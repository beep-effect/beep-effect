# Protocol as Value — Sources & Provenance

- **Cluster / origin:** 2026-08-23 eight-track research fleet (six external
  web tracks + two in-repo gap checks) run during the packet's research
  stage; plus the One Mechanism synthesis session's seven-area repo mining
  audit (capture stage). Raw outputs on disk:
  [`external-landscape-digest-2026-08-23.txt`](./external-landscape-digest-2026-08-23.txt)
  and [`../assets/mining-findings-2026-08-23.txt`](../assets/mining-findings-2026-08-23.txt).
- **Provenance:** conversation thread with Mepuka (Discord DM, 2026-08-10 →
  2026-08-23); the One Mechanism artifact
  ([`../assets/one-mechanism.html`](../assets/one-mechanism.html));
  [`explorations/identity-as-iri`](../../identity-as-iri/README.md) (graduated)
  and its fibration handoff.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| mining-2026-08-23 | Seven-area foldlab-concept audit of beep-effect (~60 findings, file:line cites) | this repo | [`../assets/mining-findings-2026-08-23.txt`](../assets/mining-findings-2026-08-23.txt) | five journal/register/fold/digest instances | reuse (in-repo) |
| effect-engine-keying | Activity results keyed by `${executionId}/${activity.name}`; executionId digest of payload | effect-smol (local checkout `~/YeeBois/dev/effect-smol`) | `packages/effect/src/unstable/cluster/ClusterWorkflowEngine.ts:510`; `unstable/workflow/WorkflowEngine.ts:693`; `unstable/workflow/Workflow.ts:317` | rename-re-executes verification | reference (MIT; upstream API, not vendored) |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| mepuka/foldlab | Apache-2.0 | port-with-attribution | vocabulary (journal/register/fold/refusal, R0–R5 ladder, heads, fences); Plait's 8-generator surface as comparison point |
| unisonweb/unison | MIT | port-with-attribution | normalized-AST digest naming; names-as-metadata; hash-sync distribution |
| dhall-lang/dhall-lang | BSD-3-Clause | port-with-attribution | semantic (normal-form) integrity checks; hash-as-cache-key/version |
| gshen42/HasChor | BSD-3-Clause | port-with-attribution | library-level choreography: one choreography value interpreted per role |
| lsd-ucsc/ChoRus | MIT | port-with-attribution | runtime endpoint projection; transport-as-service seam |
| alcestes/effpi | MIT | port-with-attribution | protocol-as-types static end of spectrum (contrast case) |
| nuscr/nuscr | GPL-3.0 | clean-room only | global-type → projection → CFSM pipeline shape |
| choral-lang/choral | LGPL-2.1 | clean-room (dep-use ok) | choreographies as first-class typed objects |
| lovrosdu/klor | EPL-2.0 OR GPL-2.0+ w/ CE | clean-room preferred | macro-route projection in a dynamic language |
| obeli-sk/obelisk | AGPL-3.0 (wit/, proto/ MIT) | clean-room only | executor locks work by sha256 of component bytes |
| windmill-labs/windmill | AGPL-3.0 mixed + EE | clean-room only | immutable hash-versioned scripts, hash-pinned webhooks |
| inngest/inngest | SSPL-1.0 (Apache future) | clean-room only | step-ID hashing (name-keyed contrast case) |
| dbos-inc/dbos-transact-ts | MIT | port-with-attribution | code-hash-gated recovery; journal-in-ACID-store |
| temporalio/temporal | MIT | port-with-attribution | position+name replay matching; Build-ID versioning (contrast) |
| NixOS/nix | LGPL-2.1 | clean-room only (RFC citable) | trust lattice: recomputed > content-addressed > signed; signed Realisations |
| FiloSottile/sunlight | ISC | port-with-attribution | tile-based transparency log (journal segments as digest-named files) |
| transparency-dev/tesseract, google/trillian | Apache-2.0 | port-with-attribution | tlog successor/reference implementations |
| sigstore/rekor-tiles | Apache-2.0 | port-with-attribution | signature camp converging on inert tiled logs |
| kpcyrd/rebuilderd | GPL-3.0 | clean-room only | verification-is-recomputation at distro scale |
| a2aproject/A2A (spec) | Apache-2.0 | port-with-attribution | agent-card trust model (the gap we type over) |
| modelcontextprotocol (spec) | MIT→Apache-2.0, docs CC-BY-4.0 | port-with-attribution | tool-definition trust gap (rug-pull class) |
| agntcy/dir | Apache-2.0 | port-with-attribution | content-addressed agent records + Sigstore signing |
| CyberCat-Institute/open-game-engine | MIT | port-with-attribution | modular game/protocol composition DSL shape |
| multiformats/cid (spec) | CC-BY-3.0 (prose) | reference (spec) | self-describing digests for hash migration |
| shumbo/choreography-ts | none found | reference only | TS library-level CP existence proof |
| cohesivesystems/cohesive | Apache-2.0 text, SPDX NOASSERTION | reference only until confirmed | semantic-graph → projections positioning |
| unison cloud (platform) | proprietary | reference only | ServiceHash: running service identity = digest |

## 3. External research sources

Papers/articles cited in RESEARCH.md (full per-claim URLs in
[`external-landscape-digest-2026-08-23.txt`](./external-landscape-digest-2026-08-23.txt)):

- Honda, Yoshida, Carbone — Multiparty Asynchronous Session Types, JACM 63(1)
  2016 — https://dl.acm.org/doi/10.1145/2827695
- Li, Stutz, Wies, Zufferey — Complete MPST Projection with Automata, CAV
  2023 — https://arxiv.org/pdf/2305.17079
- Bravetti, Carbone, Zavattaro — Undecidability of Async Session Subtyping —
  https://arxiv.org/pdf/1611.05026
- Barwell, Hou, Yoshida, Zhou — Crash-Stop Failures (Teatrino), ECOOP 2023 —
  https://drops.dagstuhl.de/entities/document/10.4230/LIPIcs.ECOOP.2023.1
- Census-Polymorphic Choreographic Programming, PLDI 2025 —
  https://arxiv.org/abs/2412.02107 ; MultiChor — https://arxiv.org/abs/2406.13716
- Bocchi et al. — Monitoring networks through MPST —
  https://link.springer.com/chapter/10.1007/978-3-642-38592-6_5
- ChorChain — Auditable choreography on blockchain, ACM TMIS 2022 —
  https://dl.acm.org/doi/10.1145/3505225 (partial refutation)
- Avro SchemaNormalization (fingerprints) —
  https://avro.apache.org/docs/1.8.1/api/java/org/apache/avro/SchemaNormalization.html
- Unison, The Big Idea — https://www.unison-lang.org/docs/the-big-idea/ ;
  Unison Cloud core concepts — https://www.unison.cloud/docs/core-concepts/
- Dhall imports standard (semantic integrity) —
  https://github.com/dhall-lang/dhall-lang/blob/master/standard/imports.md ;
  Gonzalez, Semantic integrity checks are the next generation of semantic
  versioning — https://www.haskellforall.com/2017/11/semantic-integrity-checks-are-next.html
- Mokhov, Mitchell, Peyton Jones — Build Systems à la Carte, ICFP 2018 —
  https://dl.acm.org/doi/10.1145/3236774
- Nix RFC 0062 (content-addressed paths) —
  https://github.com/NixOS/rfcs/blob/master/rfcs/0062-content-addressed-paths.md
- Haber & Stornetta — How to Time-Stamp a Digital Document —
  https://dl.acm.org/doi/abs/10.1007/bf00196791
- Tile-Based Transparency Logs — https://transparency.dev/articles/tile-based-logs/ ;
  Rekor v2 GA — https://blog.sigstore.dev/rekor-v2-ga/
- QLDB retirement — https://www.infoq.com/news/2024/07/aws-kill-qldb
- Hellerstein & Alvaro — Keeping CALM, CACM 2020 — https://cacm.acm.org/research/keeping-calm/ ;
  Keep CALM and CRDT On, VLDB 16(4) — https://www.vldb.org/pvldb/vol16/p856-power.pdf
- A2A spec — https://github.com/a2aproject/A2A/blob/main/docs/specification.md ;
  Invariant Labs MCP tool poisoning —
  https://invariantlabs.ai/blog/mcp-security-notification-tool-poisoning-attacks ;
  NSA/DoD CSI MCP Security —
  https://media.defense.gov/2026/Jun/02/2003943289/-1/-1/0/CSI_MCP_SECURITY.PDF
- AGNTCY Agent Directory Service — https://arxiv.org/pdf/2509.18787
- Kang & Diponegoro — Governance Gaps in Agent Interoperability Protocols —
  https://arxiv.org/abs/2606.31498
- Niu & Spivak — Polynomial Functors: A Mathematical Theory of Interaction —
  https://arxiv.org/abs/2312.00990 (CC BY 4.0; free PDF
  https://toposinstitute.github.io/poly/poly-book.pdf)
- Spivak — Poly: mode-dependent dynamics — https://arxiv.org/abs/2005.01894 ;
  Shapiro & Spivak — Dynamic Operads, Dynamic Categories —
  https://arxiv.org/abs/2205.03906
- Ahman & Uustalu — Directed Containers as Categories — https://arxiv.org/abs/1604.01187
- Gavranović, Lessard, et al. — Position: Categorical Deep Learning is an
  Algebraic Theory of All Architectures — https://arxiv.org/abs/2402.15332
  (Remark 2.13 + Remark H.6 verified verbatim from PDF)
- Ghani, Hedges, Winschel, Zahn — Compositional Game Theory —
  https://arxiv.org/abs/1603.04641 ; Hedges — Coherence for lenses and open
  games — https://arxiv.org/abs/1704.02230
- nLab, Grothendieck fibration — https://ncatlab.org/nlab/show/Grothendieck+fibration ;
  Jacobs, Categorical Logic and Type Theory —
  https://www.cs.ru.nl/B.Jacobs/CLT/bookinfo.html ; Patterson, Fibered and
  indexed category theory — https://www.epatters.org/wiki/algebra/fibered-category-theory
- Yoshida & Gheri — A Very Gentle Introduction to MPST —
  http://mrg.doc.ic.ac.uk/publications/a-very-gentle-introduction-to-multiparty-session-types/main.pdf
- 2024 survey — Programming Language Implementations with MPST —
  https://link.springer.com/chapter/10.1007/978-3-031-51060-1_6
- Cohesive Systems — https://cohesivesystems.com/ ;
  https://github.com/cohesivesystems/cohesive
- foldlab — https://github.com/mepuka/foldlab (README + VERIFICATION.md)
- MLST, "Data and Code are one and the same" (Lessard) —
  https://www.youtube.com/watch?v=rie-9AEhYdY&t=3583s

## 4. In-repo capability references

| Brick | Path | Status |
|-------|------|--------|
| Sha256Hex + computeSha256Hex | `packages/foundation/modeling/schema/src/Sha256.ts` | reuse |
| Graph schema suite (topology carrier) | `packages/foundation/modeling/schema/src/Graph/` | reuse/extend |
| @beep/identity composer + $I.annote + Curie/Vocab/PnLocal | `packages/foundation/modeling/identity/src/` | reuse/extend (zero digest wiring today) |
| @beep/ontology fold (propose→gate→record catamorphism) | `packages/foundation/modeling/ontology/src/Fold.assembly.ts:886` | reuse pattern |
| JSDocTagDefinition.make fibration precedent | `packages/tooling/library/repo-utils/src/JSDoc/models/JSDocTagDefinition.model.ts:261-281` | reuse pattern |
| Execution ledger (hash-chain + recompute verify) | `packages/epistemic/domain/src/values/ExecutionRecord/` | day-one customer |
| Governed tier gate (fenced register, typed refusals) | `packages/epistemic/server/src/GovernedTierGate/` | day-one customer |
| Goals PacketCore (CAS event chain, fold, fork repair) | `packages/tooling/tool/cli/src/commands/Goals/PacketCore/` | day-one customer |
| Candor gate (recomputed-only verdict) | `packages/law-practice/use-cases/src/CandorPolicy/` | day-one customer |
| Yeet proof/inbox/ack (fingerprint-bound proof) | `packages/tooling/tool/cli/src/commands/Yeet/internal/` | day-one customer |
| RegistrationGeometry (topology-as-value precedent) | `packages/tooling/tool/cli/src/internal/cli/RegistrationGeometry/` | precedent |
| @beep/acp (per-message protocol typing) | `packages/drivers/acp/` | consumer |
| MCP servers ×4 + agents slice | `packages/drivers/{uspto,gov-legal,m365,nlp}-mcp/`, `packages/agents/` | consumers |
| Fleet mirror + reserved messaging rung | `packages/tooling/tool/cli/src/commands/Worktree/Fleet.service.ts` | consumer (future) |
| Canonical-JSON encoders (×3, no owner) | epistemic `CanonicalJson.ts`; PacketCore `PacketDigest.ts`; `OpenclawRender.ts` | seam to resolve |
| drivers/workflow landing zone | reserved by `goals/effect-v4-workflow-engine-spike` | NET-NEW (reserved) |
| Fibered kit + IdentityRegistry | design-locked, zero code | owned by `goals/identity-iri-fibered` (blocked) |

## 5. Cross-links & provenance

- Exploration siblings: [`identity-as-iri`](../../identity-as-iri/README.md)
  (graduated; fibration handoff is this packet's identity-side design
  authority), [`computable-workspace-geometry`](../../computable-workspace-geometry/README.md)
  (graduated; house precedent for the category move),
  [`effect-ontology-harvest`](../../effect-ontology-harvest/README.md)
  (workflow/cluster gap inventory + content-addressing notes),
  [`fleet-coordination`](../../fleet-coordination/README.md) (D7 messaging rung).
- Goals: [`goals/identity-iri-fibered`](../../../goals/identity-iri-fibered/README.md)
  (active/blocked — decoupled, adopt-if-lands per DECISIONS 2026-08-23),
  [`goals/effect-v4-workflow-engine-spike`](../../../goals/effect-v4-workflow-engine-spike/GOAL.md)
  (active — drivers/workflow landing zone).
- This packet: [`../RESEARCH.md`](../RESEARCH.md), [`../CAPTURE.md`](../CAPTURE.md);
  One Mechanism artifact [`../assets/one-mechanism.html`](../assets/one-mechanism.html)
  (live: https://claude.ai/code/artifact/81a980d8-2861-44a5-b173-424e5e257fc5).
