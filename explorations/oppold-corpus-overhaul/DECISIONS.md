# Decisions

## 2026-08-24 — MAP ratified; privacy-gate language dropped; one-PR ceremony

Grilled round three (operator-ratified):

1. **No privilege/PII/secret gate language in this packet.** The graduation
   dossier proposed a hosted-model policy gate; the operator's revised
   corpus-handling doctrine (2026-08-17) directs that packets not carry
   confidentiality/compliance language — hosted providers are welcome,
   provider choice is ordinary config. The langextract default-deny posture
   already in code stays as-is. Dropped from BRIEF no-gos.
2. **MAP candidate set ratified as proposed:** promised-now
   `goals/oppold-corpus-salvage-restoration` (G1); gated re-entry
   `oppold-corpus-pipeline-v2` (G2), `oppold-corpus-semantic-ingestion-v2`
   (G3), `oppold-corpus-enrichment-v2` (G4), then the `practice-kg-bundle-v2`
   gate; deferred `solo-practice-corpus-kit` (productization explicitly
   outside this appetite).
3. **Ceremony:** one docs-only PR — packet updates, BRIEF, MAP, drift fixes,
   G1 scaffold, status flip to `graduated`, ATLAS sync — published via yeet.
4. **Drift fixes in scope:** packet README next-open-question rewrite;
   `research/SOURCES.md` gains the binding `goals/oppold-corpus-pipeline`
   predecessor; `explorations/README.md`'s citation of the retired
   repo-exports catalog (removed from `standards/`) is replaced with
   live-source/package-barrel language. `CAPTURE.md` stays untouched
   (append-only).

## 2026-08-24 — Four stop conditions ratified (align closed)

The four unbounded capture bullets each got a stop condition (grilled round;
candidates drawn from the adversarial residue distillation, GPT-5.6 Sol
xhigh, 2026-08-24):

1. **Pipeline re-eval "from scratch" stops** when a versioned decision matrix
   covers the current-T7 archive plus the existing governed-corpus run union,
   and every observed format, container, and pipeline stage has one
   `keep | replace | add | defer` decision with an owner, acceptance check,
   and unsupported/quarantine outcome. "From scratch" audits the completed
   June pipeline (it ran; its debt binds) — it never erases it.
2. **Capability incorporation "and more" stops** when every capability named
   in `CAPTURE.md`, plus only capabilities required to close a matrix gap
   from (1), has a written input/output, precedence, fallback, cost, and
   acceptance contract — or an explicit defer. Package discovery alone never
   adds scope.
3. **Per-step self-improvement** = one immutable pipeline version per run;
   each stage evaluated against a fixed metadata-safe regression set in
   shadow mode; stop when no candidate clears its predeclared quality-gain
   and cost/regression thresholds; accepted changes apply only to the next
   run. No same-run mutation of rules, prompts, schemas, engines, or
   ontology version.
4. **Enrichment "every avenue" stops** at a closed register of authority
   sources tied to the approved v2 competency questions; each source either
   meets its declared quality target or fails a
   license/authority/contradiction/cost/marginal-gain gate. External
   assertions are stored beside restored evidence, never over it.

With these, the manifest's open question is answered; the packet moves to
`shape` (BRIEF drafting).

## 2026-08-24 — Graduation shape, preservation timing, archive home, appetite (operator-ratified)

Grilled round (grill-with-docs session; the T7 salvage drive was mounted
(volume `T7XFER`) during the session — census layout confirmed on disk):

1. **Graduation shape:** one promised-now goal — salvage preservation +
   mail-first restoration. Pipeline re-eval, T-Box-guided ingestion, and
   enrichment stay in `MAP.md` as **gated candidates** that reopen this packet
   at decompose when their gate fires.
2. **Preservation timing:** preservation is the goal's **P0, run ASAP** —
   build the minimal streaming copy-while-hashing tool first and run the
   archive op as soon as it exists, before any transformation work. The
   removable-drive exposure window closes on bar-v2 semantics, not ad hoc.
3. **Archive destination:** the corpus home's `raw/t7-salvage-2026-08-10/`,
   beside the existing `raw/` trees; `oppold-corpus.zip` archived verbatim as
   its own object; `raw/provenance.jsonl` extended. T7 remains the redundant
   second copy; the old PC carries forward as the third until verification
   (bar v2 clause 2).
4. **Appetite (BRIEF input):** split — the preservation gate lands **this
   week, no negotiation**; the transformation gates (mail estate, recycle
   re-pairing, doc conversion) get one **~3-week wave**. Mirrors the ratified
   preservation/transformation gate separation.

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
