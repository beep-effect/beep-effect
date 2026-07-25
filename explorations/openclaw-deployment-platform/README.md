# Effect-native OpenClaw Deployment Platform

## Status

Stage: `graduate`
Status: `graduated`

Source: [`ops/manifest.json`](./ops/manifest.json)

Graduated 2026-07-25 into
[`goals/openclaw-workstation-agent`](../../goals/openclaw-workstation-agent/README.md).
This packet remains as provenance.

## Spark

Deploy a professional OpenClaw agent on the workstation through a
TypeScript-native Pulumi + Effect stack in this repo — then use what the
greenfield build proves to migrate dankserver's ~4790-line imperative Ansible
openclaw role onto the same declarative platform.

(GATE C revision, 2026-07-25: the migration half of the spark was struck —
dankserver stays on Ansible indefinitely; the platform deploys NEW OpenClaw
instances, workstation first. See DECISIONS.md.)

## Next Open Question

None — the packet is closed. Execution lives in
[`goals/openclaw-workstation-agent`](../../goals/openclaw-workstation-agent/README.md)
(P0 = the four-prototype gauntlet; a failed spike re-opens its gated decision
in the goal's decision log, not here).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Trail

- 2026-07-25: GATE C passed and the packet graduated. Grilling closed 7
  branches: BRIEF confirmed, appetite locked (one focused cycle), and one
  material scope revision — the dankserver migration struck entirely
  (dankserver stays on Ansible; the platform deploys new instances,
  workstation first). `dankserver-openclaw-migration` removed from MAP; the
  applicator seam survives workstation-only; dankserver stays the dumb-storage
  backup target; no second oracle pass. Graduated
  `goals/openclaw-workstation-agent` (SPEC seeded from BRIEF, P0 = prototype
  gauntlet, appetite binding); status flipped to `graduated` in the same PR.
- 2026-07-24 (late night): GATE B passed — 8 grilling resolutions recorded in
  DECISIONS.md (OS-enforced config root, OpenClawGeneration state machine,
  desired-intent schema + render adapters, applicator contracts + identity
  binding, secrets bootstrap exception + rotation surface, Telegram,
  state-backup mitigation, goal-P0 prototype gauntlet); research PR merged
  as #439 (review nits fixed: orphaned changeset dropped — #437 had
  independently fixed the .tsx imports); BRIEF rewritten around the locked
  design; MAP decomposed into two candidates with the gauntlet-first
  vertical slice. Next: GATE C grilling.
- 2026-07-24 (night): adversarial oracle pass landed (codex-executed after a
  Claude Code auto-mode permission block on browser submit — workaround
  documented in the oracle skill): 12 source-grounded findings, 2 CRITICAL;
  verdict tempered to HOLDS-ONLY-WITH-OS-ENFORCEMENT; decisions 6/7/12/13
  reopened as 8 manifest openQuestions with 4 prototype gates. Research
  stage closes; GATE B next.
- 2026-07-24 (evening): all research legs landed — codex OSS sweep
  (oss-landscape.md), Grok x.com leg (x-com-field-notes.md), codex
  config-internals dive w/ HOLDS-WITH-CONDITIONS verdict (spot-check
  verified), nix-openclaw clean-room study; BRIEF skeleton drafted; 7
  reference repos pinned in SOURCES. Next: /oracle review → GATE B.
- 2026-07-24 (later): research stage opened — docs-index survey + in-repo
  capability inventory codified into RESEARCH.md/SOURCES.md; codex landscape
  sweep, codex config source-dive, and Grok x.com leg dispatched in the
  background.
- 2026-07-24: packet opened on `explore/openclaw-deployment-platform`; capture
  seeded from P0 grounding (infra style oracle, doctrine routing, dankserver
  seams); 14 decisions pre-recorded in DECISIONS.md from the completed intent
  interview; next up: research dispatch.
