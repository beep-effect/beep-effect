# MCP Auth-Gated Registration & Progressive Disclosure

## Status

Stage: `graduate`
Status: `active` (sole remaining candidate: `mcp-write-wall`)

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

The shipped candidates are [`mcp-kit`](../../goals/mcp-kit/README.md),
[`uspto-mcp`](../../goals/uspto-mcp/README.md), and
[`mcp-host-retrofit`](../../goals/mcp-host-retrofit/README.md), all
completed-retained. The sole next open question is the write wall: a named MCP
host must expose a genuinely write-capable operation requiring
candidate→approved enforcement and end-to-end `UsageRecord.metadata` audit.

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

- 2026-07-14: sibling review acknowledged all three shipped candidates and
  retained only the real-host `mcp-write-wall` trigger; ODP's read-only soft
  gate does not clear it.
- 2026-07-01 (later): graduated first goal — `goals/mcp-kit` scaffolded (SPEC seeded from BRIEF, SOURCES carried, manifests cross-linked, ATLAS synced). Stopped at: remaining candidates queue behind mcp-kit implementation.
- 2026-07-01: align+shape+decompose — /grill-with-docs resolved Q1–Q7 (+Q4b gate); kit-only scope, `foundation/capability/mcp-kit` home, hybrid gate model, success-JSON channel, UsageRecord.metadata audit; Codex re-verification folded (reviews/2026-07-01-codex-verification.md; effect pin corrected to beta.92); BRIEF + MAP written. Stopped at: graduation sign-off.
- 2026-06-29: research-complete — RESEARCH.md synthesized, codex gate-1 folded, DECISIONS pre-drafted.
- 2026-06-29: packet opened from gold-intake cluster 'MCP server design (conditional registration, multi-provider auth, progressive disclosure)' (28 nuggets).
