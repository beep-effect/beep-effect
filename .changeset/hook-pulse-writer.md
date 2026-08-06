---
"@beep/repo-ai-metrics": minor
---

Land the P1 hook-pulse writer and widen `HookPulseV1` for terminal tool failures.

`.claude/hooks/hook-pulse.sh` appends one privacy-safe `HookPulseV1` NDJSON row per
Claude Code hook event to the shared XDG evidence store. Nine hook events are wired in
`.claude/settings.json`; `PermissionRequest` is the human-wait start marker, while
`PreToolUse` fires for every tool call and therefore measures execution, not waiting.

The whitelist projection happens in the writer, not downstream. Raw payloads carry
`prompt`, `message`, `tool_input`, `tool_response`, `last_assistant_message`, and
`error`, so the row is built key-by-key from an explicit whitelist and never by deleting
keys from the input — an unforeseen future content-bearing key cannot leak.

`HookPulseEvent` gains `PostToolUseFailure`, and `HookPulseV1` gains an optional
`isInterrupt` owned by it. Harness 2.1.223 ends a tool call with `PostToolUse` **or**
`PostToolUseFailure`, never both, so a bracket closing only on `PostToolUse` would drop
every approved-then-failed wait. That loss is biased rather than merely lossy: waits
ending in failure disappear while waits ending in success are kept, and failed calls are
where retry storms live. `isInterrupt` separates "the human hit escape" from "the tool
errored"; the raw `error` string is content and stays unrepresentable.

`agentEvidenceRoot` and `hookPulseLedgerDir` are exported so the shell writer and the
replay reader share one definition of where the ledger lives. The conformance test
derives its expected output path from those exports and spawns the real script, so the
two halves fail the build the moment they disagree.

The conformance test makes the schema its own oracle: `HookPulseWaitReasonInvariant`
fails the decode if the jq derivation ever drifts from `deriveWaitReason`. It also pins
the jq no-match case that silently dropped every idle-wait row during the spike, asserts
a content canary reaches no emitted row, and asserts the writer never writes to stdout —
`PermissionRequest` is a decision hook whose stdout feeds the permission outcome.

A kill-switch sentinel disarms every hook before any parsing; `hook-pulse-switch.sh`
stamps the disarm window so the gap is explicit rather than inferred from missing rows.
