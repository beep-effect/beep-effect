# BRIEF — Rung-0 Office-Action Review Loop (the "turn it once" spike)

_Shape-Up brief · Packet: `atlas-synthesis` · Stage: shape · Date: 2026-06-17_

> **What this is.** The fat-marker shape for the first build: turning the
> prose-to-proof loop **once**, on a real-shaped USPTO office action, at
> embarrassingly shallow fidelity. It graduates into **two goal packets** —
> `epistemic-claim-lifecycle-gate` (the reusable boundary) and
> `law-practice-office-action-spike` (the IP-law vertical + the loop wiring).
> Authority for the product model is `goals/agentic-professional-runtime/SPEC.md`
> + `docs/data-model-law-practice.md`. Domain grounding is
> [`synthesis/50-office-action-domain.md`](./synthesis/50-office-action-domain.md);
> data-format + ontology reality-check is
> [`synthesis/51-office-action-data-and-ontology.md`](./synthesis/51-office-action-data-and-ontology.md);
> the strategic warrant is
> [`synthesis/32-moat-niche-pmf-verdict.md`](./synthesis/32-moat-niche-pmf-verdict.md)
> (§5.2 "office-action review is the sharpest wedge", §5.4 "turn the loop once")
> and the gap map [`synthesis/00-baseline-gap-map.md`](./synthesis/00-baseline-gap-map.md)
> (§3 the thesis, §4 the critical path). This brief references them; it does not
> copy them.

---

## Problem

The repo has **remarkable bricks and not yet the building** (`00 §5`). The
authority spine is largely built; the prose-to-proof loop — the thing the whole
product *is* — has **never turned once**. Four of seven hops in the minimum loop
are net-new, the IR→law-entity mapping is flat NOT FOUND, and the first workflow
sat open this far into the build (`00 §4`, `32 §5.1`). The modal way this project
dies is "capability-rich, product-zero": every brick added without closing a loop
*widens* the integration surface instead of proving anything (`32 §5.3.1`).

We are proving the **thesis made concrete**: *retrieval proposes, fallibly; logic
proves, soundly* — with **the boundary** between them existing in running code,
not prose (`00 §3`). The proof obligation: a real-shaped office action goes in as
opaque text; a span-grounded, shape-validated **`CandidateClaim` with char-offset
`Evidence`** comes out the other side, having crossed a **SHACL gate** and a
**`ClaimLifecycle`** transition, materialized into an in-memory projection a
trivial ask can read. If that loop turns once, "the loop is reachable" upgrades to
"reached" (`32 §5.5`), the integration gap is de-risked, the TBox gets a bounded
scope, and Tom gets a concrete approve/reject action (`32 §5.2`). One choice
de-risks the loop, the ontology, and the flywheel simultaneously.

The work product the loop targets is the **DISTINCTION** — the attorney's
span-anchored assertion that a claim is patentably distinguishable from a cited
prior-art reference (`50 §5`). That is the object that flows through the epistemic
gate as a candidate.

---

## Appetite

This is a **SPIKE, and a fixed budget — not an estimate.** Scope is the lever; if
it doesn't fit, **cut fidelity, never extend the budget.** The cap:

- **One** fixture office action (synthetic or already-public; never privileged).
- **One** matter, **one** independent claim shape, a **finite** claim/rejection
  vocabulary — enough to carry **one §102 or §103 rejection** and produce **one
  distinction**. (The full §101/§102/§103/§112 taxonomy is modeled-as-union but
  only one arm is exercised end-to-end at rung 0.)
- **Embarrassingly shallow** at every hop: trivial ask, in-memory projection,
  candidate-only-plus-one-transition lifecycle, light `@source` JSDoc — no
  perfection anywhere.
- **A loop that turns once is worth more than five more perfect bricks**
  (`32 §5.4.1`). The done-signal is *the loop runs end-to-end on the fixture and
  emits a span-grounded admitted/shape-valid claim a trivial query can read* — not
  coverage, not polish, not breadth.

Binding sequencing inside the budget (every PLAN.md, no exceptions): **P0 schema →
P1 service-contract (ports/services) → P2 implementation → P3 verify.** Helpers are
extracted *after* schema + contract are fixed, never composed into a service at
the end. Role-suffix order `.model.ts → .ports.ts/.service.ts → .repo.ts`. Each
SPEC.md gates phase N+1 on phase N.

---

## Solution sketch (fat-marker)

The loop, end-to-end, at low fidelity:

```
fixture office-action.pdf|.docx        ← BRICK: clean fixture in spike fixtures/
  └─> @beep/file-processing            ← BRICK (Strategy picks driver)
       └─> @beep/tika                  ← BRICK (subprocess: bytes → text + offsets)
            └─> @beep/langextract       ← BRICK (Extraction + Alignment: spans over text)
                 └─> @beep/nlp Handoff IR ← BRICK (via langextract/Handoff)
                      └─> IR → law-entity mapping   ← ★ NET-NEW (law-practice/use-cases)
                           └─> CandidateClaim + Evidence(char-span)  ← ★ NET-NEW glue + ported primitive (epistemic)
                                └─> SHACL gate + ClaimLifecycle      ← ★ NET-NEW wiring over BRICK (@beep/semantic-web)
                                     └─> in-memory projection        ← ★ NET-NEW pure function (epistemic)
                                          └─> trivial ask/view       ← ★ NET-NEW (law-practice)
```

**Two packets, slice-owned (no new `knowledge-law/*` packages):**

1. **`epistemic-claim-lifecycle-gate`** — the **REUSABLE BOUNDARY** (epistemic
   slice). Owns: the full `ClaimLifecycle` state machine (candidate →
   shape-valid → consistency-checked → admitted; today candidate-only per
   `00 §2`/`§5`), the **SHACL-gate mechanism**, the **projection-as-pure-function**
   (in-memory, rebuilt from authority, never a second source — `00 §3`), and
   **porting the v3 `EvidenceSpan` char-offset primitive** into `Evidence`
   (`32 amendment` §"speed-to-MVP": port the thin slice, not the engine). PROV-O
   provenance is epistemic-owned and already live in `@beep/semantic-web` +
   `packages/foundation/modeling/rdf/src/Vocab/Prov.ts` (`51 §2.2`).

2. **`law-practice-office-action-spike`** — the **IP-LAW VERTICAL + the loop
   wiring** (law-practice slice). Owns: `OfficeAction` / `Claim` / `Rejection`
   (§101/§102/§103/§112 tagged union) / `PriorArt` / `Distinction` as **bespoke
   Effect-Schema** in `law-practice/domain` (the seed vocabulary is `50 §6`; the
   `Rejection` shape is a discriminated union because §-type changes cardinality —
   `50 §7`), light `@source` JSDoc (CPC/IPC, PROV-O, SKOS — all narrow/orthogonal
   per `51 §2.2`; the empirical field donor is the USPTO OA Rejection API field set
   per `51 §1.1`, cited not ingested), the **IR→law-entity mapping**
   (`law-practice/use-cases`/`server`), the loop wiring, and a trivial ask/view.

**Bricks vs NET-NEW (the load-bearing distinction — `00 §4`):**

| Hop | Status | Carrier |
|---|---|---|
| fixture → text + offsets | **BRICK** | `@beep/file-processing` + `@beep/tika` (`51 §1.3`) |
| text → spans | **BRICK** | `@beep/langextract` (Extraction/Alignment) |
| spans → IR | **BRICK** | `@beep/nlp` Handoff IR (via langextract/Handoff) |
| **IR → law entities** | **★ NET-NEW** | law-practice/use-cases (flat NOT FOUND today, `00 §2`) |
| law entities → `CandidateClaim`+`Evidence(span)` | **★ NET-NEW** glue + **ported** EvidenceSpan | epistemic |
| SHACL gate + lifecycle transition | **★ NET-NEW** wiring over bounded-SHACL **BRICK** | `@beep/semantic-web` + epistemic |
| in-memory projection | **★ NET-NEW** pure function | epistemic |
| trivial ask | **★ NET-NEW** trivial | law-practice |

**Slice ownership (compose, don't cross-import — `standards/ARCHITECTURE.md`):**
epistemic owns lifecycle + gate-mechanism + projection + EvidenceSpan;
law-practice owns the IP-law product language + the IR→law mapping + the loop;
foundation supplies the engine bricks. No direct slice-to-slice imports —
law-practice composes epistemic **only** via its public surface / shared kernel.

**Federation invariant — bake the model in now, defer enforcement (`32 amendment 2`,
~zero cost at rung 0):** corpus authority is always single-owner + local; any
cross-matter/firm view is a **permissioned projection**, never a write to a shared
central store; matter walls are a **first-class sharing-permission boundary** in
the domain (`OfficeAction.matterId`, `50 §6.1`). Enforcement deferrable; the model
not.

---

## Rabbit holes (named so we don't chase them)

- **Ontology grounding.** The 7-source IP-law ontology set **all defers** at
  rung-0 scope — none supplies the patent-claim/office-action/rejection vocabulary
  (`51 §2.3`). Bespoke Effect-Schema **is the TBox**; `@source` JSDoc stays light.
  Do **not** open `goals/ip-law-knowledge-graph` (stays PENDING/referenced). Do not
  attempt BFO/LKIF/FOLIO three-tops alignment (`00 §5`).
- **FalkorDB / a real graph store.** Projection is an **in-memory pure function**
  rebuilt from authority. No FalkorDB (SSPLv1 licensing call is real but
  irrelevant at n=1, `00 §5`, `32 §4.1`); no Cypher; no graph DB of any kind.
- **Full GraphRAG ask.** A **trivial** query over the in-memory projection
  suffices — "show me the candidate distinction and its evidence span." No RRF, no
  retrieval ranking, no GraphRAG, no conflict-checking engine.
- **The full v3 engine port.** Port **only** the `EvidenceSpan` char-offset
  primitive. langextract already covers extraction; the v3 GraphRAG/
  extraction-pipeline is the *copyable wedge*, not the moat — porting the whole
  engine is spend on the wedge (`32 amendment` §moat). Knife, not Swiss army
  (`32 §5.2`).
- **Parsing arbitrary OA PDFs.** Use **one clean fixture** (synthetic or
  already-public). Structured OA data exists but is the wrong fixture source by
  design — it lags 30–180 days, ends mid-2017, and carries no char-spans into a
  document the user holds (`51 §1.2`). Do not build a robust real-world OA parser;
  do not chase DOCX→ST.96 structured import (deferred follow-on, `51 §1.3`).
- **The §-rejection taxonomy ballooning.** Model `Rejection` as the four-arm union
  for shape correctness, but **exercise only one arm** (§102 or §103) end-to-end.
  Do not build out the full §101 Alice/Mayo two-step substructure, the seven KSR
  rationales, or the §112 sub-grounds at rung 0 (`50 §2` is grounding, not a
  build-list). The §101 detail is medium-confidence and explicitly to-be-verified
  before any schema lock (`50` Caveats).
- **Distinction taxonomy breadth.** Eight distinction kinds exist (`50 §5`); rung-0
  produces **one** (`missing_limitation` is the cleanest §102/§103 fit). The rest
  are union arms, not build targets.

---

## No-gos (hard boundaries for this spike)

- **No real privileged data.** Tom's live matters never enter the repo (`51 §1.2`,
  the binding privilege wall). Fixture is synthetic or already-public, period.
- **No 7-source ontology** and no runtime ontology dependency. Bespoke
  Effect-Schema + light `@source` only (`51 §2.5`).
- **No FalkorDB / no graph store.** In-memory projection-as-pure-function only.
- **No full v3 engine port.** Only the `EvidenceSpan` primitive crosses the
  v3→v4 boundary.
- **No autonomous legal advice.** The loop emits **candidate-only** work product
  behind an **approval gate**; the distinction is prosecution-history estoppel —
  durable, span-anchored, attorney-owned authority, never an auto-asserted fact
  (`50 §5`, §7.6). The verb is "validates shape + grounds in spans," **not**
  "proves" or "advises" (`32 §5.3.4`).
- **No new `knowledge-law/*` packages.** Two packets, slice-owned (epistemic +
  law-practice); minimum-viable slice = domain + use-cases + server (`32 §5.4.3`).
- **No venture-grade ceremony on `law-practice` now.** Keep the irreversible
  architecture (authority/projection, schema-first, error taxonomy, the federation
  invariant); defer promotion records / V2 versioning / matter-wall *enforcement*
  until rung 1 (`32 amendment 2`, `32 §5.4.3`).

---

## Confidence & Caveats

**High confidence (load-bearing decisions are locked and externally warranted).**
Office-action review as the sharpest first wedge (`32 §5.2`, `00 §5`); turn-the-
loop-once as highest-ROI move (`32 §5.4.1`); bricks-vs-NET-NEW split (`00 §4`,
`51 §1.3`); bespoke-Effect-Schema-as-TBox with the 7-source set deferred (`51 §2`);
file-through-tika fixture path over structured OA data (`51 §1.2`). These are not
relitigated here; this brief shapes within them.

**Medium confidence (carried from the grounding docs; verify before schema lock).**
The §101 two-step substructure (Step 2A prongs / groupings / 2B / "more likely than
not" threshold) is medium-confidence in `50` (the Fed-Reg direct fetch was blocked;
re-verify against MPEP 2106 before freezing any §101 schema). Exact USPTO OA
Rejection API field names are high-confidence-but-not-byte-exact (`51` Caveats —
confirm against live ODP Swagger before P0 lock). Form-paragraph numbers are
indicative, not verified.

**Out of scope / deferred (restating the no-gos as scope, not findings).** Trademark
OAs (patent-only at rung 0); double-patenting / restriction / reissue nuance;
DOCX→ST.96 structured claim import; CPC/IPC-as-SKOS classification; the
public-OA-vs-synthetic fixture choice (an open follow-on, `51` §"Open follow-ons").

**Not settled here (correctly deferred to decompose).** This is a shape, not a MAP
or a spec — it deliberately does not enumerate every schema field, service
signature, or phase gate. Those land in each packet's PLAN.md/SPEC.md under the
P0→P3 sequencing, reconciled against
`goals/agentic-professional-runtime/docs/data-model-law-practice.md` (which already
includes an `OfficeAction`) during decomposition. The exact fixture office action
has not been inspected; the `50 §6` vocabulary is a *proposed* P0 starting point,
not a frozen schema.
