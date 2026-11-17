"""Turn the raw datasets into the manifest files train.py consumes.

A manifest is a CSV with three columns: path,label,split  (split is train/val/test).

Two subcommands:

  disease  PlantVillage colour images + the dataset authors' official train/test lists.
  pest     IP102 parquet shards, regrouped (see pest_groups.py), plus a "no_pest" class
           sampled from PlantVillage so leaves without insects have a class of their own.

Nothing here downloads anything; see training/README.md for where the data comes from.
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import random
from collections import Counter, defaultdict
from pathlib import Path

from PIL import Image

from pest_groups import NO_PEST_LABEL, ip102_to_group

SEED = 42


def write_manifest(rows: list[tuple[str, str, str]], out: Path) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["path", "label", "split"])
        w.writerows(rows)
    counts: dict[str, Counter] = defaultdict(Counter)
    for _, label, split in rows:
        counts[split][label] += 1
    for split in ("train", "val", "test"):
        c = counts[split]
        print(f"  {split:5s} {sum(c.values()):6d} images, {len(c)} classes")
    print(f"wrote {out}")


def read_split_list(path: Path) -> list[str]:
    """The official lists hold one relative path per line, e.g. raw/color/<class>/<file>."""
    return [ln.strip() for ln in path.read_text(encoding="utf-8").splitlines() if ln.strip()]


def plantvillage_rows(pv_root: Path, train_list: Path, test_list: Path,
                      val_fraction: float) -> list[tuple[str, str, str]]:
    rng = random.Random(SEED)
    rows: list[tuple[str, str, str]] = []
    missing = 0
    for list_path, split in ((train_list, "train"), (test_list, "test")):
        for rel in read_split_list(list_path):
            p = pv_root / rel
            if not p.is_file():
                missing += 1
                continue
            label = Path(rel).parent.name
            s = split
            if split == "train" and rng.random() < val_fraction:
                s = "val"
            rows.append((str(p), label, s))
    if missing:
        print(f"  warning: {missing} files named in the split lists were not found on disk")
    return rows


def cmd_disease(args: argparse.Namespace) -> None:
    rows = plantvillage_rows(Path(args.pv_root), Path(args.train_list), Path(args.test_list),
                             args.val_fraction)
    write_manifest(rows, Path(args.out))


def cmd_pest(args: argparse.Namespace) -> None:
    import pyarrow.parquet as pq  # only needed for this subcommand

    out_dir = Path(args.image_dir)
    mapping = ip102_to_group()
    rng = random.Random(SEED)
    rows: list[tuple[str, str, str]] = []
    skipped = Counter()

    shards = sorted(Path(args.parquet_dir).glob("*.parquet"))
    if not shards:
        raise SystemExit(f"no parquet files in {args.parquet_dir}")

    names: list[str] | None = None
    for shard in shards:
        pf = pq.ParquetFile(shard)
        if names is None:
            meta = json.loads(pf.schema_arrow.metadata[b"huggingface"])
            names = meta["info"]["features"]["label"]["names"]
        for batch in pf.iter_batches(batch_size=256, columns=["image", "label", "split"]):
            for image, label, split in zip(batch.column("image").to_pylist(),
                                           batch.column("label").to_pylist(),
                                           batch.column("split").to_pylist()):
                group = mapping.get(names[label])
                if group is None:
                    skipped["class not in any group"] += 1
                    continue
                idx = len(rows)
                dest = out_dir / group / f"{idx:06d}.jpg"
                if not dest.exists():
                    try:
                        im = Image.open(io.BytesIO(image["bytes"])).convert("RGB")
                    except Exception:  # a handful of files in IP102 are truncated
                        skipped["unreadable image"] += 1
                        continue
                    # Shrink once here so training does not decode multi-megapixel
                    # photos every epoch. 288 leaves room for a random 224 crop.
                    w, h = im.size
                    scale = 288 / min(w, h)
                    if scale < 1:
                        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))),
                                       Image.LANCZOS)
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    im.save(dest, "JPEG", quality=90)
                split = {"validation": "val", "valid": "val"}.get(split, split)
                if split not in ("train", "val", "test"):
                    split = rng.choices(["train", "val", "test"], [0.8, 0.1, 0.1])[0]
                rows.append((str(dest), group, split))
        print(f"  {shard.name}: {len(rows)} images kept so far")

    # no_pest: plain leaves from PlantVillage, spread evenly over its 38 classes.
    if args.pv_root:
        pv = plantvillage_rows(Path(args.pv_root), Path(args.train_list), Path(args.test_list),
                               val_fraction=0.1)
        by_split: dict[str, list[str]] = defaultdict(list)
        for path, _, split in pv:
            by_split[split].append(path)
        for split, n in (("train", args.no_pest_train), ("val", args.no_pest_train // 8),
                         ("test", args.no_pest_train // 5)):
            paths = sorted(by_split[split])
            rng.shuffle(paths)
            rows.extend((p, NO_PEST_LABEL, split) for p in paths[:n])

    for reason, n in skipped.items():
        print(f"  skipped {n}: {reason}")
    write_manifest(rows, Path(args.out))


def cmd_produce(args: argparse.Namespace) -> None:
    """FruitNet (Indian fruits, Good / Mixed / Bad quality) -> labels "<Fruit>__<Quality>".

    The dataset has no official split, so a seeded 80/10/10 split is made per class.
    """
    import pyarrow.parquet as pq

    out_dir = Path(args.image_dir)
    shards = sorted(Path(args.parquet_dir).glob("*.parquet"))
    if not shards:
        raise SystemExit(f"no parquet files in {args.parquet_dir}")

    first = pq.ParquetFile(shards[0])
    features = json.loads(first.schema_arrow.metadata[b"huggingface"])["info"]["features"]
    label_cols = {k: v["names"] for k, v in features.items() if isinstance(v, dict) and "names" in v}
    quality_col = next(k for k, names in label_cols.items() if set(names) >= {"Good", "Bad"})
    fruit_col = next(k for k in label_cols if k != quality_col)
    print(f"  quality column: {quality_col} {label_cols[quality_col]}")
    print(f"  fruit column:   {fruit_col} {label_cols[fruit_col]}")

    by_class: dict[str, list[str]] = defaultdict(list)
    skipped = Counter()
    idx = 0
    for shard in shards:
        pf = pq.ParquetFile(shard)
        for batch in pf.iter_batches(batch_size=128, columns=["image", quality_col, fruit_col]):
            for image, q, f in zip(batch.column("image").to_pylist(), batch.column(quality_col).to_pylist(),
                                   batch.column(fruit_col).to_pylist()):
                fruit = label_cols[fruit_col][f]
                # FruitNet has lemon only as "Mixed" and lime only as "Good"/"Bad"; the two look
                # alike in photos, so they are merged rather than letting the model learn
                # "lemon means mixed quality".
                fruit = "Lemon" if fruit in ("Lemon", "Lime") else fruit
                label = f"{fruit}__{label_cols[quality_col][q]}"
                dest = out_dir / label / f"{idx:06d}.jpg"
                idx += 1
                if not dest.exists():
                    try:
                        im = Image.open(io.BytesIO(image["bytes"])).convert("RGB")
                    except Exception:
                        skipped["unreadable image"] += 1
                        continue
                    w, h = im.size
                    scale = 288 / min(w, h)
                    if scale < 1:
                        im = im.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
                    dest.parent.mkdir(parents=True, exist_ok=True)
                    im.save(dest, "JPEG", quality=90)
                by_class[label].append(str(dest))
        print(f"  {shard.name}: {idx} images so far")

    rng = random.Random(SEED)
    rows: list[tuple[str, str, str]] = []
    for label, paths in sorted(by_class.items()):
        paths.sort()
        rng.shuffle(paths)
        n_test = max(1, round(len(paths) * 0.1))
        n_val = max(1, round(len(paths) * 0.1))
        for i, p in enumerate(paths):
            split = "test" if i < n_test else "val" if i < n_test + n_val else "train"
            rows.append((p, label, split))
    for reason, n in skipped.items():
        print(f"  skipped {n}: {reason}")
    write_manifest(rows, Path(args.out))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("disease")
    d.add_argument("--pv-root", required=True, help="folder that contains raw/color/")
    d.add_argument("--train-list", required=True)
    d.add_argument("--test-list", required=True)
    d.add_argument("--val-fraction", type=float, default=0.1)
    d.add_argument("--out", required=True)
    d.set_defaults(func=cmd_disease)

    p = sub.add_parser("pest")
    p.add_argument("--parquet-dir", required=True)
    p.add_argument("--image-dir", required=True, help="where the resized JPEGs are written")
    p.add_argument("--pv-root", help="PlantVillage root, used for the no_pest class")
    p.add_argument("--train-list")
    p.add_argument("--test-list")
    p.add_argument("--no-pest-train", type=int, default=1500)
    p.add_argument("--out", required=True)
    p.set_defaults(func=cmd_pest)

    f = sub.add_parser("produce")
    f.add_argument("--parquet-dir", required=True)
    f.add_argument("--image-dir", required=True)
    f.add_argument("--out", required=True)
    f.set_defaults(func=cmd_produce)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
