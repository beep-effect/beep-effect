# Prose-to-Proof — Draft PRD

> **Status:** Draft · **Codename:** Prose-to-Proof · **Architecture:** BeepGraph
> **Product target:** `apps/professional-desktop` · **Owner:** @beep-team
> **Scope of this PRD:** the **next buildable increment** — turning today's chat app into
> the document portal — framed by the full [Vision](../PROSE_TO_PROOF_VISION.md).
>
> Reading order: [Vision](../PROSE_TO_PROOF_VISION.md) → [For Tom](../PROSE_TO_PROOF_FOR_TOM.md) →
> [User Story](../PROSE_TO_PROOF_USER_STORY.md) → [Architecture Map](../PROSE_TO_PROOF_ARCHITECTURE_MAP.md) → **this**.
> Sibling substrate: [Workspace Substrate](./workspace-substrate.md) — how the workbench is *inhabited* (docks + blocks + agent-operated panels).
> See also the [Visualization](../PROSE_TO_PROOF_VISUALIZATION.html).
> Governing specs: `goals/agentic-professional-runtime/SPEC.md`, its `docs/runtime-data-loop.md`
> and `docs/approval-and-autonomy-policy.md`, and `docs/BEEPGRAPH_ARCHITECTURE.md`.

---

## 1. Summary

Prose-to-Proof is a **local-first, provenance-grounded knowledge workbench for a solo IP
practice**. A document comes in; the system reads it, proposes structured claims grounded
to the exact source text, surfaces them in a document-portal editor, and admits nothing to
the practice's memory until the attorney approves. This PRD specs the **MVP**: extend the
existing runtime data loop from email to documents, so a real matter's documents become
evidence-backed, approval-gated practice memory inside `apps/professional-desktop`.

The product's first user is the builder's father, a solo IP attorney; the team **dogfoods**
the product on his real practice. That loop — his 25-year corpus as seed, his daily use as
signal — is the product strategy, not a footnote.

## 2. Problem & opportunity

A solo IP attorney is the whole firm: partner, associate, paralegal, librarian, and IT.
Existing tooling forces a bad trade:

- **Cloud AI assistants** (Harvey, Thomson Reuters CoCounsel, Robin AI) cite their sources
  well but run in the cloud — processing client material on third-party servers, a real
  confidentiality/privilege concern for a solo. [1][2][3]
- **Document management** consolidated to two cloud platforms (iManage, NetDocuments); the
  on-prem option solos relied on (Worldox) was discontinued after acquisition. [4][5]
- **Truly local AI tools** (e.g. Elephas, GPT4All) keep data on-device but lack rigorous,
  every-assertion source grounding and aren't IP-specialized. [6]
- **Patent-specific tools** (Rowan Patents, PatentPal, Patlytics, Solve Intelligence,
  LexisNexis) are all cloud SaaS, and source-grounding is uneven. [7][8][9]

**The gap:** *local-first **and** every-assertion-grounded **and** IP-specialized* is
essentially unoccupied. That intersection is the product wedge.

## 3. Goals & non-goals

**Goals (this increment)**
- G1. Ingest a real matter's documents on the local machine and produce **candidate claims grounded to source spans**.
- G2. Surface those claims in the **document-portal editor** with hover-card subgraph links (`artifact-ref`).
- G3. Gate everything behind **attorney approval**; accepted claims persist with provenance.
- G4. Keep it **local-first**: no client data leaves the device by default; embeddings on-device.
- G5. Prove the **dogfooding loop** on one real matter end to end.

**Non-goals (this increment)** — deferred, not rejected
- Replacing email, calendar, billing, docketing, CRM, or the USPTO as systems of record.
- Autonomous legal advice or filings.
- Real privileged data in the repository (synthetic fixtures only in-repo).
- Multi-machine sync.
- The full reasoner, full GraphRAG, and full FalkorDB projection (GA, see §10).

## 4. Target user

**Tom — solo IP attorney, 25 years in.** Existing email/calendar/document/billing tools; a
mixed archive of prior work product; a preference to slow down without losing leverage;
limited appetite for IT. (Per `goals/agentic-professional-runtime/docs/product-vision-law-practice.md`.)
He is the first user *and* the corpus source *and* the standard of quality.

## 5. The MVP slice — chat app → document portal

Today `apps/professional-desktop` (v0.0.3) is a local chat app (Tauri + React + Bun sidecar,
PGlite persistence, `ChatRpcs`, `AnthropicTurnKernel`/`FixtureTurnKernel`). The MVP turns it
into the document portal by walking the **same runtime data loop** already locked as the
first proof (`docs/runtime-data-loop.md`) — only the input changes from a normalized email
to a matter document:

```
seed matter/client context
  └─► ingest a document, with stable source spans
  └─► run extraction (deterministic fixture first, real model behind the same contract later)
  └─► produce candidate claims + tasks + (optional) draft, each with evidence spans + provenance
  └─► render in the Lexical editor; hover-card artifact-ref links into the subgraph
  └─► attorney reviews → approves/rejects (strict gate)
  └─► accepted claims persist to the local epistemic store with provenance
  └─► expose an evidence-bounded context packet via the SDK
```

This honors the SPEC's non-negotiables: **candidate-only writes**, **evidence by stable span
ID** (not whole-artifact, not byte offsets), **claim+evidence+provenance+lifecycle as
authority** (authoritative about what was asserted, evidenced, and decided — not about the
propositions' truth), **graph/search as projections**, and **SDK-first**.

## 6. User stories & acceptance criteria

**US-1 — Ingest & ground.** *As Tom, I drop a document in and the system extracts claims tied
to the exact text.*
- AC-1.1 A supported document (`.md`/`.docx`/`.pdf` via `@beep/md` + `@beep/pandoc-ast`) ingests without leaving the device.
- AC-1.2 At least one **candidate claim** is produced with a valid `Evidence` span that resolves to real characters in the source (`@beep/langextract` `GroundedExtraction.span`).
- AC-1.3 Clicking a claim highlights its source span in the document.

**US-2 — Portal.** *As Tom, I read a document and see what each part links to.*
- AC-2.1 An `artifact-ref` link renders a hover card with the linked artifact (e.g. a figure → CAD locator) (`@beep/lexical-schema`).
- AC-2.2 The card shows the target's identity and a way to open/trace it.

**US-3 — Approve.** *As Tom, nothing is accepted for use in my matter until I sign — and my signature records my decision, not the claim's truth.*
- AC-3.1 Candidate claims appear in a review surface with their evidence; none enter accepted state pre-approval.
- AC-3.2 Approve/reject is recorded as an `Activity` with reviewer + timestamp (`@beep/epistemic-domain`).
- AC-3.3 Accepted claims persist to local PGlite via `@beep/epistemic-tables` and survive restart.
- Note: approval is a scoped human disposition — one of seven independent typed verdicts (shape validity, anchor fidelity, semantic stance, source authority/currentness, human disposition, action authorization, release). None of them converts a contestable proposition into source truth; "accepted" is repository state, not epistemic status.

**US-4 — Local & walled.** *As Tom, my client data stays mine.*
- AC-4.1 With no backup backend configured, zero network egress of document content (verifiable).
- AC-4.2 Claims are scoped to a matter; a matter's substantive content is not readable across the wall.

## 7. Functional requirements

- FR-1 Document ingest pipeline: file → canonical model (`@beep/md`/`@beep/pandoc-ast`) → NLP offsets (`@beep/nlp-mcp`) → span-grounded extraction (`@beep/langextract`).
- FR-2 Candidate production: `CandidateClaim` + `Evidence` (span IDs) + `Activity` provenance.
- FR-3 Portal editor: Lexical state with `ArtifactRefNode` hover cards over the matter subgraph.
- FR-4 Review & approval surface: list candidates, show evidence, approve/reject, record lifecycle.
- FR-5 Local persistence: PGlite via `@beep/epistemic-tables`; rebuildable read models.
- FR-6 SDK context packet: evidence-bounded read surface (`@beep/agents-use-cases/public`).
- FR-7 Extraction is swappable: deterministic fixture agent first, real model behind the same candidate-write contract.

## 8. Non-functional requirements

- NFR-1 **Local-first:** on-device by default; no client content egress without an explicit backend choice; embeddings computed locally.
- NFR-2 **Provenance-complete:** 100% of accepted claims carry a resolvable evidence span; the validator rejects a claim whose span doesn't exist in the source.
- NFR-3 **Walled matters:** matter = named subgraph = confidentiality boundary; joinable for conflict checks, sealed for substantive reads.
- NFR-4 **Storage-neutral domain:** PGlite is the first adapter; domain language must not depend on it.
- NFR-5 **Determinism for tests:** fixture path produces snapshot-stable output independent of model nondeterminism.
- NFR-6 **Effect-native & typed:** schema-first, typed errors, slice isolation per `standards/ARCHITECTURE.md`.

## 9. Out of scope for v1

Raw `.eml` parsing; real email/calendar connectors; external sending; multi-machine sync; full
package scaffolding for every slice; autonomous legal/financial advice; production compliance
certification. (Mirrors `SPEC.md` and `runtime-data-loop.md` non-goals.)

## 10. Phased roadmap

| Phase | Theme | Outcome |
|---|---|---|
| **P0 — loop (done/spec)** | Runtime data loop on email fixtures | Candidate claims/tasks/draft + approval + SDK packet, deterministic |
| **P1 — document portal (this PRD)** | Extend loop to documents; editor portal | Real matter docs → grounded candidates → approve → local proven store |
| **P2 — librarian** | Ingest the corpus | AI librarian organizes `oppold-corpus` output into candidate claims at scale |
| **P3 — graph & ask** | Projection + retrieval | Graph-&-ask over the Postgres/PGlite projection (per `legal-document-intake` D6; dedicated graph DB deferred behind the port), GraphRAG ask-and-check, cross-matter conflict checks |
| **P4 — reason & wall** | Logic family | OWL 2 EL/RL reasoner over the TBox; enforced matter walls; bitemporal store |
| **P5 — sync & scale** | DMS completeness | Sync engine (FS ↔ Box/S3/local), Box Events → ingest |

## 11. Success metrics

- **Grounding coverage:** 100% of accepted claims have a resolvable evidence span (hard gate).
- **Time-to-first-grounded-claim:** from document drop to first reviewable candidate.
- **Approval throughput:** candidates Tom can review per session; reject rate trend (a learning signal).
- **Data egress:** zero client-content network egress in the default local configuration.
- **Dogfood traction:** number of real matters Tom runs through the loop; claims he keeps.
- **Style fidelity (qualitative):** Tom's edit distance on first drafts trending down over time.

## 12. Differentiation & competitive context

| Product | One-liner | Cloud/local | Grounds to source? | Audience |
|---|---|---|---|---|
| iManage / NetDocuments | Legal DMS (NetDocs cloud-only; Worldox discontinued) | Cloud (iManage also hybrid) | Search/clause AI emerging | BigLaw → small [4][5] |
| Harvey / CoCounsel / Robin AI | Legal AI assistants | Cloud (some private-cloud) | **Yes**, strong inline citations | BigLaw / enterprise [1][2][3] |
| Rowan / PatentPal / Patlytics / Solve | Patent drafting & prosecution AI | Cloud SaaS | Uneven; strongest in search/analysis | Patent practitioners [7][8][9] |
| Elephas / GPT4All | Local/offline AI | **Local** | Weak; not legal-grade | Privacy-minded solos [6] |
| **Prose-to-Proof** | Local IP workbench | **Local-first** | **Yes — every assertion, by hard guarantee** | **Solo IP practice** |

**Wedge:** none of the above occupy *local + every-assertion-grounded + IP-specialized*. The
UX bar for "click a claim → jump to the highlighted source span" is set by Hebbia and Glean;
Gemini's grounding model and Perplexity's inline citations are the consumer reference points. [10][11][12]

## 13. Risks & open questions

- **Real-model grounding fidelity.** Span alignment must stay deterministic and verifiable; risk of model-invented offsets is mitigated by `@beep/langextract`'s alignment (exact → fuzzy) rejecting unaligned text.
- **Ontology depth for IP.** FOLIO is shallow on patent/trademark specifics; the IP layer needs the `ip-law-knowledge-graph` 7-source set. FOLIO governance (SALI/SOLI fork) is unsettled — cite carefully. [13]
- **Which first workflow.** Office-action review vs. intake vs. drafting vs. contract review — highest trust/value ratio is an open product question (`product-vision-law-practice.md`).
- **Corpus export constraints.** What of Tom's prior-firm history can be exported, under what confidentiality terms (the corpus stays outside the repo regardless).
- **Approval language.** How to distinguish "assistant draft" from "attorney work product" in the UI.

## 14. References

Internal: `goals/agentic-professional-runtime/{SPEC.md, docs/product-vision-law-practice.md,
docs/runtime-data-loop.md, docs/approval-and-autonomy-policy.md}` · `goals/ip-law-knowledge-graph/SPEC.md`
· `goals/oppold-corpus-pipeline/SPEC.md` · `docs/BEEPGRAPH_ARCHITECTURE.md` · the
[Architecture Map](../PROSE_TO_PROOF_ARCHITECTURE_MAP.md).

External (market context):
[1] harvey.ai/platform · [2] legal.thomsonreuters.com/.../cocounsel-legal · [3] robinai.com (Word add-in)
· [4] lexworkplace.com/imanage-vs-netdocuments · [5] sbnonline.com — NetDocuments/Worldox acquisition
· [6] elephas.app/resources/best-private-ai-tools-for-lawyers · [7] clarivate.com — Rowan Patents
· [8] patlytics.ai/office-action · [9] blog.patentext.com — Solve vs Patlytics · [10] hebbia.com — document analysis citations
· [11] docs.glean.com — citations · [12] ai.google.dev/gemini-api/docs — grounding · [13] openlegalstandard.org — FOLIO/SALI.

*Competitive claims are point-in-time (researched 2026-06-15) and should be re-verified before external use.*
