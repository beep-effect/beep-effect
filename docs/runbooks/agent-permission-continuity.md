# Desktop permission continuity

A Full-access composer label does not establish effective execution policy.
Check the effective record for the current turn and a disposable outside-root
write before trusting a launch or continuation route.

## Current support boundary

The recorded defect concerns ChatGPT Desktop's app-level
`send_message_to_thread` continuation of an existing thread. It can restore
`on-request/workspace-write/managed` while the composer still shows Full
access. That route remains unsupported for live unrestricted work pending a
successful disposable reproducer on the installed build. The historical
incident predates retained logs; absence from the later census does not clear
it. There is no recorded Claude Desktop downgrade.

On 2026-10-14 the installed packages are ChatGPT Desktop
`26.1007.71326-1` and Claude Desktop `2.37337.1-1`. No Desktop fixture on those
builds has yet been run by H4. Every route below therefore remains unknown
for those builds. The unsupported ChatGPT route is a standing operational
restriction, not a claim that the defect was reproduced on this build.

For live Codex subagents, prefer native in-session follow-up or steering.
For dormant work, use a fresh task from a parent whose current effective
policy was verified, or open the target, explicitly reselect Full access,
and type the continuation there. These are the retained candidate safe paths;
H4 has not yet behaviourally verified a Desktop safe alternative on the
installed build. Keep the program's Permission continuity acceptance open
until the fixture receipt establishes one. A CLI configuration doctor or
headless launch alone cannot verify a Desktop continuation.

**Stop and report, never escalate command by command.** If the effective tuple
changes unexpectedly, stop that fixture, grant nothing, and retain the evidence.
Do not turn a mismatch into a stream of command approval requests. Never
resume another session's live work or restart either app from a worker lane.

## Read-only census

Run `bun run beep session continuity --input <manifest.json>`. The command
reads only explicitly named files, resolves relative paths against the manifest,
and emits a JSON array of sanitized policy observations. It launches no agents,
grants no permissions, and writes no configuration or transcript. Duplicate
rollout paths are read once. Keep manifests and raw output private because
thread identifiers are workstation metadata.

```json
{
  "route": "dormant-relaunch",
  "expected": {
    "approval": "never",
    "sandbox": "danger-full-access",
    "profile": "disabled"
  },
  "rollouts": ["parent.jsonl", "parent_segment.jsonl", "child.jsonl"],
  "configs": ["config.toml"],
  "claude": [
    {
      "id": "h4-fixture-claude",
      "app": "app-session.json",
      "transcript": "cli-session.jsonl",
      "expectedMode": "bypassPermissions"
    }
  ]
}
```

The route labels are `fresh`, `dormant-idle`, `dormant-relaunch`, `background`,
and `subagent-followup`. A label describes the supplied fixture. The census
cannot infer that the user actually exercised it.

Codex records are keyed by the first `session_meta.id` in each file, with
`session_id` as the family key. Later embedded parent metadata in forked
history does not replace the child's identity. Supply every segment belonging
to the thread and every child in the family. Valid timestamped tuples render
in time order; supplied segment order and row position stabilize display ties.
Retained untimed policies append after those tuples. Settings continuity uses
strict timestamp order or positions within the same file. Equal timestamps
in different files leave that side unproven unless another turn supplies
ordered evidence. Every decoded effective tuple is compared with the chosen
policy. Missing identity, malformed rows, missing tuple fields, empty segments
or an unclosed settings boundary prevent a verified verdict. A known mismatch
remains unsatisfied in an unidentified segment or a turn without a valid time.

The config reader reuses `ModelsLocatorReader` to flag conventional top-level
`default_permissions` plus legacy `sandbox_mode`. It is a coexistence check,
not a full TOML validator or precedence resolver. Select user and applicable
trusted-project configs explicitly. A config without a collision has an
unknown policy verdict because it does not establish runtime policy. Supply
the chosen effective tuple explicitly; a trusted project may override the home
configuration. Removal and return-of-key checks belong to F's owned-field
writer with its `$HOME/.config-backups/` backup and rollback.

For Claude, pair the app record with the transcript identified by its
`cliSessionId`. The census compares app `permissionMode` with the last CLI
user row carrying `permissionMode` and the chosen mode. Missing fields or
conflicting session IDs prevent verification. Mode fields can be sparse:
an old matching row cannot establish the current turn's freshness. Validate
that separately against the live fixture, its transcript, and its probe.
The roster under `~/.claude/sessions/` has no effective permission field.

`verified` in census output means agreement of the supplied metadata only.
It is not behavioural route acceptance. A missing file or invalid manifest
fails the command without printing source contents. An empty manifest returns
an empty array; it does not produce a verified result.

## Disposable fixture protocol

The orchestrator batches the operator's GUI steps after fixture preparation.
App restarts wait for a quiet window because they affect live sessions.
If the window or required app tools are unavailable, record unknown with the
reason and leave acceptance open. Never substitute a CLI probe for a Desktop
route receipt.

Prepare `~/.cache/beep/h4-fixtures/<run-id>/` with an empty `workspace/` Git
repository and a sibling `outside/` directory. Do not create project `.codex`
or `.claude` settings. Name each session or thread
`h4-fixture-<app>-<route>-<run-id>`. Record only IDs created by this fixture run.
The worker's checkout-only scope means the orchestrator prepares this external
root and drives the GUI batch. A fresh preparation command for that batch is:

```bash
run_id="$(date -u +%Y%m%dT%H%M%SZ)"
fixture_root="$HOME/.cache/beep/h4-fixtures/$run_id"
mkdir -p "$fixture_root/workspace" "$fixture_root/outside"
git -C "$fixture_root/workspace" init --quiet
pacman -Q chatgpt-bin claude-desktop
```

Keep the run ID and fixture root in the private receipt. Use a new run ID for
each batch; do not reuse another owner's fixture root.

For each turn, first ask without running commands:

> Report only the effective permission metadata for this turn. Codex: approval_policy,
> sandbox_policy.type, permission_profile.type. Claude: effective permissionMode.
> Do not run any commands.

Read the effective record before the write. If it agrees with the chosen
mode, request `touch ../outside/probe-<app>-<route>` from `workspace/`.
Use an absolute path inside the fixture's outside directory if the app's
working directory differs. The write must be executed by the fixture agent;
a host-shell write does not test its policy. Check marker existence and read
the effective record again. On denial, approval request or tuple disagreement,
stop without granting anything. Auto mode is not bypass: record a classified
permission request as such, without treating the mode label as unrestricted.

| Route | ChatGPT Desktop | Claude Desktop |
| --- | --- | --- |
| Fresh | Open fixture task, choose Full access, self-report, probe and read current `turn_context`. | New Code fixture in bypass, then a separate fixture in auto; read app and CLI mode and probe. |
| Dormant, same process | Idle the fixture, continue by typing; separately test the fixture parent's app-level send. | Idle, then type; separately use the fixture parent's app send. Repeat bypass and auto parents. |
| Dormant, relaunch | Operator restarts, reopens and types without reselecting; separate variant reselects Full access first; separate variant uses app-level send from fixture parent. | Operator restarts, then type and app-send variants. Repeat bypass and auto parents. |
| Background | Background window with app scope alive; fixture parent sends via app-level continuation. | Fixture parent sends to background fixture via app send and peer messaging; repeat bypass and auto. |
| Native subagent follow-up | Fixture parent spawns child, lets it finish, then follows up with native collaboration. Inspect child's own rollout and marker. | Fixture parent spawns Agent child, then SendMessage follow-up. Inspect subagent transcript and marker in bypass and auto variants. |

Codex's authoritative per-turn fields are in `turn_context.payload`:
`approval_policy`, `sandbox_policy.type`, and `permission_profile.type`.
Include `<threadId>_<segmentId>.jsonl` files and settings boundaries; checking
only one file can miss the downgrade. Record `session_meta.cli_version` for
each segment and child, not just the executable currently on PATH.

Claude's app record is under
`~/.config/Claude/claude-code-sessions/<account>/<organization>/`.
Read `get_session(id).permissionMode` only for the fixture parent's own session
or sessions it started. Compare with the last transcript user row carrying
`permissionMode`, or `system/init.permissionMode` when available. Record the
CLI version from that fixture's init/roster and the app package version.

For every app and route variant, retain timestamp, app/CLI versions, fixture
ID, chosen mode, before/after effective tuple, exact probe command, marker
result, transport used, segment list and verdict. Store private raw evidence
outside the public packet, then commit a sanitized row to
[goals/repository-simplification-confidence/history/receipts/stage-5-acceptance.md#permission-continuity](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/stage-5-acceptance.md#permission-continuity).
A verified safe alternative needs the same evidence as the failing route.

If a downgrade is locally repairable, hand the owned field to F's writer,
retain its backup and drift-check result, then repeat the affected fixtures.
An upstream defect satisfies the program only when its route is explicitly
unsupported with a reproducer and a verified safe alternative. Unknown routes
remain open. Keep project `.claude/settings.json` `permissions.defaultMode`
at `default` pending contrary fixture evidence; preserve its edit deny rule.

Recovery: revert the lane PR for repository changes. Restore home config only
from F's recorded backup and rerun its drift check. Archive only this run's
fixture sessions, then remove only this run's fixture directory.
