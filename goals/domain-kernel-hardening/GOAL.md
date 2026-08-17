# GOAL: harden the shared-kernel persisted-entity base

Repo: `/home/elpresidank/YeeBois/projects/beep-effect`.

Outcome: `BaseEntity` carries `Principal`-typed soft-delete and is the single
canonical audit base, with the typed-error (`.errors.ts`) convention in place for
the rest of the domain-layer hardening.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/domain-kernel-hardening/README.md`
- `goals/domain-kernel-hardening/SPEC.md`
- `goals/domain-kernel-hardening/PLAN.md`
- `goals/domain-kernel-hardening/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, the
`schema-first-development` skill, and
`standards/architecture/{02-shared-kernel,04-rich-domain-model,09-errors-across-boundaries}.md`.
Higher-priority repo standards outrank packet prose when they conflict. Grounding
lives in `explorations/domain-layer-hardening/` (synthesis 10-21, DECISIONS
G1-G14) — read by reference, do not copy.

Scope:

- In: `packages/shared/domain/src/entity/ProductEntity.ts` (add `deletedAt` +
  `deletedByPrincipal`, Principal-typed, nullable→`null`, with an
  `EntitySchema.persist.*` descriptor); `packages/foundation/modeling/schema/src/index.ts`
  (retire or deprecate-alias — `rowVersion` already covers `version`); the kernel
  `.errors.ts` convention; tests + docgen.
- Out: NO new shared VOs (`TemporalValidity`/`DomainEvent` are deferred to their
  consuming packets — zero-consumer shared exports are not promotable). NO
  slice-entity edits — do not replace `*FixtureKey` strings, type any
  `snapshot: UnknownRecord`, grow vocabularies, or add soft-delete **enforcement**
  (repository filtering/cascade). Those are sibling packets in the exploration MAP.

Workflow:

1. P0: inspect `BaseEntity`, `DomainModel`, `EntitySchema.persist.*`, `Principal`,
   and the soft-delete persist value-strategy. Record facts/blockers.
2. P1: make the smallest schema-first changes satisfying `SPEC.md`.
3. Preserve unrelated worktree changes; keep decisions tied to file/test evidence.
4. P2: run the verification commands; capture evidence.
5. Update packet status/evidence if readiness changes.
6. P3 Close: write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (soft-delete fields + tests;
      `DomainModel` retired/deprecated; `.errors.ts` convention demonstrated).
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors, formatting churn, or slice-entity edits.

Verification:

```sh
test "$(wc -m < goals/domain-kernel-hardening/GOAL.md)" -le 4000
jq . goals/domain-kernel-hardening/ops/manifest.json
git diff --check -- goals/domain-kernel-hardening
bunx turbo run check test docgen lint --filter=@beep/shared-domain --filter=@beep/schema
```

Stop and report before changing public API, schema beyond the named kernel
fields, data migration, auth, infra, security behavior, dependencies, lockfiles,
or generated files unless `SPEC.md` explicitly requires it.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
