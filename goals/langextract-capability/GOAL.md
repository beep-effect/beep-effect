# GOAL: Build the LangExtract capability packet and implementation

Repo: `beep-effect` (`kriegcloud/beep-effect` on GitHub).

Outcome: deliver `@beep/langextract` as a provider-neutral Effect v4 foundation
capability for structured extraction with source-grounded character spans, then
close quality and PR follow-up.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/langextract-capability/README.md`
- `goals/langextract-capability/SPEC.md`
- `goals/langextract-capability/PLAN.md`
- `goals/langextract-capability/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `goals/langextract-capability/**`,
  `packages/foundation/capability/langextract/**`, required `@beep/nlp`
  primitive promotions, tests, docs, manifests, exports, and generated catalog
  updates needed by quality gates.
- Out: provider-specific SDK adapters, provider env/config loading, live
  provider smoke tests, CLI workflows, rendering, visualization, unrelated
  refactors, and driver placement for V1.

Workflow:

1. Preserve unrelated user/worktree changes.
2. Run P1 research first: write required reports under `research/reports/`.
3. Synthesize the reports into `research/synthesis.md`.
4. Run the proposal review loop until zero required improvement items remain.
5. Finalize packet docs around the accepted proposal.
6. Implement the provider-neutral foundation capability.
7. Run package checks, repo quality, and the actual `$quality-review-fix-loop`
   until zero required blockers remain or explicit waivers exist.
8. Run the repo yeet cycle, open the PR, and babysit CI/review feedback with
   follow-up commits.

Hard reuse gate:

- Before adding public primitives, search the repo export catalog and inspect
  `@beep/nlp`.
- Classify overlaps as `reuse as-is`, `extend @beep/nlp first`, or
  `langextract-local with rationale`.
- If `@beep/nlp` is almost enough, edit/promote `@beep/nlp` rather than
  duplicating the primitive in `@beep/langextract`.

Architecture gate:

- `@beep/langextract` may use injected `effect/ai/LanguageModel`
  services, but it must not import concrete provider drivers.
- Stop if research shows the foundation capability route is invalid without a
  standards decision.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/langextract-capability/GOAL.md)" -le 4000
jq . goals/langextract-capability/ops/manifest.json
rg -n "langextract-capability|GOAL.md|agentLaunchers|packetAnchorDocument" goals/langextract-capability
git diff --check -- goals/langextract-capability
```

Stop and report before changing public API, schema, data migration, auth, infra,
security behavior, dependencies, lockfiles, generated files, or destructive
state unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
