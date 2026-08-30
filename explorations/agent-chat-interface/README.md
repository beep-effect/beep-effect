# Agent Chat Interface

## Status

<!-- BEGIN GENERATED: EXPLORATION STATUS -->
Stage: `graduate`
Status: `graduated`
<!-- END GENERATED: EXPLORATION STATUS -->

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

AI chat inputs — and especially message-*edit* inputs — are impoverished
plain-text boxes that lose formatting and can't express structured intent.
Build the primary chat & text input for the `@beep/professional-desktop`
agent control plane on Lexical: Notion-style blocks in the input itself,
lossless editing, schema-defined blocks, deterministic thread export.

## Next Open Question

None — graduated 2026-06-12. Execution lives in the goal packets:

1. [`goals/rich-text-foundation`](../../goals/rich-text-foundation/README.md)
2. [`goals/workspace-thread-domain`](../../goals/workspace-thread-domain/README.md)
3. [`goals/desktop-chat-surface`](../../goals/desktop-chat-surface/README.md)
   (depends on 1 + 2)

Deferred follow-ons named in [`MAP.md`](./MAP.md): `acp-chat-binding`,
`proposal-blocks`, attachment/table blocks, `thread-pdf-export`.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, links.
2. [`CAPTURE.md`](./CAPTURE.md) - the original brainstorm + screenshots (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - in-repo inventory + external landscape + proof-repo inventory (stage 1).
4. [`DECISIONS.md`](./DECISIONS.md) - 16 dated align decisions (stage 2).
5. [`BRIEF.md`](./BRIEF.md) - Shape Up pitch (stage 3).
6. [`MAP.md`](./MAP.md) - goal-packet decomposition + capability citations (stage 4).

## Trail

- 2026-06-12: packet opened by migrating `docs/research/BRAINSTORM.md` + 3
  screenshots. Capture complete. In-repo capability inventory recorded in
  `RESEARCH.md` from a full stack exploration (desktop shell, runtime
  doctrine, UI/editor substrate, agent connectivity, schema codecs). External
  landscape research queued: lobe-editor deep dive, Lexical ecosystem, chat
  input UX comparisons, PDF export options.
- 2026-06-12: research completed — external landscape (lobe-editor pins
  Lexical 0.42 + antd peers; Lexical 0.45 current; serialized-state compat is
  app-managed; branching UX prior art) + `effect-lexical-chat` proof
  inventory added to `RESEARCH.md`. Stage → align.
- 2026-06-12: align completed via grill-with-docs — 8 handoff-locked + 8
  session decisions recorded in `DECISIONS.md` (build custom kit;
  turn-kernel-first; `drivers/anthropic`; PGlite confirmed; Turn aggregate;
  UsageRecord at finalization; thread content exempt from candidate gating;
  v1 blocks md-core + artifact-ref). `openQuestions` cleared. Stage → shape.
- 2026-06-12: `BRIEF.md` written (three-packet appetite, rabbit holes,
  no-gos). Stage → decompose.
- 2026-06-12: `MAP.md` written (rich-text-foundation,
  workspace-thread-domain, desktop-chat-surface + named follow-ons; every
  component cited or NET-NEW). Stage → graduate.
- 2026-06-12: **graduated** — scaffolded `goals/{rich-text-foundation,
  workspace-thread-domain,desktop-chat-surface}` from `goals/_template`;
  manifests cross-linked; ATLAS updated. Drift noted en route: the
  handoff's `@beep/md` move had already landed (PR #240).
