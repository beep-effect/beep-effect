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

Two JSON fixtures, both extracted with a port of upstream's own
`test/spec_tests.py` scanner (never hand-transcribed), reshaped to the same
`{ markdown, html, example, start_line, end_line, section }` shape as
`data/conformance/commonmark/spec.json`:

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

`packages/foundation/modeling/markdown/scripts/extract-gfm-corpora.ts`
(TypeScript, run with Bun; no Python). Invoked from this package:

```sh
bun run generate:gfm-corpora
```

It reads the pinned `.repos/cmark-gfm/test/` checkout (pass
`--cmark-gfm <dir>` to read another checkout of the same ref). Its example
scanner is a line-for-line port of upstream `test/spec_tests.py`'s
`get_tests` and `--dump-tests` path, applied twice — once to `spec.txt`
with the case-insensitive section filter `\(extension\)$` (upstream's own
`--pattern`, matched against each example's already-parsed `section` field),
once to `extensions.txt` with no filter — and drops the per-example
`extensions` flag array upstream also emits (empty for every example that
survives extraction here). Output keeps upstream's `json.dumps(indent=2)`
form, including `\uXXXX` escapes for non-ASCII text. No compiled
`cmark`/`libcmark-gfm` binary is involved.

The script replaced a Python extractor that shelled out to
`spec_tests.py`. Both were run against `587a12bb` and produced byte-identical
`spec-extensions.json`, `extensions.json` and summary output; the scanner
also matched `spec_tests.py --dump-tests` byte for byte on every other spec
file in that checkout's `test/` directory (`spec.txt` unfiltered,
`regression.txt`, `smart_punct.txt` and both extension variants).
`test/extract-gfm-corpora.test.ts` replays a synthetic spec against
recorded upstream output and re-renders both committed corpora byte for
byte.

## Discrepancy against the P2 plan

The plan's Task 1 summary states `spec-extensions.json` has 24 examples:
Tables (8), **Task list items (2)**, Strikethrough (2), Autolinks (11),
Disallowed Raw HTML (1). Actual extraction yields **22**, not 24: the
"Task list items (extension)" section's two examples
(`.repos/cmark-gfm/test/spec.txt` lines 5084–5137) are marked
`` example disabled `` in the spec source. Upstream's own
`spec_tests.py:get_tests` (and its TypeScript port) drops any example whose marker line includes
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

Conformance data, not runtime code. Both JSON files are generated data that
the package's own `test/e2e/` suites load and that other workspace packages
import as the `@beep/markdown/conformance/gfm/spec-extensions` and
`@beep/markdown/conformance/gfm/extensions` subpaths. Nothing under `src/`
reads them. They travel with this attribution file; the CC-BY-SA 4.0 license
on `spec.txt`'s prose and the cmark-gfm repository license covering
`extensions.txt` are satisfied by this file and the upstream link above.
Regenerate both fixtures with the command above if the pinned `cmark-gfm`
submodule ref ever changes; never hand-edit them.
