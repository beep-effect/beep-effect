# T3 Code Fleet Driver

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The operator wants T3 Code to be the primary driver for beep-effect work on
DankStation and the tailnet hosts. That covers four things: T3's MCP server
in every harness, orchestrator skills that message across providers through
T3, T3 on every worker host, and a rule for sending work elsewhere when
DankStation is constrained. Beep's own agent-to-agent tooling is deleted.

## Recommendation

Adopt T3's native surfaces and delete the parallel stack. T3 already injects
its MCP tools into every session it launches, addresses threads on Linked
environments, runs headless under systemd, and drives many environments from
one client. Four goals carry the work:

1. [T3-Native Orchestration](../../goals/t3-native-orchestration/README.md).
   The first slice. It deletes `beep agent-message`, the session adapters,
   `@beep/t3-code` and the agent-to-agent packets, and rewrites the
   orchestrator, handoff, remote-worker and closeout skills around T3 tools.
2. [T3 Code Fleet Rollout](../../goals/t3code-fleet-rollout/README.md).
   DankStation publishes the fork build and the hosts pull it. T3 runs as a
   tailnet-only service on beep-worker, dankserver and tom-pc-1 (a new WSL
   distro), linked hub-and-spoke from DankStation. tbk-worker is gated on
   its latch.
3. [T3 Code Harness MCP](../../goals/t3code-harness-mcp/README.md). Registers
   `t3-hub` in every harness that runs outside T3 on every host.
4. [T3 Code Spill Routing](../../goals/t3code-spill-routing/README.md). An
   advisory rule in `orchestrate` that reads host pressure and picks the
   spill host.

## Next Open Question

None. The packet has graduated. Launch goal 1 from a T3 session on
DankStation:

```text
/goal follow the instructions in goals/t3-native-orchestration/GOAL.md
```

Gated re-entry points (tbk-worker, an automatic dispatcher, grok-bot-box-1)
are listed in [MAP.md](./MAP.md).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json): machine state.
2. [`CAPTURE.md`](./CAPTURE.md): the operator's ask, verbatim.
3. [`RESEARCH.md`](./RESEARCH.md): the synthesis, with four cited sweeps in
   [`research/`](./research/), including the
   [removal map](./research/removal-map.md).
4. [`DECISIONS.md`](./DECISIONS.md): 17 settled questions.
5. [`BRIEF.md`](./BRIEF.md): problem, appetite, sketch, rabbit holes, no-gos.
6. [`MAP.md`](./MAP.md): goals, sequencing, first slice, gates.
7. [`research/SOURCES.md`](./research/SOURCES.md): provenance and licenses.

## Trail

- 2026-11-01: Packet opened. Four research sweeps ran: T3 capabilities,
  harness MCP surfaces, fleet hosts and the repo inventory. Three align
  rounds followed. The operator then asked mid-session to delete beep's
  agent-to-agent tooling and packets, so a removal map was added and a
  fourth round settled it. The brief was approved and the packet graduated
  into four goals.
