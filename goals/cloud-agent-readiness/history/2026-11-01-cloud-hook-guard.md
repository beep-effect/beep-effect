# Cloud host notifier guard (P2/D3) — 2026-11-01

Scope: the D3 desktop-notifier guard in `.claude/hooks/hook-pulse.sh` only.
P2 stays open; this note does not close it.

## Defect

`hook-pulse.sh` defaults `notifier_rev` to `desktop-ntfy-1` and launched
`sequence-break-notifier.sh` for every `PermissionRequest` row whenever the
revision was not `log-only-0`. Nothing read `BEEP_AGENT_HOST`, so a cloud
container with `BEEP_AGENT_HOST=cloud` still spawned the desktop notifier.

Reproduced in a Claude cloud container (ambient `BEEP_AGENT_HOST=cloud`) with
a temp copy of the writer beside a stub notifier that only appends to a log,
temp `HOME`/`XDG_STATE_HOME`, a synthetic `PermissionRequest{Bash}` payload,
and `BEEP_SEQUENCE_BREAK_FOREGROUND=1`. Before the fix, both
`BEEP_AGENT_HOST=cloud` and `=desktop` wrote one row and called the stub once.
No real notifier, network or live ledger was involved.

## Fix

One extra condition on the notifier block:
`[ "${BEEP_AGENT_HOST:-}" != "cloud" ]`. The block runs only after the row is
appended, so cloud rows still land. Only the exact literal `cloud` suppresses;
the guard does not guess the host from any other signal. The Codex and Cursor
adapters exec the same writer, so the guard covers all three agent kinds.
`HookPulseV1` has no host field, so no schema literal was added (PLAN P2).

## Tests

`packages/tooling/library/ai-metrics/test/hook-pulse-writer.test.ts` gained
seven cases using a scoped temp copy of the real writer and a stub notifier:

- cloud + `desktop-ntfy-1`: one `HookPulseV1`-decodable row, wait reason
  `tool-permission`, zero notifier calls;
- unset host and a non-cloud host value + `desktop-ntfy-1`: one row, exactly
  one notifier call (these controls show the stub can be reached);
- cloud and unset host + `log-only-0`: one row, zero calls (opt-out unchanged);
- cloud + disarm sentinel: no row, one `disabled` refusal, zero calls;
- cloud + malformed stdin: no row, one `encode-failed` refusal, zero calls.

The shared writer environment now clears `BEEP_AGENT_HOST` so ambient cloud
values cannot change which branch a legacy case exercises.

Against the unfixed writer, only the cloud + desktop-notifier case fails;
with the fix, all seven pass.

## Verification receipt

- `bunx --bun vitest run test/hook-pulse-writer.test.ts`: 96 passed, 1 failed.
  The failure (`refuses indexed metadata permission errors after successful
  batch entries`) also fails at the base commit. Cause: the container runs as
  uid 0, which bypasses the permission fixture. Environment-only.
- `bun run beep quality package-verify @beep/repo-ai-metrics`: docgen ok;
  build and typecheck ok; tests 30 failed / 825 passed. Every failure also
  occurs without this change: `sequence-break.test.ts` 24 (they fail the same
  way with the HEAD writer and with `BEEP_AGENT_HOST` cleared),
  `ingest.test.ts` 2 and `transcript-discovery.test.ts` 2 (permission/unreadable
  fixtures under uid 0), plus the writer case above. Environment-only.
- `biome check .` for the package: clean after formatting the new cases.
- ShellCheck 0.10.0 on `hook-pulse.sh`: the finding set is the same before and
  after the fix (one pre-existing SC2155 warning plus infos). The new lines add
  none.
- `git diff --check`: clean.
- `bun run beep yeet publish --amend --no-edit --no-pr` was stopped by its
  25-minute host timeout while cheap-gates were still running. The gates that
  finished passed: Fallow dead-code and audit (0 findings) and the JSDoc
  ratchet. Under the constrained-compute rule the branch was then pushed with
  `git push` and the draft PR opened through the GitHub API (D4 cloud handoff;
  this container has no `gh` PR route). Hosted CI is the proof.

## Gaps left open

- P2 still needs the `packet-projections.sh` skip, a recorded cloud
  SessionStart/Stop transcript with no error lines, and the MCP-scoping research.
  The `graft` items in D3 and PLAN P2 were overtaken when graft was retired on
  2026-10-28. Do not reintroduce it.
- Cloud rows still stamp the configured `notifierRev` (default
  `desktop-ntfy-1`) even though no notifier ran. A reader that treats
  `notifierRev` as the intervention state will misattribute cloud rows. That
  decision belongs to the agent-observability owner and was not changed here.
- `sequence-break.test.ts` does not clear `BEEP_AGENT_HOST` in its writer
  harness. Under an ambient cloud value its writer-launch cases would now be
  suppressed. They already fail in this container for environment reasons.
  The file was outside this task's ownership.
