# GOAL: Move Storybook Host To An App

Repo: this `beep-effect` checkout.

Outcome: create `apps/storybook` as private executable `@beep/storybook`, make
it the only Storybook runtime/check/deploy owner, and keep foundation UI-system
stories package-local.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/storybook-app/README.md`
- `goals/storybook-app/SPEC.md`
- `goals/storybook-app/PLAN.md`
- `goals/storybook-app/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `apps/storybook`, root workspace/scripts/Turbo/lockfile,
  `packages/foundation/ui-system/ui` Storybook ownership cleanup,
  `.github/workflows/storybook.yml`, Vercel-only `infra` Storybook wiring, and
  this packet.
- Out: moving story files, shared/slice UI stories, public `@beep/storybook`
  exports, docgen/dtslint/type-test for the app, custom DNS/Cloudflare, live
  `pulumi up`, raw secrets, and unrelated refactors.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/storybook-app/GOAL.md)" -le 4000
jq . goals/storybook-app/ops/manifest.json
rg -n "storybook-app|@beep/storybook|apps/storybook|agentLaunchers|packetAnchorDocument" goals/storybook-app
git diff --check -- goals/storybook-app
bun run config-sync:check
bun run version-sync
bunx turbo run check lint test --filter=@beep/ui
bunx turbo run check lint storybook:build test:storybook --filter=@beep/storybook
bun run storybook:build
bun run test:storybook
bunx turbo run check lint test --filter=@beep/infra
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
