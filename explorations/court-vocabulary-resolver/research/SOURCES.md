# Court Vocabulary Resolver — Sources & Provenance

Provenance ledger tracing every decision in this packet back to its mined gold
nugget (with upstream repo + `file:line`), the upstream repository + license,
the external research citation, and the in-repo `@beep/*` capability it composes.
Derived from the gold-intake cluster **"Court / jurisdiction controlled
vocabulary"** (14 nuggets, route `new-exploration`, wave P2).

- **Cluster:** Court / jurisdiction controlled vocabulary (14 nuggets; theme span:
  data-ingestion, desktop-portal, ip-domain-models, kg-ontology-reasoning,
  legal-nlp, provenance-evidence)
- **Route:** `new-exploration` → primary target `court-vocabulary-resolver`
- **Gold-intake provenance:**
  [`_gold-intake/ROUTING.md`](../../_gold-intake/ROUTING.md) ·
  [`_gold-intake/routing.json`](../../_gold-intake/routing.json) ·
  [`_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md)
  (see synthesis item #2 "Court / jurisdiction controlled vocabulary" and the
  capability-gap table rows for "Court / jurisdiction / reporter taxonomies" and
  the CourtListener driver skeleton)
- **Packet codex review:**
  [`reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)
  (5 blocking + 6 advisory, folded into RESEARCH.md 2026-06-29)

---

## 1. Mined source corpus (gold nuggets)

| Nugget | Title | Upstream (repo) | Source (file:line) | Theme | Priority | Disposition |
| --- | --- | --- | --- | --- | --- | --- |
| `courtlistener#7` | Court jurisdiction taxonomy (federal/state/tribal/territory/military) | courtlistener | `cl/search/models.py:1872-1937` | kg-ontology-reasoning | P1 | clean-room (AGPL: re-express facts as Schema literals) |
| `courtlistener#8` | Citation reporter-type taxonomy + reporter data model | courtlistener | `cl/search/models.py:2883-2941` | ip-domain-models | P2 | clean-room (AGPL: derived encoding only) |
| `courts-db#1` | Canonical court entity schema (2,809 courts) with CourtListener IDs | courts-db | `courts_db/data/courts.json:1-27` | ip-domain-models | P2 | port-with-attribution (re-derive data) |
| `courts-db#2` | Regex-template variable dictionary for court-name normalization | courts-db | `courts_db/data/variables.json:1-13` | legal-nlp | P2 | port-with-attribution (authored regex) |
| `courts-db#3` | Court-string resolver with partial-match span gating | courts-db | `courts_db/__init__.py:78-97` | legal-nlp | P2 | reimplement (clean-room logic) |
| `courts-db#5` | Parent/child court disambiguation (reduce to most-specific node) | courts-db | `courts_db/__init__.py:115-127` | kg-ontology-reasoning | P2 | reimplement (clean-room logic) |
| `courts-db#7` | `gather_regexes`: compiled matchers carrying id/name/type/location/parent | courts-db | `courts_db/utils.py:194-209` | legal-nlp | P2 | reimplement (clean-room logic) |
| `courts-db#8` | `citation_string` + `name_abbreviation`: court→reporter mapping | courts-db | `courts_db/data/courts.json:68091-68113` (cafc) | provenance-evidence | P2 | port-with-attribution (re-derive data) |
| `judge-pics#2` | Fuzzy name→entity resolution w/ confidence threshold + CL-ID fallback | judge-pics | `judge_pics/search.py:31-67` | legal-nlp | P2 | study (pattern only; calibration trap) |
| `Juris.AI#6` | Jurisdiction taxonomy + per-jurisdiction court/reporter/principle maps | Juris.AI | `src/components/jurisdiction-select.tsx:19-28` | ip-domain-models | P3 | study (seed-data reference) |
| `courts-db#6` | Data-loading: template substitution + ordinal expansion + field inheritance | courts-db | `courts_db/utils.py:140-177` | data-ingestion | P3 | reimplement (ingest-target build logic) |
| `doc-haus#9` | Config-only jurisdiction packs (`profile.json` + `prompt.md`) | doc-haus | `dochaus/lib/jurisdiction.ts:13-34` | ip-domain-models | P3 | study (pattern only) |
| `seal-rookery#1` | CourtListener court-ID → full court-name taxonomy | seal-rookery | `seal_rookery/seals/seals.json:1-12` | data-ingestion | P3 | reference (ingestion cross-check only) |
| `seal-rookery#2` | Court seal image URL resolver pattern | seal-rookery | `seal_rookery/search.py:31-47` | desktop-portal | P3 | reference (optional desktop UI; unknown license) |

### How these inform this packet

**Court vocabulary + entity schema (the data layer).** `courts-db#1` is the
load-bearing seed: the per-court object (`id, name, name_abbreviation,
citation_string, jurisdiction, system, type, level, location, parent, dates[],
regex[]`) becomes the `effect/Schema` court value vocabulary and the CourtListener
driver lookup table. Take the **field shape and the ~2,809-court dataset**, but
re-derive against the live file — RESEARCH.md confirms the schema has evolved
past the nugget snapshot to ~15 fields. `courtlistener#7` (jurisdiction codes
`F`/`FD`/`TRS`/`MA` …) and `courtlistener#8` (reporter-type enum `FEDERAL=1 …
JOURNAL=9`) supply the **closed-enum facts only** — these cite AGPL server code,
so re-express the uncopyrightable code/label pairs as `LiteralKit` literals and
never transcribe the Django source. Decision locked in RESEARCH.md: reporters-db
string `cite_type` is canonical; the CL integer is a derived encoding.

**Court-string resolver (the algorithm layer).** `courts-db#3` is the core
contract to reimplement: span gating rejects any regex match whose span ≠ the full
input length —
`len(court_str) != match.span()[1] - match.span()[0]` — i.e. a full-string match,
with `match.group(0)` as the grounded span. `courts-db#7` (`gather_regexes`)
gives the compiled-pattern + metadata-tuple index shape
`(compiled, id, name, type, location, parent)` with `re.I|re.U`; `courts-db#5`
gives parent/child reduce-to-most-specific (drop any match that is a parent of
another match). Take the **algorithm**, not the code (clean-room reimplement in
Effect). `courts-db#6` (gazetteer alternation + `${N-M}` ordinal expansion +
`variables.json` Template substitution + parent→child inheritance) is the
**ingest-target build logic** — belongs in `targets/Courts.ts`, not the runtime
resolver, which consumes an already-expanded flat table.

**Normalization vocab + crosswalk.** `courts-db#2` (`variables.json` fuzzy regex
fragments tolerating OCR/abbreviation variance) is authored creative expression
under BSD-2 — port WITH attribution. `courts-db#8` is the court→reporter
crosswalk; the CAFC entry (`id="cafc"`, `citation_string="Fed. Cir."`) is the
IP-domain anchor (the only federal appellate court for patent/PTAB appeals).

**Fuzzy/secondary tier (study, do not adopt verbatim).** `judge-pics#2`'s
fuzzy-candidate-vs-exact-ID pattern is a good shape, but RESEARCH.md flags the
`>95 token_sort_ratio` threshold as a calibration trap — three "ratio"
definitions disagree, so the in-repo full-Levenshtein helper cannot reproduce it.
`Juris.AI#6` and `doc-haus#9` are pattern/seed references for the multi-
jurisdiction value list and per-matter steering — not core build items. The two
`seal-rookery` nuggets are P3 references only: `#1`'s 365 court-ID→name map is an
**ingestion cross-check assertion** (RESEARCH.md: 354/365 intersect courts-db),
and `#2`'s seal-URL resolver is an optional desktop-portal nicety — unknown
license, so do not vendor.

> No SPLIT siblings: this cluster routes whole to `court-vocabulary-resolver`.
> Adjacent ownership stays out of scope (see §5 cross-links): abstract
> Court/Jurisdiction graph nodes → `goals/ip-law-knowledge-graph`; dataset-sync
> engine → `goals/official-data-sync-foundation`.

---

## 2. Upstream repositories & licenses

| Repo | Tier | License | Port discipline | What we take |
| --- | --- | --- | --- | --- |
| courts-db | T1 | BSD-2-Clause | port-with-attribution (data + regexes); **reimplement** resolver logic (locked posture) | Court entity dataset (~2,809), `variables.json` regex dictionary, span-gated resolver algorithm, data-build pipeline |
| courtlistener | T1 | **AGPL-3.0-only** | **CLEAN-ROOM ONLY** — re-express uncopyrightable facts as Schema literals; never import/transcribe server source | Jurisdiction code/label set, reporter-type enum (facts only) |
| judge-pics | T3 | BSD-2-Clause | study (pattern, with calibration test) | Fuzzy-candidate-vs-exact-ID resolution pattern |
| Juris.AI | T2 | MIT | study / port-with-attribution (seed data) | Multi-jurisdiction value list + reporter-abbrev lookup seed |
| doc-haus | T1 | MIT | study (pattern) | Config-only jurisdiction-pack (`profile.json` + `prompt.md`) shape |
| seal-rookery | T3 | **unknown / NOASSERTION** | reference ONLY — **do not vendor** the JSON index; consume IDs/names as factual cross-check | 365 court-ID→name map (ingestion assertion); optional seal-URL resolver pattern |

> **Cautions (echoed from the source bundle):** courts-db is BSD-2 (permissive,
> attribution-friendly) — safe to vendor the dataset/regex dictionary WITH
> attribution, but it is a freelawproject/CourtListener-adjacent asset; treat the
> **resolver logic as reimplement-don't-copy** and avoid pulling in any AGPL
> CourtListener server code. **Scope:** keep this the vocabulary/resolver vertical
> only — graph-shape Court/Jurisdiction nodes remain owned by
> `ip-law-knowledge-graph`; dataset ingestion plumbing remains owned by
> `official-data-sync-foundation`. P2 because it depends on the
> official-data-sync-foundation pipeline and is downstream of the IP-graph schema.
>
> **License firewall (RESEARCH.md Constraints):** the *facts* in `courtlistener#7/#8`
> are uncopyrightable under *Feist v. Rural Telephone*, 499 U.S. 340 (1991) — but
> the AGPL server source itself must never be imported or transcribed. BSD-2
> attribution for courts-db is one entry (BSD-2 text + "Copyright (c) 2020, Free
> Law Project" + source URL/commit); the attribution-artifact path is **net-new
> and undecided** (no root `THIRD_PARTY_NOTICES` exists today — see Q7 / codex
> advisory #5).

---

## 3. External research sources

Citations actually present in this packet's RESEARCH.md / `research/*.md`:

- courts-db repo + dataset — <https://github.com/freelawproject/courts-db> ·
  PyPI <https://pypi.org/pypi/courts-db/json> · raw
  <https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/data/courts.json>
  · resolver
  <https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/__init__.py>
  · utils
  <https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/utils.py>
  · LICENSE
  <https://raw.githubusercontent.com/freelawproject/courts-db/main/LICENSE>
- reporters-db — <https://github.com/freelawproject/reporters-db> ·
  <https://pypi.org/project/reporters-db/>
- eyecite (reference architecture) — <https://github.com/freelawproject/eyecite>
  · whitepaper <https://free.law/pdf/eyecite-whitepaper.pdf>
- seal-rookery cross-check —
  <https://raw.githubusercontent.com/freelawproject/seal-rookery/main/seal_rookery/seals/seals.json>
- CourtListener jurisdiction help + live API (verification only) —
  <https://www.courtlistener.com/help/api/jurisdictions/> ·
  <https://www.courtlistener.com/api/rest/v4/courts/?jurisdiction=TRS&format=json>
  · <https://www.courtlistener.com/api/rest/v4/courts/cafc/>
- CourtListener AGPL license proof —
  <https://raw.githubusercontent.com/freelawproject/courtlistener/main/pyproject.toml>
- *Feist Publications v. Rural Telephone*, 499 U.S. 340 —
  <https://www.law.cornell.edu/supremecourt/text/499/340>
- Bluebook / citation form — <https://guides.law.sc.edu/LRAWSpring/LRAW/citingfedcases>
  · Indigo Book (CC0) <https://law.resource.org/pub/us/code/blue/IndigoBook.html>
  · CAFC case context
  <https://law.justia.com/cases/federal/appellate-courts/cafc/>
- SHACL vs OWL (closed-world rule) — <https://spinrdf.org/shacl-and-owl.html>
- Fuzzy-matching metrics — <https://rapidfuzz.github.io/RapidFuzz/Usage/fuzz.html>
  · fuzzball.js <https://github.com/nol13/fuzzball.js>
- ReDoS / linear-time regex — Sonar
  <https://www.sonarsource.com/blog/vulnerable-regular-expressions-javascript/>
  · re2js <https://github.com/le0pard/re2js> · node-re2
  <https://github.com/uhop/node-re2> · safe-regex
  <https://github.com/davisjam/safe-regex> · recheck
  <https://github.com/makenowjust-labs/recheck>

In-repo subfiles carrying these claims (raw, fully-cited):
[`research/court-jurisdiction-reporter-vocabulary-schema.md`](court-jurisdiction-reporter-vocabulary-schema.md)
·
[`research/court-reporter-citation-crosswalk.md`](court-reporter-citation-crosswalk.md)
·
[`research/courts-db-license-and-rederivation.md`](courts-db-license-and-rederivation.md)
·
[`research/official-data-sync-ingestion-contract.md`](official-data-sync-ingestion-contract.md)
·
[`research/span-gated-resolver-algorithm-in-effect.md`](span-gated-resolver-algorithm-in-effect.md)

> Upstream repo URLs above are the FLP GitHub orgs cited verbatim in RESEARCH.md.
> The gold-catalog records themselves carry no repo URLs — repos are identified by
> NAME + license in §2; no repo link is invented.

---

## 4. In-repo capability references

`@beep/*` bricks this packet composes (from the bundle `secondaryTargets` + the
RESEARCH.md In-Repo Capability Inventory). Verified via `ls`/`rg` 2026-06-29.

| Capability | Package path | Disposition |
| --- | --- | --- |
| `LiteralKit(literals, enumMapping?)` (closed enums) | `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts` | reuse |
| `EntityId.factory(slice, $I)` (branded court/reporter IDs) | `packages/shared/domain/src/entity/EntityId.ts` | reuse |
| `SyncDataTarget` engine (`acquire`/`sourceUrls`) | `packages/tooling/tool/cli/src/commands/SyncDataToTs/` | reuse engine; **NET-NEW** `targets/Courts.ts` |
| `@beep/data` generated landing zone | `packages/foundation/primitive/data/src/generated/` | reuse; **NET-NEW** `courts.ts` + `courts.data.json` |
| `@beep/utils` Struct helpers (`keysNonEmpty`/`entriesNonEmpty`/`reverse`) | `packages/foundation/modeling/utils/src/Struct.ts` | reuse |
| `@beep/langextract` `Alignment` + `GroundedExtraction` | `packages/foundation/capability/langextract/src/Alignment/index.ts`, `…/Extraction/index.ts` | reuse shape; `spanFromMatch` is **private** (extend/promote or build span via `@beep/nlp`) |
| `@beep/nlp` `Contract.Span` (half-open `[start,end)`) | `packages/foundation/capability/nlp/src/Handoff/Contract.ts` | reuse |
| `@beep/rdf` SKOS vocab terms | `packages/foundation/modeling/rdf/src/Vocab/Skos.ts` | reuse; **NET-NEW** `SKOS_NOTATION` predicate + LiteralKit→Concept emitter |
| `@beep/semantic-web` RDF/JSON-LD emission | `packages/foundation/capability/semantic-web/src/` | reuse |
| `@beep/law-practice-domain` IP entities | `packages/law-practice/domain/src/entities/` | extend — **NET-NEW** Court/Jurisdiction/Reporter value vocab |
| `@beep/courtlistener` driver | deleted 2026-08-13 | **recreate** via `goals/honest-repo-signal/research/FOLLOW-UPS.md` if a product pull needs the HTTP driver; court vocab stays in this packet / `@beep/data` |
| `goals/ip-law-knowledge-graph` abstract Court/Jurisdiction NodeKind | `goals/ip-law-knowledge-graph/history/outputs/p1-schema-design.md` | reference — owns TBox nodes; this packet supplies the ABox/value layer |

**Net-new (this packet owns), from bundle `netNew`:** courts-db canonical court
dataset (~2,809) in `@beep/data` + schema literals/codecs; regex court-name
normalization dictionary; court-string resolver with span gating; the
`targets/Courts.ts` ingestion of courts-db into `@beep/data`.

**Already covered (do NOT rebuild), from bundle `alreadyCovered`:** abstract
`_tag:"Court"` and `_tag:"Jurisdiction"` graph nodes (owned by
`ip-law-knowledge-graph` P1 schema).

---

## 5. Cross-links & provenance

- **Cluster id:** "Court / jurisdiction controlled vocabulary" (gold-intake
  cluster, 14 nuggets, wave P2) — bundle `crossref` is empty (no exploration↔goal
  link recorded yet; not graduated).
- **Sibling / ownership splits (scope boundaries, not SPLIT clusters):**
  `goals/official-data-sync-foundation` (sync engine — add one target, reuse
  engine) · `goals/ip-law-knowledge-graph` (abstract Court/Jurisdiction TBox
  nodes) · `packages/drivers/courtlistener` (driver build-out is a separate
  packet, `gov-legal-data-driver-codegen`).
- **Packet artifacts:** [`CAPTURE.md`](../CAPTURE.md) ·
  [`RESEARCH.md`](../RESEARCH.md) (External Landscape + In-Repo Inventory +
  Constraints) · [`DECISIONS.md`](../DECISIONS.md) (Q1–Q7 pre-drafted forks) ·
  [`BRIEF.md`](../BRIEF.md) · [`MAP.md`](../MAP.md) ·
  [`ops/manifest.json`](../ops/manifest.json)
- **Codex review:**
  [`reviews/2026-06-29-codex-research.md`](../reviews/2026-06-29-codex-research.md)
  (5 blocking + 6 advisory; all folded into RESEARCH.md).
- **Gold synthesis:**
  [`_gold-intake/GOLD_SYNTHESIS.md`](../../_gold-intake/GOLD_SYNTHESIS.md) —
  highest-ROI item #2 ("Court / jurisdiction controlled vocabulary"), plus the
  capability-gap rows for court/jurisdiction/reporter taxonomies and the
  CourtListener driver skeleton.
