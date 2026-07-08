# P1-B — JSDoc inventory detector fixes

Lane: P1-B. Scope: `packages/tooling/tool/cli/src/commands/Quality/internal/JSDocDocumentationInventory.ts`,
`packages/tooling/tool/cli/src/commands/Quality/internal/QualityArtifactSupport.ts`,
new test file `packages/tooling/tool/cli/test/jsdoc-inventory-detector-fixes.test.ts`.
Authorizing locked rulings: R2, R3-J2, R3-J3, R5
(`goals/standards-remediation/research/decisions.md`). No commit made, no
`standards/*.jsonc` or inventory regeneration touched (per instructions).

## Change 1 — R2 + R5: re-export declarations exempt from requiredExportTags and missingSummary

**Behavioral diff.** `analyzeExportDeclaration`
(`JSDocDocumentationInventory.ts:531-585`, was `:502-548`) computed
`missingTags = missingRequiredTags(presentTags, requiredExportTags)` and
`missingSummary = O.isNone(summaryFromComment(commentText))` for re-export
declaration nodes (`export * from "./x.ts"` / `export { X } from "./y.ts"`)
exactly like a direct export, so a bare barrel line — which normally carries
no JSDoc at all — was flagged for missing `@example`/`@category`/`@since` and
missing summary. `.patterns/jsdoc-documentation.md:91-96` states re-export
declarations are graph edges, not symbol-quality subjects: "do not add fake
examples to a barrel just to satisfy quality tooling." Live inventory count
(driver-run, per R2): 797 of 2,012 missing-`@example` findings sit on
re-exports.

Fixed by hardcoding both fields for re-export declarations instead of
deriving them from tag/summary presence:

```ts
// Re-export declarations are graph edges, not symbol-quality subjects
// (.patterns/jsdoc-documentation.md:91-96; rulings R2, R5): exempt them from
// requiredExportTags and missingSummary entirely instead of demanding fake
// examples on a barrel.
const missingTags: ReadonlyArray<string> = [];
const missingSummary = false;
```

All other checks on the declaration's own comment/text — `forbiddenTagsIn`,
`malformedConditionalTags`, `exampleImportViolations`, `unsafeExampleViolations`,
`categoryViolations` — are unchanged, so a re-export line that actually carries
a bad tag (rare, but possible) still gets flagged; only the requiredExportTags
and summary requirement stop applying. The entry is still pushed into the
package's `exports` array with `exportKind: "re-export"` exactly as before, so
`publicExportCount`/`publicModuleCount` bookkeeping and totals are unaffected —
only the FINDINGS (`missingRequiredTags`, `missingSummary`, and therefore
`remediationStatus` and the `missingExportExamples`/`missingExportCategories`/
`missingExportSince` counts) stop firing for these nodes.

## Change 2 — R3-J2: phantom packages from topo-sort section-header lines

**Behavioral diff.** `parseTopoSortOutput` (`QualityArtifactSupport.ts:456-469`,
unchanged) maps every non-empty, non-`$` line to its first whitespace token.
Real `bun run topo-sort` output interleaves dependency-section header lines
(`dependencies 2`, `devDependencies 0`, `peerDependencies 1`,
`optionalDependencies 3`) with real package name lines
(`@beep/repo-cli 20`), so the header lines parsed as phantom package names —
confirmed 4 such phantom entries with status `missing-workspace-metadata` in
the live inventory (verified against a real `bun run topo-sort` capture
during this fix, reproduced in the report above).

Fixed in the caller, `topoSortPackageNames`
(`QualityArtifactSupport.ts:485-524`), which already runs immediately before
the one place (`JSDocDocumentationInventory.ts:956` originally, now
`buildJSDocDocumentationInventory`) that separately calls
`discoverWorkspacePackages` — moved workspace discovery into
`topoSortPackageNames` itself so the module-internal function stays the
single point of truth for "real package name":

```ts
const parsedNames = parseTopoSortOutput(result.output, includeLine);
const workspacePackages = yield* discoverWorkspacePackages(repoRoot, path);
return A.filter(parsedNames, (packageName) => MutableHashMap.has(workspacePackages, packageName));
```

This widens `topoSortPackageNames`'s signature to take `path: Path.Path` (used
to call `discoverWorkspacePackages`) and its Effect requirement channel from
`ChildProcessSpawner.ChildProcessSpawner` alone to
`FileSystem.FileSystem | ChildProcessSpawner.ChildProcessSpawner`. Confirmed
via repo-wide grep that `topoSortPackageNames` has exactly one call site
(`JSDocDocumentationInventory.ts:990`, in `buildJSDocDocumentationInventory`),
which already requires `FileSystem.FileSystem | Path.Path |
ChildProcessSpawner.ChildProcessSpawner` and already has `path` in scope — so
the widening does not change `buildJSDocDocumentationInventory`'s own public
requirement channel; only the call site's argument list changed
(`topoSortPackageNames(repoRoot)` → `topoSortPackageNames(repoRoot, path)`).
`parseTopoSortOutput` itself is untouched — it stays a dumb tokenizer;
robustness comes from the intersection against discovered workspace names, as
instructed.

## Change 3 — R3-J3: multi-line import continuation false positives

**Behavioral diff.** `unsafeExampleViolations`
(`JSDocDocumentationInventory.ts:384-416`, was `:351-387`) stripped only lines
whose trimmed text started with `import ` before running the
`declare`/`any`/`as`-assertion regexes over the remaining text. Continuation
lines of a multi-line named-import block (e.g.
`  type WorkItemVisibleAction as WorkItemVisibleActionValue,`) don't start
with `import `, so they survived the filter and the `as`-regex
(`/\bas\s+(?:const|unknown|...|[A-Z_$({[])/`) false-positived
`no-type-assertions-in-examples` on the `as WorkItemVisibleActionValue` alias.
Confirmed instance:
`packages/architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts:80`
(read directly — this file is part of the architecture-lab accepted oracle and
was NOT edited; it was only used to confirm the bug shape, matching the
ticket's evidence).

Fixed by replacing the per-line `import `-prefix filter with a statement-aware
stripper that consumes a complete import statement — from a line starting
with `import` through the line containing its `from "..."` clause (handling
bare side-effect imports and `import type { ... } from "..."` forms) — before
any of the three regex scans run:

```ts
const importStatementTerminatorPattern = /from\s*["'][^"']*["']\s*;?\s*$/;
const bareImportStatementPattern = /^\s*import\s*["'][^"']*["']\s*;?\s*$/;

const stripImportStatements = (example: string): string => {
  const lines = Str.split(/\r?\n/)(example);
  const kept: Array<string> = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (bareImportStatementPattern.test(line)) {
      index += 1;
      continue;
    }
    if (/^\s*import\b/.test(line)) {
      let cursor = index;
      while (cursor < lines.length && !importStatementTerminatorPattern.test(lines[cursor] ?? "")) {
        cursor += 1;
      }
      index = cursor + 1;
      continue;
    }
    A.appendInPlace(kept, Str.trim(line));
    index += 1;
  }

  return A.join(kept, "\n");
};
```

`unsafeExampleViolations` now calls `stripImportStatements(example)` in place
of the old per-line filter. Genuine `as const`/`as unknown`/`declare`/`any`
usage in non-import example code still reaches the regexes unchanged, since
`stripImportStatements` only consumes lines that are part of an import
statement's syntax (from `import` through its terminating `from "..."`
clause).

## Fixture tests added (`test/jsdoc-inventory-detector-fixes.test.ts`, new file)

Follows the existing fixture-repo idiom from
`test/quality-artifact-generators.test.ts` (temp repo via
`fs.makeTempDirectory`, `package.json` with a controllable `topo-sort` script,
`tsdoc.json` policy, per-package `src/index.ts`), driving the already-exported
`writeJSDocDocumentationInventory` end-to-end and asserting on the written
JSON artifact. No new exports were added and no file outside the given fence
was touched — `unsafeExampleViolations`/`analyzeExportDeclaration`/
`parseTopoSortOutput` remain module-private, so all fixtures exercise the
public `writeJSDocDocumentationInventory` entry point (same approach the
pre-existing test in this package already uses).

1. `"exempts re-export declarations from requiredExportTags and missingSummary
   while direct exports still fire (R2, R5)"` — covers 1a/1b in one fixture
   repo (`@beep/demo` with `src/lib.ts` + `src/index.ts` re-exporting it via
   `export * from "./lib.js"` plus an undocumented direct export):
   - re-export entry (`exportKind === "re-export"`) — **newly-excluded** (1a):
     asserts `missingRequiredTags` is `[]`, `missingSummary` is `false`,
     `remediationStatus` is `"resolved"`.
   - direct export `directHelperWithoutExample` (no `@example`) —
     **still-fires** (1b): asserts `missingRequiredTags` contains
     `"@example"` and `remediationStatus` is `"open"`.
   - Also asserts the re-export node is still counted as public surface
     (`sourceCoverage.publicExportCount === 3`: the re-export node + the
     direct helper + `libValue` from `lib.ts`) and that
     `counts.missingExportExamples === 1` (only the direct helper), proving
     only the finding stopped, not the bookkeeping.

2. `"filters phantom package names parsed from topo-sort dependency section
   headers (R3-J2)"` (2a) — fixture root's `topo-sort` script prints
   `dependencies 0`, `devDependencies 1`, `peerDependencies 2`,
   `optionalDependencies 3`, then `@beep/demo 4`; asserts
   `inventory.packages.map(p => p.packageName)` equals exactly `["@beep/demo"]`
   and no package has `status === "missing-workspace-metadata"`.

3. `"parses real workspace package names from topo-sort output in
   topological order (R3-J2)"` (2b) — two real packages (`@beep/demo`,
   `@beep/demo-two`) with phantom section-header lines interspersed between
   them in the topo-sort output; asserts
   `inventory.packages.map(p => p.packageName)` equals
   `["@beep/demo", "@beep/demo-two"]` in order, proving the fix doesn't break
   normal multi-package parsing.

4. `"strips multi-line import statements before flagging type assertions
   while real assertions outside imports still fire (R3-J3)"` — covers 3a/3b
   in one fixture package with two exports:
   - `multiLineImportAliasExample` — **newly-excluded** (3a): example has a
     multi-line `import { type X, type X as Y } from "@beep/demo"` block;
     asserts `unsafeExampleViolations` is `[]` and `remediationStatus` is
     `"resolved"`.
   - `realUnsafeExample` — **still-fires** (3b): example has a real
     `const value = externalValue as unknown` expression plus
     `declare const externalValue: any`, both outside any import; asserts
     `unsafeExampleViolations` contains exactly one each of
     `"no-declare-statements"`, `"no-any-in-examples"`,
     `"no-type-assertions-in-examples"` (length `3`), confirming the
     multi-line import in the same example does not leak a duplicate/false
     assertion finding.

## Verification

Command (from `packages/tooling/tool/cli`):
`npx vitest run test/jsdoc-inventory-detector-fixes.test.ts test/quality-artifact-generators.test.ts test/jsdoc-categories.test.ts`

```
 RUN  v4.1.10 /home/elpresidank/YeeBois/projects/beep-effect7/packages/tooling/tool/cli

 Test Files  3 passed (3)
      Tests  13 passed (13)
   Start at  21:03:11
   Duration  10.89s (transform 1.10s, setup 542ms, import 9.21s, tests 912ms, environment 0ms)
```

All 13 tests pass: 4 new fixture tests in the new file, plus the 3
pre-existing tests in `quality-artifact-generators.test.ts` (unaffected by the
signature/behavior changes) and 6 pre-existing tests in
`jsdoc-categories.test.ts` (unrelated module, run for baseline confidence).

Additionally ran a scoped `npx tsc --noEmit -p tsconfig.json` in the package.
The only errors reported are pre-existing and unrelated, in
`src/commands/Corpus/Corpus.service.ts` (outside this lane's file fence,
already noted in the sibling P1-A report); nothing in
`JSDocDocumentationInventory.ts`, `QualityArtifactSupport.ts`, or the new test
file.

No repo-wide `turbo`/`yeet`/inventory-regen commands were run, `beep quality
jsdoc-inventory` was never invoked, `standards/*.jsonc` was never touched, no
files outside the fence were edited, and no commit was made.
