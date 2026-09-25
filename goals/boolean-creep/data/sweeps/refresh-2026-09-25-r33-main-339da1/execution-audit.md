# R33 terminal execution evidence audit

Source HEAD `32f111f3707a63168b68ed04516af800ecc3a66c`; origin/main `339da1562a2ed52f73a0a693c176fc52cca9ccb6`. Read-only verification; no fetch, source/canonical edits, HEAD moves, or census reruns.

## Result

All 27 lanes have matching transcript digests, last end events with `end_turn`, no provider error events, zero runner exit and report-validator exits, and exact receipt report/qualified counts. There are 50 raw rows and 8 raw qualified candidates. Every completion footer was reconstructed from transcript text and matched byte-for-byte against its receipt. Raw reports and footers remain unchanged.

For every lane, reconstructed the prompt bytes from the frozen template, controller literal extra prompt, source SHA, roots, and frozen 778-row seed filtered with the runner's exact path-prefix rule. All 27 reconstructed prompts match private prompt files and prompt-preflight digest/byte counts in runner logs. Runner, controller, template, extra prompt and seed hashes match lane-map/receipts. This verifies dispatched instructions, not semantic obedience to them.

All 3,977 frozen file hashes match current disk. All 3,181 included paths belong to exactly one lane, and each lane's count matches its partition receipt. Corpus path digest matches. Launch admission linked files, created-input receipt, expected lane-map digest, terminal execution-summary digest, launcher and pins all match. Launch receipt validation records are historical evidence; validators were not rerun. The controller terminal receipt correctly retains `nativeCoverageReconciliationStillRequired: true` and denies P3/dry credit.

## Coverage evidence and limitations

Reviewed all 27 completion footers. No footer admits an unvisited root. Several claim unchanged seeds despite contradictions later found by native owner audits; these are semantic reconciliation issues, not proof that a successful process established a complete correct census. In particular, blanket seed-retention claims must not supersede parent withdrawal audits.

The modeling-rest lane uses TS-focused source searches and omits the two included ontology seed files `legal-intake.jsonld` and `legal-intake.ttl`. This known omission is delegated to the separate html-element-meta/supplemental-seed-coverage audit; this execution audit does not award coverage for it.

Bounded non-TS evidence check: commands-a-c explicitly enumerated `.hbs` and searched CreatePackage templates both for Boolean-literal assignments and `boolean`. Apps explicitly enumerated `.rs`, searched Rust `bool` fields, and read Sidecar lib.rs multiple times. Thus the two most plausible additional executable/template omissions are not supported by transcript evidence. Other included non-TS files are CSS/images/icon assets; merely lacking a TS declaration search is not evidence of a missed eligible Boolean owner. All non-TS included paths are listed in execution-audit.json for explicit accounting. No additional concrete missed eligible owner/file was established in this bounded audit; this is not an exhaustive re-census.

The shared-documents footer states `dms-mirror-probe-connected` was absent from the seed list despite canonical presence. The exact frozen seed indeed has no such ID; all filtered prompt seeds match the seed, so this is not a rendering/filtering loss. The footer itself cites a Box writer recheck. Parent independently confirmed the ID was withdrawn in R32 as an actual-one-Boolean owner; the footer canonical-presence assertion is stale. Its absence from the seed is correct and creates no execution-input error. Foundation-ui's footer labels the throwing-callback scenario unresolved while retaining D1; again a semantic finding for reconciliation, not execution failure.

## Reproducibility and boundaries

`audit.py` performs only reads of canonical/source/private evidence and writes this private audit's JSON outputs. `input-bindings.json` binds all 27 prompts, transcripts, runner logs, raw reports, receipts and shared launch artifacts. `footers.json` preserves extracted completion summaries for review. `execution-audit.json` records per-lane counts and checks. The first script attempt encountered a home-aliased launch input path; resolving `~/` fixed the audit reader, without modifying original evidence.

Execution integrity checks have no findings. Known primary coverage omission remains separately tracked. No semantic reconciliation, dry credit, independent P3 approval, test-green claim, or campaign completion follows from this result.

## Output bindings

- `~/.cache/beep/boolean-creep/refresh-2026-09-25/r33-execution-audit/audit.py`: `4a4790499da99700687fb8fe22ec124b280d3443f400a7816d7f03fff988bb73`
- `~/.cache/beep/boolean-creep/refresh-2026-09-25/r33-execution-audit/execution-audit.json`: `a18864c95b893865c81456f6c3257b9c0b1a41e46795c1d40204bbf543a71d62`
- `~/.cache/beep/boolean-creep/refresh-2026-09-25/r33-execution-audit/footers.json`: `bf9f77057d7c19fd987e12afe5e3fc99511cee3ed7d43f1b30d81dd62625374d`
- `~/.cache/beep/boolean-creep/refresh-2026-09-25/r33-execution-audit/input-bindings.json`: `837d0070ddf13ee9da93f970547a59f5f6d2987c958ab8ecfff0d64f8315000a`
