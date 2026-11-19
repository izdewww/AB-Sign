"""Regenerate the documentation PNGs with Pillow."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "images"
INK = "#17362b"
SUBTLE = "#36544a"
GREEN = "#1b7339"
PALE = "#e4f4e5"
BLUE = "#e0efff"
WHITE = "#f7faf7"


def font(size, bold=False):
    for name in (("DejaVuSans-Bold.ttf", "arialbd.ttf") if bold else ("DejaVuSans.ttf", "arial.ttf")):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default(size=size)


def canvas(height, title, subtitle):
    image = Image.new("RGB", (1200, height), WHITE)
    draw = ImageDraw.Draw(image)
    draw.text((48, 30), title, font=font(37, True), fill=INK)
    draw.text((48, 86), subtitle, font=font(21), fill=SUBTLE)
    return image, draw


def flow(draw, y, blocks, color):
    for index, (title, detail) in enumerate(blocks):
        x = 48 + index * 284
        draw.rounded_rectangle((x, y, x + 248, y + 96), radius=15, fill=color)
        draw.text((x + 16, y + 16), title, font=font(21, True), fill=INK)
        draw.text((x + 16, y + 52), detail, font=font(17), fill=SUBTLE)
        if index + 1 < len(blocks):
            center = y + 48
            draw.line((x + 255, center, x + 272, center), width=3, fill=GREEN)
            draw.polygon([(x + 279, center), (x + 270, center - 6), (x + 270, center + 6)], fill=GREEN)


image, draw = canvas(420, "Desktop architecture", "A-B Sign!  ·  local application and camera practice")
draw.text((48, 135), "DESKTOP APP", font=font(17, True), fill=GREEN)
flow(draw, 165, [
    ("Electron main", "Opens the window"), ("React renderer", "Desktop interface"),
    ("Local app files", "App protocol"), ("Vision assets", "FSL model and WASM"),
], PALE)
draw.text((48, 282), "CAMERA PRACTICE", font=font(17, True), fill=GREEN)
flow(draw, 312, [
    ("Webcam", "Video stays local"), ("Vision worker", "MediaPipe inference"),
    ("Practice feedback", "Matches the target"), ("Local progress", "Saves the outcome"),
], BLUE)
image.save(OUT / "architecture.png")

image, draw = canvas(420, "Build and model pipelines", "Desktop build and offline A–Z model preparation")
draw.text((48, 135), "WINDOWS BUILD", font=font(17, True), fill=GREEN)
flow(draw, 165, [
    ("Install", "npm ci"), ("Verify", "Type-check and build"),
    ("Launch smoke test", "Renderer and model"), ("Package", "Windows x64 ZIP"),
], PALE)
draw.text((48, 282), "MODEL TRAINING", font=font(17, True), fill=GREEN)
flow(draw, 312, [
    ("Kaggle images", "Group source variants"), ("Train", "All alphabet hand shapes"),
    ("Evaluate", "Replay saved task"), ("Bundle", "Task file and WASM"),
], BLUE)
image.save(OUT / "pipelines.png")

report = json.loads((ROOT / "model-training/artifacts/fsl-abc-v2.json").read_text())
image, draw = canvas(380, "A/B/C model results", f"Same {report['test']['images']} cropped Kaggle images  ·  accuracy with missed hands counted as errors")
rows = [
    ("v1 defaults", report["test_comparison"]["v1_defaults"], "#597c72"),
    ("v1 updated runtime", report["test_comparison"]["v1_with_v2_runtime"], GREEN),
    ("v2 updated runtime", report["test"], GREEN),
]
for index, (label, result, color) in enumerate(rows):
    y = 144 + index * 56
    accuracy = result["accuracy_including_no_hand_as_miss"]
    draw.text((48, y + 2), label, font=font(20), fill=INK)
    draw.rounded_rectangle((322, y, 1022, y + 30), radius=9, fill="#e1ebe5")
    draw.rounded_rectangle((322, y, 322 + round(700 * accuracy), y + 30), radius=9, fill=color)
    draw.text((1040, y), f"{accuracy:.1%}", font=font(24, True), fill=INK)
draw.text((48, 330), "Live webcam accuracy on independent signers remains unverified.", font=font(18), fill=SUBTLE)
image.save(OUT / "results.png")

report = json.loads((ROOT / "model-training/artifacts/fsl-geometry-v3-benchmark.json").read_text(encoding="utf-8"))
camera_rows = list(report["per_letter"].items())
correct = sum(row["correct"] for _, row in camera_rows)
images = sum(row["support"] for _, row in camera_rows)
image, draw = canvas(
    560, "Camera letter results · v3",
    f"{correct:,} of {images:,} held-out photos correct ({correct / images:.2%}) across 24 letters",
)
for index, (letter, result) in enumerate(camera_rows):
    column, row = divmod(index, 12)
    x, y = 48 + 568 * column, 138 + 30 * row
    recall = result["recall"]
    draw.text((x, y), letter, font=font(18, True), fill=INK)
    draw.rounded_rectangle((x + 30, y + 4, x + 383, y + 19), radius=7, fill="#e1ebe5")
    if recall:
        draw.rounded_rectangle((x + 30, y + 4, x + 30 + round(353 * recall), y + 19), radius=7, fill=GREEN if recall >= .9 else "#a94c27")
    draw.text((x + 398, y), f"{recall:.1%} ({result['correct']}/{result['support']})", font=font(17), fill=INK)
draw.text((48, 518), "Orange bars fell below 90%. Classroom webcam accuracy remains unverified.", font=font(18), fill=SUBTLE)
image.save(OUT / "alphabet-results.png")
