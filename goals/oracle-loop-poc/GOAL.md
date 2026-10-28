# GOAL: Oracle Loop POC

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: Prove the admit-find-repair loop for agent work product in a lab app: Markdown, HTML and .docx admitted into the Doc hub through positioned codecs, findings addressed by model path, repair by splice, a generic profile and a stacked patent profile, pre-registered kill criteria. Outcome: go/no-go on promoting the core shapes.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/oracle-loop-poc/README.md`
- `goals/oracle-loop-poc/SPEC.md`
- `goals/oracle-loop-poc/PLAN.md`
- `goals/oracle-loop-poc/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: the proposed `oracle-loop` app under `apps/labs` (new, via `create-package --lab`) and lab-local packages; this packet's `history/`; the exploration's `research/OPPORTUNITIES.md`.
- Out: product apps, `@beep/md`/`@beep/markdown`/`@beep/html` source (read-only reuse), the antecedent rules (consumed from `claim-element-antecedent-check`), parse5 vendoring, the rule DSL, any tier 3 content judgment.

Workflow:

1. Inspect referenced files and current repo state.
2. Make the smallest change that satisfies `SPEC.md`.
3. Preserve unrelated user/worktree changes.
4. Keep decisions tied to evidence from files, tests, docs, or command output.
5. Update packet evidence/status if the implementation changes readiness.
6. At the Close phase, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/oracle-loop-poc/GOAL.md)" -le 4000
jq . goals/oracle-loop-poc/ops/manifest.json
git diff --check -- goals/oracle-loop-poc
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each in SPEC.md's Decision Log with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

Ship proposedCloseout and the reflection in the final implementation PR while
initiative.status stays active or paused. A proposal never reports achievement.
Done only when exact-head hosted readiness and merge evidence verify the proposal
through `bun run beep goals completion refresh --slug <slug>`, or when a blocker
that needs the operator is reported with file/command evidence.
