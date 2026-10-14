# GOAL: Answer the attorney's round-1 drawing review and add the review loop

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a round-2 live sheet set meets every 2026-10-10 markup item (F1-F10)
or carries an attorney-accepted deferral, and `beep drawings` gains mailbox
intake and review rounds keyed to the reviewed sheet-set hash (T1-T3), with
every new field defaulting to today's output.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/design-figure-review-loop/README.md`
- `goals/design-figure-review-loop/SPEC.md`
- `goals/design-figure-review-loop/PLAN.md`
- `goals/design-figure-review-loop/ops/manifest.json`
- `goals/design-figure-generation/SPEC.md` (predecessor constraints)

Read those first, then `AGENTS.md`, `CLAUDE.md`, `standards/ARCHITECTURE.md`,
and `goals/agentic-cad-patent-tooling/SPEC.md` (D9 and its widened exception).
Higher-priority repo standards outrank packet prose when they conflict.

Scope:

- In: `@beep/technical-drawing`, `@beep/occt`, `@beep/pdf-tools`,
  `@beep/m365`, `packages/tooling/tool/cli/src/commands/{Drawings,Qa}/`, the
  drawing judge prompt, generic fixtures, this packet; the live matter only
  under `BEEP_OPPOLD_CORPUS_ROOT`.
- Out: image-model generation, photo-to-DXF, desktop surface, utility numeral
  grammar, committed fonts, any client material in the repo, sending mail
  without explicit approval in chat.

Workflow:

1. Pick the phase lane from `PLAN.md` (PR-B..PR-G run in sibling lanes).
2. Schema → `Context.Service` contract → implementation; Effect v4 only,
   `LiteralKit`, `HashMap`/`HashSet`.
3. Default every new field to today's behaviour; keep
   `synthetic-bracket.golden.json` byte-identical unless a re-record is logged.
4. Run `bun run beep quality package-verify <pkg>` for every touched package.
5. Publish via yeet; record friction in `research/OPPORTUNITIES.md` as it
   happens; claim-scope questions go to the attorney, never an agent ruling.
6. At P9 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/design-figure-review-loop/GOAL.md)" -le 4000
jq . goals/design-figure-review-loop/ops/manifest.json
git diff --check -- goals/design-figure-review-loop
```

Decide changes to public API, schema, dependencies, generated files, or
destructive state yourself when the goal needs them: record each in SPEC.md's
Decision Log with its reason and how to reverse it, then continue. Escalate
only what AGENTS.md "Autonomy" lists.

Done only when the goal reaches `completed-retained` (acceptance passes,
verification is complete, closeout and reflection landed), or when a blocker
that needs the operator is reported with file/command evidence.
