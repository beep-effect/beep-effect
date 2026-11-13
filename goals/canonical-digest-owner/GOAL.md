# GOAL: Canonical Digest Owner

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: RFC 8785 is the one canonical byte form, `@beep/jsonc` owns it,
digests share one `sha256:` grammar, and the hand-rolled encoders are
replaced with proof that no stored digest changes.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/canonical-digest-owner/README.md`
- `goals/canonical-digest-owner/SPEC.md`
- `goals/canonical-digest-owner/PLAN.md`
- `goals/canonical-digest-owner/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and any governing
standards named by `SPEC.md`. Higher-priority repo standards outrank packet
prose when they conflict.

Scope:

- In: `@beep/jsonc`, `@beep/schema`, `@beep/provenance`,
  `@beep/file-processing`, `@beep/epistemics`, PacketCore's `PacketDigest.ts`
  in `packages/tooling/tool/cli`, the semantica lab encoder, one lint rule,
  this packet. Four slices in order, A to D (`PLAN.md`).
- Out: stored digests and file names, PartyKey v1 bytes, hashing backends,
  the indented renderers, `@beep/identity`, and every gated candidate in
  `explorations/protocol-as-value/MAP.md`.

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
test "$(wc -m < goals/canonical-digest-owner/GOAL.md)" -le 4000
jq . goals/canonical-digest-owner/ops/manifest.json
git diff --check -- goals/canonical-digest-owner
```

Decide changes to public API, schema, data migration, auth, infra, security
behavior, dependencies, lockfiles, generated files, or destructive state
yourself when the goal needs them: record each as a decision file (`bun run beep goals decisions add`) with
its reason and how to reverse it, then continue. Land the reversal path for an
irreversible change (a tested down-migration, a backup of deleted state) before
the change merges, and ship a breaking public API or schema change with a major
changeset. Escalate only what AGENTS.md "Autonomy" lists.

The final PR carries the reflection and writes `closeout` naming itself. Done
only when this passes and `goals completion refresh --slug canonical-digest-owner` prints
verified, when this passes under an operator ruling in `decisions/`, or when an
operator blocker is reported with evidence:
`git show origin/main:goals/canonical-digest-owner/ops/manifest.json | jq -e '.closeout.status == .initiative.status'`
