# Court Vocabulary Resolver — Research

Synthesis of five research subtopics into one decision-ready brief. This packet
is the **controlled-vocabulary + court-string-resolver vertical only**: it
ingests Free Law Project (FLP) reference data via
`goals/official-data-sync-foundation`, re-expresses it as `effect/Schema`
literals, and ports the courts-db span-gated resolver to Effect. It does **not**
own the abstract Court/Jurisdiction graph nodes (those stay in
`goals/ip-law-knowledge-graph`) and does **not** rebuild the dataset-sync engine.

Raw, fully-cited findings live in `research/`:
[vocabulary-schema](research/court-jurisdiction-reporter-vocabulary-schema.md) ·
[citation-crosswalk](research/court-reporter-citation-crosswalk.md) ·
[license-and-rederivation](research/courts-db-license-and-rederivation.md) ·
[ingestion-contract](research/official-data-sync-ingestion-contract.md) ·
[resolver-algorithm](research/span-gated-resolver-algorithm-in-effect.md).

## External Landscape

**The Free Law Project (FLP) data family is the canonical, license-clean
substrate.** Three datasets and one reference library carry the whole capability,
all **BSD-2-Clause** (permissive, attribution-only): `courts-db` (court entities
+ regex normalization + the span-gated resolver), `reporters-db` (reporter-type
taxonomy), and `eyecite` (the production citation-finder reference architecture);
plus `seal-rookery` as a 365-ID cross-check. See
[license-and-rederivation.md](research/courts-db-license-and-rederivation.md).

- **courts-db** — the court vocabulary + resolver source of truth. Live `main`
  `courts.json` holds **exactly 2,809 court objects** (`jq length`, ~1.93 MB),
  of which **2,502 carry ≥1 regex**; release **0.10.27, published 2026-03-25**,
  last repo push 2026-06-17.
  <https://github.com/freelawproject/courts-db> ·
  <https://pypi.org/pypi/courts-db/json>. The FLP marketing line ("700+ courts",
  "16M data points") is **stale relative to the live array** — count the pinned
  dataset, do not trust docs. The per-court schema has **evolved past the gold
  nugget snapshot** to ~15 fields (`id, name, name_abbreviation, citation_string,
  jurisdiction, system, type, level, location, locations, parent, dates[],
  regex[], sub_names, examples, case_types`); distinct `system` values are
  `colonial | extraterritorial | federal | international | special | state |
  tribal`, distinct `type` values `ag | appellate | bankruptcy | international |
  special | trial | trial & iac` — **model against the live file, not the
  CAPTURE snippet** (raw:
  <https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/data/courts.json>).

- **Two distinct "jurisdiction" taxonomies — do not conflate.** courts-db's
  `jurisdiction` field is a **state/territory postal token** (Alabama → `"A.L."`),
  while CourtListener's `Court.jurisdiction` is a **system+level composite code**
  (`F`=Federal Appellate, `FD`=Federal District, `TRS`=Tribal Supreme; 23 codes
  total with grouping lists Federal/State/Bankruptcy/Tribal/Territory/Military).
  courts-db normalizes that composite into three orthogonal fields
  (`system`/`type`/`level`), so `(system,type,level) ⇄ CL code` is a derivable
  crosswalk, not two unrelated enums. The 23-code set is single-source from
  `cl/search/models.py`; labels and the rare `TRS` code are independently
  corroborated by the live API and help page.
  <https://www.courtlistener.com/help/api/jurisdictions/> ·
  <https://www.courtlistener.com/api/rest/v4/courts/?jurisdiction=TRS&format=json>.
  Full detail:
  [vocabulary-schema.md §A,§C](research/court-jurisdiction-reporter-vocabulary-schema.md).

- **reporters-db** — the reporter-type taxonomy (a *separate* dataset). Each
  reporter carries a string `cite_type` ∈ `state | federal | neutral | specialty
  | specialty_west | specialty_lexis | state_regional | scotus_early` (8 values),
  plus date-bounded `editions`, `variations`, `mlz_jurisdiction`. **Current PyPI
  release is `reporters-db` 3.2.66 (2026-06-25)** — re-pin and recompute counts
  from the pinned tag/commit at ingest time. The earlier "v3.2.41 (2024-02-09):
  1,167 reporters, 2,102 variations" figures are **historical examples only and
  must NOT feed MAP/SPEC acceptance criteria** — count the pinned dataset.
  <https://github.com/freelawproject/reporters-db> ·
  <https://pypi.org/project/reporters-db/>.

- **The reporters-db string taxonomy ≠ CourtListener's integer enum (real
  gotcha).** CourtListener's `BaseCitation` stores a **9-value integer** enum
  (`FEDERAL=1 … JOURNAL=9`); the names do not line up 1:1 with reporters-db's 8
  strings (`specialty_west`/`specialty_lexis` vs `WEST`/`LEXIS`; CL adds
  `JOURNAL=9` with no reporters-db counterpart). **Recommendation: make the
  reporters-db string enum canonical** (it ships with the records) and treat the
  CL integer as a downstream encoding via a transform codec. **API note (Effect
  v4 beta.91, `effect@4.0.0-beta.91` pinned in root `package.json`):** the legacy
  `S.transformOrFail(...)` helper does NOT exist as a top-level `S.`/`Schema.`
  export in this version (`rg "S\.transformOrFail|Schema\.transformOrFail"` finds
  no callable helper). Build the static-HashMap-backed crosswalk codec with the
  current forms — `SchemaTransformation.transformOrFail({ decode, encode })` or
  `SchemaGetter.transformOrFail(fn)` — and represent typed decode failures by
  returning a `SchemaResult`/`Issue` from the getter. Checked-in pattern:
  `packages/shared/domain/src/values/LocalDate/LocalDate.behavior.ts:696`
  (`decode: SchemaGetter.transformOrFail(...)`) and
  `packages/tooling/policy-pack/repo-configs/src/internal/eslint/EffectLawsAllowlistSchemas.ts:96`
  (`SchemaTransformation.transformOrFail({...})`). The exact mapping
  function is **UNVERIFIED** — no `map_reporter_db_cite_type` helper was located
  in CL source; pin the string enum and derive integers explicitly. Detail:
  [citation-crosswalk.md](research/court-reporter-citation-crosswalk.md),
  [vocabulary-schema.md §D](research/court-jurisdiction-reporter-vocabulary-schema.md).

- **"court→reporter" is actually two joins, many-to-many over time.** (1) the
  **court parenthetical** `court.citation_string` (e.g. `"Fed. Cir."`, a property
  of the court, from courts-db) and (2) the **volume reporter** (`F.3d`/`F.4th`,
  a property of the citation, from reporters-db). The clean join is at the
  *citation* level — exactly what **eyecite** models. Deliverable = **two lookup
  tables** (`court_id → citation_string`; `reporter_abbrev → cite_type`), not one
  court→reporter map.
  <https://guides.law.sc.edu/LRAWSpring/LRAW/citingfedcases>.

- **eyecite is the reference architecture — deterministic, not NLP.** Built atop
  courts-db + reporters-db, it tokenizes with **Hyperscan + a regex database**
  and extracts metadata; tested against 50M+ citations, production at
  CourtListener + Caselaw Access Project, BSD-2. This is the
  "reimplement-don't-copy" target for the span-gated resolver.
  <https://github.com/freelawproject/eyecite> ·
  <https://free.law/pdf/eyecite-whitepaper.pdf>. **Reporter-type classification
  is a deterministic table lookup, not an NLP/ML task** — `cite_type` is a static
  property; SHACL is a viable-but-heavier expression of the same closed-world rule
  and only earns its keep if the crosswalk must be *derived inside the KG*. OWL
  (open-world) is the wrong tool.
  <https://spinrdf.org/shacl-and-owl.html>.

- **The courts-db resolver pipeline (the thing being ported), partially
  verified — pin and re-read exact source before porting.** The high-level
  order, span-gate, exact-name fallback, and parent/child reduction are
  source-confirmed, but the **exact court-ID cardinality, the `gather_regexes`
  tuple field order, the `strip_punc` character class, and RE2 feature coverage
  are NOT byte-for-byte verified** (see resolver-algorithm.md §"unverified"); lock
  these from the pinned commit during decompose, not from this synthesis
  (`courts_db/__init__.py`,
  [resolver-algorithm.md](research/span-gated-resolver-algorithm-in-effect.md)):
  `find_court` order is `strip_punc → find_court_ids_by_name → filter_by_bankruptcy
  → filter_by_date → _filter_parents_from_list`. **Span gating** rejects any match
  whose span length ≠ full input length (`len(court_str) != match.span()[1] -
  match.span()[0]`) — i.e. a full-string match; JS/Effect port: require
  `m.index === 0 && m[0].length === courtStr.length` or wrap each pattern
  `^(?:…)$`. The matched `group(0)` substring is the grounded span. **Exact-name
  fallback** when regex yields nothing (punct-stripped, lowercased compare).
  **Parent/child reduce-to-most-specific** drops any match that is a parent of
  another match (keep leaves). `gather_regexes` compiles `regex + [name]` per
  court into `(compiled, id, name, type, location, parent)` tuples with `re.I|re.U`.
  <https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/__init__.py>.

- **Fuzzy tier (judge-pics pattern) — three "ratio" definitions disagree, a
  calibration trap.** `token_sort_ratio` sorts tokens then ratios; an integer
  input bypasses fuzzy as authoritative ID lookup. But fuzzywuzzy `ratio`
  (difflib/Ratcliff-Obershelp `2M/T`) ≠ rapidfuzz `ratio` (Indel/LCS) ≠ the repo's
  full-Levenshtein `similarity` helper — **a literal `>95` threshold will not
  behave identically across metrics.** Options: vendor MIT `fuzzball.js` (a JS
  port of thefuzz) or add token-sort preprocessing to the in-repo Levenshtein
  helper; either way a calibration test is required.
  <https://rapidfuzz.github.io/RapidFuzz/Usage/fuzz.html> ·
  <https://github.com/nol13/fuzzball.js>.

- **Porting 2,100+ hand-crafted Python regexes carries two hazards.** (1)
  **Source incompatibility** — Python `(?P<name>…)`, inline `(?a)`/`(?i)` flags,
  and `$`/newline semantics differ from JS; `re.I|re.U` → JS `iu` but the `u`
  flag changes class/escape semantics. Port-and-validate each pattern (tools:
  `pyre-to-regexp`, `js-regex`). (2) **ReDoS** — 2,100 patterns over untrusted
  OCR'd text is a DoS surface; V8's native NFA can hang the event loop (>1m45s
  demonstrated vs ~454ms on RE2JS), and Node has no per-regex timeout. Mitigate
  with a linear-time engine (`re2js` pure-JS RE2 port, or native `node-re2`) and
  audit with `safe-regex`/`recheck`; RE2 rejects backreferences/lookaround, so
  flag any pattern using them.
  <https://www.sonarsource.com/blog/vulnerable-regular-expressions-javascript/> ·
  <https://github.com/le0pard/re2js>.

- **Candidate-tooling license / maintenance gate (NONE currently in the repo).**
  `rg "fuzzball|re2js|node-re2|safe-regex|recheck|pyre-to-regexp|js-regex"
  package.json bun.lock packages` found **no checked-in dependency or prior
  package decision** for any of these — every one is a net-new add to vet under
  repo dependency law before MAP. Capture for each: name · latest version ·
  SPDX license · role · native/Bun compat · maintenance. First pass (re-verify
  versions/licenses at decompose):
  - `fuzzball.js` — **MIT**, runtime, pure-JS (no native build, Bun-safe), token-sort fuzzy matcher. <https://github.com/nol13/fuzzball.js>.
  - `re2js` — **Apache-2.0** (pure-JS RE2 port), runtime, Bun-safe, linear-time engine. <https://github.com/le0pard/re2js>.
  - `node-re2` — **BSD-3-Clause**, runtime, **native addon (node-gyp build; Bun/cross-platform risk — prefer `re2js`)**. <https://github.com/uhop/node-re2>.
  - `safe-regex` — **MIT**, dev/offline validation only (star-height heuristic; known false-negatives). <https://github.com/davisjam/safe-regex>.
  - `recheck` — **MIT**, dev/offline ReDoS auditor (Scala.js; heavier), CLI/CI lane. <https://github.com/makenowjust-labs/recheck>.
  - `pyre-to-regexp` / `js-regex` — dev-only Python→JS pattern conversion/normalization; **confirm SPDX + maintenance before relying on them**, treat as one-shot porting aids not runtime deps.

- **courts-db `courts.json` is a *templated source*, not a finished table** — it
  must be rendered in four deterministic stages before `JSON.parse` (per
  `courts_db/utils.py`): (1) placename gazetteer alternation from ~28
  `data/places/*.txt` files; (2) `${N-M}` ordinal expansion against a 100-entry
  `ordinals` list; (3) `variables.json` (90-key regex-template dictionary)
  `string.Template` substitution + backslash double-escape; (4) parent→child
  field inheritance (`dates`/`type`/`location`). **Adversarial correction: the
  oft-cited `${1-56}` token does NOT appear in live `courts.json`** — only
  `${1-5}`, `${1-8}`, `${1-10}` do; `${1-56}` is a source-comment illustration of
  capacity. The TS port must support arbitrary `${N-M}`, not hard-code 56.
  <https://raw.githubusercontent.com/freelawproject/courts-db/main/courts_db/utils.py>.

- **Bluebook layer is licensing-clean.** Bluebook citation abbreviations are
  **facts, not copyrightable** ("devoid of creativity"); the **Indigo Book** is a
  **CC0** public-domain reimplementation of Table T1 usable as a cross-check.
  <https://law.resource.org/pub/us/code/blue/IndigoBook.html>. CAFC is the
  IP-domain anchor — verified two ways (`id="cafc"`, `citation_string="Fed. Cir."`,
  `jurisdiction="F"` via live API) — the only federal appellate court for patent
  appeals, hearing PTAB appeals directly.
  <https://www.courtlistener.com/api/rest/v4/courts/cafc/> ·
  <https://law.justia.com/cases/federal/appellate-courts/cafc/>. **PTAB
  decisions have no official reporter** — the reporter dimension is null for many
  patent-appeal documents (open design question for downstream grounding).

- **seal-rookery cross-check (verified, refutes a bad WebFetch summary).**
  `seals.json` has **exactly 365 court-ID keys** (254 with `has_seal:true`) — not
  542; **354/365 (~97%) intersect courts-db's 2,809 IDs**, with 11 seal-only IDs
  absent (agencies/boards: `aoc`, `asbca`, `cbca`, `mspb`, …). Use as an
  ingestion cross-check assertion. seal-rookery is a split non-SPDX license
  (images public-domain via 17 U.S.C. §105); consume only the factual
  `seals.json` IDs/names as **reference**.
  <https://raw.githubusercontent.com/freelawproject/seal-rookery/main/seal_rookery/seals/seals.json>.

## In-Repo Capability Inventory

beep-effect already owns nearly all the substrate to *compose* this capability;
the genuinely net-new work is the court/reporter vocabulary data + schemas + the
ported resolver. Verified via `ls`/`rg` on 2026-06-29.

**Reuse (already built — compose, do not rebuild):**

- **`@beep/schema` — `LiteralKit(literals, enumMapping?)`** (callable, NOT
  `LiteralKit.make`) —
  `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:720-728`
  (verified: exported callable overloads; `rg "LiteralKit\.make"` returns **no
  matches** — the `.make` form does not exist). In-repo usage shape (from the
  module docstring):

  ```ts
  const StatusKeys = LiteralKit(
    ["one", "two"],
    [["one", "ONE"], ["two", "TWO"]]
  );
  StatusKeys.Enum.ONE; // "one"
  ```

  Emits `Enum`, per-member `is`-guards, exhaustive `$match`, `thunk`
  constructors, plus `toTaggedUnion`, with compile-time coverage/duplicate
  checks. The `[code,label]` pair shape of the CL `JURISDICTIONS`/`CITATION_TYPES`
  maps directly onto the `EnumMappings` tuple-array argument. This is the
  canonical home for every closed enum here (`CourtJurisdictionCode`,
  `CourtSystem`, `CourtType`, `CourtLevel`, `ReporterType`).

- **`official-data-sync-foundation` sync engine — `SyncDataTarget`** —
  `packages/tooling/tool/cli/src/commands/SyncDataToTs/` (verified: `internal/`,
  `targets/`, `SyncDataToTs.command.ts`). The target contract is a 4-field
  interface (`acquire`, `description`, `id`, `sourceUrls`) confirmed verbatim in
  `internal/Models.ts`; `SyncDataTargetServices = HttpClient | Crypto` (fetch +
  hash only). Four working targets are registered in `targets/index.ts`
  (`CldrTerritories`, `Iso4217`, `IanaMediaTypes`, `IanaTimezones`) — **no
  Courts target**. `targets/CldrTerritories.ts` is the canonical pattern to copy
  (fetch → decode with `S.Class` → emit a generated `*.ts` + canonical
  `*.data.json` sidecar with source URLs + SHA-256). Driven by `bun run beep
  sync-data-to-ts`; goal manifest `status: "active"` (verified). CI:
  `.github/workflows/data-sync.yml` (verified present).

- **`@beep/data` generated landing zone** —
  `packages/foundation/primitive/data/src/generated/` (verified: `cldr-territories.ts`
  + `.data.json`, `iso4217.*`, `iana-media-types.*`, `iana-timezones.*`). A courts
  target lands `courts.ts` + `courts.data.json` here. `@beep/schema` then derives
  `LiteralKit`/mapped codecs from these raw arrays (no hand-copied literal lists).

- **`@beep/utils` Struct helpers** — `packages/foundation/modeling/utils/src/Struct.ts`
  exports `keysNonEmpty`, `entriesNonEmpty`, `reverse` (verified) — the helpers the
  SPEC names for deriving `LiteralKit`/mapped-codec schemas from generated data.

- **`@beep/langextract` — `Alignment` + `Extraction`** —
  `packages/foundation/capability/langextract/src/Alignment/index.ts` (verified)
  and `…/Extraction/index.ts` (verified: `GroundedExtraction` with
  `alignmentStatus`/`span`/`matchedText`,
  `AlignmentStatus = match_exact | match_lesser | match_fuzzy | unaligned`). The
  resolver's outputs map onto these; mirror the synchronous Alignment shape (no
  `Effect` wrapper for CPU-only matching).
  **Correction (Codex gate-1): `spanFromMatch(start, matchedText)` is a PRIVATE
  module-local `const` at `Alignment/index.ts:71` — it is NOT exported (`rg
  "spanFromMatch"` finds only local uses; no `index.ts` re-export). The "reuse
  `spanFromMatch` directly" path is false as written.** Either (a) the court
  resolver constructs `Contract.Span` itself via the public
  `@beep/nlp/Handoff/Contract` API, or (b) the decompose promotes/exports a
  documented span helper from `@beep/langextract` as net-new work — pick one in
  MAP. **Caveat: the `similarity` helper here is full-Levenshtein, NOT
  `token_sort_ratio`** (`Alignment/index.ts:132-156`) — see gaps below.

- **`@beep/nlp` — `Contract.Span`** —
  `packages/foundation/capability/nlp/src/Handoff/Contract.ts` (verified): a
  half-open `[start,end)` span of branded `NonNegativeInt` with `start ≤ end`.
  Exactly the shape courts-db `match.group(0)` maps to.

- **`@beep/rdf` — SKOS vocabulary terms ALREADY EXIST** —
  `packages/foundation/modeling/rdf/src/Vocab/Skos.ts` (verified, 184 lines).
  Ships named-node IRI constants for `skos:Concept`, `skos:ConceptScheme`,
  `skos:prefLabel`/`altLabel`/`hiddenLabel`, `skos:broader`/`narrower`/`related`,
  `skos:inScheme`, `skos:hasTopConcept`/`topConceptOf`, and the match family.
  **This corrects research subtopic F-H3, which claimed no SKOS module exists** —
  the SKOS *terms* are present; only the LiteralKit→Concept-triple *emitter* is
  net-new (see gaps). **Gap within the gap (Codex gate-1): `skos:notation` — the
  exact predicate the emitter needs to serialize code values — is NOT in
  `Skos.ts` (`rg "SKOS_NOTATION|notation"` returns no matches).** Either add a
  `SKOS_NOTATION` constant to `@beep/rdf/Vocab/Skos`, or have the emitter mint the
  predicate inline via `makeNamedNode("http://www.w3.org/2004/02/skos/core#notation")`;
  add a test proving code values serialize as `skos:notation`. (NB: `@beep/rdf`
  lives at `packages/foundation/modeling/rdf/`, not `…/capability/rdf/` as one
  subtopic stated.)

- **`@beep/semantic-web`** —
  `packages/foundation/capability/semantic-web/src/` (verified: `vocab/`
  [`owl/rdf/rdfs/xsd/prov/oa`], `jsonld.ts`, `prov.ts`, `iri.ts`, `uri.ts`,
  `evidence.ts`, `services/`, `adapters/`). RDF/triple + JSON-LD emission
  substrate for serializing the code lists.

- **`@beep/law-practice-domain` — existing IP entities** —
  `packages/law-practice/domain/src/entities/` (verified: `Claim`, `OfficeAction`,
  `PatentAsset`, `PriorArtReference`, `Rejection`). These are the downstream
  consumers of the court vocabulary; **none defines court/jurisdiction/reporter
  values** (see gaps).

- **`goals/ip-law-knowledge-graph` — abstract Court/Jurisdiction NodeKind
  (owned upstream, do NOT rebuild)** —
  `goals/ip-law-knowledge-graph/history/outputs/p1-schema-design.md` (verified
  present). Owns the `_tag:"Court"` / `_tag:"Jurisdiction"` graph nodes + edges
  (`DecidedBy`, `GovernedBy`) and the "OWL Class Mapping" annotation slot. Goal
  status PENDING/stub. This packet supplies the **reference-data values** those
  nodes point at (ABox/value layer), not the nodes themselves (TBox).

**Genuine gaps (NOT FOUND — net-new work this packet owns):**

- **Court/jurisdiction/reporter controlled vocabulary — NOT FOUND.** `rg` for
  `CourtJurisdictionCode|ReporterType|citation_string|CourtSystem|CourtLevel`
  across `packages/law-practice/domain/src` returned nothing; no
  `Court`/`Jurisdiction` entity dir there. The CourtListener driver was
  deleted 2026-08-13 — do not search a missing tree. The vocabularies are
  genuinely net-new.

- **courts-db dataset in `@beep/data` + a `targets/Courts.ts` sync target — NOT
  FOUND.** The `generated/` dir has only the four shipped datasets; no court
  module, no `Courts.ts` in `targets/`. Net-new (the *engine* is reused; the
  target is new). **This is a courts-specific target-design task, NOT an engine
  capability gap.** The `SyncDataFetchedSource` contract already exposes BOTH
  `bytes: Uint8Array` and `text: string`
  (`internal/Source.ts:54-60`); `fetchSource` fetches bytes, hashes them, and
  decodes `text` (`Source.ts:163-183`), and `targets/IanaTimezones.ts:240-242`
  already consumes raw `source.bytes` before parsing — so render-then-parse is a
  supported, precedented pattern. Plan: render the Template/ordinal/inheritance
  stages inline in `acquire` from `source.text` and test the rendered JSON;
  extract a reusable courts-renderer helper only if intentionally shared.

- **Span-gated court-string resolver — NOT FOUND.** No port of
  `find_court`/`gather_regexes`/`reduce_court_list` anywhere in `packages/`. Net-new
  Effect/schema-first module; consumes the vendored flat court table and emits
  `@beep/langextract` `GroundedExtraction.span`. The resolved `courtId` is not a
  field on `GroundedExtraction` → carry it in `attributes` or extend the model in
  the goal packet.

- **LiteralKit→SKOS Concept/ConceptScheme emitter — NOT FOUND (only the
  *mapping function* is net-new; the RDF substrate already exists).** `@beep/rdf`
  ships the SKOS IRI vocabulary AND the quad/dataset constructors —
  `makeNamedNode` (`Rdf.ts:794`), `makeLiteral` (`:883`), `makeQuad` (`:945`),
  `makeDataset` (`:981`), re-exported via `@beep/semantic-web/rdf`. The only gap
  is the function mapping a `LiteralKit` member set to
  `skos:Concept`/`skos:ConceptScheme` triples (`notation`=code, `prefLabel`=label,
  `broader`=grouping parent, `inScheme`=one scheme per vocabulary). **MAP
  requirement: reuse the existing constructors + SKOS constants + the missing
  `SKOS_NOTATION` predicate (blocking finding above); author no new RDF
  primitives.** Done FROM the LiteralKits (single source of truth), not by hand.

- **`token_sort_ratio` fuzzy matcher — NOT FOUND.** The only in-repo fuzzy helper
  (`@beep/langextract` `similarity`) is full-Levenshtein and will not reproduce
  fuzzywuzzy/rapidfuzz scores; a `>95` short-circuit ported literally mis-ranks.
  Net-new: vendor `fuzzball.js` (MIT) or add token-sort preprocessing + calibrate.

- **Linear-time / ReDoS-safe regex engine — NOT FOUND.** No `re2js`/`node-re2`
  wired; running 2,100 untrusted-input patterns on native V8 RegExp is a DoS
  surface needing a linear-time engine or per-pattern guard. Net-new hardening.

## Constraints

**Licensing gravity (the load-bearing constraint).**

- **courts-db, reporters-db, eyecite = BSD-2-Clause** ("Copyright (c) 2020, Free
  Law Project"), verified against the canonical `LICENSE` files + GitHub license
  API (`spdx_id: BSD-2-Clause`). Two duties only: retain the copyright notice +
  conditions + disclaimer on redistribution. No copyleft, no share-alike, no
  patent/advertising clause. **Vendoring the data tables (and even the regexes) is
  permitted WITH attribution.**
  <https://raw.githubusercontent.com/freelawproject/courts-db/main/LICENSE>.
- **HARD AGPL FIREWALL.** `freelawproject/courtlistener` (the Django server,
  where `cl/search/models.py` lives) is **AGPL-3.0-only** — verified via its
  `pyproject.toml` (`license = "AGPL-3.0-only"`) and verbatim AGPLv3 `LICENSE.txt`
  (GitHub reports `NOASSERTION` only because prepended copyright lines defeat the
  hash match). **The CAPTURE nuggets `courtlistener#7`/`#8` cite AGPL code.** The
  *facts* (jurisdiction codes, reporter-type names) are uncopyrightable under
  *Feist v. Rural Telephone*, 499 U.S. 340 (1991) — re-express them as Effect
  Schema literals — but **never import or transcribe CourtListener server source.**
  <https://raw.githubusercontent.com/freelawproject/courtlistener/main/pyproject.toml> ·
  <https://www.law.cornell.edu/supremecourt/text/499/340>.
- **Locked posture: re-derive data, reimplement logic, attribute FLP.** Even
  though BSD-2 would permit copying-with-attribution, treat the resolver
  *algorithm* as **reimplement-don't-copy** (clean provenance, avoids AGPL-adjacency
  confusion) and re-derive the data tables. The regex patterns + `variables.json`
  + `places/` gazetteers are **authored creative expression** (copyrightable, BSD-2
  attribution genuinely bites here, not just the facts). Discharge the whole BSD-2
  obligation with one attribution entry: the BSD-2 text + "Copyright (c)
  2020, Free Law Project" + source URL/commit. **Caveat (Codex gate-1): there is
  NO root `THIRD_PARTY_NOTICES`/`NOTICE` file in the repo today (`rg -l
  "THIRD_PARTY_NOTICES"` finds only plugin licenses + exploration prose) — so
  this is a net-new attribution artifact whose path/convention is undecided.**
  MAP acceptance criteria must either adopt an existing repo licensing convention
  (confirm with repo owner) or explicitly create the new file (e.g. root
  `THIRD_PARTY_NOTICES.md`) and record the obligation there.
- **Indigo Book = CC0** (cross-check only); **Bluebook abbreviations = facts, not
  copyrightable** — re-derive, do not copy the proprietary compilation. The
  Bluebook *book itself* is copyrighted; rely on courts-db/reporters-db (BSD-2) +
  Indigo Book (CC0), not the book.
  <https://law.resource.org/pub/us/code/blue/IndigoBook.html>.
- **UNVERIFIED licensing edges:** seal-rookery `seals.json` *index* metadata is
  non-SPDX `NOASSERTION` (images are public-domain; the JSON index license is not
  separately stated — treated as factual reference data, lawyer-grade confirmation
  outstanding). reporters-db *data* provenance (vs code license) historically drew
  on Bluebook/CAP sources — re-verify if vendored later. EU `sui generis` database
  right could attach in EU jurisdictions (Feist is US-only; low-risk for a US-firm
  beachhead, flagged).

**Deprecations / version dates (re-pin at ingest, do not freeze from this doc).**

- courts-db **0.10.27** (2026-03-25, current per PyPI); reporters-db **3.2.66**
  (2026-06-25, current per PyPI — supersedes the stale v3.2.41/2024-02-09 figure
  carried in earlier drafts). Both must be re-pinned from PyPI at ingest time
  (today 2026-06-29) and counts recomputed from the pinned tag. Pin a **commit
  SHA** when porting value sets so re-derivation is reproducible; CAPTURE
  line numbers (e.g. `models.py:2883-2941`) have already drifted on `main`.
- Court-count **~2,809** and the `${N-M}` token set (`${1-5}`/`${1-8}`/`${1-10}`
  on `main` 2026-06-29) are version-sensitive — re-count/re-scan the pinned ref,
  never assume.

**Locked decisions (from CAPTURE + research recommendations; confirm in DECISIONS.md).**

- **Scope discipline:** this packet = vocabulary/resolver vertical ONLY. Abstract
  Court/Jurisdiction graph nodes stay owned by `ip-law-knowledge-graph`; dataset
  sync plumbing stays owned by `official-data-sync-foundation` (add one
  `targets/Courts.ts`, do NOT rebuild the engine).
- **Canonical taxonomy choices:** reporters-db string `cite_type` is the source of
  truth (CL integer is a derived encoding); `(system,type,level)` is canonical for
  jurisdiction with the CL composite code derived. **OPEN:** whether the court
  `jurisdiction` field keeps the raw courts-db state token, is replaced by the
  derived CL code, or carries both (research recommends `(system,type,level)`
  canonical + derive CL code) — resolve in DECISIONS.md.
- Court IDs + reporter keys → branded `EntityId`-style schemas (repo law), so they
  serve as the stable join key KG nodes reference. Closed enums → `LiteralKit`.
  **Concrete source (Codex gate-1, replacing the earlier memory/skill citation):**
  `EntityId.factory(slice, $I)` at `packages/shared/domain/src/entity/EntityId.ts`,
  with per-slice usage in `packages/shared/domain/src/identity/*.ts` (e.g.
  `LawPractice.ts:12` → `EntityId.factory("law_practice", $I)`). Open architecture
  decision: which slice owns court/reporter ids (likely `law_practice`) —
  confirm in DECISIONS.md, do not assume.
- Dataset-build logic (gazetteer/ordinal/template/inheritance) belongs in the
  **ingest target**, not the runtime resolver; the resolver consumes an
  already-expanded flat table.

**Auth / secret / offline boundaries.**

- The sync `acquire` is **fetch-over-HTTP + hash only** (`SyncDataTargetServices =
  HttpClient | Crypto`); no other ambient capability, no secrets. Fetch upstream
  files at a **pinned git ref** from `raw.githubusercontent.com`, recording each
  URL + SHA-256 in the sidecar/PR report.
- The runtime resolver is **fully offline/deterministic** — it consumes the
  vendored table; no API round-trips (privilege-safe, matching the legal-AI
  local-first posture). CourtListener's live API is used in research **for
  verification only**, not as a runtime dependency.

**Routing cautions.**

- `@beep/courtlistener` was a **bare stub** and was deleted 2026-08-13.
  Recreate the HTTP driver from `goals/honest-repo-signal/research/FOLLOW-UPS.md`
  if a product pull needs it. This packet lands vocabulary + resolver only;
  it does not own the API client.
- The span-gate, exact-name fallback, and parent/child reduction are
  **verbatim-verified** but the precise `strip_punc` character class, the exact
  `gather_regexes` tuple order, and `parent`-field coverage across all 2,809 rows
  are **UNVERIFIED** at byte level — lock from the pinned dataset/source during
  decompose, not from this synthesis.

---

_Codex gate-1 folded 2026-06-29: 5 blocking + 6 advisory addressed._
