### sol-3-1
- file: scratchpad/effected/yaml/YamlNode.ts:1170
- class: bug   severity: required
- standard: D9; D11; §14 verified upstream-bug; the documented contract that aliases resolve to the anchor definition visible at their point of use.   evidence: Read-only Bun probes against the reviewed source and pinned oracle with `"a: &x 1\nb: &y [*x]\nc: &x 2\nd: *y\n"` return `{ a: 1, b: [1], c: 2, d: [2] }`; the installed `yaml` test oracle returns `d: [1]`. With `"a: &x 1\nb: &y [*x]\nc: &x [*y]\nd: *y\n"`, both implementations throw `RangeError: Maximum call stack size exceeded`, while `yaml` returns `{ a: 1, b: [1], c: [[1]], d: [1] }`. The Effect entry point records this as `Die`, bypassing the typed parse-error channel.
- failure: Expanding an earlier anchored collection reinterprets its nested aliases against the current mutable anchor map. Reusing an anchor name therefore changes previously established references and can turn an acyclic document into infinite extraction recursion before the expansion budget fires. This is new evidence beyond the recorded collection migration and sequential duplicate-anchor tests.
- fix: Retain the anchor target selected when each alias is first encountered in source order, and reuse that binding during subsequent expansion. Prevent expansion of historical nodes from overwriting live anchor registrations. Add the two regressions across value, stream, and document extraction, and register the correction under §14.

### sol-3-2
- file: scratchpad/effected/yaml/YamlDocument.ts:163
- class: bug   severity: required
- standard: D11; §14 verified upstream-bug; `YamlDiagnostic.isFatal("UnresolvedTag")` and `YamlDocument.parseAll`’s fatal-diagnostic contract.   evidence: A read-only Bun probe with `"%TAG !e! tag:example.com,2000:\n---\n!e!foo bar\n...\n---\n!e!foo baz\n"` produces a stream-level `UnresolvedTag` at offset `54`, with both documents’ own error arrays empty. In both the reviewed implementation and pinned oracle, `Yaml.parseAllResult` returns `Failure`, but `Effect.runSyncExit(YamlDocument.parseAll(...))` returns `Success` with two error-free documents. The filter admits only `InvalidDirective`, discarding this fatal stream diagnostic.
- failure: The AST stream parser accepts an undeclared tag handle in a later document and loses the diagnostic entirely. Callers receive apparently valid documents even though the same stream fails the value parser’s validity check.
- fix: Filter `streamErrors` with the existing `isFatalCode(e.code)` predicate, matching the document-error filter and value parser. Add the cross-document tag-handle regression and record the upstream-bug correction under §14.

### sol-3-3
- file: scratchpad/effected/yaml/YamlLint.ts:879
- class: bug   severity: required
- standard: D11; §14 verified upstream-bug; `YamlLint.fix` promises to apply non-overlapping fixes and preserve diagnostic-order priority for conflicts.   evidence: A read-only Bun probe supplies a configured custom rule over `"a: 1\nb: 2\n"`. Its first diagnostic has offset `0` and a fix `{ offset: 5, length: 1, content: "B" }`; its second diagnostic has offset `1` and a fix `{ offset: 0, length: 1, content: "A" }`. Both the reviewed implementation and pinned oracle return `"a: 1\nB: 2\n"`, although the edits are disjoint and applying both yields `"A: 1\nB: 2\n"`. `YamlLintDiagnostic` imposes no requirement that a diagnostic and its fix begin at the same offset.
- failure: Diagnostics are sorted by diagnostic position, but overlap selection assumes their fixes are sorted by edit position. A valid earlier-source edit is silently dropped whenever a preceding diagnostic supplies a later-source edit.
- fix: Determine conflicts from the actual fix intervals without assuming diagnostic order also orders those intervals. Preserve the existing diagnostic-order winner for overlapping or same-offset edits, then pass all accepted edits to `YamlEdit.applyAll`. Add the custom-rule regression and register the correction under §14.

### sol-3-4
- file: scratchpad/effected/yaml/YamlDiagnostic.ts:283
- class: perf   severity: required
- standard: D11’s algorithmic-class criterion.   evidence: Every `fromRaw` call invokes `lineChar`, whose loop at line `304` scans from source offset zero to that diagnostic’s offset. Batch callers include `Yaml.ts:375–376` and `YamlDocument.ts`’s raw-document materialization. For `"a: 1\n".repeat(N)`, the `N − 1` duplicate-key diagnostics occur at offsets `6, 12, …, 6(N − 1)`, requiring `3N(N − 1)` character visits solely to derive positions: Θ(N²). One source-position index followed by binary lookups reduces that phase to O(T + D log T), where `T` is source length and `D` is diagnostic count. This criterion does not depend on a timing regression.
- failure: Inputs with many diagnostics repeatedly rescan the same source prefixes. Diagnostic materialization adds quadratic work even when all records and their offsets have already been computed.
- fix: Build a reusable position index once per source operation and use it when materializing a diagnostic batch. Preserve standalone `fromRaw` behavior, diagnostic ordering, CR/LF/CRLF and LS/PS handling, and the existing interior-CRLF position regression.

### sol-3-5
- file: scratchpad/effected/yaml/YamlFormat.ts:774
- class: law   severity: required
- standard: `standards/effect-laws-v1.md` law 6; `standards/effect-first-development.md` EF-5; D11.   evidence: The reachable regional replacement path calls `Object.is(node.value, value)`. The native-runtime gate’s `OBJECT_METHODS` set in `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:56–66` lists `keys`, `values`, `entries`, `fromEntries`, `assign`, `hasOwn`, `freeze`, `seal`, and `create`, but omits `is`, explaining why the declared green gate misses this call. No recorded deviation grants this site an exception.
- failure: Domain comparison still executes a forbidden native `Object` helper. Its signed-zero check is behaviorally significant, so replacing it with ordinary equality alone would introduce another bug.
- fix: Replace the call with an Effect-based primitive comparison that preserves NaN equality and distinguishes positive from negative zero—for example, `Equal.equals` plus an explicit numeric zero-sign comparison. Retain the regional replacement’s existing signed-zero fallback behavior.

REQUIRED: 5
BACKLOG: 0