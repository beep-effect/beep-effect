# GOAL: ship the practice docket intake service

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a workstation service watches the attorney's Outlook mailbox through
an app-only registration and writes tentative `Docket - unverified` calendar
entries with a 30/14/7/1-day reminder ladder, after a two-agent classify,
enter and review pass, without ever guessing a date.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/practice-docket-intake/README.md`
- `goals/practice-docket-intake/SPEC.md`
- `goals/practice-docket-intake/PLAN.md`
- `goals/practice-docket-intake/ops/manifest.json`

Read those first, then read `AGENTS.md`, `CLAUDE.md`, and the standards named
by `SPEC.md`. Higher-priority repo standards outrank packet prose when they
conflict.

Scope:

- In: `packages/drivers/m365` (app-only lane, write verbs),
  `packages/drivers/m365-mcp` (test stubs only), docket intake code in
  `packages/law-practice/{domain,use-cases,server}`, the `docket-intake` service app,
  `docs/runbooks/docket-intake-entra-registration.md`, this packet.
- Out: a docket of record, a rules engine, weekend or holiday roll-forward,
  mail send, matter tagging of mail, attachment filing, contacts verbs, MCP
  exposure of write verbs, a workflow engine.

Workflow:

1. Follow the slices in `PLAN.md`, one PR per slice, published through yeet.
2. Design order: schema, then the `Context.Service` contract, then the
   implementation.
3. Record every implementing decision in the `SPEC.md` Decision Log.
4. Route operator-attended steps through the orchestrator session.
5. Keep client mail out of the repository and out of transcripts beyond ids,
   counts and hashes.
6. At P4 Close, write a closeout reflection to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` via the `/reflect` skill;
   `bun run beep lint reflection-artifacts` must pass.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied.
- [ ] Required verification commands pass, or unrelated failures are reproduced
      and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/practice-docket-intake/GOAL.md)" -le 4000
jq . goals/practice-docket-intake/ops/manifest.json
git diff --check -- goals/practice-docket-intake
```

Escalate only a step that costs money. Decide everything else, record it, and
continue.

Done only when acceptance passes and verification is complete, or when a blocker
is reported with file/command evidence.
