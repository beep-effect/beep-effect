#!/usr/bin/env python3
"""Freeze Python character facts and focused canonical resolver text behavior."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import unicodedata

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
PUNCT = ["Smith", "Smith,", "'Smith'", '"Smith"', "``Smith''", ' ["Smith"] ', "Smith...", "Smith.",
         "Smith.)  ", "Smith?!", "A' B", "A'' B", "A--B", "A---B", "a:b;c,@#$%&d", "A.B.",
         "", ".", "...", "😀'Name'", 'a ["b"]', "\ufeffSmith\ufeff", "\x1cSmith\x85", "Smith.\x1c",
         "Smith.\ufeff", "a\nb.", "A\u2028'", "'", "''", '"', "A.\n\n"]
PINS = [
    ("case", "1", None), ("case", None, None), ("case", None, "1"), ("law", None, None),
    ("law", None, "1"), ("law", "missing", "1"), ("journal", None, "1"),
    ("case", "1", "1"), ("case", "1", "151"), ("case", "1", "152"), ("case", "10", "9"),
    ("case", "10", "at 11"), ("case", "10", "at  11"), ("case", "10", "At 11"),
    ("case", "10", "*11"), ("case", "10", "¶ 11"), ("case", "10", "11suffix"),
    ("case", "10", "11_000"), ("case", "10", ""), ("case", "-10", "nonsense"),
    ("case", "", "nonsense"), ("case", "١٢٣", "at 124"), ("case", "123", "at ١٢٤"),
    ("case", "𝟙𝟚𝟛", "𝟙𝟚𝟜"), ("case", "²", "2"), ("case", "123", "²"),
    ("case", "¹٢", "2"), ("case", "1", "\ufeff1"),
    ("case", "9" * 100, "9" * 100), ("case", "9" * 100, "1" + "0" * 100),
    ("case", "1", "9" * 4301), ("case", "0" * 4301, "1"),
    ("case", "missing", None), ("case", "missing", "100"), ("case", "1", "1" * 4300),
    ("case", str(10**100), str(10**100 + 150)),
    ("case", str(10**100), str(10**100 + 151)),
    ("case", str(10**100), str(10**100 - 1)),
]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--data-output", type=Path, required=True)
    parser.add_argument("--cases-output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle provenance mismatch")
    if sys.version_info[:3] != (3, 11, 15) or unicodedata.unidata_version != "14.0.0" or sys.get_int_max_str_digits() != 4300:
        raise SystemExit("frozen Python/Unicode/integer conversion policy mismatch")
    if os.environ.get("PYTHONHASHSEED") != "0" or sys.flags.hash_randomization != 0:
        raise SystemExit("frozen hash seed mismatch")
    sys.path.insert(0, str(root))
    from eyecite.models import FullCaseCitation, FullLawCitation, FullJournalCitation, IdCitation, CitationToken, IdToken
    from eyecite.resolve import _has_invalid_pin_cite
    from eyecite.utils import strip_punct
    digits = "".join(chr(point) for point in range(0x110000) if chr(point).isdigit())
    decimals = "".join(chr(point) for point in range(0x110000) if unicodedata.category(chr(point)) == "Nd")
    whitespace = "".join(chr(point) for point in range(0x110000) if chr(point).isspace())
    if (len(digits), len(decimals), len(whitespace)) != (788, 660, 29):
        raise SystemExit("character truth table count mismatch")
    if any(unicodedata.decimal(char) != index % 10 for index, char in enumerate(decimals)):
        raise SystemExit("decimal ordering protocol mismatch")
    data = {"unicodeVersion": "14.0.0", "digits": digits, "decimalDigits": decimals, "whitespace": whitespace}
    header = '''/**
 * Generated observable character facts from frozen Python 3.11.15 / Unicode 14.
 * No Python or Unicode implementation source is included. Maintainer producer:
 * goals/citation-extraction-engine/ops/probe-resolver-text.py
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as S from "effect/Schema";
const $I = $LawPracticeServerId.create("internal/Citation/PythonTextData");
/**
 * Frozen classification facts used by the pinned resolver's string operations.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationPythonTextData extends S.Opaque<CitationPythonTextData, { readonly brand: unique symbol }>()(
  S.Struct({ unicodeVersion: S.Literal("14.0.0"), digits: S.String, decimalDigits: S.String, whitespace: S.String }).pipe(
    $I.annoteSchema("CitationPythonTextData", { description: "Frozen Python digit/decimal/whitespace classification facts; decimal code points occur in repeating value order zero through nine." })
  )
) {}
/**
 * Generated classification data, not a runtime Python dependency.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const citationPythonTextData = CitationPythonTextData.make('''
    args.data_output.write_text(header + json.dumps(data, ensure_ascii=True, indent=2) + ");\n")
    punctuation = [{"input": value, "output": strip_punct(value)} for value in PUNCT +
                   [char + "Smith" + char for char in whitespace]]
    pin_rows = []
    for kind, page, pin in PINS:
        cls = {"case": FullCaseCitation, "law": FullLawCitation, "journal": FullJournalCitation}[kind]
        groups = {"reporter": "fixture", "volume": "1"}
        if page != "missing":
            groups["page"] = page
        full = cls(CitationToken("fixture", 0, 7, groups), index=0, groups=groups)
        short = IdCitation(IdToken("Id.", 0, 3), index=1, metadata={"pin_cite": pin})
        try:
            outcome = {"status": "value", "invalid": _has_invalid_pin_cite(full, short)}
        except (ValueError, AttributeError) as error:
            outcome = {"status": "error", "kind": type(error).__name__}
        pin_rows.append({"kind": kind, "page": page, "pin": pin, "outcome": outcome})
    digit_cases = [{"input": char, "output": True} for char in digits]
    neighbors = sorted({point for char in digits for point in (ord(char) - 1, ord(char) + 1) if 0 <= point <= 0x10ffff and not chr(point).isdigit()})
    digit_cases += [{"input": chr(point), "output": False} for point in neighbors]
    digit_cases += [{"input": value, "output": value.isdigit()} for value in ["", "12", "١2", "²2", "1_2", "1 2", "-1", "\U0001e4f0"]]
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed")
    result = {"schemaVersion": "citation-resolver-text-cases/v1", "oracleCommit": PIN, "oracleTree": TREE,
              "producerSha256": sha(Path(__file__).read_bytes()), "licenseSha256": sha((root / "LICENSE").read_bytes()),
              "lockSha256": sha((root / "uv.lock").read_bytes()), "pythonVersion": "3.11.15", "unicodeVersion": "14.0.0",
              "integerMaxDigits": 4300, "characterFacts": data, "punctuation": punctuation, "pins": pin_rows, "digits": digit_cases,
              "scope": "Focused resolver text helpers only; no complete resolver or extraction proof."}
    args.cases_output.write_text(json.dumps(result, ensure_ascii=True, indent=2) + "\n")
    print(f"Captured {len(punctuation)} punctuation, {len(pin_rows)} pin and {len(digit_cases)} digit observations")


if __name__ == "__main__":
    main()
