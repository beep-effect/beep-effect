# Agentic Governance Laws — Sources & Provenance

- **Source exploration:** `explorations/graphnosis-prior-art` — primary ledger:
  [`explorations/graphnosis-prior-art/research/SOURCES.md`](../../../explorations/graphnosis-prior-art/research/SOURCES.md).
  That ledger is canonical and is **linked, not copied**: the mined corpus,
  upstream licenses, external citations, and the quantitative quarantine all
  live there and travel into this packet by reference.
- **Provenance:** graduated 2026-08-06 as the second of the exploration's two
  graduations (Q1 — dissolve into amendments, graduate exactly two packets).
  Decision log:
  [`explorations/graphnosis-prior-art/DECISIONS.md`](../../../explorations/graphnosis-prior-art/DECISIONS.md)
  (Q1, Q3, Q6, Q8 bind here; Q10 explicitly does not). Shaped pitch:
  [`explorations/graphnosis-prior-art/BRIEF.md`](../../../explorations/graphnosis-prior-art/BRIEF.md)
  §Problem B, §Solution Sketch B, §Rabbit Holes, §No-Gos.
- **No codex review on the source exploration** — the mining ran on Claude
  sub-agents (Codex weekly limit exhausted 2026-08-06). Two mining defects were
  caught at shape stage, one of them load-bearing for this packet (see §3).

## 1. Mined source corpus

Not reproduced here. The corpus, its per-source dispositions, and the
port-discipline calls live in the exploration's ledger §1–§2. Nothing in this
packet is a port: laws 1–3 are stated from repo evidence, and the donor
material informs *which* laws are worth stating, not their text.

**How these inform implementation:** the trained-skills paper supplies the
three law shapes (self-minted ceilings, per-edge lifetime caps, conformance
fixtures for governance rules). The repo supplies every mechanism — TierGate
for the clamp, `LiteralKit` for the vocabulary, the existing law-scanner
surface for enforcement. Take the shapes, leave the implementations.

## 2. Upstream repositories & licenses

Inherited unchanged from the exploration's ledger §2. Binding here:

- **Clean-room only.** No verbatim ports. If any port becomes verbatim,
  Apache-2.0 attribution attaches and must be recorded in the exploration's
  ledger, and back-linked from this file.
- **Quarantine travels.** No donor or Chronocept quantitative figures appear
  in this packet's SPEC, code, tests, or commit messages. See the ledger's
  "Quarantined — do not quote" note.

## 3. External research sources

Titles and URLs live in the exploration's ledger §3 — not duplicated. One
correction from that exploration is load-bearing for this packet and is
recorded there in full:

- [`explorations/graphnosis-prior-art/RESEARCH.md`](../../../explorations/graphnosis-prior-art/RESEARCH.md)
  **2026-08-06 addendum** — the mining's claim that `runLawScan` is "the single
  choke point every repo law goes through (7 scanners)" was wrong at mining
  time. Ground truth: two scanners route through it; three more scan paths
  exist; two of the named seven are not corpus scanners at all. The non-vacuity
  *gap* is real and verified. The fix is four assertions, not one edit — which
  is why this packet's appetite is medium rather than small. The corrected
  scope is reproduced as a table in [`../SPEC.md`](../SPEC.md) Constraints and
  must not be silently re-widened.

## 4. In-repo capability references

The exploration's ledger §4 carries the full brick inventory. The ones this
packet composes, re-verified against the live tree on 2026-08-06:

| Brick | Path | Disposition |
|---|---|---|
| `TierGate` — `TierGateShape` (`evaluate`/`recordOutcome`), `TierGateSettlement` `LiteralKit` at `:58` | `packages/foundation/capability/mcp-kit/src/TierGate.ts` (626 lines) | **reuse** — owns the runtime clamp half of Rule 5; must not be weakened |
| `GovernedTierGate` — write-ahead, fail-closed implementation of that shape | `packages/epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts` (507 lines; `makeGovernedTierGate` `:238`, `evaluate` `:342`) | **reference** — the enforcement precedent the declaration half composes with |
| `runLawScan` + `LAW_SCAN_INCLUDED_GLOBS` (`:27`), `isExcludedLawScanPath` (`:44`), unguarded `scannedFiles` (`:175`) | `packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:149-183` | **extend** — scan path 1 of 4 (`EffectFn.ts:396`, `FrozenGrantSet.ts:331`) |
| Direct `project.getSourceFiles()` scan | `packages/tooling/tool/cli/src/commands/Laws/EffectImports.ts:137` | **extend** — scan path 2 of 4 |
| Direct `project.getSourceFiles()` scan | `packages/tooling/tool/cli/src/commands/Laws/TerseEffect.ts:592` | **extend** — scan path 3 of 4 |
| Own accumulation loop, summary at `:689` | `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:589` | **extend** — scan path 4 of 4 |
| `scanned_files=` logging only, no assertion | `packages/tooling/tool/cli/src/commands/Laws/Laws.command.ts:364,415,464` | **reference** — proves nothing gates the count today |
| Lawful zero-file scan (exclusions cover the fixture) | `packages/tooling/tool/cli/test/effect-fn.test.ts:258` | **reference** — the constraint that forbids a blanket `> 0` assertion |
| Per-entry file resolution, silent skip when a file has moved | `packages/tooling/tool/cli/src/commands/Laws/AllowlistCheck.ts:218-234` | **triage at P0** — not a corpus scanner, but a sibling vacuity hazard (see below) |
| `Skill` entity stub | `packages/agents/domain/src/entities/Skill/Skill.model.ts` (47 lines, `{fixtureKey, name}`) | **reference** — future adopter of the caps shape, not edited here |

**Sibling vacuity hazard found while verifying the scan paths (2026-08-06).**
`AllowlistCheck` resolves one source file per allowlist entry via
`addSourceFileAtPathIfExists` and, when the file is gone, `continue`s — so an
entry whose file moved is silently unverifiable rather than reported. This is
the same failure *family* as scan vacuity (a check that matches nothing still
reports clean) on a non-corpus surface. It is recorded here as a P0 triage
item, **not** folded into law 3's scope, which stays at the four corpus scan
paths the exploration verified.

## 5. Cross-links & provenance

- This packet: [`../README.md`](../README.md) · [`../SPEC.md`](../SPEC.md) ·
  [`../PLAN.md`](../PLAN.md) · [`../GOAL.md`](../GOAL.md) ·
  [`../ops/manifest.json`](../ops/manifest.json)
- Source exploration:
  [`explorations/graphnosis-prior-art/README.md`](../../../explorations/graphnosis-prior-art/README.md)
  · [`BRIEF.md`](../../../explorations/graphnosis-prior-art/BRIEF.md) ·
  [`DECISIONS.md`](../../../explorations/graphnosis-prior-art/DECISIONS.md) ·
  [`RESEARCH.md`](../../../explorations/graphnosis-prior-art/RESEARCH.md) ·
  [`research/AMENDMENTS.json`](../../../explorations/graphnosis-prior-art/research/AMENDMENTS.json)
- Sibling graduation: `goals/epistemic-contradiction-detection` — the same
  exploration's first graduation. Independent of this packet.
- Adjacent territory, deliberately not owned here:
  [`explorations/agent-governance-control-plane`](../../../explorations/agent-governance-control-plane/README.md)
  (control-plane surface) and the Q8 adherence instrument (no owner yet; it
  consumes the stop-reason records this packet's caps produce).
- Decision log for this packet lives in [`../SPEC.md`](../SPEC.md), seeded from
  the exploration's Q1/Q3/Q6/Q8 as links rather than copies.
