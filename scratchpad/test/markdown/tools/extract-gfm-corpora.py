#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
One-off extractor for the vendored GFM conformance corpora.

Run by hand, never by CI and never by the test suite, from the repository
root:

    PYTHONDONTWRITEBYTECODE=1 python3 \
      packages/markdown/__test__/tools/extract-gfm-corpora.py

It shells out to the vendored `spec_tests.py` (`.repos/cmark-gfm/test/`) --
the same upstream tool `commonmark/spec_tests.py` used to generate
`fixtures/commonmark/spec.json` -- rather than reimplementing its example-
block scanner, so the extraction logic is exactly upstream's, not a port that
could silently diverge from it.

Two corpora are produced:

- `fixtures/gfm/spec-extensions.json`: the examples embedded in
  `.repos/cmark-gfm/test/spec.txt` whose section header ends in
  "(extension)" -- the GFM extension sections (Tables, Strikethrough,
  Autolinks, Disallowed Raw HTML). `--pattern '\\(extension\\)$'` selects
  them via `spec_tests.py`'s own section-regex filter (`get_tests`'s
  `re.search` against each example's `section` field), so no section text is
  matched by hand here.

  NOTE: `spec_tests.py`'s `get_tests` unconditionally drops any example
  block marked "example disabled" (`extensions.txt`/`spec.txt`'s own
  authoring convention for illustrative blocks excluded from conformance
  runs) before the pattern filter ever sees it. `spec.txt`'s "Task list
  items (extension)" section contains exactly two such disabled examples;
  they are consequently NOT part of this corpus, despite appearing in the
  section. See VENDORED.md for the resulting count discrepancy against the
  plan.

- `fixtures/gfm/extensions.json`: every example in
  `.repos/cmark-gfm/test/extensions.txt` (the whole file is GFM-extension
  content, so no section filter is applied) -- includes the only official
  footnote corpus.

Both dumps are reshaped to the exact field set the existing
`fixtures/commonmark/spec.json` entries carry: `markdown`, `html`, `example`,
`start_line`, `end_line`, `section`. Upstream's `--dump-tests` also emits a
per-example `extensions` array (the parsed `example <flags>` marker text);
it is dropped here since neither corpus's still-included examples carry any
non-empty flags and the commonmark fixture has no such field.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[4]
CMARK_GFM = REPO_ROOT / ".repos" / "cmark-gfm"
SPEC_TESTS = CMARK_GFM / "test" / "spec_tests.py"
FIXTURES_DIR = REPO_ROOT / "packages" / "markdown" / "__test__" / "fixtures" / "gfm"

FIELDS = ("markdown", "html", "example", "start_line", "end_line", "section")


def dump(spec_path: Path, pattern: str | None) -> list[dict]:
    args = [sys.executable, str(SPEC_TESTS), "--spec", str(spec_path)]
    if pattern is not None:
        args += ["--pattern", pattern]
    args.append("--dump-tests")
    result = subprocess.run(
        args,
        cwd=CMARK_GFM,
        env={"PYTHONDONTWRITEBYTECODE": "1"},
        capture_output=True,
        check=True,
        text=True,
    )
    raw = json.loads(result.stdout)
    return [{field: entry[field] for field in FIELDS} for entry in raw]


def write(path: Path, examples: list[dict]) -> None:
    # Two-space indent to match the existing fixtures/commonmark/spec.json
    # byte-for-byte in style (upstream's own --dump-tests default).
    path.write_text(json.dumps(examples, indent=2) + "\n", encoding="utf-8")


def summarize(label: str, examples: list[dict]) -> None:
    counts: dict[str, int] = {}
    for entry in examples:
        counts[entry["section"]] = counts.get(entry["section"], 0) + 1
    print(f"{label}: {len(examples)} examples")
    for section, count in counts.items():
        print(f"  {section}: {count}")


def main() -> None:
    FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    spec_extensions = dump(CMARK_GFM / "test" / "spec.txt", pattern=r"\(extension\)$")
    write(FIXTURES_DIR / "spec-extensions.json", spec_extensions)
    summarize("spec-extensions.json", spec_extensions)

    extensions = dump(CMARK_GFM / "test" / "extensions.txt", pattern=None)
    write(FIXTURES_DIR / "extensions.json", extensions)
    summarize("extensions.json", extensions)


if __name__ == "__main__":
    main()
