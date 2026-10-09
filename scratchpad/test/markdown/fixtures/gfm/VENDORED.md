# Vendored: GFM conformance corpora

- **Upstream:** [github/cmark-gfm](https://github.com/github/cmark-gfm)
- **Version:** `0.29.0.gfm.13`
- **Commit:** `587a12bb` (confirmed checked out via `git -C .repos/cmark-gfm
  rev-parse --short HEAD`; matches the `ref` pinned in `.repos/config.json`)
- **License:** CC-BY-SA 4.0 (`test/spec.txt` prose and embedded examples,
  same license family as the upstream CommonMark spec) / BSD-style (the
  cmark-gfm repository license covering `test/extensions.txt`,
  `test/spec_tests.py` and the rest of the vendored tree — see `COPYING` in
  `.repos/cmark-gfm`)
- **Vendored via:** `.repos/cmark-gfm` (git submodule, sparse checkout of
  `test/`, `extensions/`, `src/`, `COPYING`)

## What this is

Two JSON fixtures, both extracted with upstream's own `test/spec_tests.py`
(never hand-transcribed), reshaped to the same `{ markdown, html, example,
start_line, end_line, section }` shape as
`fixtures/commonmark/spec.json`:

- `spec-extensions.json` — the examples embedded in
  `.repos/cmark-gfm/test/spec.txt` whose section header is marked
  `(extension)` in the spec prose: **Tables (extension)** (8), **Strikethrough
  (extension)** (2), **Autolinks (extension)** (11), **Disallowed Raw HTML
  (extension)** (1). 22 examples total.
- `extensions.json` — every example in `.repos/cmark-gfm/test/extensions.txt`
  (the entire file is GFM-extension conformance content, so no section
  filter applies): 30 examples across Tables and its six named subsections,
  Strikethroughs, Autolinks, HTML tag filter, Footnotes and its two named
  variant subsections, Interop, and Task lists. This is the only official
  footnote conformance corpus upstream ships.

## Extraction method

`packages/markdown/__test__/tools/extract-gfm-corpora.py` (python3, no
dependencies beyond the standard library and the vendored `spec_tests.py` it
shells out to). Invoked from the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 \
  packages/markdown/__test__/tools/extract-gfm-corpora.py
```

The script runs upstream's own `.repos/cmark-gfm/test/spec_tests.py
--dump-tests` twice — once against `spec.txt` with
`--pattern '\(extension\)$'` (upstream's own section-regex filter, matched
against each example's already-parsed `section` field), once against
`extensions.txt` with no pattern — and reshapes the output to drop the
per-example `extensions` flag array upstream also emits (empty for every
example that survives extraction here). `PYTHONDONTWRITEBYTECODE=1` keeps
`.repos/cmark-gfm/test/__pycache__/` from appearing as submodule dirt,
mirroring the `commonmark-spec` vendoring note in `.repos/config.json`.
`--dump-tests` returns before `spec_tests.py` ever constructs a `CMark`
converter, so no compiled `cmark`/`libcmark-gfm` binary is required to run
the extraction.

## Discrepancy against the P2 plan

The plan's Task 1 summary states `spec-extensions.json` has 24 examples:
Tables (8), **Task list items (2)**, Strikethrough (2), Autolinks (11),
Disallowed Raw HTML (1). Actual extraction yields **22**, not 24: the
"Task list items (extension)" section's two examples
(`.repos/cmark-gfm/test/spec.txt` lines 5084–5137) are marked
`` example disabled `` in the spec source. Upstream's own
`spec_tests.py:get_tests` drops any example whose marker line includes
`disabled` unconditionally — before the section-pattern filter this
extraction applies ever sees it — so those two illustrative blocks are not
part of the conformance corpus upstream tests against, and are excluded here
too, matching upstream's own extraction semantics exactly rather than
diverging from them by hand-including disabled examples.

Task-list conformance is not lost: `extensions.txt`'s own "Task lists"
section supplies 3 real (non-disabled) task-list examples, one more than the
plan's estimate for that construct, bringing the combined GFM task-list
corpus to those 3 cases plus whatever `spec.txt` base-list examples already
exercise unchanged. `extensions.json`'s total of 30 matches the plan exactly.

## Attribution posture

Test-only vendoring. Both JSON files are generated data consumed exclusively
by `__test__/e2e/`, never shipped in the published package artifact. The
CC-BY-SA 4.0 license on `spec.txt`'s prose and the cmark-gfm repository
license covering `extensions.txt` are satisfied by this attribution file and
the upstream link above; regenerate both fixtures with the command above if
the pinned `cmark-gfm` submodule ref ever changes — never hand-edit them.
