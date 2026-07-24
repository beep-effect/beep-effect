# Effect-native OpenClaw Deployment Platform

## Status

Stage: `research`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Deploy a professional OpenClaw agent on the workstation through a
TypeScript-native Pulumi + Effect stack in this repo — then use what the
greenfield build proves to migrate dankserver's ~4790-line imperative Ansible
openclaw role onto the same declarative platform.

## Next Open Question

Does full-file `openclaw.json` ownership hold at source level? — awaiting
`research/openclaw-config-internals.md` (codex source-dive of the local clone)
plus the OSS landscape sweep and x.com field notes; then synthesis + `/oracle`
adversarial review close the research stage.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-24 (later): research stage opened — docs-index survey + in-repo
  capability inventory codified into RESEARCH.md/SOURCES.md; codex landscape
  sweep, codex config source-dive, and Grok x.com leg dispatched in the
  background.
- 2026-07-24: packet opened on `explore/openclaw-deployment-platform`; capture
  seeded from P0 grounding (infra style oracle, doctrine routing, dankserver
  seams); 14 decisions pre-recorded in DECISIONS.md from the completed intent
  interview; next up: research dispatch.
