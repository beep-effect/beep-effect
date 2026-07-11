# TL;DR

OriginTrail is **not selectable from this docs sweep alone**. The only
OriginTrail source I could read was the provided local fallback copy of
`https://docs.origintrail.io/llms.txt`; DNS resolution for
`docs.origintrail.io` failed in this session, and Firecrawl MCP scraping was not
available. The fallback index shows that the docs cover DKG V10, node operation,
knowledge assets, context graphs, SPARQL HTTP, APIs, packages, economics,
funding, and TRAC-related network topics, but it does not expose the page
content needed to verify license, node requirements, token-free operation, MCP
support, temporal semantics, or SDK details. [R1]

For **Role A**, OriginTrail should remain a possible future capability donor or
projection/retrieval engine only after clone/page verification. The local product
doctrine requires durable truth to stay in claim/evidence/provenance/lifecycle
records, with semantic systems used only as managed caches or projections.
[R2][R3][R4]

For **Role B**, there is no docs-index evidence of an official MCP server or a
low-footprint Claude/Codex dev-memory path. Treat it as **not recommended** for
dev-tooling memory until MCP/local reliability is proven. [R1]

# Hard-gate verdicts

1. **Self-hostable/local-first: NOT ESTABLISHED; treat as fail until verified.**
   The index links to `DKG Node`, `Node Components`, `Daemon Lifecycle`,
   `Relays & Peers`, `Updates & Rollback`, `Migrate to npm`, and
   `Troubleshooting`, so node operation is clearly a documented area. However,
   the linked pages were not readable, so this sweep cannot verify supported
   local deployment modes, hardware requirements, storage backends, offline
   behavior, or whether a node can serve the product as a local-first component
   rather than a network-dependent service. [R1]

2. **OSI license without copyleft trap: NOT ESTABLISHED; treat as fail until
   verified.** The readable index links to `Terms & Conditions`, bounty pages,
   economics pages, and network/contract pages, but it does not state an OSI
   license or rule out SSPL, BUSL, AGPL, custom terms, or mixed licensing. This
   gate cannot pass from the docs index. [R1]

3. **TS-native or clean HTTP/MCP API: PARTIAL SIGNAL, NOT PASSED.** The index
   links to `API`, `Packages`, `CLI`, `Storage SPARQL HTTP`, `OKF Import,
   Export, and Verify`, and `Publish & Query`, which are promising integration
   surfaces. The linked pages were not readable, so this sweep cannot verify
   TypeScript-native SDKs, endpoint shapes, auth, local-only access, or MCP
   support. The index contains no MCP-specific link or description. [R1]

# Architecture & storage

The docs index frames OriginTrail as **DKG V10** documentation for AI-agent
memory, with overview text saying the DKG gives AI agents memory that survives a
session and a quickstart for persistent structured memory. [R1]

The architecture topics advertised by the index are broad: `DKG Network`, `DKG
Node`, `Node Components`, `Agents & Trust`, `Memory Layers`, `Context Graphs`,
`Knowledge Assets`, `Universal Messenger`, and `P2P Resilience`. Those titles
indicate that OriginTrail wants to be evaluated as a networked knowledge-graph
runtime rather than a narrow vector-memory library, but this sweep could not
verify the actual component boundaries or storage design. [R1]

Storage is especially under-evidenced from the fallback index. `Storage SPARQL
HTTP` suggests a SPARQL-facing storage/query surface, and `OKF Import, Export,
and Verify` suggests a portable knowledge format, but the index does not reveal
the database engine, persistence guarantees, backup model, local data ownership,
or whether storage can be rebuilt deterministically from an external authority
store. [R1]

# Retrieval

The index exposes retrieval-oriented topics: `Publish & Query` under both
`use-dkg` and `agent-context`, `Storage SPARQL HTTP`, `Context Pack`, and
`Invariants`. [R1]

That is enough to mark OriginTrail as **retrieval-surface promising**, but not
enough to assess recall quality, exact-vs-semantic routing, ranking,
determinism, citation behavior, query latency, or failure modes. For this repo,
any retrieval layer must sit below deterministic claim/evidence authority and
must not become the source of truth. [R2][R3][R4]

# Provenance/temporal/lifecycle

The index has relevant lifecycle and verification hooks: `Knowledge Assets`,
`Knowledge Asset Lifecycle CLI`, `OKF Import, Export, and Verify`, `Updates &
Rollback`, `Agents & Trust`, and `Invariants`. [R1]

The actual provenance model is not established. The fallback index does not show
whether a knowledge asset carries source spans, evidence records, assertion
state, human acceptance state, PROV-style derivation, actor identity, confidence,
or legal-domain lifecycle fields. It also does not establish temporal semantics:
no readable page showed valid-time, transaction-time, version chains, rollback
scope, expiration, supersession, or auto-invalidation behavior. [R1]

For the agentic-professional-runtime, this means OriginTrail cannot be accepted
as authoritative memory from this sweep. The product's locked primitive is claim
plus evidence plus provenance, with agent output remaining candidate state until
human review; durable truth must remain in the product authority store. [R4]

# Integration surface

The index advertises several possible integration surfaces:

- `CLI`
- `API`
- `Packages`
- `Storage SPARQL HTTP`
- `OKF Import, Export, and Verify`
- `Context Pack`
- `Publish & Query`
- `Node Skill` [R1]

The page content was unavailable, so this sweep cannot verify TypeScript package
names, SDK maturity, HTTP endpoint contracts, auth model, local node API
stability, or MCP support. There is no MCP-specific entry in the readable index.
[R1]

The safest future integration shape, if later evidence clears the gates, would
be a `drivers/*` adapter that projects accepted Postgres authority records into
OriginTrail knowledge assets or context packs, queries them through HTTP/SPARQL
or SDK surfaces, and treats every result as rebuildable cache/projection output.
That shape matches the repo doctrine that semantic or external memory systems
are managed caches, not durable truth. [R2][R3][R4]

# License, pricing & maturity

License is unresolved. The readable index contains `Terms & Conditions`, but no
OSI license claim and no evidence about copyleft, source-available, or custom
commercial terms. [R1]

Pricing and token requirements are unresolved. The index links to
`Conviction & Economics`, `Knowledge Commerce`, `Funding`, `Publishing
Conviction`, `Networks & RPCs`, `Contract addresses`, `Bridging TRAC`, and
`Staking & Migration (V8 -> V10)`, so token/network economics are clearly part
of the documented system. The unread page content is required to answer the
critical product question: what works without blockchain tokens, TRAC funding,
staking, or paranets. [R1]

Maturity is also unresolved. The index includes `V10 Mainnet Release Timeline`,
`Roadmap`, V10 bounty pages, and a `V9 Archive`, which show active versioned
documentation around a V10 transition. The index alone does not establish
production stability, release status, backwards compatibility, or operational
burden. [R1]

# Role A assessment

**Verdict: watchlist only; do not select from docs evidence.**

OriginTrail is conceptually interesting for Role A because the docs index points
at knowledge assets, context graphs, SPARQL HTTP, OKF verification, lifecycle
CLI, and agent context packs. Those are plausible capability-donor surfaces for
portable provenance, graph projection, interoperability, and retrieval. [R1]

It fails the current selection bar because the hard gates are not established:
no readable OSI license evidence, no verified local-first deployment evidence,
no verified TypeScript/HTTP/MCP contract, no verified token-free operating mode,
and no readable temporal/provenance schema. [R1]

If later clone or page research clears those gaps, the only acceptable Role A
placement is behind a driver wrapper as a rebuildable projection/retrieval
engine. It must not own durable professional-memory truth, because the binding
architecture keeps authority in deterministic claim/evidence/provenance records
and treats semantic/network memory as cache or projection. [R2][R3][R4]

# Role B assessment

**Verdict: not recommended for Claude/Codex dev-tooling memory from this sweep.**

The index does not show an official MCP server, lightweight local agent-memory
server, or coding-agent recall workflow. It does show node, network, economics,
funding, and contract-address topics, which may imply a materially heavier
operational footprint than desired for day-to-day Claude/Codex repo memory, but
the page content was not available to verify the actual burden. [R1]

For Role B, the immediate blockers are practical: no MCP evidence, no verified
local install path, no verified low-maintenance mode, and no recall-quality
evidence. [R1]

# Contradictions with prior repo assessments

n/a. The task states OriginTrail has zero prior coverage in this repo, and this
docs lane did not find or rely on an existing OriginTrail assessment artifact.

# References

[R1] Local fallback copy of OriginTrail docs index:
`/tmp/claude-1000/-home-elpresidank-YeeBois-projects-beep-effect5/ea57f70e-159a-4fc2-9828-26514d3e7422/scratchpad/llms/origintrail-llms.txt`
for original URL `https://docs.origintrail.io/llms.txt`. I read this local file
because outbound DNS resolution for `docs.origintrail.io` failed.

[R2] Repo doctrine:
`/home/elpresidank/YeeBois/projects/beep-effect5/standards/memory-architecture/README.md`.

[R3] Repo memory taxonomy:
`/home/elpresidank/YeeBois/projects/beep-effect5/standards/memory-architecture/01-memory-layer-taxonomy.md`.

[R4] Product authority:
`/home/elpresidank/YeeBois/projects/beep-effect5/goals/agentic-professional-runtime/README.md`.

Unfollowed OriginTrail links due to unavailable network/DNS. These are listed as
gaps, not cited as page evidence:

- `https://docs.origintrail.io/getting-started/readme.md`
- `https://docs.origintrail.io/getting-started/quickstart.md`
- `https://docs.origintrail.io/getting-started/dkg-v10-t-c.md`
- `https://docs.origintrail.io/active-now/dkg-v10-premainnet-bounty.md`
- `https://docs.origintrail.io/active-now/dkg-v10-bounty.md`
- `https://docs.origintrail.io/active-now/staking-migration.md`
- `https://docs.origintrail.io/origintrail-v9-v10/roadmap.md`
- `https://docs.origintrail.io/origintrail-v9-v10/v10-mainnet-release-timeline.md`
- `https://docs.origintrail.io/how-dkg-works/key-concepts.md`
- `https://docs.origintrail.io/how-dkg-works/dkg-network.md`
- `https://docs.origintrail.io/how-dkg-works/dkg-node.md`
- `https://docs.origintrail.io/how-dkg-works/node-architecture.md`
- `https://docs.origintrail.io/how-dkg-works/agents-and-trust.md`
- `https://docs.origintrail.io/how-dkg-works/memory-layers.md`
- `https://docs.origintrail.io/how-dkg-works/context-graphs.md`
- `https://docs.origintrail.io/how-dkg-works/knowledge-assets.md`
- `https://docs.origintrail.io/how-dkg-works/conviction-and-economics.md`
- `https://docs.origintrail.io/how-dkg-works/roadmap-and-convergence.md`
- `https://docs.origintrail.io/how-dkg-works/knowledge-commerce.md`
- `https://docs.origintrail.io/how-dkg-works/universal-messenger.md`
- `https://docs.origintrail.io/how-dkg-works/p2p-resilience.md`
- `https://docs.origintrail.io/use-dkg/run-node.md`
- `https://docs.origintrail.io/use-dkg/publish-and-query.md`
- `https://docs.origintrail.io/use-dkg/knowledge-asset-lifecycle.md`
- `https://docs.origintrail.io/use-dkg/async-publisher-wallets.md`
- `https://docs.origintrail.io/use-dkg/okf.md`
- `https://docs.origintrail.io/use-dkg/funding.md`
- `https://docs.origintrail.io/use-dkg/publishing-conviction.md`
- `https://docs.origintrail.io/use-dkg/relays-and-peers.md`
- `https://docs.origintrail.io/use-dkg/storage-sparql-http.md`
- `https://docs.origintrail.io/use-dkg/host-mode-manual-subscribe.md`
- `https://docs.origintrail.io/use-dkg/updates-and-rollback.md`
- `https://docs.origintrail.io/use-dkg/migrate-to-npm.md`
- `https://docs.origintrail.io/use-dkg/troubleshooting.md`
- `https://docs.origintrail.io/agent-context/context-pack.md`
- `https://docs.origintrail.io/agent-context/invariants.md`
- `https://docs.origintrail.io/agent-context/publish-query.md`
- `https://docs.origintrail.io/agent-context/operate-troubleshoot.md`
- `https://docs.origintrail.io/references/cli.md`
- `https://docs.origintrail.io/references/api.md`
- `https://docs.origintrail.io/references/packages.md`
- `https://docs.origintrail.io/references/glossary.md`
- `https://docs.origintrail.io/references/node-skill.md`
- `https://docs.origintrail.io/general/networks.md`
- `https://docs.origintrail.io/general/contract-addresses.md`
- `https://docs.origintrail.io/general/bridging-trac.md`
- `https://docs.origintrail.io/general/whitepaper-and-rfcs.md`
- `https://docs.origintrail.io/general/random-sampling.md`
- `https://docs.origintrail.io/general/general-bug-bounty.md`
- `https://docs.origintrail.io/archive/v9.md`
