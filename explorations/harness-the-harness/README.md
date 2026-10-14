# Harness the Harness: Claude Code for Lawyers Without the Setup

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

The developer stack gives Claude real leverage, but it took a dozen-plus MCP
servers, a proxy, a secret manager, toolchains and dozens of permission rules
to get there. Wrap Claude Code so a lawyer gets the same capability on a
Windows workstation without any of that: an onboarding agent that interviews
the practice and provisions it, one gateway MCP, and a harness that owns
Claude Code's extension points. Origin: the Notion Development Todo "Coding
Agent Effectiveness & How the same capabilities can be achieved for non
technical agent setups in beep-effect (law-practice)".

## Next Open Question

None — graduated into [`goals/practice-gateway`](../../goals/practice-gateway/README.md).
Reopen at `decompose` when a MAP gate fires: interview data ranks providers
(`practice-gateway-providers`), a real-machine install is next
(`practice-gateway-signed-release`, money), or the gateway runs on the
attorney's machine (`practice-harness-improvement-loop`).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - the Notion thesis and the operator's own words.
3. [`RESEARCH.md`](./RESEARCH.md) - t3code, `.mcpb`, Windows, adoption data, in-repo bricks.
4. [`DECISIONS.md`](./DECISIONS.md) - D1–D12.
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (confirmed).
6. [`MAP.md`](./MAP.md) - decomposition and capability check.
7. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger.

Siblings: [`claude-mods-law-practice`](../claude-mods-law-practice/README.md)
owns the in-Claude-Code wrap layer (graduated to `practice-claude-mod`);
[`stack-installer`](../stack-installer/README.md) holds the installer lessons
this packet re-enters.

## Trail

- 2026-10-14: brief confirmed by the operator; MAP names `practice-gateway`
  (promised now) and three gated follow-ons; graduated into
  `goals/practice-gateway` (SPEC seeded from BRIEF + DECISIONS, sources carried).
- 2026-10-14: align rounds 1–2 settled D6–D12 (extensions first, signed
  bootstrapper, clean Windows VM proof, free adoption data, new gateway, sign
  later, operator entity publishes); BRIEF.md drafted; stopped at shape review.
- 2026-10-14: packet opened from the Notion item (S23, D1); capture of the
  operator discussion; research pass (t3code, `.mcpb`, Claude Code on
  Windows, solo/small-firm adoption, in-repo inventory); D1–D5 recorded;
  stopped at align round 1.
