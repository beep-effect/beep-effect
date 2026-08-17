# GOAL: build the schema-first rich-text foundation

Repo: this `beep-effect` checkout.

Outcome: `@beep/lexical-schema` (`packages/foundation/modeling/lexical`) and
`@beep/editor` (`packages/foundation/ui-system/editor`) exist, quality gates
pass, and a fixture assistant turn renders through schema → viewer in
`apps/storybook`.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/rich-text-foundation/README.md`
- `goals/rich-text-foundation/SPEC.md`
- `goals/rich-text-foundation/PLAN.md`
- `goals/rich-text-foundation/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict. Proof-repo reference (read-only, same effect
catalog): the effect-lexical-chat project (machine-local checkout) —
`shared/lexical-schema.ts` (effect-only serialized-state schemas) and
`shared/assistant-schema.ts` (block AST + `assistantContentToLexical`).

Scope:

- In: `packages/foundation/modeling/lexical` (new), `packages/foundation/
  ui-system/editor` (new), `apps/storybook` stories, root workspace/export
  maps, repo-exports catalog shards.
- Out: `@lobehub/editor` dependency; `@lexical/yjs`; persistence/rpc/app
  wiring; PDF export; any new rich-text AST (canonical AST is `@beep/md`,
  `packages/foundation/modeling/md`).

Key constraints (SPEC.md is normative):

- Zero runtime `lexical` imports in `@beep/lexical-schema`; `lexical` is a
  devDependency for dtslint conformance only.
- Run the Md ↔ Lexical lossiness check (format bitmask/alignment/indent)
  before locking the codec profile; document the profile.
- v1 nodes: paragraph, heading, code, list, quote (+ inline marks),
  artifact-ref. Mention/slash-command are composer affordances.
- `@beep/editor` builds on raw `lexical` + `@lexical/react` 0.45; reuse
  `@beep/ui` editor-00 substrate, theme, content-editable exports.
- Nullish wire values decode to `O.Option` at the schema boundary
  (`S.OptionFromOptionalKey`/`OptionFromNullOr`/`OptionFromNullishOr`…) —
  no null checks in function logic. `Type`/`Encoded` diverge: hand-write
  companion-namespace interfaces for recursive nodes; tags only on
  concrete leaf classes. See SPEC.md "Schema conventions".

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At P3 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P3 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/rich-text-foundation/GOAL.md)" -le 4000
jq . goals/rich-text-foundation/ops/manifest.json
git diff --check -- goals/rich-text-foundation
bun run beep yeet verify
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
