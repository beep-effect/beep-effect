# Instance

- ID: `r33-cli-yeet-clip-scan`
- HEAD: `32f111f3707a63168b68ed04516af800ecc3a66c`
- main: `339da1562a2ed52f73a0a693c176fc52cca9ccb6`
- Owner: `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorComments.ts:842–852`, complete private `ClipScan` class.
- Two actual Boolean members: `inString`, `escaped`; E4 at :857 with dispatch :874 and initialization :854.
- 4 representable / 3 legal; stored, internal, Tier 1, LiteralKit target.

Private P2 proposal only. Parent integration, independent P3 review, ratification, and implementation gates remain separate. No implementation authorized by this artifact.

# Current shape

The five fields are `depth: S.Finite`, `inString: S.Boolean`, `escaped: S.Boolean`, `lastComplete: S.Finite`, and `closeDepth: S.Finite`. There are no defaults or optional fields. The class and every state constructor/helper are private. Only the string-to-string salvage function is exported (:897), also through the test-kit wildcard (:47); no public state decoder, constructor, return, persistence, or serialization exposes ClipScan.

Closed construction proves the implication, not merely a convenient producer subset of a public model: :854 starts FF; :874 sends only string states to :857; that writer makes pending escape TT only for an unescaped backslash, consumes any escaped character into TF, and exits on an unescaped quote into FF. Structural path :859–867 receives FF, preserves escaped=false, and enters TF only on quote. No other state writes or consumers were found in package-wide symbol searches. Each of the three states is reachable (empty prefix, quote prefix, quote-backslash prefix). The structurally representable FT state has no legitimate scanner interpretation.

# Cardinality gap

| inString | escaped | State |
| --- | --- | --- |
| false | false | outside-string |
| false | true | Forbidden: escape pending outside a string |
| true | false | inside-string |
| true | true | escape-pending |

`finite-table.json` records all four assignments and the 21 transitions across three legal phases and quote/backslash/open-array/open-object/close-array/close-object/other. Numeric fields remain payload, not invented Boolean axes.

# Target schema

Define private annotated `ClipScanPhase = LiteralKit(["outside-string", "inside-string", "escape-pending"])` using the existing module `$I` identity and the repo's LiteralKit concept entrypoint. Keep private `ClipScan` as the same named S.Class with `{ depth: S.Finite, phase: ClipScanPhase, lastComplete: S.Finite, closeDepth: S.Finite }`. No optional phase, defaults, retained Boolean cache/getters, compatibility model, handwritten literal union, or new public exports. No shared reusable scanner was found in the concept search, and this remains an owner-local model.

Use the kit's exhaustive `$match` for phase dispatch. Outside-string retains the structural helper: quote enters inside-string; opens increment depth; closes decrement depth and update both completion fields; other characters return the same object. Inside-string consumes backslash into escape-pending, quote into outside-string, and everything else into inside-string. Escape-pending consumes every character, including another backslash or quote, into inside-string. String transitions continue constructing new states and preserve all numeric payloads. Do not route escaped punctuation through structural handling.

Local API basis: `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:583–605` provides exhaustive `$match`; `.repos/effect/packages/effect/src/Schema.ts:7140–7149` and :14866–14881 define Finite and Class. This design needs no speculative transforms or version-dependent codec APIs.

# Migration inventory

| Site | Migration / preserved behavior |
| --- | --- |
| MonitorComments.ts:842–852 | Replace only the Boolean pair; preserve complete remaining class, annotations, privacy, and finite-number domains. |
| :854 | Initialize phase outside-string with the same three zero payloads. |
| :856–857 | Replace Boolean formulas with exhaustive string phase transitions; preserve payloads and construction behavior. May fold into owner-local phase dispatch rather than retaining a redundant helper. |
| :859–867 | Quote sets phase inside-string; preserve exact open/close numeric writes and ordinary-character original reference. |
| :869–879 | Match stored phase instead of testing inString; preserve scan loop/index and return conditions. |
| :897 and test/Yeet.test-kit.ts:47 | Keep public string alias and wildcard surface unchanged; expose no state model. |
| :899–940, especially :935 | Preserve clipped-read decode, empty-array recovery, warning, nonzero-exit failure, nontruncated decode error behavior. No state conversion at this boundary. |
| test/yeet-monitor-comment-stream.test.ts:522–580 | Retain finite-prefix tests and clipped-read cursor/warning integration; add discriminating transition regressions through existing public alias. |

# Guard-deletion accounting

Remove both stored Boolean declarations (:845–846), the pair of correlated assignments (`escaped || char !== quote`, `!escaped && char === backslash`) at :857, and the `scan.inString` dispatch at :874. No Boolean compatibility getters may recreate those obligations. Replace them with one stored phase and exhaustive kit dispatch. The quote/open/close character comparisons, depth-zero completion check, lastComplete-zero fallback, capture truncation check, and command exit checks remain: they express independent parsing or IO behavior, not redundant state guards. Non-empty deletion is the two correlation formulas plus the Boolean-state dispatch; no claim to delete unrelated parser branches.

# Encoded-side impact

ClipScan has no supported encoded boundary. Its default schema encoding is an internal capability, not a persisted or public input contract. No adapter or wire migration is needed. The externally observable returned JSON text must remain byte-identical for every input the current function processes (including existing failure behavior where malformed numeric depth affects suffix generation). Preserve truncation-notice replacement, UTF-16 index/length/slice semantics, numeric updates before outermost completion testing, early return when a container closes at depth zero, empty `[]` fallback, and current repeated `]` suffix behavior. Do not tighten finite payloads to natural integers or repair malformed JSON/object closure semantics as part of this change. All comment payload decoding, cursors, warnings, errors, and output boundaries remain unchanged.

# Test impact

Before implementation, check source identity and receive campaign admission. Prove the 21 transition cases preserve phase, three numeric fields, and unchanged-reference behavior of outside ordinary characters. Exercise through the existing public salvage alias: quotes/backslashes inside strings, odd/even backslash runs before quotes, bracket/brace characters inside strings, cuts immediately after escape or quote, complete nested pages, no completed container, truncation-notice removal, complete outer array followed by trailing text, and Unicode preceding cut offsets. Characterization cases for malformed/unbalanced input must compare existing behavior, not impose a more general JSON parser contract. Tests should prove distinct salvage outcomes rather than mirror only the implementation's phase labels. No test-only state export is needed.

Retain existing bounded-process integration proving only the first complete comment is decoded/acknowledged, its cursor persists, and the truncation warning appears. Preserve nonzero-exit and nontruncated decode error tests. Run the owning CLI focused tests plus package verification and required schema-first/catalog/docgen checks as applicable after implementation; report real exits then. No tests, runtime proof, independent review, passing dry round, or campaign completion is claimed by this static P2 artifact.

# Risk

Escaped punctuation must never reach the structural branch. Preserve original-reference behavior for ordinary outside characters and numeric update order. Main movement invalidates these source bindings and requires recheck before implementation. The proposal has no runtime or independent-review credit.
