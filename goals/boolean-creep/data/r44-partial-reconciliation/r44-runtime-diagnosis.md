# R44 runtime refusal: independent diagnosis

- **Source:** `862327c74e`
- **Main:** `8c16e648527a`
- **Runtime artifacts:**
  - UI transcript `9234b7a3…`
  - UI receipt `df58d511…`
  - summary `2b4e6876…`
  - core `5f55a49d…`
  - profile `bbacc70c…`
  - Grok binary `34444fab…`
  - bound headless doc `248d83a9…`

The JSON records the full binding set. Session IDs and the raw warning line are deliberately omitted.

## What happened

- **Dispatch:** 5 lanes are completed and awaiting review, UI failed, and 21 lanes were skipped. The stop reason is `trailing-invalid-stream`.
- **UI lane outcome:** the process exited 0. The `end` event reports `end_turn` after 29 turns, with model `grok-4.7-build`. Guards before and after both passed. It made 80 tool calls with no failures. The final pointer text is complete and the report is empty.
- **The refusal:** exactly one non-JSON line follows the `end` event. It is a tracing-format `WARN … Resident session actor exited unexpectedly; reaping as DeadFailed` line carrying a `session_id` field.
- **The other five transcripts** share the same 24 startup warnings, all before `end`, and have nothing after `end`.

## Mechanism

1. **Grok logs to stderr.** The runtime profile sets `RUST_LOG=warn`. The bound Grok headless doc says *headless logs to stderr* and suggests `2> debug.log` to capture them.
2. **The controller merges stderr into stdout.** `run_process` calls `Popen(..., stderr=subprocess.STDOUT)` (core:34), so diagnostic log lines land in the streaming-json protocol transcript.
3. **The parser fails closed.** `terminal_event` accepts non-JSON lines before `end` but rejects them after it (core:70-79). That was correct: with merged streams, a teardown log line cannot be told apart from protocol corruption.

## Evidence that the warning is a teardown diagnostic

| Evidence | Finding |
|---|---|
| Grok's own `logs/unified.jsonl` | All six lanes show the same shutdown order: `handle_prompt.done` → `workspace_teleport.skip` → `session_end.worker_join{outcome: joined}`. |
| UI timeline | Prompt done at 21:02:37.895, **WARN at 21:02:38.978**, worker joined at 21:02:39.133. The join took 388 ms, against 205–261 ms in the other lanes. |
| Causality | Grok wrote the WARN before it exited. The launcher only sends `killpg` after exit, so it cannot have caused the warning. |
| UI session signals | `errorCount 0`, `toolFailureCount 0`, `cancellationCount 0`, `turn_ended`, with the same 16-file layout as the successful lanes. |

**Verdict:** the warning is *probably harmless, but not proven*. Grok is a closed binary, the actor semantics are undocumented, and `DeadFailed` could mean a real crash in another context. Whitelisting the text alone is therefore not justified.

- The UI lane **stays failed**.
- No retroactive success, coverage, dry-round or P3 credit is granted.

## Would separating stdout and stderr fix this?

Yes, and it makes detection stronger rather than weaker.

**stdout (`.ndjson`), stricter than today:**
- Every non-empty line must be a JSON object.
- Exactly one `end` event, and it must be the last line.
- No `error` events.
- Pre-`end` noise, which today's parser tolerates, is no longer allowed.

**stderr (`.stderr.log`):**
- The launcher opens it exclusively, outside the sandbox, and binds its hash in the receipt and summary.
- The 402 / usage-exhaustion scan covers both stdout and stderr.

**stderr policy, fail-closed:**
- Every line must parse as a tracing record. Panics, backtraces and raw text fail.
- Any `ERROR` line fails.
- A `WARN` line passes only if it matches a pinned exact template:
  - **Startup template:** untrusted-folder MCP skip, with the server in the pinned set of 9.
  - **Startup template:** plugin registry locked.
  - **Startup template:** `disallowedTools` no-match, with agent `grok-build-plan` and the tool in the pinned set of 4.
  - **Teardown template:** `Resident session actor … DeadFailed`, at most once, and only when all of the following hold:
    - its `session_id` equals the stdout `end.sessionId`;
    - the process exited 0 with `end_turn`;
    - the session signals show `errorCount 0` and `toolFailureCount 0`;
    - its timestamp is at or after the session's `handle_prompt.done`.
- When the teardown template passes, the lane is flagged `runtimeTeardownWarning: true` for parent review.
- Anything else fails.

**Rejected alternatives:**
- **Loosen the trailing check on the merged stream:** leaves the stream ambiguity in place.
- **Unset `RUST_LOG`:** hides the diagnostics and loses discovery evidence.
- **Text-whitelist the warning:** admits it anywhere, with no evidence tying it to teardown.
- **Use `GROK_LOG_FILE`:** needs an environment and profile-tree rebinding.

## Recommended next action

1. **Terminalize R44 like R43.**
   - Classification: `incomplete-runtime-stream-refusal`, with the 5/1/21 lane split.
   - Zero credit.
   - Completed-lane reviews are informative only.
   - A fresh full R45 is required.
   - Public artifacts redact session IDs and the raw warning line.
2. **New bundle.**
   - Split-stream `run_process`, a strict stdout `terminal_event`, and a `stderr_policy` check.
   - The receipt gains `stderrSha256` and `runtimeTeardownWarning`.
   - The confinement, environment, tools, commands, model and profile tree stay unchanged.
3. **Provider-free tests** cover:
   - trailing and pre-end non-JSON lines on stdout;
   - an unknown WARN, an ERROR, and a panic line;
   - each teardown constraint violated individually, and all constraints satisfied (passes, flagged);
   - startup templates with unpinned values;
   - 402 text in stderr.
4. **Bounded probes, only after the parent approves:**
   - **P1:** one exact-command probe with `--max-turns 1` and split streams. Pass criteria: stdout is pure JSON with `end` last; stderr contains only startup templates; the tree, config and HOME are stable; the expected surfaces and model are present. Bind all hashes.
   - **P2 (optional):** a split-stream all-tools probe.
   - Do not try to reproduce the race; it hit 1 of 6 lanes, nondeterministically.
5. **Fresh independent review** of the new bundle before R45 is admitted.

## Remaining uncertainties

- The actor and reaper semantics are undocumented, so the classification rests on behavioral evidence only.
- Flush ordering is proven for one occurrence only. That is why the policy also requires exit 0 and `end_turn`, and flags the lane.
- A reap that coincided with a truncated stdout would still be caught independently by the strict stdout rules.
- **Separate observation, not part of this refusal:** the session signals show 3 trace uploads to the provider's gcsQueue even though codebase upload is disabled. This is worth a separate operator note.

No provider calls, relaunches, edits, tests or git changes were made.
