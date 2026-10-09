# Native managed-session qualification

2026-10-09. This report separates the implementation's provider evidence from the
earlier exploration spikes. Codex/Grok and Codex/Claude autonomous qualification passed. Claude also passed
queued acceptance during a busy native turn and subsequent idle delivery.
Existing app attachment and browser automation retain their separate goal gates.

## Frozen native implementation review

The provider package passes source and test type-checks, all 19 synthetic native
transport cases, and canonical full package audit/docgen. The independent reviewer
reran all 19 cases, verified the same 15 source/test digest entries afterward,
confirmed no synthetic peers remained, and reported zero actionable findings.
No model calls were made by this review.

Three independently identified lifecycle/provenance defects were repaired:

- ACP initialization, authentication, session creation, mode selection and
  cancellation now have bounded deadlines; failed enrollment stops its owned child.
- Codex buffers at most 128 early completions and selects the exact returned turn
  identity. A current completion followed by a stale completion before the start
  response no longer loses the current result.
- Cursor permission provenance is launch-enforced. Its model identity is read from
  ACP, but the handshake does not independently report the effective permissions.

Wire records use annotated schema classes and raw protocol data is decoded at the
boundary. A Claude handshake regression from class conversion was caught and
repaired before this passing snapshot. Deadline fixtures run sequentially within
their shared TestClock resource layer. The package and independent review receipts
are retained privately; these results qualify synthetic transport behavior only.

## Grok mailbox sandbox preflight

The first native-child diagnostic reproduced `SQLITE_READONLY_DIRECTORY` while
the outer sandbox could write its private mailbox. The inner Grok sandbox was the
remaining restriction. No model inference was used in either diagnostic.

With the native `beep-messaging` profile extending read-only and granting write
access to only the owned mailbox directory, the actual MCP child successfully
performed its SQLite write preflight. Writing to a sibling disposable workspace
was refused with `PermissionError`, even though the outer sandbox allowed that
workspace. The MCP handshake connected all six messaging tools. Initialization,
existing-subscription authentication and session creation completed, and the owned
process was stopped. The [sanitized receipt](GROK-SANDBOX-PREFLIGHT.json) preserves
these facts without account, process, session or filesystem identifiers.

The launch explicitly selected the built-in mediators `search_tool,use_tool`.
That argv alone does not prove all other built-in tools were unavailable during
inference. The next live receipt must establish the actual autonomous message
exchange; policy/tool inventory remains a distinct claim. These diagnostic results
are not retroactively assigned hashes from the final repository driver.

## Live proof contract

The [opt-in runner](probes/README.md) submits one controller seed. The enrolled
Codex session must acknowledge it and send a request through its scoped MCP tool.
The peer must acknowledge and reply through its own tool, and Codex must acknowledge
the reply. Success requires exactly three logical messages, nonce and reply
correlation, one persisted outbound grant use per provider, completed native turns,
owned cleanup and unchanged source/executable hashes throughout the run.

Claude's separate busy exercise submits two controller messages before that
autonomous exchange. It must witness the second message accepted while the first
acknowledged native turn is still active, then both messages draining with no
outbound grant usage. This qualifies durable queued acceptance during an active
turn and subsequent idle delivery; it does not claim native steering.

All raw logs, generated identities, grants, databases and authentication references
remain in owner-private cache state. Failed attempts retain their original
ambiguity and quota receipts. A new test uses new disposable state, never a reset
of an uncertain attempt.

## Codex and Grok autonomous result

The [frozen-source receipt](GROK-MANAGED-ROUNDTRIP.json) passes. The host submitted
one seed and did not forward peer replies. Codex acknowledged and sent the request;
Grok acknowledged and replied; Codex acknowledged that reply. Exactly three logical
messages were present, each provider used its one-message grant once, every native
dispatch settled, and both owned process groups stopped. Source, runner and native
executable hashes were unchanged throughout. The whole run took 39.91 seconds,
including setup and teardown; this is not a message-latency measurement.

Private Grok events recorded one MCP server connecting six tools. Observed built-in
calls were `search_tool` and `use_tool`; the two MCP calls were
`agent_message_acknowledge` and `agent_message_reply`. This establishes the observed
tool path, not a universal negative proof that every unrelated built-in would be
denied. The receipt therefore retains `builtInToolDenialVerified: false`.

The preceding frozen run acknowledged its seed but declined to send because the
wrapper did not state the host's messaging authorization. Its failed receipt and
zero outbound grant usage are retained privately. The host wrapper now explicitly
authorizes grant-bound messaging and excludes other tools, file work, agent launch,
policy changes, merge and spending. Independent boundary review found this wording
consistent with existing grant authority. No store or permission limit was widened.

## Claude MCP launch correction

A failed busy/idle attempt enrolled both endpoints but completed the Claude
primer without acknowledgment. It stopped with `busy-opportunity-missed` after
103.4 seconds; owned cleanup and unchanged-source/executable checks passed.

A zero-model diagnostic on Claude Code 2.1.295 isolated the cause. Both launch
profiles initialized successfully. `--safe-mode` reported zero MCP servers;
`--restricted` connected one owned stdio fixture exposing the six messaging
tools. Repeating the comparison with explicit instruction exclusions and auto
memory disabled produced the same result. No user/model prompt was sent, the
network namespace was unshared, tool calls were refused by the fixture, and all
owned process groups stopped. Existing subscription credentials were referenced
read-only, not copied or read by the controller.

The correction keeps strict explicit MCP configuration, an exact tool allowlist,
empty built-ins, empty inherited setting sources, disabled slash commands and
`dontAsk`. It adds `claudeMdExcludes: ["**"]` and `autoMemoryEnabled: false`.
These are documented launch settings, not effective-context readback.
[Claude's memory documentation](https://code.claude.com/docs/en/memory#exclude-specific-claude-md-files)
states that managed administrator instructions cannot be excluded. `--bare`
is excluded because installed help says it bypasses subscription OAuth.

This diagnostic proves explicit MCP startup only. The separate live receipt
below qualifies queued-busy/idle behavior and autonomous messaging through the
real router after the correction.

## Codex and Claude busy/idle and autonomous result

The [frozen-source receipt](CLAUDE-MANAGED-ROUNDTRIP.json) passes. The controller
observed Claude acknowledge its primer while that native turn remained active.
A second controller message was accepted during that active turn; both messages
subsequently acknowledged and settled without consuming outbound grant budget.
This is durable queued follow-up, not native steering.

Those same owned Codex and Claude sessions then completed the autonomous
three-message exchange. Codex acknowledged the seed and sent the request, Claude
acknowledged and replied, and Codex acknowledged the reply. All five messages
were acknowledged, every native dispatch settled, and each provider used exactly
one outbound grant message. The controller did not forward peer replies.
Source, runner and executable digests remained unchanged and all owned process
groups stopped. The whole run took 56.2 seconds including setup and cleanup;
it is not a message-latency measurement.

The corrected provider package passed all 19 synthetic transport tests, source
and test type-checks, and canonical full audit/docgen (14.4 and 2.6 seconds).
These receipts qualify owned managed sessions on the recorded versions. Existing
application enrollment and universal built-in tool denial remain unproved.

## Current capability evidence

| Route or behavior | Evidence | Remaining limit |
| --- | --- | --- |
| Owned Codex ↔ Grok messaging | Actual scoped MCP send/reply/ACK, three logical messages, settled turns and budgets | Managed sessions only; no universal built-in denial claim |
| Owned Codex ↔ Claude messaging | Actual scoped MCP send/reply/ACK after busy exercise, three logical messages | Managed sessions only |
| Claude busy follow-up | Actual second message accepted during an acknowledged active turn; both messages drain | Queued follow-up, not steering into the active turn |
| Codex active steering and cancellation | Synthetic exact-turn control, stale-completion and terminal fencing tests | This implementation's managed live receipts do not exercise active controls |
| Persistent input and resume | Synthetic persistent peers and wrong-resumed-session rejection; actual multi-turn managed exchanges | No takeover of an existing visible application conversation |
| ACP enrollment and cancellation bounds | Synthetic deadline/failure tests; scope-owned cleanup in live receipts | Cancellation acceptance is distinct from terminal model cancellation |
| Cursor approved route | Handshake/access-denial classification, including denial despite `end_turn` | Generation access remains blocked; no purchase or model substitution |
| Claude web ↔ Grok | Earlier disposable visible-app browser-mediated proof in the exploration | Production autonomous browser bridge remains queued |
| Native Desktop, cloud ChatGPT/Work, federation | Named follow-up gates in the exploration map | Not qualified by these managed receipts |

The final Claude launch correction also received an independent read-only review
with zero actionable introduced findings on the exact three-file digest manifest.
No model call or source change was made by that review.

The two live receipts describe successive frozen snapshots. The later change
touched only the Claude launch module, its synthetic fixture and provider README;
Grok, Codex, router and scoped-tool implementation remained unchanged. The Grok
receipt retains its original complete source inventory, including the earlier
Claude module hash. It is not relabeled as a run of the later complete tree.

## Hosted documentation repair

The first integrated PR head (`5b0207b8c7`) failed Heavy Docgen and the fresh
JSDoc inventory ratchet. Twenty-seven private provider exports used an invalid
category; required examples, the messaging-tool domain's annotation/type
companion, and two router comment section orders also needed repair. Package
docgen had compiled/rendered successfully without proving those global metadata
requirements.

The corrective wave supplies approved categories and 50 compilable provider
examples, canonical LiteralKit metadata and the private type companion. The two
router changes move comments only. Literal domains, wire fields, provider pins,
tool grants and native control flow remain unchanged. Full provider audit/docgen
passed again (21.9 and 3.0 seconds), all four scoped documentation tasks passed,
and a direct provider metadata check analyzed the package without proof-manifest
reuse and found zero missing documentation. The CLI's comment-only repair passed
canonical quick lint/check (3.7 and 8.5 seconds).

The live receipts retain their original source inventories. This documentation
and schema-metadata wave is subsequent evidence, not a retroactive reassignment
of live-run hashes. A fresh global inventory generated after the source freeze
passed the JSDoc ratchet: 21 tracked totals, zero increases, and zero legacy
non-generated findings. Missing export examples decreased from nine to eight;
no baseline was weakened. The final hosted head remains the merge gate for the
corrective wave.

## Hosted transient-storage correction

Review of PR #1571 reproduced a P1 with a real SQLite lock exceeding the 250 ms
busy timeout. A failed completion write escaped the serve loop and closed the
owned native scope. The correction retries only classified lock timeouts around
recovery, claim and completion operations. A known completion is retained across
its initial write plus eight retries at 250 ms spacing; native submission is not
repeated. Other storage and policy errors remain fatal.

If all nine completion attempts fail, the scope stays alive and the durable claim
remains fenced. The local result is then discarded; lease recovery can turn the
claim into an ambiguity hold. This bounded retry is not a universal reconciliation
mechanism. Evidence-backed resolution of that hold remains tracked in
[#1579](https://github.com/beep-effect/beep-effect/issues/1579).

The original live Codex/Grok and Codex/Claude receipts remain tied to their
recorded source snapshots. This subsequent runtime correction requires separate
focused storage/dispatch proof and final-head hosted checks; it does not reassign
the live receipts to new source hashes or claim another model run.

The frozen correction passed 48 combined router tests, CLI quick lint/check
(4.0 and 9.4 seconds), test type-checking, scoped dead-code analysis and CLI
package docgen (363 modules and 2,356 compiled examples). Independent review
reported zero actionable findings. Its source bindings are:

- Runtime: `f24ded1f99bf61f7016a2e1aeeea5087294cace515bad17d08971e5c35a9a5dd`
- Runtime test: `6171e31cc7df719e0fdc48f8738dcc21a9bef7e0fe8086c72bd4f2ea24630280`

A fresh repository-wide JSDoc inventory/ratchet also passed after this repair
(21 tracked totals, zero increases, zero legacy non-generated findings). The six
new Effect Vitest rows are individually reviewed resource/clock ownership
judgments; all prior inventory rows and metadata remain unchanged.
