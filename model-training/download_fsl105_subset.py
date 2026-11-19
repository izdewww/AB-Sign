"""Download FSL-105 clips used by the starter curriculum from their original ZIP ranges."""
import csv
import json
import subprocess
from concurrent.futures import ThreadPoolExecutor
from zipfile import ZipFile

from train_vocabulary import IDS, SOURCE, ZIP_HASH, digest

manifest = json.loads((SOURCE / "files.json").read_text(encoding="utf-8-sig"))
entry = next(item for item in manifest if item["filename"] == "clips.zip")
size = entry["size"]
url = entry["content_details"]["download_url"]
if entry["content_details"]["sha256_hash"] != ZIP_HASH or not url.startswith("https://data.mendeley.com/public-files/datasets/48y2y99mb9/"):
    raise ValueError("Unexpected archive manifest")


def request(start, end, name):
    target = SOURCE / name
    header = target.with_suffix(".headers")
    expected = f"bytes {start}-{end}/{size}"
    if target.is_file() and target.stat().st_size == end-start+1 and header.is_file() and expected in header.read_text().lower():
        return start, target
    subprocess.run(["curl.exe", "-fsS", "-L", "--max-time", "80", "--retry", "2",
                    "-r", f"{start}-{end}", "-D", str(header), "-o", str(target), url], check=True)
    if target.stat().st_size != end-start+1 or expected not in header.read_text().lower():
        raise ValueError("The server returned a different byte range")
    return start, target


def download():
    tail_offset, tail = request(size - 262144, size - 1, "central.zip.part")
    sparse = SOURCE / "fsl105-selected-source.zip"
    with sparse.open("wb") as out:
        out.seek(tail_offset)
        out.write(tail.read_bytes())
    needed = set()
    for split in ("train", "test"):
        with (SOURCE / (split + ".csv")).open(encoding="utf-8-sig", newline="") as file:
            needed.update(row["vid_path"].replace("\\", "/").lower() for row in csv.DictReader(file) if row["id_label"] in IDS)
    with ZipFile(sparse) as zipfile:
        entries = sorted(zipfile.infolist(), key=lambda item: item.header_offset)
        ranges = []
        found = set()
        for i, item in enumerate(entries):
            canonical = item.filename.lower().replace("\\", "/")
            if canonical not in needed:
                continue
            found.add(canonical)
            end = (entries[i+1].header_offset if i+1 < len(entries) else zipfile.start_dir) - 1
            if ranges and item.header_offset <= ranges[-1][1] + 256 and end - ranges[-1][0] < 3 * 1024 * 1024:
                ranges[-1] = (ranges[-1][0], end)
            else:
                ranges.append((item.header_offset, end))
    if needed != found:
        raise ValueError(f"Could not find {len(needed - found)} declared clips in the archive")
    print(f"Downloading {len(needed)} clips in {len(ranges)} ranges ({sum(end-start+1 for start,end in ranges):,} bytes).", flush=True)
    with ThreadPoolExecutor(max_workers=12) as pool, sparse.open("r+b") as out:
        jobs = [pool.submit(request, start, end, f"range-{start}.part") for start, end in ranges]
        for i, future in enumerate(jobs, 1):
            start, file = future.result()
            out.seek(start)
            out.write(file.read_bytes())
            if i % 10 == 0:
                print("Downloaded ranges", i, "/", len(ranges), flush=True)
    published = SOURCE / "manifest-clips.json"
    with ZipFile(sparse) as zipfile:
        for entry in zipfile.infolist():
            if entry.filename.lower().replace("\\", "/") in needed:
                zipfile.read(entry)  # CRC check for every downloaded clip.
    published.write_text(json.dumps({"archive_sha256": ZIP_HASH, "subset_sha256": digest(sparse), "clips": len(needed)}, indent=2))
    print("Verified extracted clips:", len(needed), flush=True)


if __name__ == "__main__":
    download()
