#!/usr/bin/env python3
"""Observe pinned native Unicode layouts and every boundary in short input products.

Native layout adapts CPython PyASCIIObject/PyCompactUnicodeObject, PSF-2.0;
see THIRD_PARTY_NOTICES.md. No target preparation code is used here.
"""
import argparse
import ctypes
import hashlib
import itertools
import json
import os
from pathlib import Path
import subprocess
import sys
import sysconfig

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) != (PIN, TREE, ""):
        raise SystemExit("oracle provenance mismatch")
    if sys.implementation.name != "cpython" or sys.version_info[:3] != (3, 11, 15) or sys.byteorder != "little":
        raise SystemExit("native runtime mismatch")
    if os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization:
        raise SystemExit("hash seed mismatch")
    header = Path(sysconfig.get_path("include")) / "cpython/unicodeobject.h"
    class Ascii(ctypes.Structure):
        _fields_ = [("refcount", ctypes.c_ssize_t), ("type", ctypes.c_void_p), ("length", ctypes.c_ssize_t),
                    ("hash", ctypes.c_ssize_t), ("state", ctypes.c_uint), ("wstr", ctypes.c_void_p)]
    class Compact(ctypes.Structure):
        _fields_ = Ascii._fields_ + [("utf8_length", ctypes.c_ssize_t), ("utf8", ctypes.c_void_p), ("wstr_length", ctypes.c_ssize_t)]
    if (ctypes.sizeof(Ascii), ctypes.sizeof(Compact), Ascii.state.offset) != (48, 72, 32):
        raise SystemExit("native ABI mismatch")
    def storage(text):
        record = Ascii.from_address(id(text))
        width = (record.state >> 2) & 7
        if not ((record.state >> 5) & 1) or width not in (1, 2, 4) or record.length != len(text):
            raise ValueError("unexpected native string")
        offset = ctypes.sizeof(Ascii) if (record.state >> 6) & 1 else ctypes.sizeof(Compact)
        native = ctypes.string_at(id(text) + offset, len(text) * width)
        if native != b"".join(ord(char).to_bytes(width, "little") for char in text):
            raise ValueError("native content mismatch")
        return {"width": width, "nativeHex": native.hex()}
    rows = []
    projections = 0
    for length in range(4):
        for points in itertools.product((0x41, 0xe9, 0x100, 0xd835, 0xdfce, 0x1d7ce), repeat=length):
            text = "".join(chr(point) for point in points)
            utf16 = text.encode("utf-16-le", "surrogatepass")
            units = [int.from_bytes(utf16[index:index + 2], "little") for index in range(0, len(utf16), 2)]
            prefix = [0]
            for char in text:
                prefix.append(prefix[-1] + len(char.encode("utf-16-le", "surrogatepass")) // 2)
            boundaries = [not (0 < offset < len(units) and 0xd800 <= units[offset - 1] <= 0xdbff and
                              0xdc00 <= units[offset] <= 0xdfff) for offset in prefix]
            projected = utf16.decode("utf-16-le", "surrogatepass")
            rows.append({"points": list(points), "storage": storage(text), "pythonLength": len(text),
                         "utf16Units": len(units), "prefix": prefix, "boundaries": boundaries,
                         "projectionAmbiguous": not all(boundaries), "text": projected,
                         "rawStorage": storage(projected), "rawPythonLength": len(projected)})
            projections += (len(text) + 1) * (len(text) + 2) // 2
    if len(rows) != 259:
        raise SystemExit("product coverage mismatch")
    result = {"schemaVersion": "citation-regex-input/v1", "oracleCommit": PIN, "oracleTree": TREE,
              "pythonVersion": "3.11.15", "unicodeHeaderSha256": sha(header.read_bytes()),
              "licenseSha256": sha((root / "LICENSE").read_bytes()), "lockSha256": sha((root / "uv.lock").read_bytes()),
              "producerSha256": sha(Path(__file__).read_bytes()), "cases": rows, "projectionCases": projections,
              "scope": "Native observed storage and unverified projection boundaries only; no regex-worker, matching or verified-span proof."}
    args.output.write_text(json.dumps(result, ensure_ascii=True, indent=2) + "\n")
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed")
    print(json.dumps({"cases": len(rows), "projectionCases": projections,
                      "ambiguous": sum(row["projectionAmbiguous"] for row in rows)}))


if __name__ == "__main__":
    main()
