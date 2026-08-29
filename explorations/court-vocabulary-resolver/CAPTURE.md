# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-06-29 — Gold-intake seed

Seeded from the gold-intake pass. Full narrative context lives in the
GOLD_SYNTHESIS: see `explorations/_gold-intake/GOLD_SYNTHESIS.md` — Executive
summary "Top ~12 highest-ROI items" item **#2 "Court / jurisdiction controlled
vocabulary"** (`courts-db` → seed `@beep/law-practice` placeholder vocabularies
+ a court-string resolver; "Unblocks every citation/venue feature"), plus the
gap-map "TRUE GAPS the gold fills" row **"Court / jurisdiction / reporter
taxonomies | placeholder single-literal vocabularies in law-practice |
courts-db, courtlistener"**. Theme drill-downs: "Legal / court / patent data
ingestion" (court-ID lookup + deterministic reference-data assembly) and
"Provenance & evidence" (court→reporter citation crosswalk).

### Cluster rationale

The `@beep/courtlistener` driver is a bare stub (only `VERSION`), and no
courts-db dataset, regex normalization dictionary, or span-gated court-string
resolver exists anywhere in `packages/`, `@beep/data`, or `goals`.
ip-law-knowledge-graph only defines abstract OWL Court/Jurisdiction graph nodes
(PENDING), not a controlled vocabulary or resolver, and
official-data-sync-foundation provides the dataset-sync mechanism but does not
own court data. The vocabulary dataset plus resolver is a coherent net-new
capability warranting its own packet that ingests via
official-data-sync-foundation and lands in/alongside the courtlistener driver.

- route: `new-exploration` → primaryTarget `court-vocabulary-resolver` (targetExists=false)
- wave: `P2` (waveHistogram P1:1, P2:8, P3:5) — depends on the official-data-sync-foundation pipeline and is downstream of the IP-graph schema
- themeSpan: `data-ingestion`, `desktop-portal`, `ip-domain-models`, `kg-ontology-reasoning`, `legal-nlp`, `provenance-evidence`
- secondaryTargets: `goals/official-data-sync-foundation`, `@beep/courtlistener`, `goals/ip-law-knowledge-graph`

### Nuggets (14)

- **courtlistener#7** (courtlistener) — Court jurisdiction taxonomy (federal/state/tribal/territory/military). `cl/search/models.py:1872-1937`. → feeds netNew "courts-db canonical court entity dataset" + the controlled vocabulary / SKOS taxonomy seed (beep-target law-practice court/jurisdiction dimension; alignment target for FOLIO/JudO ontologies). P1, adopt. Snippet: `FEDERAL_APPELLATE="F"; FEDERAL_DISTRICT="FD"; STATE_SUPREME="S"; TRIBAL_SUPREME="TRS"; MILITARY_APPELLATE="MA"; JURISDICTIONS=((FEDERAL_APPELLATE,"Federal Appellate"),...)` plus grouping lists FEDERAL_JURISDICTIONS/STATE_JURISDICTIONS/BANKRUPTCY_JURISDICTIONS/TRIBAL_JURISDICTIONS.
- **courts-db#1** (courts-db) — Canonical court entity schema (2,809 courts) with CourtListener IDs. `courts_db/data/courts.json:1-27`. → feeds netNew "courts-db canonical court entity dataset (~2,809 courts) with CourtListener IDs" + data-sync ingestion into @beep/data + effect/Schema definitions; controlled vocabulary for grounding court refs in OfficeAction/Matter provenance. P2, adopt. Snippet: `"id":"alacirct","jurisdiction":"A.L.","level":"gjc","location":"Alabama","name":"Alabama Circuit Courts","name_abbreviation":null,"regex":["Alabama Circuit Courts"],"system":"state","type":"trial","dates":[{"end":null,"start":null}]` (per-court fields: id, name, name_abbreviation, citation_string, jurisdiction, system, type, level, location, parent, dates[], regex[]).
- **courts-db#2** (courts-db) — Regex-template variable dictionary for court-name normalization. `courts_db/data/variables.json:1-13`. → feeds netNew "regex court-name normalization dictionary"; normalization vocabulary for beep's legal-NLP candidate-extraction layer (canonicalize court/jurisdiction mentions before they become candidate claims). P2, port. Snippet: `"md":"M(id(dle)?)? ?D(ist)?((r?ict)?)? ?(((of|for|to|if) ?){1,2})? ?", "sd":"S(o)?(ur?th?erh?n)? ?D(ist(r?ict)?)? ?...", "usa":"(((U\.? ?S\.? ?)|(Unite(d|s)? State(s|d)?)) ?)"` — short keys referenced by courts.json regexes via $-templates; tolerates OCR/abbreviation variation.
- **courts-db#3** (courts-db) — Court-string resolver with partial-match span gating. `courts_db/__init__.py:78-97`. → feeds netNew "court-string resolver with partial-match span gating"; span/character-offset logic for `GroundedExtraction.span`. P2, port. Snippet: `match=re.search(regex,court_str); if match: if (not allow_partial_matches and len(court_str)!=match.span()[1]-match.span()[0]): continue; m=(match.group(0),court_id,parent_court); matches.append(m)` — rejects matches whose span length != full string length; falls back to exact name compare when no regex hits.
- **courts-db#5** (courts-db) — Parent/child court disambiguation (reduce to most-specific node). `courts_db/__init__.py:115-127`. → feeds netNew "court-string resolver" (hierarchy resolution); reusable for KG subsumption-hierarchy leaf assertion. P2, adopt. Snippet: `parent_ids={parent_id for _,_,parent_id in court_list}; reduced_list=[]; for court in court_list: court_id=court[1]; if court_id not in parent_ids: reduced_list.append(court); return reduced_list` (reduce_court_list 115-127 + _filter_parents_from_list 194-209: drop any court that is a parent of another match).
- **courts-db#6** (courts-db) — Data-loading: template substitution + ordinal expansion + field inheritance. `courts_db/utils.py:140-177`. → feeds netNew "data-sync ingestion of the courts-db dataset into @beep/data + schema literals/codecs" (deterministic assembly of a large derived taxonomy from modular source files). P3, study. Snippet: `for path in iglob(.../"places"/"*.txt"): places=f"({'|'.join(p.read().splitlines())})"; variables[...]=places ... ord_arrays=re.findall(r"\${(\d+)-(\d+)}",temp); for ord in ord_arrays: re_ord=f"(({')|('.join(ordinals[int(ord[0])-1:int(ord[1])])}))"` — injects placename gazetteers, expands ${1-56} ordinal ranges, Template-substitutes variables.json, then parent→child field inheritance (dates/type/location).
- **courts-db#7** (courts-db) — gather_regexes: compiled court matchers carrying id/name/type/location/parent. `courts_db/utils.py:194-209`. → feeds netNew "court-string resolver" (compiled pattern + metadata tuple index, mirrored in Effect). P2, port. Snippet: `for court in courts: court_regexes=court["regex"]+[court["name"]]; for reg_str in court_regexes: reg_str=reg_str.replace("\\\\","\\"); regex=re.compile(reg_str,(re.I|re.U)); regexes.append((regex,court["id"],court["name"],court["type"],court.get("location"),court.get("parent")))`.
- **courts-db#8** (courts-db) — citation_string + name_abbreviation: court-to-reporter mapping. `courts_db/data/courts.json:68091-68113`. → feeds netNew "courts-db canonical court entity dataset" (the authoritative court↔Bluebook citation crosswalk; CAFC entry is the IP-domain anchor for patent appeals). P2, adopt. Snippet: `"citation_string":"Fed. Cir.","id":"cafc","name":"Court of Appeals for the Federal Circuit","regex":["(^|\s)((U\. ?S\.)|(United States)),? Court of Appeals(,|(,? for the))? Federal Circuit","${uscoa} Federal Circuit"]` (NOTE: original line cite '1-30' was wrong — cafc entry at 68091-68113).
- **courtlistener#8** (courtlistener) — Citation reporter-type taxonomy + reporter data model. `cl/search/models.py:2883-2941`. → feeds netNew "courts-db canonical court entity dataset" (reporter-type controlled enum; candidate for SHACL/logic-rule classification, beep citation/PriorArtReference data model). P2, adopt. Snippet: `FEDERAL=1; STATE=2; STATE_REGIONAL=3; SPECIALTY=4; SCOTUS_EARLY=5; LEXIS=6; WEST=7; NEUTRAL=8; JOURNAL=9; CITATION_TYPES=(...)` — BaseCitation with volume/reporter/page fields + SmallIntegerField type choice. NOTE: the 'sort_cites/Bluebook ordering' part of the original claim is NOT in this block — only reporter-type taxonomy + reporter fields confirmed.
- **seal-rookery#1** (seal-rookery) — CourtListener court-ID to full court-name taxonomy. `seal_rookery/seals/seals.json:1-12`. → feeds netNew "courts-db canonical court entity dataset" (alt/cross-check static lookup, 365 IDs; enrich CourtListener driver, resolve court IDs in citations/provenance without an API round-trip). P3, reference. Snippet: `"acca":{"has_seal":true,"hash":"73105919687d913e17d9a2eeb267aa5091ad0e97fc9d7bcb6fe32c0d7310014e","name":"United States Army Court of Criminal Appeals","notes":""}`.
- **judge-pics#2** (judge-pics) — Fuzzy name-to-entity resolution with confidence threshold + CourtListener ID fallback. `judge_pics/search.py:31-67`. → feeds netNew "court-string resolver with partial-match span gating" (candidate fuzzy vs authoritative exact-ID resolution pattern). P2, study. Snippet: `m=fuzz.token_sort_ratio(matching_path,search_str.lower()); xlist.append((path,m)); if m>95: return [f"https://portraits.free.law/v2/{size}/{path}.jpeg"]; xlist.sort(key=lambda y:-y[1])` — fuzzywuzzy token_sort_ratio ranked list above threshold, short-circuit >95; integer input bypasses fuzzy as authoritative CourtListener person-ID lookup.
- **Juris.AI#6** (Juris.AI) — Jurisdiction taxonomy + per-jurisdiction court/reporter/principle maps. `src/components/jurisdiction-select.tsx:19-28`. → feeds netNew "regex court-name normalization dictionary" / "courts-db canonical court entity dataset" (reporter-abbreviation + court-name lookup tables as reusable seed data for citation parsing / jurisdiction normalization; surrounding case generator is synthetic mock — harvest the tables only). P3, study. Snippet: `export const localJurisdictions = [{value:"us",label:"United States"},{value:"uk",label:"United Kingdom"},{value:"ca",...},{value:"au",...},{value:"in",...},{value:"np",...},{value:"cn",...},{value:"eu",label:"European Union"}]` (legal-apis.ts holds parallel jurisdiction→court/reporter/constitutional-ref maps).
- **doc-haus#9** (doc-haus) — Config-only jurisdiction packs (profile.json + prompt.md) injected into the system prompt. `dochaus/lib/jurisdiction.ts:13-34`. → feeds netNew "courts-db canonical court entity dataset" / jurisdiction classification taxonomy (swappable code-free bundle; a matter can span several jurisdictions; per-matter reasoning steering across the 7-ontology TBox). P3, study. Snippet: `export type JurisdictionProfile={code:string; name:string; citationStyle:string; preferredModel?:string|null}; export type JurisdictionPack=JurisdictionProfile & {prompt:string}` — jurisdiction/<code>/{profile.json,prompt.md}, loader path-sanitizes the code, plugin appends matching fragments per turn.
- **seal-rookery#2** (seal-rookery) — Court seal image URL resolver pattern. `seal_rookery/search.py:31-47`. → serendipitous, feeds secondaryTarget desktop-portal (court-seal UI next to matter/citation references); enum-driven size resolution pattern. P3, reference. Snippet: `def seal(court:str, size:SIZES=ImageSizes.MEDIUM)->Optional[str]: if court not in seals: return None; if size==ImageSizes.ORIGINAL: ...; else: return f"https://seals.free.law/v2/{size.value}/{court}.png"`.

### netNew (build list)

- courts-db canonical court entity dataset (~2,809 courts) with CourtListener IDs
- regex court-name normalization dictionary
- court-string resolver with partial-match span gating
- data-sync ingestion of the courts-db dataset into @beep/data + schema literals/codecs

### alreadyCovered (reuse — do NOT rebuild)

- abstract Court graph node (ip-law-knowledge-graph p1 schema, `_tag` Court) — owned by goals/ip-law-knowledge-graph
- abstract Jurisdiction graph node (ip-law-knowledge-graph p1 schema) — owned by goals/ip-law-knowledge-graph

### cautions

- courts-db is BSD-2 (permissive, attribution-friendly) — safe to vendor the dataset/regex dictionary WITH attribution, but it is a freelawproject/CourtListener-adjacent asset; treat the resolver logic as **reimplement-don't-copy** and avoid pulling in any AGPL CourtListener server code.
- SPECIAL NOTE (from wedge brief): courts-db license must be **verified before copying data tables — re-derive, do not copy**. Ingest the ~2,809-court dataset via `goals/official-data-sync-foundation` (the static-dataset sync engine — do NOT rebuild that engine). Feeds citation-grounding-hallucination-guard + `goals/ip-law-knowledge-graph`.
- Scope discipline: keep this the vocabulary/resolver vertical only — graph-shape Court/Jurisdiction nodes remain owned by ip-law-knowledge-graph; dataset ingestion plumbing remains owned by official-data-sync-foundation.
- P2 because it depends on the official-data-sync-foundation pipeline and is downstream of the IP-graph schema.

## YYYY-MM-DD

<dump>
