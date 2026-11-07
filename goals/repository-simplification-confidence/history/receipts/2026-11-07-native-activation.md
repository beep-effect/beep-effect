# F-CLAUDE applied, F-CURSOR qualified, F-DOCKER measured — 2026-11-07

Refs #1862. Continues
[`2026-11-02-native-links-and-claude-home.md`](2026-11-02-native-links-and-claude-home.md).
Under the 2026-11-02 operator ruling, F-CLAUDE has a home-write grant and F-CURSOR and
F-DOCKER waited on the launcher sign-ins. The 48-hour config freeze ended
2026-11-04T03:10Z. Base: `origin/main` `cf46c70048`. Times are UTC.

| Disposition | Result | Meets SPEC acceptance |
| --- | --- | --- |
| F-CLAUDE | Applied: one key written, journaled, reversible | Yes |
| F-CURSOR | Qualified: 3 of 3 fixed prompts on the `composer-2.5` seat, sandbox on | Yes, on the `cursor.volume` seat (Opus witness optional after 2026-11-11) |
| F-DOCKER | Read-only half: live measurement, proposed allowlist, apply plan | No: the apply waits for a quiet window |

## F-CLAUDE: applied

A bare `beep models apply --write` would also rewrite `~/.grok/config.toml`
`[models] default_reasoning_effort` (`xhigh` → `medium`), which the ruling retained as-is
under F-GROK-COMPAT. So both the preview and the write were limited to one target.

```sh
bun run beep models apply --dry-run --target home.claude.settings
# models: preview home.claude.settings [json-key] change=true expected=claude-fable-5-1
# models: preview home.claude.settings [json-key] change=false expected=medium
bun run beep models apply --write --target home.claude.settings
# models: write home.claude.settings; journal models-2026-11-07T032229045Z-2780947
```

- Change: `~/.claude/settings.json` `model` went from `"opus"` to `"claude-fable-5-1"`. A sorted-key
  JSON diff of the pre-write copy against the live file shows only that line. `effortLevel`
  was already `medium`, and every other key, plugin and header is unchanged.
- Journal: `models-2026-11-07T032229045Z-2780947`. The backup and journal are
  under `~/.config-backups/`.
- Reverse: `bun run beep models restore --journal models-2026-11-07T032229045Z-2780947`.
- `bun run beep models check` afterwards: no `home.claude.settings` finding. Six findings remain.
  One is `home.grok.config` `current="xhigh" expected="medium"`, kept by the ruling. The other
  five are `home.zshrc` wrapper assignments the checker cannot parse
  (`Unsupported shell form`, lines 158–159). Those are manual-verification targets that `apply`
  never writes. The command exits 1 on those six.

## F-CURSOR: qualified on the composer-2.5 seat

Gate: `cursor-agent status` reports logged in (CLI `2026.11.05-86047df`). The Opus seat
(`claude-opus-5-5-medium`) still returns the usage-limit `ActionRequiredError` until the
monthly cycle ends on 2026-11-11. Setting a spend limit would spend money, so it was not set.
The F-CURSOR row names no model, so the runs used `composer-2.5`, the manifest's
`cursor.volume` role. Decision: [`2026-11-07-f-cursor-composer-seat-activation`](../../decisions/2026-11-07-f-cursor-composer-seat-activation.md).

Workspace: a disposable scratch directory outside every repository. It held:

- `.cursor/cli.json`, copied from the repo (deny `Shell(git|sudo|pkexec)`);
- `.cursor/hooks/deny-shell.sh`, copied verbatim (D21 guard, `failClosed`);
- a local pulse logger, registered for all seven events the repo's `.cursor/hooks.json`
  pulses, that answers the hook protocol the way `hook-pulse.sh` does;
- a two-test `node:test` fixture;
- a one-tool stdio MCP server, `rsc-probe`, with the tool `rsc_probe_echo`.

The prompts contain no repository, corpus or client material and no secrets (D11).

Argv for all three runs (recipe v2, prompt differs):

```sh
timeout -k 10 600 cursor-agent -p --trust --force --sandbox enabled \
  --workspace <scratch>/cursor-ws --model composer-2.5 --output-format stream-json \
  "<fixed prompt>" </dev/null > <run>.ndjson 2> <run>.stderr
```

| Run | Fixed prompt (abridged) | Exit / result | Wall / API | Activation steps | Hook events fired |
| --- | --- | --- | --- | --- | --- |
| r1 hooks | run `ls src`, then `echo git`, quote any block | 0 / `success` | 10.5 s / 6.7 s | 2 shell calls | sessionStart, preToolUse ×2, postToolUse ×1, postToolUseFailure ×1, sessionEnd |
| r2 read+test | read both files, run `node --test src/`, report counts | 0 / `success` (2 pass, 0 fail, `sum`) | 12.9 s / 7.6 s | 2 reads, 1 shell | sessionStart, preToolUse ×3, postToolUse ×3, sessionEnd |
| r3 MCP | call `rsc_probe_echo` with token `f-cursor-1862` | 0 / `success` (`rsc-probe:f-cursor-1862`) | 9.1 s / 5.6 s | 1 `getMcpTools`, 1 `mcpToolCall` | sessionStart, preToolUse ×1, postToolUse ×1, sessionEnd |

- D21 witness: in r1 the copied guard denied `echo git` (any token named `git` is denied), and
  the agent quoted the block message verbatim. No git, sudo or pkexec ran.
- MCP witness: the server log shows `initialize`, `notifications/initialized`, `tools/list` and
  `tools/call`. Before r3, `cursor-agent mcp enable rsc-probe` approved the server for the
  scratch workspace only. The approval landed in
  `~/.cursor/projects/<scratch-slug>/mcp-approvals.json`, and `--approve-mcps` was not used.
- Failures: none. Gaps: `beforeSubmitPrompt` and `stop` never fired in `-p` mode on any run.
  `getMcpTools` produced no pre/post hook pair. These come from the headless CLI. The hook
  wiring is fine.

Native-field preservation (sha256 before → after):

| File | Result |
| --- | --- |
| `~/.cursor/mcp.json`, `argv.json`, `agent-cli-state.json` | unchanged |
| repo `.cursor/cli.json`, `.cursor/hooks.json`, `hooks/deny-shell.sh`, `hooks/hook-pulse.sh` | unchanged |
| `~/.cursor/cli-config.json` | rewritten by every run (`d00cb478…` → `5ae9c3a4…`) |

Fields changed in `cli-config.json`:

- `model.{modelId,displayModelId,displayName,displayNameShort}` and `selectedModel` went from
  Opus 5.5 300K Medium to Composer 2.5.
- `modelParameters.composer-2.5` `fast` went from `true` to `false`.
- `composer-2.5` moved to the front of `modelSelectionHistory`.
- `privacyCache.updatedAt` changed.
- `sandbox.mode` stayed `disabled`, the native default. Lanes keep passing
  `--sandbox enabled` explicitly.

So `--model` on argv silently replaces the operator's interactive default. The file was
backed up to `~/.config-backups/rsc-f-cursor.20261107T0326Z/` (`cli-config.before-runs.json`,
`cli-config.after-runs.json`). Then only `model`, `selectedModel`, `modelParameters` and
`modelSelectionHistory` were restored from the pre-run copy. After the restore, only
`privacyCache` differs from pre-run, and the default reads `claude-opus-5-5` again. To restore
fully, copy `cli-config.before-runs.json` back over the live file.

Unrelated observation: `~/.cursor/` holds 223 orphaned `statsig-cache.json.<pid>.<uuid>.tmp`
files. These runs added none, and the files were left in place.

## F-DOCKER: read-only half

The sign-in looks met: Docker Hub credentials are in the creds store and
`mcp/docker-mcp-catalog:latest` resolves. Codex, Claude, Grok and Junie share the gateway on
`127.0.0.1:8811`, and about 12 live agent sessions were using it. The unit, its drop-ins and
the `dankstation` profile were not touched. Decision:
[`2026-11-07-f-docker-allowlist-apply-quiet-window`](../../decisions/2026-11-07-f-docker-allowlist-apply-quiet-window.md).

Live state: `docker mcp` v0.44.2. The unit is active since 2026-11-05 and its `ExecStart` is
still legacy `--servers sequentialthinking,github-official`, with no `--profile`, no `--tools`,
no dynamic discovery and no code mode. The profile snapshot still lists 42 tools. The running
gateway lists 47, so the ownership/mode mismatch from the stage-3 inventory persists.

### Measurement

Method: authenticated MCP `initialize` and `tools/list` over streaming HTTP. The bearer was read
from the Claude client definition in memory and never printed. No tool was called.

| | Tools | Compact JSON bytes | Pages | initialize / tools/list |
| --- | --- | --- | --- | --- |
| Baseline (stage-3 inventory) | 47 | 128,947 | 1 | — |
| Live 2026-11-07 | 47 | 128,947 | 1 | 16 ms / 2 ms |

Server `Docker AI MCP Gateway` 2.0.1, protocol `2025-06-18`: 46 `github-official` tools and 1
`sequentialthinking`.

### Observed use per client

Counts come from local transcripts. They cover only invocation records, not tool listings.
Missing telemetry never proves non-use.

- Claude (1,090 transcripts; actual `tool_use` blocks): `issue_read` 3,
  `search_pull_requests` 2, `get_file_contents` 2, `list_issues` 1.
- Codex (session `server/tool` records): `pull_request_read` 235, `update_pull_request` 13,
  `create_pull_request` 5, `issue_write` 3, `search_pull_requests` 2, `issue_read` 2,
  `pull_request_review_write` 1, `list_pull_requests` 1,
  `add_reply_to_pull_request_comment` 1.
- Grok, Junie: their local state holds tool listings and handshake records but no invocation
  records this scan could tell apart, so their use is unmeasured.

### Proposed `--tools` allowlist (19 tools, ~64.8 KB, −49.7 % schema bytes)

- Observed (11): `pull_request_read`, `update_pull_request`, `create_pull_request`,
  `list_pull_requests`, `search_pull_requests`, `pull_request_review_write`,
  `add_reply_to_pull_request_comment`, `issue_read`, `issue_write`, `list_issues`,
  `get_file_contents`.
- Kept for the PR/issue review and triage workflows (8): `add_comment_to_pending_review` (pairs
  with `pull_request_review_write`), `search_issues`, `add_issue_comment`, `search_code`,
  `list_commits`, `get_commit`, `get_me`, `sequentialthinking`.
- Excluded (28):
  - Writes that bypass the signed-commit and Yeet merge path: `merge_pull_request`,
    `push_files`, `create_or_update_file`, `delete_file`, `create_branch`,
    `create_repository`, `fork_repository`, `update_pull_request_branch`.
  - Copilot: `assign_copilot_to_issue`, `request_copilot_review`.
  - Releases, tags, teams, labels, collaborators, issue fields and types, `sub_issue_write`,
    `update_issue_comment`, `search_users`, `search_repositories`, `search_commits`,
    `list_branches`, `ui_get`.

The allowlist reflects what usage was observed. It does not freeze the tool set: re-admitting
a tool is a one-word edit plus a restart.

### Apply plan for a quiet window

Preconditions:

- No live clients on 8811. Check with `ss -tnp state established '( sport = :8811 )'` and
  confirm with the orchestrator that no Codex, Claude, Grok or Junie session is mid-task.
- The F panel or orchestrator accepts the allowlist above.
- The owner model stays as it is: `--servers` plus `--tools` (R56). Do not switch to
  `--profile`, which is mutually exclusive with `--servers`.

Steps:

1. Back up:
   `B=~/.config-backups/rsc-f-docker.$(date -u +%Y%m%dT%H%M%SZ); mkdir -p "$B" && cp -a ~/.config/systemd/user/docker-mcp-gateway.service ~/.config/systemd/user/docker-mcp-gateway.service.d "$B"/ && docker mcp profile export dankstation "$B/dankstation.yaml"`.
2. Validate offline: run the current effective `ExecStart` argv with `--dry-run` and
   `--tools <list>` appended. It starts the gateway without listening. Confirm it starts and
   resolves all 19 names.
3. Write `~/.config/systemd/user/docker-mcp-gateway.service.d/97-tools-allowlist.conf`
   containing `ExecStart=` (reset) followed by the current effective `ExecStart` copied
   verbatim from `systemctl --user cat docker-mcp-gateway.service`, with
   `--tools pull_request_read,update_pull_request,…,sequentialthinking` (the 19 names above)
   appended after `--servers …`.
4. Apply: `systemctl --user daemon-reload && systemctl --user restart docker-mcp-gateway.service`.
5. After: rerun the in-memory `tools/list` measurement and expect 19 tools and about 64.8 KB.
   Diff the names against the allowlist and refuse on drift. Then run one representative call
   per client: Codex `pull_request_read`, Claude `issue_read`, and a `tools/list` touch from
   Grok and Junie. Record latency and failures.
6. Roll back (prove once): `rm ~/.config/systemd/user/docker-mcp-gateway.service.d/97-tools-allowlist.conf && systemctl --user daemon-reload && systemctl --user restart docker-mcp-gateway.service`,
   then confirm 47 tools and 128,947 bytes. To restore everything from backup, copy `"$B"/*`
   back and do the same reload and restart.
7. Write a dated receipt and decision file. The final config fingerprint goes to the named
   review panel, as SPEC §F requires.

## Still open (#1862)

- F-DOCKER: the quiet-window apply, validation and rollback proof above.
- Optional: an Opus-seat F-CURSOR witness after the 2026-11-11 Cursor quota reset.
- Packet-level: the three-model review panel on the final F fingerprint.
