# Bake-off adversarial reconciliation — 2026-08-24

Inputs: [`2026-08-24-sol-bakeoff-review.md`](./2026-08-24-sol-bakeoff-review.md) (REWORK ×5) and
[`2026-08-24-grok-4-6-bakeoff-review.md`](./2026-08-24-grok-4-6-bakeoff-review.md) (2×
RATIFY-WITH-EDITS, 3× REWORK). Reconciled by Fable. Outcome: **no family verdict is ratified
today.** The five sheets are reclassified as **candidate screens** — high-value slates and probe
definitions, not adoption decisions.

## The convergent core (both reviewers, independently)

1. **Process breach.** Rubric §0 forbids launching without the workload/gold artifacts; §4
   forbids final verdicts before the compatibility round. `gold/v1` does not exist, F1 fixtures
   are uncommitted, the compatibility round never ran — and the corpus premise was wrong:
   **76 PDFs on disk, not 443** (443 is the metadata census; verified, contract corrected to
   v1.1 with a committed-manifest W1 definition). Sheets that name winners under those
   conditions violate the law we ratified. Sol: "calling the choices 'provisional' does not
   create a sixth verdict state." Accepted in full.
2. **Selective gate application.** EYE received G8 credit for unbuilt decode work that failed
   Ascent; G4/G8 "PASS by contract" scored unwritten code (extraction, input, embeddings);
   synthetic Linux proxies produced G5 passes (storage); UNKNOWN leaked into scored ranges
   (reasoning gold 0-16). All confirmed against the sheets' own text. Accepted.
3. **The winners do not compose.** Five seams, found by both: (a) no named canonicalization —
   spans were locally valid, globally meaningless (fixed: `CanonicalText` added to
   shared-schema v1.1, UTF-16, single owner); (b) **dim 256 vs 384 vs 768** across
   embeddings/storage/model-native (decision: dimension is frozen only by the joint canary, and
   vector tables are dimension-keyed); (c) EYE full-rerun vs the ledger's incremental truth
   maintenance — four candidate owners for RDFS closure; single-owner rule: **the ledger owns
   invalidation; any engine is a batch oracle behind it**; (d) DuckDB-exact → pgvector has no
   migration story; (e) **budgets were per-family**: storage alone measured 1,145 MB RSS and
   ~175 MB deps; adding EYE (documented 1 GB stacks) and unpruned ORT (259 MB) busts both
   ceilings — budget accounting is bundle-level from now on.
4. **Live-source falsification.** Grok: `@beep/duckdb` has NO vector surface (the 18-20
   integration score was invented); the Oxigraph adapter builds a fresh store per request and
   ignores `timeoutMs`; `ExtractionResult` carries no span field. Sol: same class. The screens'
   in-repo "adapt" claims were often claims about code that does not exist yet.

## Reconciled family states (recorded in DECISIONS B1–B6)

Formal verdict for every family today: **park-pending-canary**, with the sheet's slate preserved
as the probe order. Concretely: storage keeps the ledger+projections *shape* as the first bundle
to probe (Oxigraph inside the probe only after its adapter gains a long-lived store + timeout);
embeddings carries Snowflake/GTE × native-ORT/Transformers.js into one model-held-constant probe,
dim unfrozen; input keeps per-stage bricks, PDF.js/MuPDF formally a tie; reasoning parks EYE as
the first adaptation probe (never yet loaded in Bun); extraction forwards hybrid AND pattern-only
into the same gold probe, single family verdict pick-one/adapt-pending, `already-have` dropped
as a co-verdict. Atlas `Verdict` columns receive ONLY park values that are final (server-only
tech, semantica-internal drops) — no adopt/pick-one is written into Notion until probes pass;
"candidate" is packet state, not atlas state (A9 has no such value, and both reviewers refused
to invent one).

## The canary (both reviewers' "run first", merged — the M1 gateway)

One Bun sidecar, network disabled: F1 fixtures + one W1-manifest PDF through parse →
CanonicalText + loss map → EvidenceBatch → ledger commit → dimension-keyed DuckDB query →
Oxigraph projection → EYE `--restricted` proof → decoded InferenceEvent → EvalReport. Run twice
offline; crash/restart between ledger commit and each projection rebuild. Required: identical
ids/hashes across replays, every mention slice equal to CanonicalText content, independently
verified proofs, consistent watermarks, and **aggregate** budgets (<5 s cold, <2 GB RSS, <250 MB
deps for the loaded bundle). Prerequisites, in order: corpus manifest → F1 fixtures → minimal
gold slice. Any miss falsifies the corresponding family table, not the rubric.

## Rejected / noted

- Grok's "Oxigraph out of the bundle" as a permanent exclusion — softened to conditional
  (adapter rework is small and its G6 issue is ours, not upstream's).
- Sol's implication that the screens were low-value — rejected; the slates, gate tables, live
  measurements (shacl 20 s hang, DuckDB M2, RSS numbers) and probe definitions are exactly the
  research the rubric wanted. The failure was verdict inflation, and D17 caught it. Minor:
  reasoning sheet's `../beep-effect-logos` citation path doesn't resolve (correct path is
  `~/YeeBois/projects/beep-effect-logos`).
