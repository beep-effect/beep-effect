#!/usr/bin/env python3
"""Execute pinned helpers.get_year across source integer conversion boundaries."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
import unicodedata

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def native(text):
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15) and unicodedata.unidata_version == "14.0.0"
    assert sys.get_int_max_str_digits() == 4300
    sys.path.insert(0, str(root))
    from eyecite import helpers
    assert importlib.metadata.version("regex") == "2023.12.25"
    words = ["", "1599", "1600", "2026", "2027", "2028", "9999", "10000", "10001", "-2000", "+2000", "-0", "+", "1_600", "_1600", "1600_", "16__00", "1_6_0_0", "16 00", "0x7d0", "2000.0", "2e3", "\ufeff2000", "\ud835\udfce2000", "\U0001d7ce2000", "\U00011f502000"]
    decimals = [chr(p) for p in range(0x110000) if chr(p).isdecimal()]
    other_digits = [chr(p) for p in range(0x110000) if chr(p).isdigit() and not chr(p).isdecimal()]
    whitespace = [chr(p) for p in range(0x110000) if chr(p).isspace()]
    assert len(decimals) == 660 and len(other_digits) == 128 and len(whitespace) == 29
    words += ["16" + c + "0" for c in decimals + other_digits]
    words += [c + "2000" for c in whitespace] + ["2000" + c for c in whitespace]
    words += [chr(c) + "2000" for c in range(128)] + ["20" + chr(c) + "00" for c in range(128)]
    words += ["0" * n + "2000" for n in (4295, 4296, 4297)]
    words += ["0_" * n + "2000" for n in (4295, 4296, 4297)]
    words += ["٩" * n for n in (4299, 4300, 4301)]
    rows = []
    # Source import-time bound is explicitly frozen per profile, rather than
    # silently claiming that a capture date is universal production behavior.
    for highest in (1600, 2026, 2027, 9999, 10000):
        helpers._highest_valid_year = highest
        selected = words if highest == 2027 else ["1599", "1600", "2026", "2027", "2028", "9999", "10000", "10001"]
        for text in selected:
            rows.append({"highest": highest, "source": native(text), "year": helpers.get_year(text)})
    sha = lambda data: hashlib.sha256(data).hexdigest()
    out = {"schemaVersion": "citation-metadata-year/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "unicode": "14.0.0",
           "producerSha256": sha(Path(__file__).read_bytes()), "helpersSha256": sha((root / "eyecite/helpers.py").read_bytes()),
           "integerDigitLimit": 4300, "decimalPoints": len(decimals), "nondecimalDigits": len(other_digits), "whitespacePoints": len(whitespace), "cases": rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(rows), "valid": sum(r["year"] is not None for r in rows)}))


if __name__ == "__main__":
    main()
