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
