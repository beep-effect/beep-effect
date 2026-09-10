> Historical phase contract. For new work after the 2026-09-10 rc.113 integration,
> use the active SPEC, shared lane-contract and current integration receipt.
> Recorded pins, model settings and proof below retain their original provenance.

# P0.5 narrow conformance entrypoint policy integration

Use gpt-6-astra/xhigh in this user-requested Codex CLI lane. No agents.
Work only in ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem.
You are not alone: the conformance lane owns the test-utils helper/tests; root
owns its dependency patch/manifests, goal docs, package checks and all git. Do not
edit or revert their files. No git, inbox, scanner writes, dependencies, global
config/diagnostic severity changes, broad audit/check, web, publishing or agents.

Create this report first and append progressively:
~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-canon/goals/effect-vitest-canon/history/lanes/p05-conformance-policy.md
Final message only report absolute path.

Own ONLY:
- packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts
- packages/tooling/tool/cli/test/quality-tsgo-directives.test.ts
- your report, plus private ~/ .cache path without the space:
  ~/.cache/beep/effect-vitest-canon/p05-policy-* scratch/proof files.
No new source role file is needed. If ownership is insufficient, give the exact
reason and proposed extension; do not silently widen it.

## Authority and exact intent

The user explicitly requires per-test Effect.provide(layer) in the shared
FileSystemConformance helper because the filesystem layer is the subject. This
is the named D14 conformance exception in PLAN P0.5 and resource-authoritarian.
Read those primary goal docs and research/2026-09-08-p05-platform-boundaries.md.
Grok checked @effect/tsgo 0.39.1 source: strictEffectProvide flags every call and
has NO test/entrypoint recognizer. Its only current supported exemption is a
local diagnostic directive. Repo Quality currently bans every such directive.

Root is authorizing the smallest explicit integration of the ALREADY APPROVED
D14 exception into that policy. This is not a blanket waiver and does not make
package/hosted proof optional. The global compiler remains at error for every
rule. Do not change tsconfig, allow severity-off profiles, suppress other rules,
hide provider calls behind aliases or rename source files to evade detection.

Allow exactly the canonical file-local directive:
// @effect-diagnostics strictEffectProvide:skip-file
ONLY in the exact normalized repo-relative path:
packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts

No other path, basename match, suffix, sibling, fixture, directive spelling,
additional rule, next-line form, or broad/off severity is authorized. Root will
add the directive and the concrete resource-lifetime reason to the helper AFTER
its writer finishes. You must not edit that file. This one directive marks the
shared Vitest registration module as a conformance entrypoint; all 21 visible
per-test provisions and explicit resource scopes remain in source.

## Implementation

Read live AGENTS, effect-first-development skill and export JSDoc guidance.
Search existing Quality source/helpers/tests for reuse before new functions.
Use the smallest existing policy seam, keep current directive recognition tests
and exported semantics intact, and make the actual collector apply the same
contextual decision exercised by tests. A generic 'turn diagnostics off' API,
new shared service, broad allowlist or source parser is not justified.

The relevant existing sites are effectDiagnosticsDirectivePattern around
Quality.command.ts:341, isEffectDiagnosticsDirectiveForTesting around 377, and
collectDisabledEffectDiagnosticDirectives around 2272-2310. The latter collects
all matching lines; its rejection must remain the default. If exposing a
contextual pure predicate for tests is necessary, follow public helper laws
(including pipeability when applicable) and meaningful JSDoc, without weakening
the existing isEffectDiagnosticsDirectiveForTesting recognition API.

## Verification

Extend the existing focused test file with meaningful positive/negative policy
coverage: canonical line at the exact file is allowed; the same line at another
source file and same basename elsewhere is rejected; the canonical file still
rejects a different rule, extra rules on the same line, next-line directives,
and unapproved off forms. Existing directive recognition and non-directive
cases remain. Do not add source directive comments to test fixture code; use
constructed string data as current tests do, so the test itself is not an
exemption. Verify collector and pure predicate do not diverge.

Run focused Node Vitest for the owned test and focused compiler/Biome with repo
Effect diagnostics intact. Root will run full package-verify after all writers
exit. Record exact commands/exits and any remaining concerns. Runtime pin is
Bun 1.4.2 (non-login shell preserves supplied PATH), Node v24.20.0, tsgo0.39.1.
Do not use anonymous memfd configs; authorized private scratch is available.
No changes to exception inventories or phase state inside this lane.
