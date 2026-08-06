# GOAL: land the legal position relator runtime

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: the law-practice slice owns a closed eight-member `HohfeldPosition`
domain whose correlative and opposite derivations over
`(positionKind, LegalActContent)` are proven total, involutive and commuting,
and a simple `LegalPositionRelator` storing one advantage-side relation and
deriving every other view — never computing legal judgment.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract — under `goals/legal-position-relator-runtime/`: `README.md`,
`SPEC.md`, `PLAN.md`, `ops/manifest.json`, `research/SOURCES.md`.

Read those first, then `AGENTS.md`, `CLAUDE.md`, and the cross-slice rules in
`standards/architecture/10-cross-slice-coordination.md`. Higher-priority repo
standards outrank packet prose when they conflict.

Scope:

- In: `packages/law-practice/domain`, `packages/law-practice/use-cases`, and
  the EntityId registrations in
  `packages/shared/domain/src/identity/LawPractice.ts`; rung 2 adds
  `law-practice/tables`, `law-practice/server`, and the slice's **second**
  db-admin migration (+ PGlite test + `AcceptedProofManifest`).
- Out: the epistemic and agents slices' vocabularies and SPECs, any new
  package or `law-practice/*` → `epistemic/*` package edge, any stored
  correlative or opposite view, any computed legal judgment (full list: SPEC
  Non-Goals).

Workflow:

1. P0: re-verify `research/SOURCES.md` §4 surfaces, then make the binding
   rung-2 handoff pick per SPEC Constraints (four shapes; three carry
   disqualifying evidence and the fourth sits near its own removal condition),
   with an `architecture-guardian` check. Record it in the SPEC decision log
   with the consumer and binding files. Deferring with recorded evidence is
   legitimate (sibling precedent).
2. P1 (rung 1): schema → `Context.Service` contract → implementation, in that
   order. Write `LegalPositionRelatorPolicy.test.ts` failing first, then green
   over in-memory/test-only layers. Budget circuit-breaker: drop
   `LegalScopeContext` first, then degrade `Party` linkage — never the
   `(kind, content)` derivation soundness or one-stored-relation.
3. P2 (rung 2): transition events, `CorrectionDelta`, `PriorityBasis`, durable
   append-only ports/repo/layer, the migration lane, the CQ fixtures, and the
   handoff. P2 never starts before P1's test is green.
4. Preserve unrelated worktree changes; keep decisions tied to evidence, and
   update packet evidence/status as readiness changes.
5. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill (see
   `PLAN.md` P4 Closeout Checklist); `bun run beep lint reflection-artifacts`
   must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (gated criteria only when
      their owning goals have landed).
- [ ] Required verification commands pass, or unrelated failures are
      reproduced and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/legal-position-relator-runtime/GOAL.md)" -le 4000
jq . goals/legal-position-relator-runtime/ops/manifest.json
git diff --check -- goals/legal-position-relator-runtime
```

The SPEC matrix adds the domain-tier and package-edge checks.

Stop and report before changing public API, schema, data migration, auth,
infra, security behavior, dependencies, lockfiles, generated files, or
destructive state unless `SPEC.md` explicitly requires it — and stop if the
handoff would need a forbidden import or a new package edge.

Done only when acceptance passes and verification is complete, or when a
blocker is reported with file/command evidence.
