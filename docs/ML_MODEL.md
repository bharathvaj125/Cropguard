# ML models

CropGuard uses three image classifiers. All are **MobileNetV3-Large** networks pretrained on ImageNet-1k and
fully fine-tuned with PyTorch, then exported to ONNX for serving.

| | Disease model | Pest model |
|---|---|---|
| Task | Identify crop and disease from a leaf photo | Identify the insect or mite pest in a photo |
| Dataset | PlantVillage, colour images | IP102, regrouped |
| Classes | 38 (26 diseases + 12 healthy, 14 crops) | 26 (25 pest groups + `no_pest`) |
| Train / val / test images | 19,693 / 4,353 / 10,709 | 25,457 / 6,845 / 20,343 |
| **Test top-1 accuracy** | **99.08%** | **82.22%** |
| Test top-3 accuracy | 99.95% | 92.67% |
| Test macro F1 | 0.991 | 0.814 |
| Calibration error (ECE), before → after temperature scaling | 11.2% → 0.3% | 9.2% → 0.9% |
| Model size | 17 MB | 17 MB |

### Produce quality model (FruitNet)

| | Produce model |
|---|---|
| Task | Fruit type and quality of a photographed lot -> Grade A (Good), B (Mixed), C (Bad) |
| Dataset | FruitNet: Indian fruits of different quality (Meshram & Patil, 2022), CC BY 4.0, via Project AgML |
| Classes | 18: apple, banana, guava, lemon/lime, orange, pomegranate x Good / Mixed / Bad |
| Train / val / test images | 9,262 (capped at 700 per class) / 1,951 / 1,951, seeded 80/10/10 split per class |
| **Test top-1 accuracy** | **99.85%** (grade alone: 99.85%; fruit alone: 100%) |
| Test macro F1 | 0.996 (weakest class: Orange Mixed, F1 0.96, only 12 test photos) |
| Calibration error (ECE) | 12.4% -> 0.2% |

Two dataset quirks were handled before training. Lemon appears only as "Mixed" and lime only as "Good" or "Bad",
which would teach a model that lemons are always mixed quality; the two look alike in photos, so they are merged into
one class. "Mixed" photos are rare (113-285 per fruit against ~1,100 for the others); class weighting compensates.

**Near-duplicate check.** FruitNet contains many photos of the same lots and has no official split, so a random
split leaks look-alike photos between training and test. A 16x16 difference hash found a near-identical training
photo for 1,000 of the 1,951 test photos (143 exact duplicates). The model was therefore also scored on test photos
with no look-alike in training: 99.7% on 951 photos (hash distance > 20 of 256 bits) and 99.8% on 528 photos
(distance > 60). The score is not an artefact of leakage, but FruitNet photos are clean close-ups of a few fruits
on plain backgrounds, so, as with PlantVillage, real mandi photos will be harder. The check is recorded in
`ml-service/models/produce/metrics.json`.

The backend uses the model only for these six fruits. Other produce is graded by Claude vision when it is
configured, and otherwise by a basic colour check that is labelled as such and capped at 40% confidence.

Exact figures, per-class precision / recall / F1 and the full confusion matrix are in
`ml-service/models/<name>/metrics.json` and are shown in the admin panel.

## Datasets

### PlantVillage (disease)

54,305 leaf photos of 14 crops (apple, blueberry, cherry, corn, grape, orange, peach, bell pepper, potato,
raspberry, soybean, squash, strawberry, tomato), taken in controlled conditions on a plain background.
Source: Hughes & Salathé (2015); Mohanty, Hughes & Salathé (2016), *Frontiers in Plant Science*. Licence CC BY-SA 3.0.

The dataset authors' **official train/test split** (`splits/color_train.txt`, `color_test.txt`) is used, so the
test figures are comparable with published work and no near-duplicate photo of the same leaf can leak between
training and test. 10% of the training list is held back for validation. Training was capped at 600 images per
class (19,693 in total), which was enough to reach 99% while keeping CPU training to about an hour.

### IP102 (pests)

75,222 images of 102 insect pest species of field crops, from Wu et al. (2019), *IP102: A Large-Scale Benchmark
Dataset for Insect Pest Recognition*, CVPR, as packaged on Hugging Face by Project AgML (CC BY 4.0).

102 species is finer than a farmer needs (three different cutworms, eight different aphids) and many species
have very few images. 74 species were merged into **25 groups that share the same management advice** (aphids,
planthoppers, stem borers, armyworms, whiteflies, thrips, spider mites, …). The other 28 species (8,541 images),
which did not fit any shared-advice group, were left out. The mapping is in `training/pest_groups.py`.

A **`no_pest`** class was added from PlantVillage leaves so that a photo of a leaf with no insect has somewhere
to go other than "the least unlikely pest". The official IP102 train/val/test split is kept.

## Training (`ml-service/training/train.py`)

1. **Input pipeline.** Train: random resized crop (55–100% area) to 224, horizontal and vertical flips,
   ±20° rotation, colour jitter, occasional blur. Evaluation: resize to 256, centre crop 224, exactly as the
   serving code does (`app/preprocessing.py`). ImageNet normalisation is baked into the exported graph.
2. **Warm-up epoch.** Backbone frozen (its batch-norm statistics too), new classification head trained with AdamW
   at lr 2e-3.
3. **Fine-tuning.** All layers trained with AdamW (weight decay 1e-4) and a one-cycle schedule, peak lr 5e-4.
   4 epochs for the disease model, 5 for the pest model.
4. **Loss.** Cross-entropy with label smoothing 0.1 and class weights ∝ 1/√(class count), so rare classes are not
   ignored without discarding data from common ones.
5. **Model selection.** The epoch with the best validation accuracy is kept. The test split is used exactly once,
   after training.
6. **Calibration.** A single temperature T is fitted on the validation set by minimising negative log-likelihood
   (Guo et al., 2017). Label smoothing makes raw softmax scores under-confident; dividing logits by T fixes it.
   The service uses T for every prediction, and the API's 60% / 55% "uncertain" thresholds rely on it.
7. **Export.** `torch.onnx.export` (opset 17, dynamic batch), then the ONNX output is compared with PyTorch on
   random inputs; the build fails if they disagree.

All training ran on a laptop CPU (Intel i7-13620H), with no GPU.

## Explainability: "Where the AI looked"

For each disease result the service builds an **occlusion map**: it hides each 56×56 region of the image in turn
(stride 28, 49 variants in one batch) and measures how much the model's evidence for its answer drops. The
evidence is the logit margin (the class's score minus the best competing score). Probability is not used, because
when the model is very sure it stays at 100% whichever patch is hidden. No gradients are needed, so this works on
the exported ONNX model. If no single region matters (largest drop < 0.25), no map is shown rather than noise.

## Known limitations

These matter, and the app is built around them.

1. **Lab photos versus field photos.** PlantVillage images show one detached leaf on a plain background in even
   light. Real field photos have several leaves, soil, shadows and hands. Published studies report large accuracy
   drops when PlantVillage-trained models meet field images. **The 99% figure is a benchmark, not a promise for
   field use.**
2. **Background shortcut.** Because every PlantVillage class was photographed in similar sessions, a model can
   pick up background cues. The heatmaps show this on some images (highlighting background around the leaf). The
   UI tells farmers to treat a result with caution when the highlight is not on the damaged tissue.
3. **Closed set.** The disease model only knows 14 crops and 26 diseases. A photo of rice, cotton or chilli will
   still be forced into one of its classes; the crop selector, the confidence threshold and the "what the AI
   knows" note reduce but do not remove this risk.
4. **Pest accuracy.** IP102 is a hard benchmark (web photos, look-alike species, cluttered backgrounds). Published
   results use all 102 species, so they are not directly comparable with this 26-class regrouping. Weakest groups: budworms and bollworms (F1 0.48, a single
   species with few images), armyworms (0.71) and rice leaf folders (0.74); caterpillars of different moths look
   alike. The model works best on a clear close-up of the insect itself, not on damage symptoms.
5. **Advice is general.** Treatment text is integrated pest and disease management guidance. Product
   registration and doses vary by country and crop; the app tells users to follow labels and local experts.

### Recommended next steps

- Collect field photos through the app (with consent), have agronomists label them through the admin review
  screen (which already records *confirmed* / *corrected* verdicts) and fine-tune on that data.
- Add field datasets such as PlantDoc for validation under real conditions.
- Add an out-of-distribution check (for example, a "not a supported leaf" class or embedding distance) before
  diagnosing.
- Move from classification to detection (for example, YOLO) so several lesions or insects in one photo are found.

## Retrain

```bash
cd ml-service
python -m venv .venv-train && .venv-train/Scripts/activate
pip install torch torchvision --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-train.txt
```

Download the data (about 4 GB in total):

```bash
# PlantVillage colour images (sparse checkout of the authors' repository) and the official split lists
git clone --filter=blob:none --sparse https://github.com/spMohanty/PlantVillage-Dataset data/pv
git -C data/pv sparse-checkout set raw/color
curl -L -o data/color_train.txt https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main/splits/color_train.txt
curl -L -o data/color_test.txt  https://huggingface.co/datasets/mohanty/PlantVillage/resolve/main/splits/color_test.txt

# IP102 parquet shards
for i in 0 1 2 3 4 5 6; do
  curl -L -o data/ip102/train-0000$i-of-00007.parquet --create-dirs \
    https://huggingface.co/datasets/Project-AgML/CT_PestNet_crop_pest_classification/resolve/main/data/train-0000$i-of-00007.parquet
done
```

Build manifests and train:

```bash
cd training
python prepare_data.py disease --pv-root ../data/pv --train-list ../data/color_train.txt \
  --test-list ../data/color_test.txt --out ../data/disease.csv
python prepare_data.py pest --parquet-dir ../data/ip102 --image-dir ../data/pest_img --pv-root ../data/pv \
  --train-list ../data/color_train.txt --test-list ../data/color_test.txt --out ../data/pest.csv

python train.py --manifest ../data/disease.csv --out ../models/disease --name disease --epochs 4 --max-per-class 600
python train.py --manifest ../data/pest.csv    --out ../models/pest    --name pest    --epochs 5 --max-per-class 1200
```

Each run writes `model.onnx`, `labels.json` and `metrics.json`. Restart the ML service to load them. If a label
is added or renamed, add its advice to `backend/src/data/diseases.js` or `pests.js`; the backend unit tests check
the knowledge base covers every class.
