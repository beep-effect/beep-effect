# Corpus dispatch note — academia-corpus-mining (2026-07-25)

- **Route:** attach-to `goals/citation-verified-span-substrate` (high priority)
- **Source packet:** [`explorations/academia-corpus-mining`](../../../explorations/academia-corpus-mining/README.md) (align-stage dispatch)
- **Owning reports:** [legal norms and reasoning](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md), [retrieval and citation grounding](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md), [agent metacognition and neurosymbolic systems](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md), and [agent security and orchestration](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md)
- **Status:** evidence input for this packet's owners — proposes, never amends, the target's SPEC/PLAN.

## Why this reached citation-verified-span-substrate

The target already protects the correct narrow invariant: deterministic locator
normalization may recover canonical offsets, but only exact equality with a
versioned raw source slice may construct a verified anchor. Its
[README](../README.md) and normative [SPEC](../SPEC.md) also keep legal
vocabulary, claim lifecycle, authority assessment, and hosted enrichment out
of scope.

The corpus identifies a boundary hazard around that invariant. “Verified” can
leak from locator fidelity into proposition support, truth, legal authority,
human admission, action authorization, or release permission. The four owning
reports converge on the opposite rule: an anchor proves which source bytes were
located and emitted; every consequential interpretation or permission remains
a separate verdict.

The legal cluster adds a second identity problem. A citation can refer
semantically to a legal work or expression while reproducible evidence must
identify an immutable item or manifestation, its version or digest, and its
exact span. Collapsing both purposes into one URI loses either semantic
continuity or replayable proof
([Direct patterns, “Dual legal-citation identity”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns)).

The metacognition cluster supplies the decisive negative test: deterministic
replay and trace integrity can reproduce a false conclusion perfectly. Exact
node evidence, logical validity, authorization, and replay integrity are
independent predicates
([Direct patterns, “Trace integrity plus independent validators”](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#direct-patterns)).

This high-priority route dispatches now under align decision 1. Under align
decision 8, these are additive candidate requirements and fixtures; any
binding-doc change belongs to a separate PR.

## Distilled requirements

1. **Make successful anchor verification explicitly non-authorizing.** A
   serialized or persisted success must state only that the named source
   revision, canonical half-open UTF-16 offsets, and emitted raw quote satisfy
   the target's exact-slice contract. A test must demonstrate that this result
   contains no approval, legal-authority, action-permission, or release
   disposition and cannot satisfy such a downstream gate by itself. Evidence:
   [legal design challenge 4](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#design-challenges),
   703aea161905 — *Argumentation and Standards of Proof* and 73abf21862dc —
   *The adaptive nature of text-driven law*; [security design challenge 1](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges),
   caefce8b35a2 — *LLM Agents can Autonomously Exploit One-day
   Vulnerabilities*.

2. **Keep anchor fidelity distinct from every later verdict.** Tests must
   distinguish exact-anchor success or typed anchor failure from claim-to-span
   support, aggregation, source authority or currentness, human disposition,
   and action authorization. No confidence score, generated rationale, schema
   conformance, similarity score, or reviewer decision may substitute for the
   exact-slice predicate. Evidence:
   [retrieval design challenges 1 and 3](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges),
   0421a1687b40 — *ProVe*, d81e86e1d786 — *IntKB*, and 1a72f7ffcd1c —
   *KGValidator*; [metacognition corroborations](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#corroborations),
   9e55e391080a — *SYMBOLIC AI* and 8031a91d7e5b — *Lari*.

3. **Carry two independently testable citation targets at the citation-facing
   boundary.** One target identifies the semantic referent; the other
   identifies the immutable evidentiary source revision and exact anchor.
   Tests must preserve one semantic target across two source manifestations,
   permit an unresolved semantic target without weakening exact-anchor
   verification, and reject an evidentiary target lacking the required source
   identity, digest or version, or exact span. The substrate owns the
   evidentiary half and must not acquire legal citation vocabulary or identity
   resolution. Evidence:
   [legal direct pattern 6](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#direct-patterns),
   7d7f8ed65c53 — *Computable Models of the Law: Languages, Dialogues, Games,
   Ontologies*, a32b2b3bfed9 — *AI and Law: A fruitful synergy*, and
   e4c1e92b3477 — *A Linked Term Bank of Copyright-Related Terms*.

4. **Retain resolution and verification provenance without turning it into
   authority.** Persistence tests must preserve original citation text when
   present, semantic-target resolution status and provenance, evidentiary
   source identity and version, raw candidate, normalization or engine version,
   verification attempts, typed failures, and re-anchor history. Changing a
   semantic resolution must not rewrite the source anchor; source drift must
   continue to create a failed attempt and, after renewed proof, a new linked
   anchor. Evidence:
   [legal tensions, “MetaLex-style citations”](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#tensions--contradictions)
   and the target [SPEC constraints 5 and 10](../SPEC.md#constraints).

5. **Add a replayable false-trace regression with per-node evidence checks.**
   The fixture must replay byte-for-byte with stable lineage while containing
   at least one conclusion that cannot bind to an exact supporting source
   slice. Replay integrity must pass; that node's evidence validation must fail
   closed; no verified anchor may be synthesized for it; and any separately
   valid quoted node must remain non-authorizing. Evidence:
   [metacognition direct patterns](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#direct-patterns),
   9e55e391080a — *SYMBOLIC AI* and 8031a91d7e5b — *Lari*; [routing suggestions](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#routing-suggestions).

6. **Prove that verified hostile content remains data, not capability.** A
   boundary fixture must verify an exact security-sensitive disclosure span
   while demonstrating that the output grants no tool permission and cannot
   alter orchestration policy. Origin, source revision, and exact span remain
   available to a separate downstream policy decision. Evidence:
   [security corroborations](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#corroborations)
   and [routing suggestions](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#routing-suggestions),
   caefce8b35a2 — *LLM Agents can Autonomously Exploit One-day
   Vulnerabilities* and e77ec0588486 — *Securing With Dual-LLM Architecture*.

## Fixture candidates

- **Perfect replay, unsupported conclusion:** freeze source bytes, trace nodes,
  capability versions, and hashes; replay successfully; require the unsupported
  conclusion's missing or mismatched quote to produce a typed closed failure.

- **Exact quote, false inference:** bind a premise to an exact raw slice, then
  derive a proposition the passage does not support. Anchor construction
  succeeds only for the quote; no support, truth, approval, or authorization
  verdict is inferred.

- **Co-occurrence-only evidence:** use a passage containing both entity names
  but not the asserted relation. Preserve the exact anchor while proving that
  colocated strings do not become relational support, following d81e86e1d786 —
  *IntKB*.

- **Contradictory generated rationale:** provide a shape-valid verdict whose
  explanation contradicts its label. The explanation remains generated output,
  never evidence, following 1a72f7ffcd1c — *KGValidator*.

- **Dual-target manifestation change:** keep the semantic referent stable while
  replacing the source manifestation with a new digest and shifted text. The
  prior anchor becomes stale, the failed attempt remains, and any replacement
  anchor requires renewed exact-slice proof.

- **Unresolved semantic target, valid evidence target:** retain the original
  citation surface and unresolved resolution status while verifying the
  immutable source item and span. Later resolution updates only the semantic
  side and preserves the anchor history.

- **Verified disclosure without execution authority:** verify a
  provenance-rich vulnerability description, then present a derived tool
  action. The anchor remains valid, but the action stays denied until a
  separate principal-, capability-, intent-, and budget-aware authorization
  decision exists, following caefce8b35a2 — *LLM Agents can Autonomously
  Exploit One-day Vulnerabilities*.

## Tensions and limits

- Dual citation targets could accidentally pull legal identity vocabulary into
  foundation. The target's current non-goals prevail: this packet may preserve
  generic target roles and unresolved status, while legal work, expression,
  manifestation, and citation-relation semantics remain downstream.

- A false-trace fixture crosses citation verification and agent governance.
  Its scope here is only the evidence-boundary invariant; it does not choose an
  external-supervisor or integrated-scheduler topology, which remains open
  under align decision 6.

- The term “verified” remains useful for exact-anchor fidelity but invites
  semantic overreach. Documentation and tests should qualify the verified
  predicate rather than rename it into another broad assurance term.

- Align decision 2 assigns typed human-disposition vocabulary to a separate
  `docs/product/prose-to-proof.md` PR. This note therefore requires
  non-authorization at the substrate boundary without amending product approval
  doctrine.

- The recorded medium-priority follow-on for page-region, OCR-token, and
  composite anchors remains after the locked text slice; it is not dispatched
  here
  ([master synthesis routing table](../../../explorations/academia-corpus-mining/research/t3-master-synthesis.md#consolidated-routing-table)).

- The corpus is strong on architectural convergence and thin on production
  validation. No study evaluates privileged legal documents, exact versioned
  spans, natural counterevidence, attorney disposition, matter walls, and
  action authorization together.

- 0421a1687b40 — *ProVe* is the strongest implemented grounding study, but it
  excludes PDFs, tables, scans, and implicit support, has almost no end-to-end
  refutation evidence, and lacks durable offsets. The legal papers are mainly
  formal analyses or hand-built examples, and 8031a91d7e5b — *Lari* is useful
  chiefly as a negative example: deterministic hashes do not validate premises
  or conclusions.

## Provenance

- Target scope read first:
  [README.md](../README.md) and [SPEC.md](../SPEC.md).

- Owning report sections mined:
  [legal design challenges, direct patterns, tensions, routing, and quality](../../../explorations/academia-corpus-mining/research/t3-legal-norms-reasoning.md#design-challenges);
  [retrieval design challenges, direct patterns, tensions, routing, and quality](../../../explorations/academia-corpus-mining/research/t3-retrieval-citation-grounding.md#design-challenges);
  [metacognition design challenges, direct patterns, corroborations, routing, and quality](../../../explorations/academia-corpus-mining/research/t3-agent-metacognition-neurosymbolic.md#design-challenges);
  [security design challenges, corroborations, routing, and quality](../../../explorations/academia-corpus-mining/research/t3-agent-security-orchestration.md#design-challenges).

- Gold-tier deep reads consulted first: 0421a1687b40 — *ProVe*;
  7d7f8ed65c53 — *Computable Models of the Law: Languages, Dialogues, Games,
  Ontologies*; a32b2b3bfed9 — *AI and Law: A fruitful synergy*;
  703aea161905 — *Argumentation and Standards of Proof*; 73abf21862dc —
  *The adaptive nature of text-driven law*; f4ab0f7d6892 — *Persuasion and
  Value in Legal Argument*; 90c15fe84620 — *Persuasion in Practical Argument
  Using Value-based Argumentation Frameworks*; 0d06c1a2189a — *Prompt
  Engineering a Prompt Engineer*; and 01b2258ed130 — *The Devil in the Detail:
  Mitigating the Constitutional*.

- Additional deep reads consulted: e4c1e92b3477 — *A Linked Term Bank of
  Copyright-Related Terms*; d81e86e1d786 — *IntKB*; ba0c4177bb61 — *Check Your
  Facts and Try Again*; 1a72f7ffcd1c — *KGValidator*; 9e55e391080a —
  *SYMBOLIC AI*; 8031a91d7e5b — *Lari*; caefce8b35a2 — *LLM Agents can
  Autonomously Exploit One-day Vulnerabilities*; and e77ec0588486 —
  *Securing With Dual-LLM Architecture*.
