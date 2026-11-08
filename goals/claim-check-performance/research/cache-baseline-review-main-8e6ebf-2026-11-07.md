# Claim inspection cache baseline re-record on main 8e6ebf6611 (2026-11-07)

Reviewer: Claude Opus 5.5 (steward lane for #2864, launched by the orchestrator).

Merging `origin/main` (`8e6ebf661185fe7aa38960c18fb18b6d6205af15`) into this branch took main's
`standards/cache-qualification-baseline.json`, as the merge instruction required, so main's
re-recorded rows (including the root-package projection swap) are kept unchanged. That copy does
not carry this branch's two workspace dependency edges. At merge head `8ad16ad1df0cc8b247d8676455cd8a3b2abdd5a7` the server manifest
still declares the existing `@beep/wink` workspace dependency and the use-cases manifest still
declares the existing `@beep/nlp-processing` workspace dependency. `bun run beep cache audit`
reports ten blocking `configuration-drift` rows, all in these two subjects:

| Computation | Changed dependency |
| --- | --- |
| `@beep/law-practice-server#build` | Add `@beep/wink` edge; removed none |
| `@beep/law-practice-server#check` | Add `@beep/wink` edge; removed none |
| `@beep/law-practice-server#doctest` | Add `@beep/wink` edge; removed none |
| `@beep/law-practice-server#lint:deprecated-apis` | Add `@beep/wink` edge; removed none |
| `@beep/law-practice-server#test` | Add `@beep/wink` edge; removed none |
| `@beep/law-practice-use-cases#build` | Add `@beep/nlp-processing` edge; removed none |
| `@beep/law-practice-use-cases#check` | Add `@beep/nlp-processing` edge; removed none |
| `@beep/law-practice-use-cases#lint:deprecated-apis` | Add `@beep/nlp-processing` edge; removed none |
| `@beep/law-practice-use-cases#test` | Add `@beep/nlp-processing` edge; removed none |
| `@beep/law-practice-use-cases#test:property` | Add `@beep/nlp-processing` edge; removed none |

Reviewed subjects: `@beep/law-practice-server`, `@beep/law-practice-use-cases`. Task commands,
input globs, outputs, environment keys and cache flags are unchanged. Every other subject keeps
main's recorded rows. Qualification, scope, profile and epoch are unchanged, and no exception or
debt rows are added. The earlier basis `cache-baseline-review-2026-11-07.md` describes the same
two dependency edges against an older main.

Changed-input bindings:

- `packages/law-practice/server/package.json`: SHA-256 `01310fc5f85d38441704114c868e8bff79bcbb014f82ed205cc9705a2dc3db2b`.
- `packages/law-practice/use-cases/package.json`: SHA-256 `f4851f6580270cd5bbe229ac46e99bb204e8d70c32e9855a418602cbf59b818a`.
