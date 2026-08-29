# MCP Auth-Gated Registration & Progressive Disclosure

## Status

Stage: `graduate`
Status: `graduated` (three candidates shipped; `mcp-write-wall` absorbed)

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

beep already ships two Effect-native MCP servers (`@beep/nlp-mcp`,
`@beep/m365-mcp`) that register every tool unconditionally — this exploration
layers the missing *patterns* onto them: credential-keyed conditional `Toolkit`
composition, tier-gating write-vs-read tools at the candidate→approved wall, a
structured `api_key_required` helper, and progressive-disclosure field tiers so
verbose source payloads (USPTO/CourtListener/GovInfo/DOL) never blow the LLM
context budget.

## Next Open Question

None — this packet is closed. The shipped candidates are
[`mcp-kit`](../../goals/mcp-kit/README.md),
[`uspto-mcp`](../../goals/uspto-mcp/README.md), and
[`mcp-host-retrofit`](../../goals/mcp-host-retrofit/README.md), all
completed-retained.

The fourth candidate — the write wall (a named MCP host exposing a genuinely
write-capable operation behind candidate→approved enforcement with end-to-end
audit) — was **absorbed** by `agent-execution-sandbox` per its align decision 2,
and now lives in
[`goals/agent-execution-authority`](../../goals/agent-execution-authority/README.md).
The rationale: the Supabase MCP incident's exfiltration sink was an ordinary
permitted write, so sinks must be classified by *audience* rather than protocol,
and that classification cannot have two owners. Absorption also closes the
concrete defect this packet correctly identified — `TierGateAuditRecord` is
generated for every gated call and discarded on the approved path
(`packages/ontology/server/src/tools/OntologyToolHandlers.ts:87`).

Do not start a write wall here.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
3. [`RESEARCH.md`](./RESEARCH.md) - prior art + capability inventory (stage 1, if present).
4. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, if present).
5. [`BRIEF.md`](./BRIEF.md) - shaped pitch (stage 3, if present).
6. [`MAP.md`](./MAP.md) - decomposition (stage 4, if present).

## Sources & provenance

[`research/SOURCES.md`](./research/SOURCES.md) - the gold-intake provenance
ledger: every mined nugget (upstream repo + `file:line`), each upstream
repository's license and port discipline (clean-room vs port-with-attribution),
the external research citations, and the `@beep/*` capabilities this packet
composes. Derived from the gold-intake cluster "MCP server design (conditional
registration, multi-provider auth, progressive disclosure)" - see
[`../_gold-intake/ROUTING.md`](../_gold-intake/ROUTING.md).

## Trail

<Dated one-liners, newest first: what each session did and where it stopped.>

- 2026-07-25 (later): status flipped to `graduated`. The absorbing packet
  graduated into
  [`goals/agent-execution-authority`](../../goals/agent-execution-authority/README.md),
  which carries the write wall as its MCP sink class. Notably its design keeps
  `@beep/mcp-kit`'s `TierGate` contract almost intact — the governed evaluator is
  a slice-side *implementation* of the port this packet shipped, not a rewrite of
  it, which is a good sign the original abstraction was cut at the right joint.
  The one addition is `recordOutcome`, needed because `dispatchWithTierGate` had
  no post-effect seam.
- 2026-07-25: `mcp-write-wall` absorbed by `agent-execution-sandbox` (its
  align decision 2) as a governed write sink; audit persistence — the gap this
  candidate correctly named, `TierGateAuditRecord` generated per call but
  discarded at `OntologyToolHandlers.ts:87` — moves into that packet's
  execution-ledger scope. Status flip pending its brief.
- 2026-07-14: sibling review acknowledged all three shipped candidates and
  retained only the real-host `mcp-write-wall` trigger; ODP's read-only soft
  gate does not clear it.
- 2026-07-01 (later): graduated first goal — `goals/mcp-kit` scaffolded (SPEC seeded from BRIEF, SOURCES carried, manifests cross-linked, ATLAS synced). Stopped at: remaining candidates queue behind mcp-kit implementation.
- 2026-07-01: align+shape+decompose — /grill-with-docs resolved Q1–Q7 (+Q4b gate); kit-only scope, `foundation/capability/mcp-kit` home, hybrid gate model, success-JSON channel, UsageRecord.metadata audit; Codex re-verification folded (reviews/2026-07-01-codex-verification.md; effect pin corrected to beta.92); BRIEF + MAP written. Stopped at: graduation sign-off.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'MCP server design (conditional registration, multi-provider auth, progressive disclosure)' (28 nuggets).
