# P2 spike reproduction artifacts

Durable copies of every artifact the P2 verdict's reproduction commands require
(`../../history/p2-spike-2026-08-13.md`). The spike itself ran in a throwaway worktree on the
local-only branch `feat/lint-policy-oxlint-spike`; these copies make a fresh clone sufficient.
Fixture sources carry a `.txt` suffix so they stay inert to repo-wide TS gates.

## Reconstitution

1. `bun add -d oxlint-tsgolint@7.0.2001` (the peer floor for the pinned oxlint 1.78.0; brings
   the `tsgolint` binary).
2. Copy `oxlintrc-deprecated-apis.jsonc` to the repo root as `.oxlintrc.deprecated-apis.jsonc`.
3. Restore fixtures, stripping the `.txt` suffix:
   - `fixtures/engagement-canary.ts.txt` →
     `apps/architecture-lab-proof/src/__p2_oxlint_deprecated_canary__.ts`
   - `fixtures/{api,direct-member-overload,alias-reexport,reexport,type-only}.ts.txt` and
     `fixtures/jsx.tsx.txt` → `packages/drivers/oxlint-deprecated-parity-spike/src/`
   - `fixtures/out-of-project.ts.txt` →
     `packages/drivers/oxlint-deprecated-parity-spike/scripts/out-of-project.ts`
   - `fixtures/parity-package-tsconfig.json.txt` →
     `packages/drivers/oxlint-deprecated-parity-spike/tsconfig.json`
   (The parity package is deliberately NOT a registered workspace package; it exists only for
   the two lint engines and must not be committed to main — new-package governance gates would
   fire and the deprecated canaries would trip the real deprecated-apis gate.)
4. Run the commands recorded in the verdict document. Every gate's command is reproduced there
   verbatim (engagement canary, parity corpus normalized diff, `/usr/bin/time -v` benchmark,
   `OXC_LOG=debug` coverage audit).

## Contents

- `oxlintrc-deprecated-apis.jsonc` — the dedicated typed-rule profile (all categories off,
  `typescript/no-deprecated: error`, type-aware, scope/ignores mirroring
  `DeprecatedApisESLintConfig.ts`).
- `fixtures/` — engagement canary plus the eight-case parity corpus (direct call, member,
  computed member, overload-specific, alias/re-export, JSX, type-only, out-of-project script).
