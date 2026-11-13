# Model-First Slices — Sources & Provenance

- **Cluster / origin:** an operator-requested greenfield redesign of `standards/ARCHITECTURE.md`
  around `@alchemy.run/domain` and Effect Cluster, 2026-11-13.
- **Provenance:** the proposal text in `01-proposal.md`; reviews in `02` to `05`.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| alchemy-run/alchemy (`packages/domain`, `packages/effect-cluster`, `examples/cluster-domain`) | not re-verified in this packet | dependency, not vendored | the domain blocks, cluster hosting and the hosting example's shape |
| Effect-TS/effect (`packages/platform/cloudflare`, `packages/effect/src/cluster`) | MIT | dependency, not vendored | Effect Cluster primitives |

## 3. External research sources

The URLs are in `05-grok-deep-research.md` under "Sources" (Alchemy docs and the beta.87 post, the
`@effect/platform-cloudflare` README, Akka, Axon, Kurrent, Orleans, Marten, the MCP specification,
the OpenAI Agents SDK, LangGraph, SWE-CC, Foldkit, XState). Source claims in `02-astra-review.md`
cite local checkout paths and line numbers.

## 4. In-repo capability references

- `packages/documents/{domain,use-cases,server}`: evidence, the first slice on the library.
- `packages/drivers/alchemy-postgres`: evidence; retirement is gated by decision D5.
- `scratchpad/model-first-slices/`: NET-NEW prototype, not a workspace member.

## 5. Cross-links & provenance

- `explorations/alchemy-domain-adoption/DECISIONS.md` (D0 to D17).
- This packet's `RESEARCH.md` and `DECISIONS.md`.
