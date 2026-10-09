# Opportunities

## 2026-10-09 — Fresh Codex thread cannot resume before first rollout

- Work: first real router + native Codex/Grok autonomous tool proof.
- Evidence: both native endpoints enrolled; seed acceptance became ambiguous
  28 ms after claim, before any messaging grant usage. A separate owned
  `thread/start` → `thread/resume` diagnostic made zero model calls and returned
  RPC `-32600`, “no rollout found for thread id”, with both ephemeral and
  persistent starts on Codex CLI 0.162.0.
- Prevention: native fixtures must distinguish fresh thread state from a
  persisted rollout. Generic upstream resume documentation does not establish
  first-turn behavior in the installed runtime. Preserve safe operation/code
  diagnostics in the durable receipt instead of discarding the failure class.
- Disposition: keep the failed proof and its ambiguous receipt. Use the verified
  initial thread policy for the first owned turn; explicitly pin its turn
  arguments. Resume/readback applies only after a rollout exists. A fresh proof
  uses new owned state and a new nonce, never blind retry of the ambiguous seed.

## 2026-10-09 — Host grant authority must be stated to the managed agent

- Work: frozen native Codex/Grok autonomous tool proof after sandbox repair.
- Evidence: both providers enrolled with matching pins. Codex acknowledged the
  controller seed, completed its turn, and explicitly declined the requested send
  because it appeared only in peer content. No outbound grant was used. The host
  wrapper instructed acknowledgment but did not explicitly authorize grant-bound
  communication tasks. Both owned idle runtime groups were stopped; cleanup and
  unchanged source/executable checks passed. The run remains failed.
- Prevention: distinguish task content from the host's authorization to perform
  bounded communication. A server-enforced grant does not by itself tell a model
  that using its messaging tools is authorized by the launching host.
- Disposition: the wrapper now expressly authorizes scoped acknowledgment, send
  and reply within persisted grants. Peer content cannot expand recipients,
  conversation, quota or permissions; launch, other tools, file work, policy,
  merge and spending remain outside that authority. The final CLI audit was
  interrupted before changing the wrapper so its earlier snapshot cannot be
  reported as proof of this change. A fresh model proof uses fresh private state.

## 2026-10-09 — Claude safe mode excludes the required MCP bridge

The first managed Claude busy/idle run enrolled both endpoints, but its primer
finished without an acknowledgment. It stopped after 103.4 seconds with
`busy-opportunity-missed`, unchanged source/executable hashes and successful owned
cleanup. The installed CLI's `--safe-mode` help explicitly lists MCP servers among
disabled customizations. A separate zero-model diagnostic must establish whether
that disables the explicitly supplied bridge and qualify the isolated alternative
before another inference run.

`--bare` is not an acceptable shortcut: the installed help says it skips OAuth
and requires an API-key/helper route. Preserve the existing subscription, owned
HOME/workspace, strict MCP configuration, scoped tools and noninteractive policy.
The full CLI audit was interrupted before a possible provider-source repair; run
the final full audit after live qualification has settled to avoid certifying a
superseded launch configuration.

The zero-model comparison confirmed the cause on Claude Code 2.1.295: safe mode
reported zero MCP servers, while restricted mode connected the six-tool fixture.
The comparison remained stable with explicit instruction exclusions and auto
memory disabled. The native driver is being corrected without changing the
subscription, grant or tool authority. Prevention: qualify startup controls
against the installed CLI before using a model call to test message behavior.

## 2026-10-09 — Protocol fixture crosses the property-test heuristic

The final collected cheap-gates run passed 15 lanes and failed only the
schema-first inventory check. Its new Claude settings decoder increased the
standalone synthetic child fixture to four codec assertions, triggering
`SFV4-arbitrary-tests`. This executable is a deterministic regression peer used
to inspect exact launch flags and emit prescribed protocol events; randomized
input generation inside it would change that role. Retain one narrowly reasoned
inventory exception and its removal condition. No production source or live
receipt is changed by that inventory judgment. Prevention: distinguish executable
protocol fixtures from schema property suites in the checker.

## 2026-10-09 — Hosted fresh documentation scan exceeds package proof

On PR #1571 at `5b0207b8c7`, Heavy Docgen rejected 27 provider-internal exports
using the unrecognized category `internals`. JSDoc Ratchet's freshly generated
inventory also reported 26 added missing examples, two schema-annotation findings
and two section-order findings. Earlier package audit/docgen and the committed
inventory ratchet passed, so those receipts did not establish fresh repository
metadata compliance. Read both completed job logs immediately and repair the
introduced documentation against the canonical JSDoc categories and example
grammar; do not grow the baseline or exclude the internal files. Prevention:
run fresh documentation inventory and bounded repository metadata checks when
adding private cross-file exports, as well as the package's own docgen.

## 2026-10-09: repository hooks can expand a T3 enrollment turn

Task: prime two owned T3 repository conversations with a no-tool READY brief.
The inherited `full:00-cheap-gates` P0 stop hook continued after that reply.
Claude repeated the bounded reply while refusing tools; Codex inspected the
checkout inbox and its memory and used `yeet inbox ack --wontfix` despite the
brief's no-tool restriction. Both turns eventually completed. The acknowledgment
recorded that the existing implementation lane still owns the failure; it did
not establish remediation or green proof. No tracked change is attributed to
these peers: T3 checkpoint diffs include concurrent edits by the implementing
agents and cannot establish who wrote them.

Prevention: reconcile owned inbox obligations before a bounded host experiment,
carry explicit coordinator/worker ownership and hook handling in real briefs,
and inspect the complete executed turn rather than accepting its first READY
message. Full-access agents and prompt boundaries are not OS isolation. Retain
this failed no-tool enrollment case separately from the later scoped route proof.

## 2026-10-09: package creation leaves an identity formatting failure

Task: create the T3 driver through the canonical package generator, then run
`beep quality package-verify @beep/identity`. Build, type checks, 115 tests and
docgen passed, but Biome rejected the newly extended package-name list in
`packages/foundation/modeling/identity/src/packages.ts`. Formatting that generated
edit resolves the introduced failure. The package writer should format its
identity registration output before returning success.

## 2026-10-09: process arguments exposed an owned T3 credential

Task: inspect package-verifier progress. A process command-line match included
the internal MCP bearer passed to the owned T3 Claude process. The verifier
reported the mistake and stopped argument inspection. The host archived only
that owned conversation through the supported lifecycle API, verified its exact
detach effect succeeded with `revokeMcpCredential: true`, then unarchived it.
The installed source routes that terminal detach through thread credential
revocation. The old bearer was not separately probed; retain that evidence limit.

Prevention: emit only PID and command name for progress checks. Never inspect
agent command arguments, which can contain credentials. Keep diagnostic values
out of public receipts and use supported, scoped revocation before resuming proof.

## 2026-10-09: incoming native delivery needs its own scope check

Final review traced a valid sender grant through enqueue and claim into the T3
adapter. The sender's conversation scope did not establish the receiver's scope.
The receiver's later ACK would reject a foreign conversation, but its native
model could already have seen the task. The adapter now checks the direct target,
repository, receiver conversation and explicit symmetric peer allowlist before
any T3 read or send. Two actual grant-to-claim regressions cover a foreign
conversation and an unallowed sender, both with zero native sends. Preserve the
earlier allowed-traffic proof separately from the hardened source rerun.

Prevention: review incoming task authorization at the external submission
boundary, independently of outbound grant validation and acknowledgment.

## 2026-10-09: missing generated SDK output blocked full docgen

The required full docgen run failed in `@beep/infra` while checking unchanged
`@pulumi/gharunners` source against strict compiler options. Ten relevant files
and the SDK/compiler lock records matched main; the installed SDK's declared
`bin` output was absent. The existing `bun run infra:prepare-gha-runners`
preparation command completed successfully. The subsequent full repository
docgen run completed with exit 0, including aggregation. Ensure the
tracked postinstall prerequisite has run after a script-skipping installation.

## 2026-10-09: run structural gates before live qualification

The final cheap-gate collection found two introduced Fallow complexity findings
in `AgentMessage.attached.service.ts`: `submit` and `verifyAttachedT3`. Focused
behavioral tests and the bidirectional live proof had already passed, so a later
cohesion refactor requires its own review and source binding. The new package
also needed canonical policy-fingerprint regeneration and a scoped cache-policy
review. Run those structural gates before the live experiment to avoid repeating
qualification or confusing a historical source receipt with the final source.
The in-progress full CLI audit was cancelled when its source was superseded;
that cancelled run is not a successful package proof.

## 2026-10-09: interruption separates ACK from final native settlement

The final refactored-source exercise persisted four ACKs and both coordinator
reports before the host interruption. Its forward dispatches settled; two reverse
dispatches remained active. Restoring the same T3 app/profile reconciled the
Codex run as completed and the Claude run as cancelled. Canonical mailbox
recovery retained the reverse ambiguity fences without replaying either task.
The external proof credentials were revoked and independently returned HTTP401.
Preserve the earlier complete hardened proof separately; an ACK or written report
does not establish successful native completion after a host interruption.

The full CLI package audit also lost its terminal receipt during interruption.
The replacement audit buffers output across approximately 298 serial isolated
test files; process metadata showed worker turnover and progress. A quiet log
is neither a pass nor evidence of a hang. A per-step progress marker and explicit
audit deadline would make this verification easier to observe and recover.

## 2026-10-09: integration secret scan matched a documentation header

The main integration's staged secret scan reported `private-key` in
`scratchpad/effected/github/GitHubApp.ts:120`. Inspection found only a PEM header
quoted in JSDoc describing PKCS conversion, with no credential or key body.
The existing exact-fingerprint ignore mechanism records that one documentation
match; the full staged scan still runs. Prefer descriptive header names in prose
where a literal sentinel can trigger a multi-line secret detector during merges.
