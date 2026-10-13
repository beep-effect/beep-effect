I'll review the toml port at that commit against the round-1 inventory, the port ledger, and the upstream oracle, and report only new findings.The toml surface is in scratchpad, so I'll read the round-1 inventory, port decisions, and ledger before comparing the commit to the upstream oracle.Round 1 is closed and S2/S3 are recorded green. I'll review this commit for new misses, starting with the brief and the diff against that baseline.I'll confirm the four candidate findings against the source, the ledger, and D11 before reporting.### grok-2-1
- file: scratchpad/effected/toml/TomlDateTime.ts:238
- class: schema   severity: required
- standard: Operator step 4; D5; EF-12   evidence: `offsetMinutes: S.Int.check(S.isBetween({ minimum: -1439, maximum: 1439 }))` has no `.annotateKey`. Every other schema field in `scratchpad/effected/toml/**` carries `.annotateKey`, including the shared `dateFields` and `timeFields` spread into this same struct (`TomlDateTime.ts:50-60`). The class itself has `$I.annote`. Round-1 `r-metadata-model` covered those shared fields and is closed. The four beep laws and docgen do not read field annotations (round-1 evidence; still green here).
- failure: `TomlOffsetDateTime.offsetMinutes` is the one model field with no description in schema JSON or hover. The UTC offset bound (−1439 through 1439) is undocumented on the schema while every sibling calendar field is documented.
- fix: Chain `.annotateKey({ description: "..." })` on that field, stating the combined offset in minutes from −1439 through 1439. Keep the `S.Int` and `S.isBetween` bounds.

### grok-2-2
- file: scratchpad/effected/toml/TomlFormat.ts:456
- class: law   severity: required
- standard: effect-laws-v1 law 7; D9; `.patterns/error-handling.md`   evidence: Upstream `packages/toml/src/TomlFormat.ts:390` throws `new Error("invariant: semantic pass admitted a value where a table was navigated")` when `intoTable` is given `undefined` or a value node. The lab pipes that case to `O.getOrThrow`. Installed `effect/src/Option.ts:1467` implements that as `getOrThrowWith(() => new Error("getOrThrow called on a None"))`. The native-runtime gate matches a `new Error` written in the scanned file (`packages/tooling/tool/cli/test/native-runtime.test.ts:161,192`) and is green because this file does not contain that text. The same file already throws `TomlFormatInvariantError` for the other format invariants (`TomlFormat.ts:1004`, `TomlFormat.ts:1010`). The ledger `tagged-errors` row says existing raw Error messages were retained. This site retains neither the message nor a tagged carrier. Valid documents that `buildSemanticIndex` builds do not reach this branch. The comment at `TomlFormat.ts:449-450` states the semantic pass guarantees a navigable node.
- failure: An invariant break throws a native `Error` whose message is `getOrThrow called on a None`. Upstream throws a native `Error` whose message is `invariant: semantic pass admitted a value where a table was navigated`. Callers see a different defect message, and the failure is outside `TomlFormatInvariantError`.
- fix: On `None`, throw `TomlFormatInvariantError.make({ message: "invariant: semantic pass admitted a value where a table was navigated" })`. Keep the table passthrough and the last-element array-table branch.

### grok-2-3
- file: scratchpad/effected/toml/TomlDiagnostic.ts:197; scratchpad/effected/toml/TomlDocument.ts:94
- class: jsdoc   severity: backlog
- standard: EFFECTED_PORT_GOAL.md section 10.2; round-1 `b-description-links`   evidence: The schema description strings still contain the literal tokens `(TomlErrorCode:type)` and `(TomlExpression:type)`. The JSDoc `{@link (TomlErrorCode:type)}` at `TomlDiagnostic.ts:163` and `{@link (TomlExpression:type)}` at `TomlDocument.ts:54` are the legal form and stay. S2 is recorded green at 2026-10-09T16:17Z ("carriers converted") and docgen is green. Docgen does not scan schema `description` strings, so the gate cannot see these two leftovers. These are schema strings, so section 10.2's `{type}`-brace ban on new JSDoc blocks does not make this required.
- failure: Schema JSON and hover show the declaration-reference tokens as plain text.
- fix: Write the plain names `TomlErrorCode` and `TomlExpression` in those two description strings.

### grok-2-4
- file: scratchpad/test/toml/oracle.property.test.ts:300
- class: test   severity: backlog
- standard: D10; `@beep/fc-runs` `fcRuns`   evidence: `ORACLE_CHECK_OPTIONS` is `{ runs: 250, seed: 20260710 }` and is passed as `{ arbitrary: ORACLE_CHECK_OPTIONS }` at lines 312 and 324. Every other `scratchpad/test/toml/**/*.property.test.ts` uses `fcRuns(100)` (16 files). `fcRuns` (`packages/tooling/test-kit/fc-runs/src/FastCheckRuns.ts:148-165`) treats the inline count as a floor under `BEEP_FC_NUM_RUNS`, and an explicit `seed` spread over the result still wins. S3 is recorded green at 2026-10-09T23:43Z ("property floor"). Schema round-trips and formatter idempotence from round-1 `b-properties` are present. This differential sweep is the site that still bypasses `fcRuns`. D10 is outside the D11 required list.
- failure: `BEEP_FC_NUM_RUNS` cannot raise the smol-toml differential above 250 runs. The fixed seed still cannot be combined with that floor.
- fix: Pass `{ ...fcRuns(250), seed: 20260710 }` as the arbitrary options.

REQUIRED: 2
BACKLOG: 2
