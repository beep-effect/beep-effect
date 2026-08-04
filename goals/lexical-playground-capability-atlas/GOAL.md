# GOAL: establish the Lexical Playground capability atlas

Repo root: the current `beep-effect` checkout; use repo-relative paths.

Outcome: every live/source Lexical Playground `0.49.0` feature
at commit `a933222` is accounted for in a versioned evidence atlas, and
`@beep/editor` proves the smallest schema-backed
capability/profile resolver through Storybook and a synthetic Professional
Desktop dock panel.

Read these as the contract:

- `goals/lexical-playground-capability-atlas/README.md`
- `goals/lexical-playground-capability-atlas/SPEC.md`
- `goals/lexical-playground-capability-atlas/PLAN.md`
- `goals/lexical-playground-capability-atlas/ops/manifest.json`
- `explorations/full-document-editor/{CAPTURE,RESEARCH,DECISIONS,BRIEF,MAP}.md`
- `explorations/full-document-editor/research/` (both audits and provenance)

Then read `AGENTS.md`, `CLAUDE.md`, and sources named by `SPEC.md`. Repo law
outranks packet prose.

Scope:

- In: atlas/provenance; `@beep/editor` schemas, resolver, command/keybinding/help
  projection, compatibility defaults and tests; Storybook; one synthetic dock
  panel; recorded browser QA.
- Out: new `@beep/md` semantics or Lexical wire nodes; full feature
  implementation; persistence/revisions/sharing; remote egress;
  collaboration, redlining, DOCX/PDF engines, Prose-to-Proof workflows, or
  product template lifecycles; unrelated redesigns.

Key constraints (`SPEC.md` is normative):

- `@beep/md` is canonical; Lexical/Pandoc are projections and loss is explicit.
- Disabled authoring does not make supported existing content unreadable.
- `@beep/editor` owns descriptors/resolution; apps/slices own product profiles.
- Profiles are mount-immutable; invalid dependency/conflict/binding state fails
  with typed errors before mount.
- All authoring paths and shortcut help project one resolved command registry.
- Diagnostics are development-only; accessibility and responsive QA are gates.

Workflow:

1. Inspect the worktree and full source hierarchy.
2. Normalize audits; reconcile and exercise every user-visible activation
   path, registration, command, setting, and interchange surface.
3. Derive the smallest schema-backed descriptor/profile contract. Stop for a
   new product/security decision rather than silently classifying a feature.
4. Implement only the resolver/projection and representative profiles in the
   spec; preserve existing consumers through compatibility defaults.
5. Prove with focused runtime/schema tests, the editor package check, Storybook,
   and recorded browser QA; store evidence under packet `history/`.
6. When authorized, Yeet to mergeable and close with `/reflect`.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are all satisfied.
- [ ] Zero unexplained or unexercised user features without an approved waiver;
      all seed screenshots remain linked as reference evidence.
- [ ] Required verification is green, or unrelated failures are evidenced.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/lexical-playground-capability-atlas/GOAL.md)" -le 4000
jq . goals/lexical-playground-capability-atlas/ops/manifest.json
git diff --check -- goals/lexical-playground-capability-atlas explorations/full-document-editor
bun run --cwd packages/foundation/ui-system/editor check
bun run beep goals doctor
bun run beep yeet verify
```

Stop before scope expansion, migration, auth/infra/security changes,
dependencies/lockfiles, destructive state, or any named non-goal. Done only
when acceptance and verification pass, or a blocker has file/command evidence.
