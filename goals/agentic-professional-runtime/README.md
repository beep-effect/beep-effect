# Agentic Professional Runtime

## Status

Active product-definition initiative.

## Mission

Define the local-first agentic professional-services runtime that beep-effect
will prove through two real product slices:

- Agentic Solo Practice Law Firm
- Todox.ai Wealth Management Runtime

The runtime is the center of gravity. The Law Firm and Todox products are the
first two proofs that force the shared kernel, slice topology, local native app,
data model, and agent integration story to become concrete.

Status note (2026-06-11): law is the sole active vertical; wealth-management
is demoted to a dormant proof fixture (see the SPEC status amendment).

Status note (2026-07-14): the law-practice office-action loop now invokes the
provider-neutral `@beep/langextract` service over an injected LLM, maps
span-bearing `GroundedExtraction[]` into law entities, and covers missing and
unaligned required extractions before the epistemic gate. The next
implementation rung is multi-reference section 103 plus section 101/112
handling while preserving deterministic tests and the privilege wall.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/agentic-professional-runtime/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

### Root

- [SPEC.md](./SPEC.md) - authoritative product and architecture contract
- [PLAN.md](./PLAN.md) - staged rollout and follow-up plan
- [GOAL.md](./GOAL.md) - compact `/goal` launcher
- [ops/manifest.json](./ops/manifest.json) - machine-readable routing surface
- [history/sources.md](./history/sources.md) - source inventory and authority

### Product Docs

- [docs/vision-map.html](./docs/vision-map.html) - interactive capability-lane
  vision map (open in a browser)
- [docs/product-vision-law-practice.md](./docs/product-vision-law-practice.md)
- [docs/product-vision-todox.md](./docs/product-vision-todox.md)
- [docs/product-feature-map.md](./docs/product-feature-map.md)
- [docs/shared-capabilities.md](./docs/shared-capabilities.md)

### Runtime Proof

- [docs/runtime-data-loop.md](./docs/runtime-data-loop.md)
- [docs/runtime-fixture-catalog.md](./docs/runtime-fixture-catalog.md)
- [docs/sdk-context-packet-contract.md](./docs/sdk-context-packet-contract.md)
- [docs/approval-and-autonomy-policy.md](./docs/approval-and-autonomy-policy.md)
- [docs/runtime-proof-slice-map.md](./docs/runtime-proof-slice-map.md)
- [docs/p3-slice-implementation.md](./docs/p3-slice-implementation.md)
- [fixtures/runtime-data-loop](./fixtures/runtime-data-loop)

### Data And Architecture

- [docs/data-model-shared-core.md](./docs/data-model-shared-core.md)
- [docs/data-model-law-practice.md](./docs/data-model-law-practice.md)
- [docs/data-model-wealth-management.md](./docs/data-model-wealth-management.md)
- [docs/architecture-map.md](./docs/architecture-map.md)

## Product Thesis

Professional services will not be won by one more SaaS wrapper around a model.
The useful product is a local-first runtime that lets a professional bring their
own agent clients, tools, data sources, and model credentials into a governed
workspace where every durable assertion carries evidence, provenance, lifecycle,
and cost.

Law and wealth management are different regulated domains, but they share the
same runtime pressure:

- private client data
- document-heavy knowledge work
- email, calendar, and thread context
- evidence-backed professional judgment
- assistants that can propose work but should not silently become the licensed
  professional
- external systems of record that should be connected, not replaced

## Locked Decisions

- One initiative, two product proofs.
- Native desktop first, using archived Tauri/editor apps as capability
  references only.
- Org-first tenancy: a solo practice is a one-person organization.
- First proof is the runtime data loop, not a standalone installer.
- The v1 runtime data loop starts with normalized incoming email fixtures.
- The canonical paired scenarios are Law patent intake and Wealth cash request.
- The authoritative knowledge primitive is claim plus evidence plus provenance.
- Evidence in v1 uses stable source span IDs.
- Internal Effect/TypeScript SDK first; MCP is an adapter over that contract.
- Agents may read and create candidate writes. Acceptance promotes candidate
  work into authoritative runtime state.
- The first proof uses a deterministic fixture agent, not a real LLM dependency.
- P3 promotes the fixture proof into real package topology and an app-level
  contract test harness.
- The v1 approval policy is strict: agent output remains candidate state until
  human review.
- The runtime owns runtime truth only. Existing CRM, email, calendar, billing,
  custodian, document, and practice-management systems remain external systems
  of record.

## Related Packets

This initiative references related surfaces without merging them:

- `explorations/knowledge-workspace` — re-captures the workspace vision.
- `goals/semantic-foundation` — absorbs the ontology-survey scope; grounding
  survey remains in `explorations/legal-ontology-landscape`.
- `goals/canonical-slice-factory`
- `goals/oppold-corpus-pipeline` — salvages and organizes the real practice
  corpus that feeds this runtime's corpus-ingestion lane (added 2026-06-11)

Those surfaces remain source context and evidence. This packet is the active
authority for the professional runtime product direction.

## Next Actions

1. Keep P1 open for the user's product interview tightening across the law and
   dormant wealth proof documents.
2. Implement the tracked doctrine rung: multi-reference section 103 plus
   section 101/112 extraction, mapping, and review behavior.
3. Keep P4 open for the user's native first-run onboarding product design.

## Source material

Gold-intake provenance for the agent-Skills / cost-tiered-routing /
ethical-wall material folded into this packet lives in
[research/SOURCES.md](./research/SOURCES.md) — the ledger joining each mined gold
nugget to its upstream repo + license, external citation, and the in-repo
`@beep/*` brick it composes. It derives from the source exploration dir
[explorations/_gold-intake/](../../explorations/_gold-intake/) (cluster "Agent
skills + cost-tiered routing + ethical-wall identity", route `mixed`, wave P1).

## Notes

- 2026-06-29: gold-intake research note added at
  research/gold-intake-agent-skills-ethical-wall.md (see for agent Skills,
  cost-tiered tool routing, the not-legal-advice disclaimer gate, and
  ethical-wall `CurrentUser` identity); provenance ledger at
  research/SOURCES.md.
