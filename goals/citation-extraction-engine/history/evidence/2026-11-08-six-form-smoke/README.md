# Pinned donor operability smoke, 2026-11-08

Nine hand-authored synthetic snippets, not a held-out accuracy benchmark. The
screen checks that existing local installations import and recognize basic
first-slice forms; it neither selects an architecture nor proves parity, safety,
resolution, metadata correctness, or document coverage. No installs, production
edits, or full suites were run.

The snippets include a full case, short case, Id., supra, 35 U.S.C., 37 C.F.R.,
an astral Unicode prefix, one negative, and a full-case/Id. context pair. All
three contenders emitted the anticipated broad families, no citation on the
negative, and two mentions on the context pair. Every returned source span was
in bounds and yielded a valid UTF-16 source slice after conversion of Python
code-point offsets. This is deliberately a basic operability result.

- Official eyecite 2.7.6: Pin: 04d82c032ad5fd0f9ab72a61c87110c46ee8f52e;
  Invocation: existing .venv/bin/python screen.py

- eyecite-ts 0.34.2: Pin: 34133d03143ea65861f48a5ed0eb32c931581666; Invocation:
  bun screen.ts ts, importing pinned src/index.ts

- eyecite-js 2.7.6-alpha.28: Pin: 53a49f2412da668aaf262e5f92584c2c3781043b;
  Invocation: bun screen.ts js, importing pinned src/index.ts

Cached source provenance was checked with git HEAD/status before execution.
Python and JS tracked trees were clean. TS had a preexisting llms.txt
modification; no runtime source modification was reported, and this screen
preserved it. Existing build outputs were not imported.

## Differences that matter to an adapter

- For `Smith, supra, at 3.`, Python's returned span starts at offset 7 and TS/JS
  start at offset 0. The latter include the antecedent name. A product must
  specify which source region is its citation span instead of treating these
  layouts as identical.
- Python's `matched_text()` can name the core token (`Id.`), while `span()`
  covers the pin-inclusive text (`Id. at 120`). An adapter must form its
  verified quote from the chosen actual source range; naive token-text equality
  is insufficient.
- The astral-prefix example locates the case at UTF-16 [7,19) for all three
  after explicit Python conversion. This single example does not establish
  general Unicode fidelity.

Raw outputs include one-pass timing observations. Those runs use synthetic tiny
inputs, unequal warmup/import paths and one sample per case. They are not
throughput or latency benchmarks and should not rank the implementations. No
current native Beep engine timing was measured here.

Files: cases.json; screen.py; screen.ts; per-lane stdout/stderr;
normalized-observations.json. A later comparison needs independently labelled
real documents, an explicit supported-form contract, ambiguity/resolution
controls, adversarial input, resource isolation and repeated matched-condition
measurements.
