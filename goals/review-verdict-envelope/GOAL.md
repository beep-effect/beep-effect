# GOAL: ship the review verdict envelope

Repo root: the current `beep-effect` checkout. All paths are repo-relative.

Outcome: one cross-producer review envelope (`ReviewItem`, `SourceRef`, `VerdictRow`) in
`@beep/law-practice-domain`, `ReviewQueue` + `VerdictProjector` services in
`@beep/law-practice-use-cases` (claim-finding verdicts → `ClaimDisposition` projections), spike evidence
that decides the review pane, and the amendment delivered to the `practice-claude-mod` owner.

This is a compact `/goal` launcher. The contract lives in:

- `goals/review-verdict-envelope/SPEC.md` (normative)
- `goals/review-verdict-envelope/PLAN.md`
- `goals/review-verdict-envelope/README.md`
- `goals/review-verdict-envelope/ops/manifest.json`

Read those, then `AGENTS.md`, `CLAUDE.md`, and the source exploration
`explorations/attorney-review-workspace/` (BRIEF, MAP, DECISIONS). Higher repo standards outrank
packet prose.

Scope:

- In: `packages/law-practice/domain/src/values/{ReviewItem,SourceRef,VerdictRow}/`,
  `packages/law-practice/use-cases/src/{ReviewQueue,VerdictProjector}/`, their tests and
  barrels, a changeset, and this packet (spike report under `history/`).
- Out: pane or plugin code, the `practice-claude-mod` packet, Box writes, `$.prompt.submit`,
  `$.model.*`, artifact/Doc review surfaces, client files anywhere, and the gated re-entry
  points in the exploration MAP.

Phases (PLAN.md has entry/exit criteria):

1. P0 Evidence: ask the attorney one plain question (which app he lives in daily); run S1 and S3
   (go/no-go), then S2, S4, S6, S8 and the one-hour Word check. Report under `history/`.
2. P1 Schema: `SourceRef` (reuse the `DurableLocator` quote shape), `ReviewItem` tagged union by
   `kind`, `VerdictRow` append-only with undo and lock. May run in parallel with P0.
3. P2 Services: `Context.Service` contracts first, then implementation. `right` → `active`,
   `wrong` → `rejected` with the note as reason. Spike S5 round-trip test is the verify.
4. P3 Handoff: deliver
   `explorations/attorney-review-workspace/research/AMENDMENT-practice-claude-mod.md`; if S1
   failed, rewrite it as the row-only fallback and reopen the exploration at `decompose`.
5. P4 Yeet: PR to mergeable. P5 Close: reflection via `/reflect`.

Laws: schema → `Context.Service` contract → implementation; Effect v4 from `effect/<Module>`;
`LiteralKit` for literal unions; `S.Class` schemas with `$I`; `effect/HashMap`/`HashSet`, never
native `Map`/`Set`; JSDoc per `.patterns/jsdoc-documentation.md`. Never name the attorney,
clients, machines, or home paths.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/review-verdict-envelope/GOAL.md)" -le 4000
jq . goals/review-verdict-envelope/ops/manifest.json
git diff --check -- goals/review-verdict-envelope
bun run beep quality package-verify @beep/law-practice-domain
bun run beep quality package-verify @beep/law-practice-use-cases
```

Decide schema, API, and scope calls yourself: record each in SPEC.md's Decision Log with its
reason and how to reverse it, then continue. Escalate only what AGENTS.md "Autonomy" lists.

Done only at `completed-retained` (acceptance, verification, closeout and reflection landed),
or when a blocker that needs the operator is reported with file/command evidence.
