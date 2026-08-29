# Citation Grounding — Product Doctrine

> **Ground before cite.** No citation or quotation reaches legal work product
> unless identified source text verifies the exact raw span it would emit.

- **Status:** Ratified product doctrine (2026-07-14)
- **First implementation packet:** [verified-span substrate](../../goals/citation-verified-span-substrate/README.md)
- **Source exploration:** [Citation Grounding & Hallucination Guard](../../explorations/citation-grounding-hallucination-guard/README.md)
- **Shared firewall family:** [Solo-Firm Docketing](./solo-firm-docketing.md) · [IP Attorney Time Tracking](./ip-attorney-time-tracking.md)

---

## 1. Ground before cite

A plausible legal citation is not evidence, and normalized text that merely
resembles a source is not a quotation. The product may propose a citation or
quote only after deterministic extraction points to identified source text and
the proposed half-open span reproduces the text that would be emitted. Legal
resolution operates on that grounded candidate; it never manufactures the
grounding that allows a candidate through.

Machine output therefore has zero citation authority. An absent, ambiguous,
stale, unverifiable, or cross-matter anchor fails closed before a citation or
quotation reaches work product or the approval seam. This is the same
candidate/approval firewall family used by [docketing](./solo-firm-docketing.md)
and [time capture](./ip-attorney-time-tracking.md): evidence may create a
reviewable candidate, but confidence and repetition never create authority.

The law-practice boundary publishes grounded citation evidence. Application or
server composition may adapt its verified anchor to the existing epistemic
evidence and candidate-admission contracts. Citation vocabulary does not move
into the epistemic slice, and the shared claim lifecycle does not change.

## 2. The verbatim firewall

Normalization may locate; it may not speak for the source. The locator may
normalize whitespace and typographic quotes, but it does not case-fold or
fuzzy-match. It keeps a deterministic normalized-to-raw-source map, converts
every foreign boundary explicitly into canonical half-open UTF-16 code units,
then replaces locator text with the exact raw slice. A quote crosses only when
`source.slice(start, end) === quote`.

Source identity and digest/version travel with the anchor. Duplicate
occurrences require deterministic context or fail ambiguous. Cross-chunk or
page straddle must preserve one global raw span without inventing or dropping
separators. Source drift never silently rewrites evidence: retain the failed
attempt, re-anchor only against the identified new source version, and prove
the same raw-slice invariant again.

The audit trail retains raw extraction attempts, normalization/engine version,
verified anchors, matter identity, resolution attempts and warnings, re-anchor
history, and closed failures. `NO_CITATION` is a persisted negative extraction
attempt, not a citation entity. Derived display and grouping views are
recomputed rather than treated as source truth.

## 3. Privileged text stays local

The v1 path is local-only. Privileged source text never leaves the device, and
no hosted parser or lookup result can substitute for exact equality against the
local identified source.

A later CourtListener lane is separately gated. It is opt-in, accepts only
explicitly non-privileged text, carries managed authentication and audit
metadata, and verifies or enriches after the local path is proven. It is never
the parser and never the grounding truth.

## 4. Three lanes, three gates

The program proceeds in order:

1. **Verified-span substrate.** Generic provenance and langextract mechanics
   establish matter-scoped `TextAnchor` construction, canonical UTF-16
   conversion, deterministic normalization-to-source mapping, straddle, and
   fail-closed source-drift behavior. A hostile-text fixture spike gates
   implementation.
2. **Citation extraction engine.** An Effect-native eyecite-parity engine emits
   the existing law-practice citation values. It waits on the verified-span
   substrate and versioned stable-ID artifacts from the separately graduating
   court-vocabulary resolver; attribution and stage-level parity evidence are
   gates.
3. **Ground-before-cite integration.** Law-practice extraction/resolution ports
   and the guard carry verified matter-scoped evidence through composition into
   the existing epistemic admission machinery. It waits on both prior lanes and
   must prove absent, ambiguous, stale, cross-matter, and `NO_CITATION`
   behavior.

MPEP patterns, hosted enrichment, matter-wall enforcement, and rich-text
annotation remain gated follow-ons. The full rationale, rejected options, and
source ledger remain in the [exploration packet](../../explorations/citation-grounding-hallucination-guard/README.md);
the active implementation contract lives in the [verified-span goal
packet](../../goals/citation-verified-span-substrate/README.md).
