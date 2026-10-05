# Push-First Publish Plan

## Status

Status: `pending` (packet authored 2026-10-05 from a grill-with-docs session;
decisions D1–D10 in `SPEC.md` are locked).

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Ground the decisions in current Yeet behaviour, hosted triggers, and the ship-velocity parity audit. | `SPEC.md` decisions table and `research/SOURCES.md` filled. |
| P1 Implement | pending | Planner, flags, guards, draft PR creation, monitor terminal, `ready` verb, tests. | Acceptance criteria 1–7 in `SPEC.md`. |
| P2 Doctrine | pending | Rewrite the yeet skill sections and the `AGENTS.md` Quality Operator bullet. | No prose anywhere states full proof before publish as a rule. |
| P3 Yeet: PR to mergeable | pending | Publish this packet through the **new** default path as its own live proof. | Draft PR, `ready-pending-flip`, `yeet ready`, `merge-ready: yes`. |
| P4 Close | pending | Record reviewer-on-draft observation, write the closeout reflection, flip packet state. | Reflection lint passes; manifest flipped in the same PR. |

## P1 work items, in order

1. **Schemas first.** Add `proveFirst` and `noPr` to `YeetRunOptions` and
   `YeetRunPlanModeOptions`; remove `fast` and `startPrEarly`; default `pr` to
   true. Add `ready-pending-flip` to the monitor terminal `LiteralKit`. Add a
   `YeetReadyOptions` class.
2. **Planner.** `publishSteps`: default branch = fallow advisory → commit →
   cheap-gates tier → head-install preflight → push → draft PR create + label +
   provenance stamp → detached monitor submit. `--prove-first` branch = the
   pre-change `Match.orElse` body. `--push-only` unchanged.
3. **Guards.** Delete the `--fast`/`--monitor` guard. Add: `--prove-first`
   with `--push-only` rejected; `--no-pr` with `--ready` rejected.
4. **PR create step.** `gh pr create --draft`, then
   `gh pr edit --add-label ready-for-heavy`. Docs-only detection reuses the
   existing path filter so the label is skipped there.
5. **Monitor.** `WatchMode` verdict: when `isDraft` is the only failing
   criterion, emit `ready-pending-flip`; `MonitorPolicy` treats it as a
   terminal success and prints `bun run beep yeet ready`.
6. **`yeet ready`.** New subcommand: reads the PR with the monitor's view
   query, applies D10, runs `gh pr ready`, prints the resulting state.
7. **Tests.** Extend `yeet-command-wiring.test.ts` (default plan, `--prove-first`
   byte-equality against the old fixture, `--no-pr`), guard tests, monitor
   terminal tests, a `ready` gate test with a fake PR view.
8. `bun run beep quality package-verify @beep/repo-cli`.

## P2 doctrine edits

- `.claude/skills/yeet/SKILL.md`
  - Rename "Authoritative Gates (green local must mean green CI)" to
    "Gates: cheap-gates before push, hosted CI after". Keep the list of
    non-authoritative inner-loop commands; state that `yeet verify` is
    on-demand.
  - "Mergeable PR Workflow" step 4 becomes the new publish contract; step 5
    (draft fallback via `gh`) is deleted; step 6 states that publish already
    submitted the monitor job; step 10 becomes `yeet ready`.
  - Delete "Fast Plus Monitor" and "Start PR Early"; add "Push-First Publish"
    (D1–D8) and "Ready" (D9–D10); add the push-budget rule (D6).
- `AGENTS.md` Quality Operator bullet: "Yeet is the canonical repo-quality
  path ... `publish` gates on cheap-gates and pushes to a draft PR; hosted CI is
  the authoritative proof; one push per addressed wave."
- `docs/runbooks/agent-pools.md`: touch only if it restates the publish order.

## P3 live proof

Publish this packet's PR with the new binary from the lane
(`bun run beep` resolves from the checkout it runs in). The publish output must
show: no admission ticket, draft PR URL, job id. Babysit with
`bun run beep yeet job wait <jobId>`; expect `ready-pending-flip`; flip with
`bun run beep yeet ready`; then expect `merge-ready: yes`.

## Out-of-repo follow-through (operator memory, not this PR)

- Retire the memory clause "local full proof before publish" and record the
  push-budget rule; keep "open PRs as draft until final" and "apply
  ready-for-heavy at PR open" as they are now encoded in the tool.

## Closeout Checklist

1. Write `research/draft-reviewers.md` with what Greptile and hosted checks did
   on the first draft PR.
2. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`.
3. Run `bun run beep lint reflection-artifacts`.
4. Update `README.md` and `ops/manifest.json` phase statuses in the same PR.

## Verification Commands

```sh
test "$(wc -m < goals/push-first-publish/GOAL.md)" -le 4000
jq . goals/push-first-publish/ops/manifest.json
rg -n "push-first-publish|GOAL.md|agentLaunchers|packetAnchorDocument" goals/push-first-publish
git diff --check -- goals/push-first-publish
bun run beep quality package-verify @beep/repo-cli
```
