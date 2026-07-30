# Court Vocabulary Resolver — Decisions

The align gate closed on 2026-07-14. All seven alignment questions below are
ratified and locked. Items under **Deferred Work** are implementation spikes or
optional follow-ons, not unresolved alignment questions.

## 2026-07-25 — SUPERSEDING — Raw artifact home and ingestion boundary

The generated raw artifact home is
`packages/law-practice/domain/src/internal/generated/free-law-project/`, not
`packages/foundation/primitive/data/src/generated/`. This supersedes only the
raw-artifact location in Q5; public stable vocabulary and pure product semantics
remain owned by law-practice domain.

The first implementation increment is ingestion substrate only. reporters-db
ingestion includes all six official datasets (case-name abbreviations, journals,
laws, regex fragments, reporters, and state abbreviations), and courts-db is
assembled from its pinned authored inputs. eyecite-js and eyecite-ts are
research references only; their local/custom overlays are excluded from
production truth. Public IDs, lookups, compatibility/lifecycle APIs, and
resolver behavior remain later goal phases.

## 2026-07-14 — LOCKED — Q1: What do we build?

**Question:** Should beep reimplement court-string resolution, adopt a JavaScript
citation library, or call a hosted service?

**Answer:** Reimplement the pinned courts-db court-string resolver as pure Effect
law-practice code. Pinned courts-db behavior is the parity contract. Attribute
data, regexes, fixtures, and any ported expression under BSD-2. This is not the
citation engine: the queued eyecite port owns tokenization, extraction, grouping,
and citation resolution.

**Rationale:** The resolver is a deterministic domain capability over a static
vocabulary and must work offline. A narrow behavior-preserving port gives beep a
testable boundary without importing CourtListener server architecture or
duplicating the citation engine.

**Rejected options:** Hosted CourtListener resolution was rejected because it
violates the offline/deterministic boundary. eyecite-js was rejected by the
locked cross-packet ownership decision. A broader citation-engine port here was
rejected as duplicate scope. This overturns the pre-draft's clean-room-only
language: BSD-2 material may be ported with the required attribution.

## 2026-07-14 — LOCKED — Q2: What is in scope?

**Question:** Where does this vertical begin and end?

**Answer:** In scope are courts-db and reporters-db ingestion targets,
deterministic generated artifacts, stable public domain IDs and vocabularies,
source-faithful lookup tables, and offline deterministic court-string
resolution. Optional follow-ons are calibrated fuzzy court-name ranking and a
SKOS projection derived from the canonical vocabulary.

**Rationale:** Court and reporter identity are reusable substrate. The packet
should supply canonical values and resolution while leaving orchestration,
persistence, hosted access, and knowledge-graph structure to their owners.

**Rejected options:** Abstract KG nodes remain owned by
`ip-law-knowledge-graph`; sync-engine redesign is rejected in favor of extending
its targets; a CourtListener API client or hosted enrichment belongs to future
`drivers/courtlistener`; citation extraction and orchestration remain outside
this packet. A hand-authored second SKOS taxonomy was rejected.

## 2026-07-14 — LOCKED — Q3: What ships first?

**Question:** What is the dependency order and first delivery?

**Answer:** Goal 1 versions the court and reporter vocabulary artifacts together,
including stable IDs, provenance, drift reporting, and one shared BSD-2 notice.
It uses the same generated-artifact mechanism family ratified for USPTO
vocabularies: source identity, retrieval date, checksum, refresh command, and
drift that reports rather than silently mutates. The resolver follows; fuzzy and
SKOS remain optional later tiers.

**Rationale:** Live citation models already expect reporters-db normalization in
`packages/law-practice/domain/src/values/Citation/Citation.models.ts`. Court and
reporter identity therefore form one compatibility substrate. Goal 1 unblocks
`citation-extraction-engine` scaffolding before resolver behavior is complete.

**Rejected options:** Court-only ingestion, resolver-first delivery, silent
runtime refresh, and bundling optional fuzzy/SKOS work into the first bet were
rejected. This supersedes the pre-draft's court-first slice and combined fuzzy +
SKOS third slice.

## 2026-07-14 — LOCKED — Q4: What are the acquisition, regex, and fuzzy boundaries?

**Question:** How are sources acquired, regexes executed, and fuzzy matching
admitted?

**Answer:** Acquire pinned-commit URLs through HTTP fetch + SHA-256 only, with no
secrets. Generation is deterministic, refresh diffs are reviewable, runtime
never mutates data, and resolution is fully offline. `re2js` is preferred only
after a pinned-corpus compatibility spike scans every pattern for RE2
incompatibility, proves parity fixtures, and exercises adversarial timing. A
bounded hybrid is allowed only for a proven incompatible subset. Fuzzy matching
is excluded from the core resolver; any later metric must be selected against
calibration fixtures.

**Rationale:** Linear-time matching is desirable for untrusted text, but fidelity
to the pinned corpus is the contract. The recorded `>95` threshold cannot cross
similarity definitions: the existing langextract helper is full Levenshtein,
not token-sort similarity.

**Rejected options:** Unpinned sources, authenticated acquisition, runtime
network lookups, unbounded native-regex fallback, adopting `re2js` without the
corpus spike, and reusing the historical `>95` fuzzy threshold were rejected.
The pre-draft's unconditional `re2js` + `fuzzball.js` selection is overturned.

## 2026-07-14 — LOCKED — Q5: Where does each layer live?

**Question:** Which packages own ingestion, raw artifacts, stable vocabulary,
resolution, and hosted integration?

**Answer:** Sync targets live in
`packages/tooling/tool/cli/src/commands/SyncDataToTs/targets/`; raw generated
artifacts are package-private in
`packages/foundation/primitive/data/src/generated/`; stable IDs, canonical
domain vocabulary, and the pure resolver live in `law-practice/domain` values
and pure modules. `law-practice/server` is involved only for persistence or
drivers. Future hosted CourtListener integration belongs in
`drivers/courtlistener`.

**Rationale:** Static data and pure product semantics are not a service or SDK
boundary. `standards/architecture/03-driver-boundaries.md` reserves drivers for
external technical wrappers and keeps domain driver-neutral;
`standards/architecture/07-non-slice-families.md` routes product semantics to the
owning slice and repo automation to tooling.

**Rejected options:** The pre-draft's near-`@beep/courtlistener` resolver
placement is explicitly overturned. Public raw `@beep/data` tables, a new
generic foundation capability, and server placement without persistence were
also rejected.

## 2026-07-14 — LOCKED — Q6: What taxonomy is authoritative?

**Question:** How are courts-db dimensions, reporter types, CourtListener enums,
and the existing inference model reconciled?

**Answer:** Preserve raw courts-db jurisdiction, system, type, and level
source-faithfully in the artifact. New domain names must not collide with the
existing `CourtInference`, `CourtLevel`, or `CourtJurisdiction`; for example,
use `CourtHierarchyLevel` for the source level. reporters-db string `cite_type`
is canonical. CourtListener composite/integer enums may appear only as optional
derived interoperability values through a pinned, tested crosswalk; they are
never decode authority. Existing `CourtInference` becomes a lossy,
reporter-derived projection over the richer canonical vocabulary.

**Rationale:** Source dimensions and the current inference values have different
information content. Keeping the source vocabulary canonical preserves
provenance while one explicit lossy projection prevents competing models.
CourtListener facts may be re-expressed, but AGPL expressions must not be
transcribed.

**Rejected options:** Renaming or collapsing raw source fields into the existing
types, treating CourtListener enums as canonical, transcribing AGPL taxonomy
code, and creating a second inference model were rejected. The pre-draft's
three-field canonicalization plus static CourtListener codec is narrowed to a
tested optional interop projection.

## 2026-07-14 — LOCKED — Q7: How is attribution recorded?

**Question:** Where does the BSD-2 obligation live?

**Answer:** Use one root `THIRD_PARTY_NOTICES.md` entry containing the full BSD-2
notice and disclaimer, copyright holder and year, upstream repositories,
pinned versions or commit IDs, and affected material. Generated sidecars link
source identity and checksums but do not become competing notices.

**Rationale:** One canonical notice is reviewable and satisfies the shared
attribution obligation for courts-db/reporters-db data, regexes, fixtures, and
ported expression while sidecars retain artifact-level provenance.

**Rejected options:** Per-artifact license copies, sidecars as notices, omission
on the theory that all fields are facts, and waiting for another notice
convention were rejected. The pre-draft's proposed root convention is now
ratified.

## Deferred Work

### 2026-07-14 — DEFERRED — re2js pinned-corpus compatibility spike

Run in goal-1/resolver P0: scan every pinned pattern for RE2 incompatibility,
prove parity fixtures, and benchmark adversarial timing before fixing the engine
or defining a bounded incompatible subset.

### 2026-07-14 — DEFERRED — crosswalk and CourtInference migration spike

Run in resolver-goal P0: prove crosswalk exhaustiveness, define the lossy
projection, and bound migration of existing `CourtInference` consumers.

### 2026-07-14 — DEFERRED — fuzzy calibration

Admit only after the core resolver, with representative calibration fixtures and
a metric-specific threshold. No historical threshold carries forward.

### 2026-07-14 — DEFERRED — SKOS projection

Consider only as a generated projection from the canonical vocabulary. Never
hand-author or maintain a second taxonomy.
