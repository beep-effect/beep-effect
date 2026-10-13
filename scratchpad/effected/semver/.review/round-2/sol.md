### sol-2-1
- file: scratchpad/effected/semver/internal/desugar.ts:56
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); `Range` promises node-semver range semantics.   evidence: Read-only `bun -e` probes against the lab and the pinned oracle show that `~*`, `~x`, `^*`, and `^x` all normalize to `>=0.0.0 <1.0.0-0` and reject `2.0.0`. The installed node-semver implementation normalizes each to `*` and accepts `2.0.0`; its `replaceTilde` and `replaceCaret` implementations explicitly handle a wildcard major as unrestricted. Both lab helpers substitute `0` for `p.major === null` before choosing their upper bound. The green suite misses the semantic error: scratchpad/test/semver/internal/desugar.coverage.test.ts:14 and :18 explicitly expect the incorrect upper bound.
- failure: A wildcard major under tilde or caret acquires an unintended `<1.0.0-0` ceiling. Resolving either range against published versions at or above `1.0.0` rejects valid candidates. This is an inherited upstream bug, absent from the recorded deviations and round-1 inventory.
- fix: In both `desugarTilde` and `desugarCaret`, handle `p.major === null` before numeric substitution and return the ordinary stable wildcard comparator `>=0.0.0`. Correct the two coverage expectations and add public `Range.parse` membership regressions covering stable versions above zero and prerelease exclusion. Record the verified upstream-bug fix in README Port notes and the ledger.

### sol-2-2
- file: scratchpad/effected/semver/internal/desugar.ts:169
- class: bug   severity: required
- standard: D9, D11, section 14 (`upstream-bug`); node-semver X-range operator semantics.   evidence: Read-only differential probes show that `>*`, `>x`, `<*`, and `<x` normalize to `>=0.0.0` in both the lab and pinned oracle and accept `2.0.0`. Node-semver normalizes each to `<0.0.0-0` and rejects every version; its `replaceXRange` implementation explicitly produces that unsatisfiable comparator when the major is a wildcard and the operator is strict `<` or `>`. The lab’s wildcard-major branch ignores `operator`. scratchpad/test/semver/internal/desugar.coverage.test.ts:43 expects `>=0.0.0` for every operator, preserving the bug despite full coverage.
- failure: Strict comparisons against a full wildcard become permissive ranges. `Range.filter` and `VersionCache.resolveString` can select stable versions from constraints that should match nothing. This inherited upstream bug is not among the recorded deviations or round-1 findings.
- fix: In the wildcard-major branch, return `<0.0.0-0` for `<` and `>`; retain `>=0.0.0` for the remaining operators. Split the coverage expectation by operator and add public matching and resolution regressions. Record the verified upstream-bug deviation.

### sol-2-3
- file: scratchpad/effected/semver/SemVer.ts:74
- class: schema   severity: required
- standard: D5; standards/effect-first-development.md EF-12 and EF-12c; standards/effect-laws-v1.md law 18.   evidence: Runtime AST inspection shows no schema annotations on the named `nonNegativeInteger`, `prereleaseIdentifier`, or `buildIdentifier` building blocks. The `S.isInt()` and `S.isBetween(...)` checks reused through `nonNegativeInteger` also have no `identifier`, `title`, or `description`. Specifically, inspecting `SemVer.fields.major.ast.checks.slice(1)` produces two records with all three metadata fields absent. Field-level `annotateKey` descriptions and the owning class’s annotations do not supply these missing schema/check annotations. This is new evidence of an annotation gap beyond the round-1 repair of `ExactVersionString` and `PinnableVersionString`.
- failure: The shared version-component and identifier constraints remain anonymous in schema introspection, and the reused numeric validation block lacks the metadata required by the cited laws. The green gates and existing class/string-schema annotation assertions do not detect this gap.
- fix: Add composer-derived schema metadata to the three named building blocks and metadata to the reusable numeric check block, preserving the existing validation predicates and accepted inputs. Add focused AST metadata assertions and extend the existing per-class identity-annotations record.

REQUIRED: 3
BACKLOG: 0