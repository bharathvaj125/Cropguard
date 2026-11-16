"""Fine-tune an ImageNet-pretrained MobileNetV3-Large on a manifest and export it to ONNX.

    python train.py --manifest disease.csv --out ../models/disease --name disease

What it does, in order:
  1. warm-up: backbone frozen, only the new classification head trains
  2. fine-tune: every layer trains, cosine learning-rate schedule
  3. the epoch with the best validation accuracy is kept
  4. a softmax temperature is fitted on the validation set so the confidence the app
     shows is calibrated (label smoothing on its own makes the model under-confident)
  5. the held-out test split is scored once and the numbers are written to metrics.json
  6. the model is exported to ONNX with input normalisation baked in, and the ONNX
     output is checked against PyTorch

Runs on CPU. The serving container never imports PyTorch; it only needs the .onnx file.
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import time
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from PIL import Image
from torch.utils.data import DataLoader, Dataset
from torchvision import models, transforms

IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)
INPUT_SIZE = 224
RESIZE_TO = 256


class ManifestDataset(Dataset):
    def __init__(self, items: list[tuple[str, int]], transform):
        self.items = items
        self.transform = transform

    def __len__(self) -> int:
        return len(self.items)

    def __getitem__(self, i: int):
        path, label = self.items[i]
        with Image.open(path) as im:
            im = im.convert("RGB")
        return self.transform(im), label


class NormalisedModel(nn.Module):
    """Wraps the network so the exported graph takes plain 0..1 RGB and returns logits."""

    def __init__(self, net: nn.Module):
        super().__init__()
        self.net = net
        self.register_buffer("mean", torch.tensor(IMAGENET_MEAN).view(1, 3, 1, 1))
        self.register_buffer("std", torch.tensor(IMAGENET_STD).view(1, 3, 1, 1))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net((x - self.mean) / self.std)


def load_manifest(path: Path, max_per_class: int | None, seed: int):
    by_split: dict[str, list[tuple[str, str]]] = defaultdict(list)
    with path.open(newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            by_split[row["split"]].append((row["path"], row["label"]))
    labels = sorted({label for rows in by_split.values() for _, label in rows})
    index = {label: i for i, label in enumerate(labels)}

    train = by_split["train"]
    if max_per_class:
        rng = random.Random(seed)
        per_class: dict[str, list[tuple[str, str]]] = defaultdict(list)
        for item in train:
            per_class[item[1]].append(item)
        train = []
        for label in labels:
            rows = per_class[label]
            rng.shuffle(rows)
            train.extend(rows[:max_per_class])

    def enc(rows):
        return [(p, index[label]) for p, label in rows]

    return labels, enc(train), enc(by_split["val"]), enc(by_split["test"])


def build_model(num_classes: int) -> nn.Module:
    net = models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.IMAGENET1K_V2)
    in_features = net.classifier[-1].in_features
    net.classifier[-1] = nn.Linear(in_features, num_classes)
    return NormalisedModel(net)


@torch.no_grad()
def collect_logits(model: nn.Module, loader: DataLoader) -> tuple[torch.Tensor, torch.Tensor]:
    model.eval()
    logits, targets = [], []
    for x, y in loader:
        logits.append(model(x.contiguous(memory_format=torch.channels_last)))
        targets.append(y)
    return torch.cat(logits), torch.cat(targets)


def fit_temperature(logits: torch.Tensor, targets: torch.Tensor) -> float:
    """Single-parameter temperature scaling (Guo et al., 2017)."""
    log_t = torch.zeros(1, requires_grad=True)
    opt = torch.optim.LBFGS([log_t], lr=0.1, max_iter=100)

    def closure():
        opt.zero_grad()
        loss = F.cross_entropy(logits / log_t.exp(), targets)
        loss.backward()
        return loss

    opt.step(closure)
    return float(log_t.exp().item())


def expected_calibration_error(probs: torch.Tensor, targets: torch.Tensor, bins: int = 15) -> float:
    conf, pred = probs.max(dim=1)
    correct = pred.eq(targets).float()
    edges = torch.linspace(0, 1, bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        mask = (conf > lo) & (conf <= hi)
        if mask.any():
            ece += mask.float().mean().item() * abs(correct[mask].mean().item() - conf[mask].mean().item())
    return ece


def classification_report(logits: torch.Tensor, targets: torch.Tensor, labels: list[str],
                          temperature: float) -> dict:
    probs = F.softmax(logits / temperature, dim=1)
    pred = probs.argmax(dim=1)
    n = len(labels)
    cm = torch.zeros(n, n, dtype=torch.long)
    for t, p in zip(targets.tolist(), pred.tolist()):
        cm[t, p] += 1
    tp = cm.diag().float()
    support = cm.sum(dim=1).float()
    predicted = cm.sum(dim=0).float()
    precision = torch.where(predicted > 0, tp / predicted.clamp(min=1), torch.zeros(n))
    recall = torch.where(support > 0, tp / support.clamp(min=1), torch.zeros(n))
    f1 = torch.where(precision + recall > 0, 2 * precision * recall / (precision + recall).clamp(min=1e-9),
                     torch.zeros(n))
    top3 = logits.topk(min(3, n), dim=1).indices.eq(targets.unsqueeze(1)).any(dim=1).float().mean().item()
    return {
        "samples": int(targets.numel()),
        "accuracy": round(pred.eq(targets).float().mean().item(), 4),
        "top3_accuracy": round(top3, 4),
        "macro_precision": round(precision.mean().item(), 4),
        "macro_recall": round(recall.mean().item(), 4),
        "macro_f1": round(f1.mean().item(), 4),
        "expected_calibration_error": round(expected_calibration_error(probs, targets), 4),
        "per_class": [
            {"label": labels[i], "precision": round(precision[i].item(), 4),
             "recall": round(recall[i].item(), 4), "f1": round(f1[i].item(), 4),
             "support": int(support[i].item())}
            for i in range(n)
        ],
        "confusion_matrix": cm.tolist(),
    }


def export_onnx(model: nn.Module, path: Path) -> float:
    """Export and return the largest absolute difference between ONNX and PyTorch logits."""
    import onnxruntime as ort

    model.eval()
    model = model.to(memory_format=torch.contiguous_format)
    dummy = torch.rand(2, 3, INPUT_SIZE, INPUT_SIZE)
    torch.onnx.export(
        model, (dummy,), str(path),
        input_names=["image"], output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=17, dynamo=False,
    )
    sess = ort.InferenceSession(str(path), providers=["CPUExecutionProvider"])
    x = torch.rand(5, 3, INPUT_SIZE, INPUT_SIZE)
    with torch.no_grad():
        ref = model(x).numpy()
    out = sess.run(None, {"image": x.numpy()})[0]
    return float(np.abs(ref - out).max())


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--out", required=True, help="output folder for model.onnx, labels.json, metrics.json")
    ap.add_argument("--name", required=True, help="model name stored in the metadata, e.g. disease")
    ap.add_argument("--dataset", default="", help="free-text dataset description for metrics.json")
    ap.add_argument("--epochs", type=int, default=4, help="fine-tuning epochs after the warm-up epoch")
    ap.add_argument("--batch-size", type=int, default=64)
    ap.add_argument("--lr", type=float, default=5e-4)
    ap.add_argument("--max-per-class", type=int, default=None, help="cap on training images per class")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--threads", type=int, default=8)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    torch.manual_seed(args.seed)
    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.set_num_threads(args.threads)

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    labels, train_items, val_items, test_items = load_manifest(Path(args.manifest), args.max_per_class, args.seed)
    print(f"{len(labels)} classes | train {len(train_items)} | val {len(val_items)} | test {len(test_items)}",
          flush=True)

    train_tf = transforms.Compose([
        transforms.RandomResizedCrop(INPUT_SIZE, scale=(0.55, 1.0), ratio=(0.8, 1.25)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(),
        transforms.RandomRotation(20),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.3, hue=0.03),
        transforms.RandomApply([transforms.GaussianBlur(5, sigma=(0.1, 1.5))], p=0.2),
        transforms.ToTensor(),
    ])
    # Must match app/preprocessing.py in the serving code.
    eval_tf = transforms.Compose([
        transforms.Resize(RESIZE_TO),
        transforms.CenterCrop(INPUT_SIZE),
        transforms.ToTensor(),
    ])

    def loader(items, tf, shuffle):
        return DataLoader(ManifestDataset(items, tf), batch_size=args.batch_size, shuffle=shuffle,
                          num_workers=args.workers, persistent_workers=args.workers > 0,
                          drop_last=shuffle)

    train_loader = loader(train_items, train_tf, True)
    val_loader = loader(val_items, eval_tf, False)
    test_loader = loader(test_items, eval_tf, False)

    model = build_model(len(labels)).to(memory_format=torch.channels_last)

    # Inverse-frequency class weights, softened with a square root, so rare classes
    # are not ignored but the common ones are not thrown away either.
    counts = Counter(label for _, label in train_items)
    weights = torch.tensor([1.0 / math.sqrt(counts[i]) for i in range(len(labels))])
    weights = weights / weights.mean()
    criterion = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.1)

    history = []
    best_acc, best_state = -1.0, None
    steps_per_epoch = len(train_loader)

    def run_epoch(epoch: int, optimiser, scheduler, backbone_frozen: bool) -> float:
        model.train()
        if backbone_frozen:
            model.net.features.eval()  # keep batch-norm statistics from ImageNet
        t0 = time.time()
        total, seen = 0.0, 0
        for step, (x, y) in enumerate(train_loader):
            x = x.contiguous(memory_format=torch.channels_last)
            optimiser.zero_grad(set_to_none=True)
            loss = criterion(model(x), y)
            loss.backward()
            optimiser.step()
            if scheduler:
                scheduler.step()
            total += loss.item() * x.size(0)
            seen += x.size(0)
            if step % 50 == 0:
                rate = seen / max(time.time() - t0, 1e-6)
                print(f"  epoch {epoch} step {step}/{steps_per_epoch} loss {loss.item():.3f} "
                      f"{rate:.0f} img/s", flush=True)
        return total / max(seen, 1)

    def validate(epoch: int, phase: str, train_loss: float, started: float):
        nonlocal best_acc, best_state
        logits, targets = collect_logits(model, val_loader)
        acc = logits.argmax(1).eq(targets).float().mean().item()
        history.append({"epoch": epoch, "phase": phase, "train_loss": round(train_loss, 4),
                        "val_accuracy": round(acc, 4), "seconds": round(time.time() - started)})
        print(f"epoch {epoch} [{phase}] train_loss {train_loss:.4f} val_acc {acc:.4f} "
              f"({time.time() - started:.0f}s)", flush=True)
        if acc > best_acc:
            best_acc = acc
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
            torch.save(best_state, out / "checkpoint.pt")

    # 1. warm-up: head only
    for p in model.net.features.parameters():
        p.requires_grad = False
    opt = torch.optim.AdamW(model.net.classifier.parameters(), lr=2e-3, weight_decay=1e-4)
    t0 = time.time()
    validate(0, "warmup", run_epoch(0, opt, None, backbone_frozen=True), t0)

    # 2. fine-tune everything
    for p in model.parameters():
        p.requires_grad = True
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=args.lr, total_steps=args.epochs * steps_per_epoch,
                                                pct_start=0.15)
    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        validate(epoch, "finetune", run_epoch(epoch, opt, sched, backbone_frozen=False), t0)

    # 3-5. best weights, calibration, test score
    model.load_state_dict(best_state)
    val_logits, val_targets = collect_logits(model, val_loader)
    temperature = fit_temperature(val_logits, val_targets)
    test_logits, test_targets = collect_logits(model, test_loader)
    report = classification_report(test_logits, test_targets, labels, temperature)
    uncalibrated = classification_report(test_logits, test_targets, labels, 1.0)
    print(f"test accuracy {report['accuracy']:.4f} | top-3 {report['top3_accuracy']:.4f} | "
          f"macro-F1 {report['macro_f1']:.4f} | temperature {temperature:.3f}", flush=True)

    # 6. export
    max_diff = export_onnx(model, out / "model.onnx")
    print(f"ONNX export checked, max |onnx - torch| = {max_diff:.2e}", flush=True)

    (out / "labels.json").write_text(json.dumps(labels, indent=2), encoding="utf-8")
    (out / "metrics.json").write_text(json.dumps({
        "name": args.name,
        "architecture": "MobileNetV3-Large (ImageNet-1k pretrained, fully fine-tuned)",
        "framework": f"PyTorch {torch.__version__}, exported to ONNX opset 17",
        "dataset": args.dataset,
        "trained_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "input": {"size": INPUT_SIZE, "resize_to": RESIZE_TO, "range": "0..1 RGB, normalisation inside the graph"},
        "num_classes": len(labels),
        "split_sizes": {"train": len(train_items), "val": len(val_items), "test": len(test_items)},
        "train_class_counts": {labels[i]: counts[i] for i in range(len(labels))},
        "hyperparameters": {"epochs": args.epochs, "warmup_epochs": 1, "batch_size": args.batch_size,
                            "lr": args.lr, "label_smoothing": 0.1, "max_per_class": args.max_per_class,
                            "seed": args.seed},
        "temperature": round(temperature, 4),
        "best_val_accuracy": round(best_acc, 4),
        "history": history,
        "test": report,
        "test_ece_before_calibration": uncalibrated["expected_calibration_error"],
        "onnx_max_abs_diff": max_diff,
    }, indent=2), encoding="utf-8")
    print(f"saved {out / 'model.onnx'}", flush=True)


if __name__ == "__main__":
    main()
