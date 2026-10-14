# package-json round-3 inventory

Seats read: `grok.md`, `sol.md`, `fable.md`, shared `BRIEF.md`, and `BRIEF.grok3.md`. No part-N directories exist. Grok and Fable report no findings; Sol supplies two records, both retained below.

REQUIRED: 2  BACKLOG: 0  CODEMOD: 0  REJECTED: 0  GROUPS: 2

The complete operator revision block, including both 2026-10-09 ruling blocks, D1-D20, sections 12.4-12.5 and 14, and the task's write-surface restrictions govern this merge. The briefs pin review commit `3ad7b305790c7f0903f6d55766c55186745ba2d1` and upstream oracle `af7566a9da2eff169cb74955efcc5ede1e5de9f8`. Live HEAD is `9f73185dd8517933985c39c9a3ba6f9765480185` on `@lab/effected-2`, rather than the named `@lab/effected`. Both affected source files are unchanged since the round-2 fix commit `cd35f93e29`.

Both findings demonstrate semantic cases missed by the reported green gates. They concern verified upstream bugs, not unforced port changes or repeats of the round-2 unknown-key partition fix. Source inspection confirms the failing operations remain in the lab and pinned oracle; runtime probe results below are evidence from Sol's report, not new executions by this merger. The parsed native-runtime allowlist contains zero entries for `scratchpad/effected/package-json/**`, so no `allow-<n>` findings are added.

`required.json` assigns each source and regression test to one group, with one source file per group. Upstream-bug deviation receipts and regression references go to central bookkeeping; no group owns `PORT_LEDGER.json`, README Port notes, repository configuration, root `package.json`, or `bun.lock`. This merge writes only this inventory and `required.json`; no compiler, test, coverage, graph refresh, session, Yeet, closeout, or ledger command ran.

## Required

### sol-3-1

- file: scratchpad/effected/package-json/Repository.ts:351
- class: bug   severity: required
- standard: `standards/effect-first-development.md` EF-1 and Operating Model require explicit handling of throwable APIs; D9; D11; section 14 verified upstream-bug exception.
- evidence: Sol's read-only probe decoded `{ url: "github:owner/repo", directory: "src/\ud800" }` through `Repository.FromValue` successfully, then observed `URIError: String contained an illegal UTF-16 sequence.` when reading `directoryUrl`, in both the reviewed lab and pinned oracle. Live source still passes accepted directory segments directly to `encodeURIComponent` at line 351; the oracle does the same at `src/Repository.ts:267`. Sol also probed the proposed Result/Option replacement: ordinary segments retain their encoded bytes, while a lone surrogate yields `None`. Existing directory tests cover percent encoding, root paths, unknown hosts and traversal rejection, but do not exercise malformed UTF-16; green gates therefore miss this accepted-input failure.
- failure: Reading an `Option<string>` getter on successfully decoded manifest data can throw a native exception. Escaped lone surrogates are valid JSON string contents, so the failure is reachable through manifest input.
- fix: Wrap each segment encoding in `Result.try(() => encodeURIComponent(segment))`, convert each result with `Result.getSuccess`, and sequence the Options with `O.all`. Return `O.none()` if a segment cannot be encoded, retaining current host, traversal, root and ordinary percent-encoding behavior. In `scratchpad/test/package-json/Repository.test.ts`, add a regression for successful decoding of a lone-surrogate directory, getter access returning `None` without throwing, and unchanged wire encode/decode fidelity; retain existing ordinary-encoding assertions. Supply the verified upstream-bug receipt and regression reference to central deviation bookkeeping; do not edit the ledger or README Port notes.
- seats: sol-3-1

### sol-3-2

- file: scratchpad/effected/package-json/internal/wire.ts:51-64
- class: bug   severity: required
- standard: `Package.wireFor` supports typed subclass fields; D9; D10 codec round-trip contract; D11; section 14 verified upstream-bug exception. The later grilling ruling requires own-property-safe public records built with `R.fromEntries`.
- evidence: Sol's read-only probe defined `class Extended extends Package.extend("Extended")({ ["__proto__"]: S.String }) {}`. Direct class decoding of `{ name: "pkg", version: "1.0.0", ["__proto__"]: "kept" }` succeeded, and `Package.wireFor(Extended)` encoded the instance with `"__proto__":"kept"`; decoding that encoding failed with `Missing key at ["__proto__"]`. The pinned oracle produced the same results. Live `makeWire` initializes `known` with `{}` at line 51 and assigns `known[key] = value` at line 59; the oracle retains those operations at `src/internal/wire.ts:30,38`. Assignment to `__proto__` invokes the inherited setter instead of defining an own field. Existing hostile-key properties exercise the unknown-key `rest` partition, not declared subclass fields, so their green result does not enforce this case.
- failure: A supported subclass wire codec cannot decode its own encoding when `__proto__` is a required declared field. An optional declared field can disappear silently; object-valued input can also alter the accumulator's prototype. This defect is in the known-field partition, distinct from the unknown-field losses repaired in round 2.
- fix: Build `known` with `R.fromEntries` over `R.toEntries(raw)` filtered by `HashSet.has(knownKeys, key)`, preserving own-property semantics, existing rest representation, and typed-field precedence. Correct the adjacent implementation comment claiming declared fields cannot collide with `__proto__`. In `scratchpad/test/package-json/Package.test.ts`, add a `Package.extend` regression with a computed `["__proto__"]: S.String` field: assert direct class decoding succeeds, the wire codec decodes the raw input, and encode followed by decode preserves the declared field and other metadata. Retain the existing unknown-key and typed-collision tests. Supply the verified upstream-bug receipt and regression reference to central deviation bookkeeping; do not edit the ledger or README Port notes.
- seats: sol-3-2

## Backlog

None.

## Handled by the deviation codemod

None. Neither seat record only requests bookkeeping for a law-forced change. Recording the two verified upstream-bug fixes remains central and does not create separate findings or worker write assignments.

## Rejected

None. Both seat records provide concrete failure evidence and fixes within D11 and the permitted source/test directories.
