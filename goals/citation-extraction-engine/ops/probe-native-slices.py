#!/usr/bin/env python3
"""Observe compact native Python substring values and exact receiving sizes."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def native(text):
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--oracle-root", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    def git(*xs):
        return subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("requires clean exact oracle")
    if sys.version_info[:3] != (3, 11, 15):
        raise SystemExit("requires pinned Python")
    path = Path(__file__).resolve().parents[3] / "packages/law-practice/use-cases/test/fixtures/eyecite/token-text.json"
    source_bytes = path.read_bytes()
    source_sha = hashlib.sha256(source_bytes).hexdigest()
    assert source_sha == "f50330d18ec0566fb7ebd04add831da401ade8f054a5aef0ffc88c321721508a"
    ranges = json.loads(source_bytes)["ranges"]
    text = "a\u0100b c"
    ranges += [{"source": native(text), "start": start, "end": end} for start in range(len(text) + 1) for end in range(start, len(text) + 1)]
    cases = []
    for row in ranges:
        width = row["source"]["width"]
        raw = bytes.fromhex(row["source"]["bytes"])
        text = "".join(chr(int.from_bytes(raw[i:i + width], "little")) for i in range(0, len(raw), width))
        value = text[row["start"]:row["end"]]
        expected = native(value)
        cases.append({"id": len(cases), "source": row["source"], "start": row["start"], "end": row["end"], "expected": expected,
                      "layout": {"width": expected["width"], "pythonLength": len(value), "utf16Units": sum(2 if ord(c) > 65535 else 1 for c in value), "byteLength": len(bytes.fromhex(expected["bytes"]))}})
    out = {"schemaVersion": "citation-native-slices/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15",
           "producerSha256": hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), "rangeSourceSha256": source_sha, "cases": cases}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(cases)}))


if __name__ == "__main__":
    main()
