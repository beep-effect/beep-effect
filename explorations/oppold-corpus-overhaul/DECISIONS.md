# Decisions

## 2026-08-17 — Restoration bar v2 (adversarially reviewed, re-ratified)

Eight adversarial lanes (grok xhigh + codex medium over the bar and the
pipeline vision; reports in `research/2026-08-17-adversarial/`) invalidated
the first census and several bar clauses. The operator re-ratified the bar
as amended:

1. **One-pass copy-while-hashing** to the durable archive, then destination
   verification — never a separate hash pass before redundancy exists.
   Streaming hasher required (the in-RAM helper cannot process the 47.58 GiB
   PST). Dest-exists policy: truncate-and-resume by hash, never fail-closed
   hand cleanup.
2. **Loss universe defined honestly:** the bar guarantees *no further loss
   from current T7 state*. The collector's 5,986 errors, deliberate
   exclusions, exFAT-stripped NTFS metadata, 13 missing-`$R` records, and the
   1,021 mutated-E-tree dests are the loss ledger's **inherited opening
   balance**. The salvage's own do-not-wipe-the-old-PC instruction carries
   forward until verification.
3. **Recycle restoration** = the four-class identifier join (valid pair /
   missing-`$R` / orphan-`$R` / duplicate) over all **three volumes'** bins,
   via the existing `beep corpus recycle-bin` pairing semantics extended with
   directory-`$R` tree reconciliation, a collision + illegal-character +
   case/NFC policy for the case-sensitive destination, and a mapping ledger
   (`$I` originalPath → digest → restored path).
4. **Fail-closed checks:** `f-recyclebin-F` absence; the E-tree post-staging
   mutation; `_meta/manifest.jsonl` reconciliation row-by-row.
5. **`oppold-corpus.zip` (137.6 GiB)** is archived verbatim as its own
   object; never unzipped over the corpus.
6. **Preservation and transformation are separate acceptance gates.**
   Preservation: every current T7 byte hash-verified in the archive.
   Transformation (extraction/conversion) reconciles source→output counts
   with per-item ledgers and never gates preservation.

## 2026-08-17 — Scope discipline (adversarially reviewed, ratified)

1. The census was rewritten with corrections recorded (see its header note).
2. `goals/oppold-corpus-pipeline` (June: 663k children extracted `-m items`,
   285 failures, 3,055 unsorted) is a binding predecessor alongside
   `oppold-corpus-refresh`; the overhaul inherits its debt ledger.
3. The four unbounded capture bullets (from-scratch re-eval; "and more"
   capability incorporation; per-step self-improvement; "every avenue"
   enrichment) each require an explicit align question with a stop condition
   before the BRIEF.
4. **Mail-first ordering:** the restoration slice leads with a streaming,
   path-based libpff runner (`-m all` recovered items, no EML budget cap,
   per-child digests, per-store corruption/password/codepage lane) — the
   112 GB mail estate is where loss risk concentrates, and 46 of 53 stores
   sit inside a recycle tree. `.doc` conversion is a net-new subsystem (no
   in-repo converter exists) with a defined fidelity metric; convert
   distinct digests, not paths.

## 2026-08-17 — Born active at capture; one packet; gates bundle v2

**Decision (operator, grilled round):** capture the full corpus-overhaul
vision as ONE exploration packet — decompose splits it later; the bullets are
one coherent vision. The packet is **active**, not parked: its first align
question (salvage restoration and data-loss proof) is urgent because the
salvage sits on a removable drive.

**Gating (operator-ratified):** this packet gates **practice-kg bundle v2**,
not the live v1 front. Lane 1's first-user delivery proceeds from the current
corpus; the overhaul's exit is the declared prerequisite for the next
expensive pipeline run.

**Honesty bars set at capture:** "lossless" `.doc` → `.docx` is restated as
fidelity-verified conversion with provenance; T-Box work composes with
`semantic-foundation` M1 / patent-document-schema / FOLIO rather than
re-founding ontology work.
