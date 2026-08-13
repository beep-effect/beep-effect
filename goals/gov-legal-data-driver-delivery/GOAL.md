# GOAL: Finish the four gov/legal data drivers on the proven substrate

Repo root: the current working directory — the `beep-effect` checkout you are
running in. All paths below are repo-relative.

Outcome: `@beep/ecfr` (2→15 ops), `@beep/federal-register` (14 ops, keyless),
`@beep/dol` (6 ops, keyed, GATED), and `@beep/courtlistener` (full official-v4
parity, keyed, GATED) are finished drivers that build network-free from
committed specs, with offline tests, Stream pagination helpers, and green
docgen.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/gov-legal-data-driver-delivery/README.md`
- `goals/gov-legal-data-driver-delivery/SPEC.md` (normative; Locked Decisions
  D1–D7 + inherited predecessor Q2/Q5/Q7/Q8)
- `goals/gov-legal-data-driver-delivery/PLAN.md` (phases P0–P6)
- `goals/gov-legal-data-driver-delivery/ops/manifest.json`

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the standards named by
`SPEC.md`. Higher-priority repo standards outrank packet prose.

Scope:

- In: live `packages/drivers/ecfr`. Recreate `@beep/federal-register`,
  `@beep/dol`, and `@beep/courtlistener` from
  `goals/honest-repo-signal/research/FOLLOW-UPS.md` — those directories do
  not exist; do not extend deleted trees.
  Also `packages/foundation/capability/api-transport` (wire existing
  `ApiAuth` branches only), the CI codegen-drift lane
  (`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`), this packet, and
  named cross-links in `goals/gov-legal-data-driver-codegen`.
- Out: `gov-legal-mcp`, PatentsView/patents, XML/CSV parsing, `/browser`
  entrypoints, rewrites of govinfo or api-transport.

Hard gates:

- P3–P5 (dol, courtlistener) MUST NOT start until
  `research/data-source-terms-matrix.md` exists (P0 deliverable; SPEC D2).
- CourtListener: literal `Authorization: Token` auth; synthetic-only
  fixtures; in-process/ephemeral cache only.
- Binding sequencing per phase: schema → `Context.Service` contract →
  implementation → verify.
- Generated boundary: `src/_generated/*` holds only effect/Schema value
  models + operation descriptors (SPEC ban-set); transport stays
  hand-authored on `@beep/api-transport`.

Workflow:

1. Inspect referenced files and current repo state; confirm the current phase
   in `PLAN.md`.
2. Make the smallest change that satisfies `SPEC.md` for that phase; mirror
   the ecfr/govinfo exemplar shapes; follow `/effect-first-development`,
   `/schema-first-development`, and the JSDoc/annotation rubric.
3. Each phase ships as its own PR via `bun run beep yeet` with a committed
   changeset.
4. Preserve unrelated worktree changes; keep decisions tied to evidence.
5. Update packet evidence/status as phases complete.
6. At P6 Close, write the closeout reflection via `/reflect`
   (see `PLAN.md` P6 Closeout Checklist); `bun run beep lint
   reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria AC#1–AC#10 are satisfied.
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/gov-legal-data-driver-delivery/GOAL.md)" -le 4000
jq . goals/gov-legal-data-driver-delivery/ops/manifest.json
git diff --check -- goals/gov-legal-data-driver-delivery
```

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it. Stop if the
data/source-terms matrix reveals prohibitive upstream terms — record, halt
that driver, do not work around.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
