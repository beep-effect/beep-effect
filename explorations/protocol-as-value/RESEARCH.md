# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-08-23 — Eight-track sweep

Six external tracks (web) + two in-repo gap checks, run as a parallel research
fleet. Full findings with per-claim citations, licenses, and honest gaps:
[`research/external-landscape-digest-2026-08-23.txt`](./research/external-landscape-digest-2026-08-23.txt)
(~114 claims). This section is the distillation; the digest is the authority.

### Headline

**The novelty gap held under attack.** Four tracks independently tried to find
prior art for the composed thesis — *a digest-named global protocol type,
distributed as a value, per-agent local types derived by projection, with
conformance audited by recomputation over per-agent journals* — and failed.
Every piece exists; the composition does not:

- MPST has the projection *theory* (global type → local types, JACM 2016) but
  protocol identity is a file name; runtime monitoring exists (Bocchi et al.
  TCS 2017) but persists no hash-linked conformance evidence.
- Unison names *code* by digest of normalized AST (MIT); Unison Cloud names
  *services* by ServiceHash; no protocol layer between parties.
- Avro fingerprints (canonical form → digest on the wire) are production
  practice for *data* schemas; nobody lifted it to behavioral types.
- No durable-execution engine names work by content digest of its code as its
  public identity: DBOS hashes code but only to gate recovery; Temporal's
  Build ID is a user-asserted label; Obelisk digest-locks components (AGPL);
  Windmill hashes script versions. Piecewise, never composed.
- The math literature (Poly) has the protocol-as-object story but no
  digest-naming and no proof-by-recomputation treatment.

Partial refutations to keep honest: blockchain BPMN choreographies
(ChorChain, ACM TMIS 2022) pair a protocol with a tamper-evident conformance
log — but identity is a contract *address* (location, not content) and there
is no typed projection. Nomos runs session types on a ledger, nominally named.

### External landscape by theme

**1. The projection theory is done; adopt, don't invent.**
Honda–Yoshida–Carbone MPST (JACM 63(1) 2016) is "each agent's local type is a
projection of the global type," verbatim. Live design axes the theory hands
us: classical syntactic projection is incomplete (sound+complete needs
automata — CAV 2023); async session *subtyping is undecidable* (hard ceiling:
a protocol registry can only offer a conservative, decidable compatibility
fragment); failure handling tops out at crash-stop (Teatrino, ECOOP 2023);
dynamic participant sets are the 2024–25 frontier (census polymorphism /
MultiChor, PLDI 2025) — the roster-change-mints-new-digest problem has active
theory. Library-level choreographic programming is proven portable: HasChor
(BSD-3, Haskell), ChoRus (MIT, Rust) do endpoint projection at runtime by
interpreting one choreography value per role — the Effect-native blueprint.
Nothing in TypeScript is production-grade or Effect-native (STScript research
artifact; ChoreoTS unlicensed) — the implementation lane is open.

**2. The naming discipline should hash the *normal form*, not the source.**
Dhall freezes imports to the SHA-256 of the αβ-normalized encoding —
behavior-preserving refactors keep the digest, so "same digest ⇒ same
meaning" is a theorem; the hash doubles as cache key and version story
("semantic integrity checks are the next generation of semantic versioning").
Unison hashes the alpha-invariant, dependency-inlined AST, making renames
metadata and diamond deps impossible. CID/multiformats solve digest-format
governance (self-describing hashes survive hash-function migration) — beep's
five bare-sha256 instances will hit this. Verdict for the thesis: a protocol
digest should name the *canonicalized* global type.

**3. Trust architecture: the field converged on our shape.**
Transparency logs abandoned smart log servers for *tile-based* inert files —
immutable digest-addressed artifacts, all meaning recomputed by verifier-side
folds (Sunlight ISC, TesseraCT Apache-2.0; even Sigstore's Rekor v2 rebuilt
this way). AWS QLDB died (EOL 2025-07-31): a single-operator ledger with no
third-party recomputation ecosystem — survival correlates with outsiders
being able to re-run the fold. Nix draws the exact trust lattice a
verification ladder needs: recomputed-locally > content-addressed >
signed-by-trusted-key. Build Systems à la Carte *defines* correctness as
recomputation agreement (Def 3.1) and its trace taxonomy (verifying /
constructive / deep-constructive) is a graded R-ladder. CALM gives the
journal/register split an iff: monotone reads (folds over a grow-only prefix)
are coordination-free; decisions are non-monotone and must pay for the fence
— "Keep CALM and CRDT On" sharpens it to: a mid-journal fold read is
trustworthy iff the fold is monotone.

**4. Agent protocols have claims, not checkable claims.**
A2A agent cards are self-described JSON, optionally JWS-signed, with nothing
binding runtime behavior to the card; MCP tool descriptions are unverified
free text — the documented tool-poisoning / rug-pull class is precisely a
mutation of protocol-level meaning that digest-pinning would surface (NSA/CISA
published MCP security guidance 2026). AGNTCY is the only stack with a
content-addressed story and it addresses agent *records* (metadata), not the
protocol between agents. An independent governance-gaps analysis (arXiv
2606.31498) concludes the missing layer sits *above* current interop
standards — exactly where the thesis puts the protocol value. Positioning
consequence: build the typing/verification layer over MCP+A2A, not a rival
transport.

**5. The mathematics is further along than Act III claimed.**
Poly (Niu & Spivak, CC-BY-4.0) is *a mathematical theory of interaction*:
a lens `p → q` "is an interaction protocol" (§3.2, verbatim); a wiring
diagram is a single morphism — the topology as one value, independent of any
agent implementation (§4.4.3); agents are precisely coalgebras of the
interface object (Ex 6.67); and the CDL paper supplies the dual uniqueness
(Remark H.6: one unfold into a terminal coalgebra) to Remark 2.13's one fold
out of an initial algebra — journal readings unique AND agent behaviors
unique. Two live upgrades to the thesis: mode-dependent dynamics (Spivak
2020) models the wiring *changing as a function of collective state* — the
categorical version of "a new digest names the new protocol version" — and
dynamic operads (Shapiro–Spivak 2022) model the organizing structure being
rewritten *by the interactions it organizes* — i.e., the register's successor
decided by the system it governs. Known limit: Poly's dynamics are
synchronous; no settled async account. Fibration citations for the identity
pattern: nLab (Grothendieck fibration), Jacobs (CLTT), Patterson (indexed ↔
fibered equivalence).

**6. Positioning: fellow travelers, no incumbent.**
foldlab is public, Apache-2.0, 11 days old, single-author ("Plait": eight
generators, KernelDoor.admit, refusals carrying law + repair, heads as
32-byte commitments, NATS JetStream substrate, Go twin for cross-language
agreement; R5 Lean proofs on the model side, R0 single-node on the shipping
side). Its README does NOT make the topology/protocol a digest-named
projected value — the novelty delta over foldlab is confirmed. Cohesive
Systems is Leo Gorodinski (eulerfx — Jet.com event-sourcing lineage), solo,
.NET: semantic system graph → projections to infra/APIs, *no*
content-addressing or proof-by-recomputation; license ambiguous (Apache-2.0
text, SPDX NOASSERTION) — reference only. Commercial "collapse" sellers
(Temporal, Restate, DBOS, Golem, Kurrent) all collapse *machinery*, none
collapse *meaning* — protocol stays implicit in user code everywhere.

**7. Verified sharp claim for the Mepuka thread.** "Renaming an activity
re-executes its effects in the most type-safe workflow engine" is TRUE,
verified at source level: Effect's cluster engine keys persisted activity
results by `${executionId}/${activity.name}` only (ClusterWorkflowEngine.ts:510,
WorkflowEngine.ts:693) — a rename is a cache miss and silent re-execution.
Same family: Inngest, Cloudflare Workflows. Position-keyed engines (Temporal,
DBOS, Dapr, Azure DF) fail loudly instead. And the Effect engine *already*
digest-names the payload side (executionId = sha-256 of tag+idempotency key,
Workflow.ts:317) while leaving code identity a bare string — the asymmetry
the thesis closes.

## In-Repo Capability Inventory

(Track 7+8 of the digest; every claim path-verified 2026-08-23.)

**Verified live bricks:**

- **The five foldlab instances all verify on disk** — ExecutionRecord/
  GovernedTierGate (epistemic), Goals PacketCore, CandorPolicy
  (law-practice), Yeet ProofState/Inbox/Ack — five day-one customers for any
  unifying substrate. See also
  [`assets/mining-findings-2026-08-23.txt`](./assets/mining-findings-2026-08-23.txt).
- **Digest schema has one owner**: `@beep/schema` `Sha256Hex` (branded,
  $I-annotated) + effectful `computeSha256Hex`
  (`packages/foundation/modeling/schema/src/Sha256.ts`).
- **Graph-as-data carrier exists**: `@beep/schema` Graph suite
  (`packages/foundation/modeling/schema/src/Graph/`) — serializable topology
  values, no protocol semantics yet.
- **@beep/identity is live and single-rooted**: composer + `$I.annote` +
  Vocab/Curie/PnLocal codecs all shipped; whole workspace authority-bound via
  one `$I.compose` (packages.ts:46); `bun run beep lint identity-registry`
  polices single-root closure. The @beep/ontology fold is BUILT and merged
  (PR #536, `Fold.assembly.ts:886`) — a live unique-catamorphism-over-
  annotated-schemas with propose→gate→record shape to reuse.
- **Fibration precedent with line cites**: `JSDocTagDefinition.make`
  (repo-utils, model.ts:261–281) — base = TagName LiteralKit, section
  decoded through schema, soldered via `.annotate`, recovered via display map.
- **Topology-as-value house precedents**: RegistrationGeometry.schemas.ts
  (closed literal domains for "which surfaces exist, who may write");
  graduated `computable-workspace-geometry` ("space = pure function of
  schema") — same category move, ratified.
- **Consumers waiting**: fleet push/pull messaging (fleet-coordination D7
  rung 2, reserved, unbuilt); four MCP servers + the agents slice
  (AgentTurnKernel) — endpoints with per-message schemas and no global type
  above them; `@beep/acp` types a fixed external protocol per-message only.

**Verified gaps (NOT FOUND):**

- No session-type / choreography / projection machinery anywhere in
  `packages/**/src`.
- The `drivers/workflow` landing zone is reserved by
  `goals/effect-v4-workflow-engine-spike` (active) but the package is not
  created; zero `effect/unstable/workflow`|`cluster` imports
  outside `scratchpad/effect-ontology`; no `@effect/cluster` in bun.lock.
- **No single canonical-JSON owner** — 3+ independent encoders (epistemic
  CanonicalJson.ts, PacketCore PacketDigest.ts, OpenclawRender.ts, plus
  Yeet's fingerprints): the "one canonical byte form" premise is violated
  in-repo today. A real design fork: promote one encoder or accept
  per-instance byte forms.
- **Zero digest wiring in @beep/identity** — identity names are exclusively
  path-derived; no linkage between `$I` and `Sha256Hex`. The load-bearing
  seam: add a content-addressed projection channel beside iri/curie/slug, or
  keep digests in the journal/register layer and map them to path identities.
- Fibered kit + IdentityRegistry service: design-locked, zero code; owned by
  `goals/identity-iri-fibered` (active, blocked on two semantic-web cleanup
  items). Protocol-as-value should depend on / co-design with that goal, not
  reinvent.
- Handoff §11 static-extraction CI invariant unimplemented (interpolation ban
  is runtime-throw + types + one unit test — not a CI gate).

## Constraints Discovered

1. **Async session subtyping is undecidable** — protocol-evolution checks
   must pick a conservative decidable fragment; "is v2 a safe refinement of
   v1" cannot be promised in general.
2. **Failure handling in MPST tooling tops out at crash-stop** (2023) —
   byzantine/partition behavior is unmodeled; budget accordingly.
3. **Poly's dynamics are synchronous** — the async multi-agent semantics is
   ours to engineer, not to cite.
4. **Fixed-census, delegation-free protocols are the implementable fragment
   today** (2024 survey); census polymorphism is where dynamic rosters live.
5. **License walls**: nuscr GPL-3, Obelisk AGPL, Inngest SSPL, Nix LGPL,
   rebuilderd GPL — clean-room only. Portable: HasChor BSD-3, ChoRus MIT,
   effpi MIT, Unison MIT, Dhall BSD-3, Sunlight ISC, TesseraCT/Trillian/
   A2A-spec/AGNTCY Apache-2.0, open-game-engine MIT, foldlab Apache-2.0.
   Cohesive Systems: reference only until license confirmed.
6. **Concurrency must be linearized before journaling** (DBOS/Pydantic) —
   the journal's initial-algebra property forces a canonical order on even
   parallel effects.
7. **In-repo**: canonical-JSON multiplicity and identity's zero digest wiring
   are the two seams any implementation must resolve first.
