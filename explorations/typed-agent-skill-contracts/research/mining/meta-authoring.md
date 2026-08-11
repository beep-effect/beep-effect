# Lane: skill-authoring-meta

## Inventory table

| skill | one-line what-it-is | maturity (prototype/solid/polished) | steal-score 0-5 |
|---|---|---:|---:|
| repository authoring contract | Host-level rules for skill layout, RDF memory, anti-drift gates, manual ZIP publication, and attribution | solid | 4 |
| opal-agent-skill-assembler | Elicitation recipe that turns selected OPAL skills/functions into Markdown plus JSON registrations and can exercise existing registrations | prototype | 3 |
| uriburner-opal-agent-skills | Large protocol/router playbook for native KG tools, SPARQL Agent 121, bounded fallback, and provenance-bearing answers | solid | 4 |
| shared templates and scripts | Mixed utility shelf for HTML corpus indexes, RDF sidecar links, memory migrations, one-off KG generation, and Virtuoso loading | prototype | 2 |
| showcases-and-explainers | Evidence-led demo-production assets spanning storyboard, recording scenes, guide HTML, narration, and captions | solid | 4 |
| fuxi-engineer | Single-file FuXi/RDFLib/ROBOT/QLever reasoning cheat sheet with proof-output and testing patterns | prototype | 2 |
| wc2026-match-report | Three Python-backed HTML report modes with live SPARQL, rich interactions, and stated verification gates | prototype | 4 |
| world-cup-2026-navigator | Large FIFA ontology/query reference with named-graph, coded-value, analytics, and event-navigation patterns | solid | 4 |

## Per-skill notes

### repository-authoring-contract

- What it actually does
  - Defines the source unit as a folder containing `SKILL.md` plus optional `README.md`, `CHANGELOG.md`, `examples/`, `references/`, and `templates/`; the distributable is a sibling ZIP. This is descriptive convention, not a checked manifest (`ai-agent-skills/AGENTS.md`).
  - Says there is no build system, package manager, or test runner; installation is direct folder/ZIP loading followed by manual exercise of a documented usage example (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/README.md`).
  - Specifies a manual update lifecycle: edit source, update version/changelog if present, delete the prior archive, recreate it with `zip -r`, exclude `.DS_Store`, load, exercise, and optionally schedule (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/README.md`).
  - Adds a host policy above individual skills: re-read the relevant section before each build unit, prepare the verification gate first, validate section-by-section, and compose delegated skills' contracts independently (`ai-agent-skills/AGENTS.md`).
  - Makes `agent-rdf-memory/` a mandatory pre-task behavioral source and post-task write target; this lane skipped mining that already-covered skill, but the repo root and assembler depend on its `preferences.ttl` and `howto/` documents (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/README.md`, `ai-agent-skills/opal-agent-skill-assembler/SKILL.md`).
- Notable files worth a human read
  - `ai-agent-skills/AGENTS.md` — the real authoring/governance contract, including anti-drift, packaging, attribution, and RDF language-tag rules.
  - `ai-agent-skills/README.md` — minimal consumer setup and the cross-reference into `agent-rdf-memory/`.
- Standout mechanisms
  - The anti-drift triad—re-read before build, gate-first, section-by-section—is a compact operational contract that can be compiled into workflow states (`ai-agent-skills/AGENTS.md`).
  - Skill contracts remain independently applicable when skills compose; delegation does not erase the caller's harness requirements (`ai-agent-skills/AGENTS.md`).
  - The attribution contract distinguishes canonical skill IRIs, visible prose attribution, resolver links for semantic entities, and `prov:wasGeneratedBy` in JSON-LD (`ai-agent-skills/AGENTS.md`).
  - “Delete then re-ZIP” correctly avoids stale deleted archive entries, a subtle but concrete packaging invariant (`ai-agent-skills/AGENTS.md`).
- Weaknesses / smells
  - The lifecycle is prose-only: no linter checks frontmatter, references, versions, ZIP freshness, archive contents, broken links, examples, or gates (`ai-agent-skills/AGENTS.md`).
  - The “every skill has a ZIP” rule is already false in the assigned set: matching root archives exist for the assembler, URIBurner, and match-report skills, but not `fuxi-engineer` or `world-cup-2026-navigator`; only bundle names were inspected, never contents (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/fuxi-engineer/SKILL.md`, `ai-agent-skills/world-cup-2026-navigator/README.md`).
  - Metadata is inconsistent: most skills use YAML `name`/`description`, `fuxi-engineer` adds `compatibility`, and `wc2026-match-report` has no frontmatter at all, placing name/version in Markdown (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`, `ai-agent-skills/fuxi-engineer/SKILL.md`, `ai-agent-skills/wc2026-match-report/SKILL.md`).
  - The memory protocol is absolute and mutation-heavy for a reusable public skill repository; it can dominate unrelated tasks and couples skill use to one repository-local memory topology (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/README.md`).

### opal-agent-skill-assembler

- What it actually does
  - Runs a three-stage elicitation—endpoint, authentication, mode—then discovers agents/skills/functions, asks for selected IDs and metadata, emits Markdown plus JSON, optionally uploads both to WebDAV, and exercises registrations through `/chat/api` (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`).
  - Models OPAL composition explicitly: Agent → selected Skills; Skill → selected fully qualified function names (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`, `ai-agent-skills/opal-agent-skill-assembler/references/opal-agent-skill-json-schema.md`).
- Notable files worth a human read
  - `ai-agent-skills/opal-agent-skill-assembler/SKILL.md` — elicitation and assemble/exercise state machine.
  - `ai-agent-skills/opal-agent-skill-assembler/prompts/agents-md-template.md` — agent documentation template.
  - `ai-agent-skills/opal-agent-skill-assembler/prompts/skills-md-template.md` — OPAL skill documentation template.
  - `ai-agent-skills/opal-agent-skill-assembler/references/opal-agent-skill-json-schema.md` — example registration objects and storage paths.
  - `ai-agent-skills/opal-agent-skill-assembler/references/opal-service-surface.md` — concise discovery/chat/MCP/WebDAV surface.
- Standout mechanisms
  - Discovery-before-assembly prevents authors from inventing unavailable skill/function identifiers (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`).
  - Assemble and exercise are paired modes; a generated resource has a prescribed post-upload discoverability check and a live conversational smoke test (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`).
  - Dual artifacts separate human operating instructions from runtime registration data (`ai-agent-skills/opal-agent-skill-assembler/prompts/agents-md-template.md`, `ai-agent-skills/opal-agent-skill-assembler/references/opal-agent-skill-json-schema.md`).
- Weaknesses / smells
  - “JSON schema” is a Markdown page containing examples, not JSON Schema: no `$schema`, required fields, enums, ID constraints, unknown-property policy, or executable validator (`ai-agent-skills/opal-agent-skill-assembler/references/opal-agent-skill-json-schema.md`).
  - The skill generates `SKILLS.md` plural for OPAL, whereas this repository and Claude Code install `SKILL.md` singular; the output is an OPAL registration document, not a portable Claude Code skill (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`, `ai-agent-skills/README.md`).
  - Templates are shallow documentation shells and omit trigger semantics, failure algebra, authorization policy, input/output schemas, tool preconditions, and verification receipts (`ai-agent-skills/opal-agent-skill-assembler/prompts/agents-md-template.md`, `ai-agent-skills/opal-agent-skill-assembler/prompts/skills-md-template.md`).
  - The auth branch asks the user to paste a bearer token and prints raw curl patterns; it has no secret-reference contract, redaction gate, token lifetime model, or safe storage policy (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`).
  - It is “skills generating skills” only at the selection-and-scaffolding layer: there is no implementation generation, semantic validation, packaging command, test harness, or rollback (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`).

### uriburner-opal-agent-skills

- What it actually does
  - Routes local/remote SPARQL, SPASQL, SQL, fetch, sponge, schema discovery, and LLM-mediated KG workflows across REST, OAuth, MCP, OPAL functions, `chatPromptComplete`, and curl (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`, `ai-agent-skills/uriburner-opal-agent-skills/references/protocol-routing.md`).
  - Defines a bounded KG-first loop: exact label search, semantic breakdown, up to three variants, targeted provenance query, inference and endpoint fallbacks, then a structured failure audit and explicit user options (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
  - Separates native deterministic query tools from LLM-mediated SPARQL Agent 121 use; the latter is reserved for explicit Gemini/agent/citation-verification intent (`ai-agent-skills/uriburner-opal-agent-skills/README.md`, `ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
- Notable files worth a human read
  - `ai-agent-skills/uriburner-opal-agent-skills/SKILL.md` — full KG workflow, limits, query patterns, and audit block.
  - `ai-agent-skills/uriburner-opal-agent-skills/references/protocol-routing.md` — transport/auth preference matrix.
  - `ai-agent-skills/uriburner-opal-agent-skills/README.md` — compact intent statement that exposes drift against the longer files.
- Standout mechanisms
  - Strict and permissive KG enforcement modes make epistemic policy explicit: strict aborts with an audit receipt rather than synthesizing unbacked text (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
  - Operational limits are named data—query budget, per-query timeout, semantic retries, concurrency, retry delay, and total time—rather than vague “try a few times” prose (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
  - A no-result receipt records every query, endpoint, timestamps, status, count, reason, and elapsed time; this is directly portable to typed Effect telemetry (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
  - User-named protocol overrides default routing, an important human-in-the-loop contract (`ai-agent-skills/uriburner-opal-agent-skills/references/protocol-routing.md`).
- Weaknesses / smells
  - Default ordering drifts: the README says native MCP is primary; the main skill says REST then terminal OAuth then MCP; the routing reference labels MCP primary but later recommends terminal OAuth → REST for Claude Code (`ai-agent-skills/uriburner-opal-agent-skills/README.md`, `ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`, `ai-agent-skills/uriburner-opal-agent-skills/references/protocol-routing.md`).
  - The large `SKILL.md` repeats endpoints, examples, defaults, and selection rules, increasing token cost and stale-copy risk (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
  - The JavaScript “sanitizer” removes only one matched punctuation character and still interpolates the result into SPARQL; it is not a safe query-construction mechanism (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
  - No scripts enforce budgets, parse audit receipts, encode resolver URLs, validate queries, or test transport equivalence (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).

### shared-templates-and-scripts

- What it actually does
  - `scripts/index.js` recursively extracts HTML/meta/JSON-LD metadata, copies shared CSS/JS, and writes a filterable grid/timeline/table index; `templates/index.js` also attempts live Apache-style directory scraping and a 60-second local cache (`ai-agent-skills/scripts/index.js`, `ai-agent-skills/templates/index.js`, `ai-agent-skills/templates/index.css`).
  - `backfill-rdf-related.js` finds adjacent RDF serializations and regex-injects POSH `rel=related` plus JSON-LD `relatedLink` (`ai-agent-skills/scripts/backfill-rdf-related.js`).
  - Two memory migrations regroup a flat preference graph into topical `schema:HowTo` hubs; one uses RDFLib graph reconstruction and validates Turtle/sub-HowTo/step counts, while the older one rewrites text via regex then parses it (`ai-agent-skills/scripts/migrate_preferences_v2.py`, `ai-agent-skills/scripts/migrate_preferences_to_sub_howtos.py`).
  - `bulk-load-ntriples.sh` stages `.nt.gz`, registers `ld_dir`, runs the Virtuoso loader, checkpoints, polls `LOAD_LIST`, and prints a final summary (`ai-agent-skills/scripts/bulk-load-ntriples.sh`).
  - `generate_blogging_collapse_kg.py` embeds a fixed dataset and emits schema.org/PROV/custom-vocabulary Turtle, but currently fails at runtime because it uses `os` without importing it; the local execution ended in `NameError` before output (`ai-agent-skills/scripts/generate_blogging_collapse_kg.py`).
- Notable files worth a human read
  - `ai-agent-skills/scripts/migrate_preferences_v2.py` — strongest example of parse-transform-serialize-parse validation.
  - `ai-agent-skills/scripts/index.js` and `ai-agent-skills/templates/index.js` — static-plus-live corpus index design.
  - `ai-agent-skills/scripts/backfill-rdf-related.js` — tiny linked-data discoverability mechanism, despite brittle implementation.
  - `ai-agent-skills/scripts/generate_blogging_collapse_kg.py` — PROV-shaped output plus a cautionary one-off generator.
- Standout mechanisms
  - The RDFLib migration preserves step triples, rebuilds ownership links, reports missing/extra steps, serializes, reparses, and counts linked sub-HowTos (`ai-agent-skills/scripts/migrate_preferences_v2.py`).
  - The HTML index derives UI facets from embedded document metadata, a useful generated-exploration pattern for artifact corpora (`ai-agent-skills/scripts/index.js`).
  - POSH `rel=related` plus JSON-LD `relatedLink` makes companion RDF discoverable from a human page (`ai-agent-skills/scripts/backfill-rdf-related.js`).
- Weaknesses / smells
  - None of these are packaging scripts; ZIP creation remains a manual command in `AGENTS.md` (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/scripts/`).
  - `scripts/index.js` calls itself `generate-index.js` in usage text, overwrites `index.html`, `index.css`, and `index.js` without a dry run, and has no HTML/render validation (`ai-agent-skills/scripts/index.js`).
  - The browser template inserts derived filenames/themes into HTML and inline handlers without consistently escaping attributes, and assumes a specific directory-listing table layout (`ai-agent-skills/templates/index.js`).
  - Regex mutation of JSON-LD is unsafe for nested/multiple script blocks and does not reparse the resulting JSON/HTML (`ai-agent-skills/scripts/backfill-rdf-related.js`).
  - The Virtuoso loader defaults to `dba`/`dba`, assembles SQL from path/pattern/graph strings, and has no rollback or post-load triple-count gate (`ai-agent-skills/scripts/bulk-load-ntriples.sh`).
  - The fixed blogging KG generator hardcodes generation identity/times, says 100 blogs while other literals say 98, imports unused `dedent`, and lacks a final RDF parse/SHACL validation (`ai-agent-skills/scripts/generate_blogging_collapse_kg.py`).

### showcases-and-explainers

- What it actually does
  - Builds a demo from captured session evidence: identity and preferences, A2A Agent Card discovery, endpoint skill selection, OAuth evidence, honest backend failure, and a direct-SPARQL user-outcome fallback (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.md`).
  - Maps the narrative to a shot-scraper-like YAML recording sequence, a static guide page, a voiceover script, and synchronized SRT/VTT caption sidecars (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.yml`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-voiceover.txt`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo.srt`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo.vtt`).
  - Separately diagrams Data Twingler as a gated intent-template workflow with graph discovery, mandatory index results, a user checkpoint, a direct-entity shortcut, execution fallback, and linked output (`ai-agent-skills/showcases-and-explainers/data-twingler-prompt-to-response-flow.md`).
- Notable files worth a human read
  - `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.md` — evidence inventory, scene proof points, failure separation, and capture plan.
  - `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html` — semantic metadata and multimodal asset wiring.
  - `ai-agent-skills/showcases-and-explainers/data-twingler-prompt-to-response-flow.md` — clearest finite workflow in the lane.
- Standout mechanisms
  - Every scene has a visual capture, narration beat, and proof point; this is a reusable browser/desktop QA evidence contract (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.md`).
  - The demo explicitly distinguishes client discovery/auth success from backend skill failure and preserves both as evidence (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.md`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html`).
  - HTML links its MP4, audio, VTT, and SRT via semantic `<link>` relations and describes page/media/agents in JSON-LD with PROV delegation (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html`).
  - The Data Twingler checkpoint prevents a multi-step query from silently choosing the wrong entity (`ai-agent-skills/showcases-and-explainers/data-twingler-prompt-to-response-flow.md`).
- Weaknesses / smells
  - The guide embeds asserted identity/preferences and live endpoint results as static prose; there is no generated evidence manifest, timestamp binding, screenshot hash, or replay script (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html`).
  - Storyboard YAML contains a user-specific absolute macOS output path and assumes a local HTTP server and fixed scroll distances (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.yml`).
  - The guide references MP4/MP3 assets not present in the assigned directory, so the source packet is not self-contained (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html`).
  - The explainer names external reference files but supplies no executable state machine or trace schema (`ai-agent-skills/showcases-and-explainers/data-twingler-prompt-to-response-flow.md`).

### fuxi-engineer

- What it actually does
  - Provides installation, CLI modes, canonical RDFLib/FuXi pipeline code, top-down SPARQL store usage, remote SPARQL, InfixOWL authoring, N3 rule parsing, RDF conversion, and lightweight testing advice in one file (`ai-agent-skills/fuxi-engineer/SKILL.md`).
- Notable files worth a human read
  - `ai-agent-skills/fuxi-engineer/SKILL.md` — especially canonical pipeline, proof outputs, ROBOT profile validation, and testing patterns.
- Standout mechanisms
  - Makes reasoning evidence a first-class output: PML, proof graphs, RETE networks, and SIP collections are named products rather than invisible inference (`ai-agent-skills/fuxi-engineer/SKILL.md`).
  - Separates forward chaining, backward fixpoint querying, hybrid local reasoning, and remote SPARQL, with a warning against hybrid mode on large services (`ai-agent-skills/fuxi-engineer/SKILL.md`).
  - Recommends an OWL 2 RL/DL profile gate via ROBOT before reasoning and parse/triple-membership assertions for generated N3 (`ai-agent-skills/fuxi-engineer/SKILL.md`).
- Weaknesses / smells
  - There are no scripts, fixtures, pinned versions, compatibility matrix, example ontology, or runnable test suite; all guarantees are prose/code snippets (`ai-agent-skills/fuxi-engineer/SKILL.md`).
  - “Manchester OWL (OWL/RDF/XML)” conflates two different syntaxes, and the `~/qlever$ sophia-cli/sop` shell example appears malformed (`ai-agent-skills/fuxi-engineer/SKILL.md`).
  - It is a broad technology cheat sheet rather than a task contract: no trigger-specific outputs, typed failures, artifact locations, or verification receipt (`ai-agent-skills/fuxi-engineer/SKILL.md`).

### wc2026-match-report

- What it actually does
  - Dispatches among match, single-player, and tournament scatter reports; each mode has a Python generator, live SPARQL query plan, a specific visual grammar, and a claimed verification contract (`ai-agent-skills/wc2026-match-report/SKILL.md`).
  - The match generator queries overview, coaches, events, team/player analytics, squad, and article data, then emits a single interactive HTML file with movable navigation, theme toggle, SVG pitches, timelines, comparison bars, live query links, and attribution (`ai-agent-skills/wc2026-match-report/scripts/report_template_create.py`).
  - The player generator normalizes attack direction per match/half, links assist/shot markers to event IRIs, deduplicates temporal snapshots by `timePlayed`, derives final/aggregate stats, and renders 12 sections, six canvases, and two SVG maps (`ai-agent-skills/wc2026-match-report/scripts/player_report_create.py`).
  - The scatter generator validates metric names and chart count, embeds one comprehensive SPARQL query, fetches client-side, derives pass accuracy, plots by position, resolves clustered clicks with a modal, and generates narrative insights (`ai-agent-skills/wc2026-match-report/scripts/analytics_scatter_report_create.py`).
- Notable files worth a human read
  - `ai-agent-skills/wc2026-match-report/SKILL.md` — mode router and stated design/gate contract.
  - `ai-agent-skills/wc2026-match-report/scripts/player_report_create.py` — strongest concrete spatial/temporal/provenance mechanism.
  - `ai-agent-skills/wc2026-match-report/scripts/analytics_scatter_report_create.py` — compact typed-metric-to-interactive-chart generator.
  - `ai-agent-skills/wc2026-match-report/references/verification.md` — useful mainly as evidence of contract drift.
- Standout mechanisms
  - Mode selection is based on user subject shape, then each mode has a single source-of-truth generator and a short structural gate (`ai-agent-skills/wc2026-match-report/SKILL.md`).
  - The player pipeline's per-(match, half) attack-direction inference and fallback to the opposite known half is a concrete spatial normalization algorithm (`ai-agent-skills/wc2026-match-report/scripts/player_report_create.py`).
  - Latest-snapshot selection via `MAX(fifa:generatedAt)` and cross-graph labels demonstrates temporal KG query discipline (`ai-agent-skills/wc2026-match-report/scripts/report_template_create.py`, `ai-agent-skills/wc2026-match-report/scripts/analytics_scatter_report_create.py`).
  - Click targets retain provenance at event granularity, not merely player or match level (`ai-agent-skills/wc2026-match-report/scripts/player_report_create.py`).
- Weaknesses / smells
  - The “12-point” gate actually lists 15 items, while the generator does not emit `hero-image-wrap`, `lineup-group`, `Assistant Coaches`, `attr-card`, `copyAnchor`, or inline `onclick="copyAnchor(this)"` required by the skill/checker (`ai-agent-skills/wc2026-match-report/SKILL.md`, `ai-agent-skills/wc2026-match-report/references/verification.md`, `ai-agent-skills/wc2026-match-report/scripts/report_template_create.py`).
  - The verifier expects seven `attr-card` divs, while the generator emits `attribution-card` articles; no generator invokes the verifier (`ai-agent-skills/wc2026-match-report/references/verification.md`, `ai-agent-skills/wc2026-match-report/scripts/report_template_create.py`).
  - The match generator swallows every SPARQL exception into an empty list, allowing partially fabricated-looking reports instead of typed failure (`ai-agent-skills/wc2026-match-report/scripts/report_template_create.py`).
  - Dynamic KG strings are interpolated into HTML attributes, prose, and JSON-LD without systematic escaping (`ai-agent-skills/wc2026-match-report/scripts/report_template_create.py`).
  - The scatter mode advertises `yellowCards` as valid but neither SELECTs, OPTIONAL-binds, nor parses it, so that accepted metric cannot work (`ai-agent-skills/wc2026-match-report/scripts/analytics_scatter_report_create.py`).
  - The report script derives starters from top `timePlayed`, ignores the stated role grouping/status contract, and does not retrieve assistant coaches (`ai-agent-skills/wc2026-match-report/SKILL.md`, `ai-agent-skills/wc2026-match-report/scripts/report_template_create.py`).

### world-cup-2026-navigator

- What it actually does
  - Supplies a manual ontology facade: graph routing, class/property tables, coded instances, event qualifiers, timeline bridges, power-ranking snapshot patterns, analytics metrics, and 15 reusable queries (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/world-cup-2026-navigator/references/properties.md`, `ai-agent-skills/world-cup-2026-navigator/references/coded-values.md`).
- Notable files worth a human read
  - `ai-agent-skills/world-cup-2026-navigator/SKILL.md` — named graphs, match hub, snapshot queries, anti-traps.
  - `ai-agent-skills/world-cup-2026-navigator/references/properties.md` — property/domain/range inventory.
  - `ai-agent-skills/world-cup-2026-navigator/references/coded-values.md` — coded instances and event/qualifier examples.
  - `ai-agent-skills/world-cup-2026-navigator/README.md` — cleanest summary of intended query-selection mechanics.
- Standout mechanisms
  - Treats named graphs as explicit bounded contexts and teaches joins across main, analytics, historical, and rankings graphs (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`).
  - Models temporal analytics as append-only snapshots and repeatedly applies latest-per-entity subqueries (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/world-cup-2026-navigator/references/properties.md`).
  - `fifa:timelineEvent` bridges normalized live entities to raw events/qualifiers, a useful two-layer ingestion pattern (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/world-cup-2026-navigator/references/coded-values.md`).
  - The “URI + label” output rule supports stable follow-up identifiers while retaining readable display (`ai-agent-skills/world-cup-2026-navigator/references/coded-values.md`).
- Weaknesses / smells
  - It duplicates exhaustive metric/property tables across `SKILL.md` and references, undermining progressive disclosure and making drift likely (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/world-cup-2026-navigator/references/properties.md`).
  - Its coded-value truth conflicts with the applied skill: navigator says CardType-2 second-yellow and CardType-3 straight-red with labels; match skill says current WC2026 has only codes 1/2 and no labels (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/world-cup-2026-navigator/references/coded-values.md`, `ai-agent-skills/wc2026-match-report/SKILL.md`).
  - Several query patterns require labels on tactics, positions, periods, goal types, or cards even though the applied skill warns those current data instances lack labels (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/wc2026-match-report/SKILL.md`).
  - `fifa:playsForTeam` is described both as a direct team link in the player-report generator and as a `TeamMembership` link in the property reference; this needs live-schema reconciliation before reuse (`ai-agent-skills/wc2026-match-report/scripts/player_report_create.py`, `ai-agent-skills/world-cup-2026-navigator/references/properties.md`).
  - There is no ontology snapshot, SHACL shape, SPARQL fixture, or contract test tying the prose facade to actual graph data (`ai-agent-skills/world-cup-2026-navigator/README.md`).

## Cross-cutting patterns in this lane

- The repo has four distinct contract planes: host law in `AGENTS.md`, portable skill instructions in `SKILL.md`, OPAL runtime registrations in JSON plus Markdown, and proof/showcase artifacts in HTML/media sidecars (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/opal-agent-skill-assembler/references/opal-agent-skill-json-schema.md`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html`).
- Their authoring lifecycle versus Claude Code is surface-compatible but not contract-compatible: Claude Code consumes a directory with singular `SKILL.md` and optional resources; OPAL assembly emits plural `SKILLS.md`/`AGENTS.md` plus a WebDAV JSON registration. A translator must map metadata, tool identities, triggers, auth, tests, and runtime registration—not merely rename a file (`ai-agent-skills/README.md`, `ai-agent-skills/opal-agent-skill-assembler/SKILL.md`).
- The typical source lifecycle is author prose → add references/scripts → manually exercise an example → manually recreate ZIP → load folder/ZIP → optionally schedule; there is no repository compiler or CI gate (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/README.md`).
- The strongest skills turn ambiguous work into explicit state machines: discovery before selection, template gate before query, checkpoint before entity-specific follow-up, and audit receipt before epistemic fallback (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`, `ai-agent-skills/showcases-and-explainers/data-twingler-prompt-to-response-flow.md`, `ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
- The best provenance is operational, not decorative: event-level resolver links, query/endpoints/timestamps in a failure receipt, and client-success/backend-failure separation (`ai-agent-skills/wc2026-match-report/scripts/player_report_create.py`, `ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.md`).
- Prose contracts routinely outrun code: routing order, coded values, gate selectors, report structure, and bundle presence disagree across files (`ai-agent-skills/uriburner-opal-agent-skills/README.md`, `ai-agent-skills/wc2026-match-report/references/verification.md`, `ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/AGENTS.md`).
- Progressive disclosure is intended through `references/` and companion skills, but large primary files duplicate references rather than routing to them (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
- JSON-LD, POSH links, canonical entity hyperlinks, named graphs, and PROV are used as mechanics for discoverability and traceability; they are most valuable when emitted from typed runtime facts instead of hardcoded prose (`ai-agent-skills/scripts/backfill-rdf-related.js`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html`, `ai-agent-skills/scripts/generate_blogging_collapse_kg.py`).

## Steal-worthy for beep-effect (ranked, concrete — name the mechanism and the port)

1. **Compiled Skill Contract + Evidence Receipt** — define `SkillContract`, `Gate`, `Artifact`, `Evidence`, and `FailureReceipt` with `effect/Schema`; execute each gate as an Effect and refuse `Complete` unless every blocking gate has typed evidence. This ports the anti-drift law while eliminating the match-report contract/runtime split (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/wc2026-match-report/references/verification.md`).
2. **Bounded KG Retrieval State Machine** — port label search → semantic variants → targeted query → inference/endpoints → strict abort as a discriminated Effect workflow with query/time/concurrency budgets and a serializable audit receipt (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`).
3. **Capability Discovery Before Binding** — model A2A/OPAL Agent Cards as schemas, discover offered skills/functions, validate selected IDs, then construct a `Context.Service` implementation for the chosen remote capability (`ai-agent-skills/opal-agent-skill-assembler/SKILL.md`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.md`).
4. **Dual Human/Runtime Skill Artifacts** — generate readable `SKILL.md` and a machine manifest from one Effect Schema AST; add deterministic serialization, schema version, hash, and round-trip validation instead of maintaining unrelated Markdown and example JSON (`ai-agent-skills/opal-agent-skill-assembler/prompts/skills-md-template.md`, `ai-agent-skills/opal-agent-skill-assembler/references/opal-agent-skill-json-schema.md`).
5. **Temporal Snapshot Selector** — standardize `latestBy(entity, generatedAt)` and `seriesBy(entity, observedAt)` query combinators with named-graph scope; use them in legal/patent KG ingestion and analytics pipelines (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/wc2026-match-report/scripts/player_report_create.py`).
6. **Raw Event ↔ Normalized Entity Bridge** — retain source events/qualifiers, point normalized domain entities back to them, and expose provenance traversal through typed IDs; this maps naturally to document facts ↔ extracted legal/patent claims (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`).
7. **Spatial Normalization by Context Partition** — port the per-(match, half) direction inference as a generic `NormalizationPolicy` whose evidence records observed samples, inferred flips, and fallbacks; useful for coordinate-bearing browser QA and diagram extraction (`ai-agent-skills/wc2026-match-report/scripts/player_report_create.py`).
8. **Scene Proof Contract for Browser/Desktop QA** — schema each demo scene as `{action, capture, narration, assertion, redactions, artifactHash}` and have Playwright/browser automation emit a signed evidence manifest alongside screenshots/video/captions (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.md`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.yml`).
9. **Reasoning Proof as Artifact** — make inference services return result plus derivation/proof graph and an OWL/SHACL/profile-validation receipt, borrowing FuXi's proof-output menu without adopting its Python-specific API (`ai-agent-skills/fuxi-engineer/SKILL.md`).
10. **HTML ↔ RDF Sidecar Discovery** — emit validated `rel=related` and JSON-LD `relatedLink` from the same typed artifact manifest, never via regex; useful for exploration packets and KG-backed reports (`ai-agent-skills/scripts/backfill-rdf-related.js`).
11. **Deterministic Skill Packager** — replace delete-and-zip prose with a TS command that validates metadata/references/tests, normalizes archive order/timestamps, excludes junk, writes checksums/SBOM, and proves archive/source parity (`ai-agent-skills/AGENTS.md`).
12. **Protocol Override Algebra** — encode default route plus explicit user override as a tagged union, with credential capability requirements and typed transport failures, rather than three drifting routing tables (`ai-agent-skills/uriburner-opal-agent-skills/references/protocol-routing.md`).

## Exploration-packet leads (open questions worth a deeper research phase)

- What is the actual OPAL registration OpenAPI/schema, and can agents, skills, functions, auth scopes, model overrides, and WebDAV revisions be generated from one canonical definition (`ai-agent-skills/opal-agent-skill-assembler/references/opal-service-surface.md`, `ai-agent-skills/opal-agent-skill-assembler/references/opal-agent-skill-json-schema.md`)?
- Which `SKILL.md` frontmatter fields are accepted by Claude Code, Codex CLI, OpenCode, and other hosts, and how should `compatibility`, version, tools, permissions, and entrypoints be represented portably (`ai-agent-skills/fuxi-engineer/SKILL.md`, `ai-agent-skills/wc2026-match-report/SKILL.md`)?
- Can a repository compiler extract every named gate from Markdown, bind it to executable code, and fail when selectors/assertions do not exist in generator output (`ai-agent-skills/AGENTS.md`, `ai-agent-skills/wc2026-match-report/references/verification.md`)?
- What is the live FIFA graph truth for labels, CardType codes, `fieldStatus` versus `playerStatus`, coach-role predicates, and `playsForTeam`; generate shapes and fixtures from a pinned graph snapshot before porting any query (`ai-agent-skills/wc2026-match-report/SKILL.md`, `ai-agent-skills/world-cup-2026-navigator/references/properties.md`)?
- How should KG query evidence be captured so a response can be reproduced after endpoint mutation—raw response hash, named-graph version, query text, timestamp, inference ruleset, and resolver base (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`)?
- Can the A2A showcase pipeline produce a WCAG-checked, redaction-checked, replayable artifact bundle with captions derived from one timing source and every proof point linked to captured evidence (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.md`)?
- How should provenance distinguish generator software, selected skill contract, model, principal/delegation, source datasets, and validation activities without hardcoding identities into templates (`ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-guide.html`, `ai-agent-skills/scripts/generate_blogging_collapse_kg.py`)?
- Would SHACL be sufficient for generated RDF contracts, or should beep-effect compile Effect Schemas to SHACL plus runtime decoders and property-based fixtures (`ai-agent-skills/fuxi-engineer/SKILL.md`, `ai-agent-skills/scripts/migrate_preferences_v2.py`)?

## Dead ends (what to NOT spend time on, and why)

- Do not port the giant duplicated FIFA property/metric tables by hand; generate a typed catalog from a pinned ontology/data snapshot or the same contradictions will follow (`ai-agent-skills/world-cup-2026-navigator/SKILL.md`, `ai-agent-skills/world-cup-2026-navigator/references/properties.md`).
- Do not adopt `SKILLS.md` + example JSON as a universal skill format; it is an OPAL-specific registration convention and lacks a real schema (`ai-agent-skills/opal-agent-skill-assembler/prompts/skills-md-template.md`, `ai-agent-skills/opal-agent-skill-assembler/references/opal-agent-skill-json-schema.md`).
- Do not port the full CSS/HTML report templates as architecture; preserve the data contracts, provenance links, spatial normalization, and gates, then rebuild presentation with tested components (`ai-agent-skills/wc2026-match-report/scripts/report_template_create.py`, `ai-agent-skills/wc2026-match-report/scripts/player_report_create.py`).
- Do not use regex to mutate JSON-LD or HTML contracts; parse, transform, serialize, and revalidate (`ai-agent-skills/scripts/backfill-rdf-related.js`).
- Do not treat manual ZIP presence as release proof; current assigned directories already violate the promised one-directory/one-archive topology (`ai-agent-skills/AGENTS.md`).
- Do not reuse static endpoint inventories, model names, assistant IDs, or user-specific output paths as domain truth; move them behind configuration and discovery (`ai-agent-skills/uriburner-opal-agent-skills/SKILL.md`, `ai-agent-skills/showcases-and-explainers/a2a-client-skill-demo-storyboard.yml`).
- Do not spend a deep phase on the fixed blogging dataset generator until its runtime, counts, provenance timestamps, and RDF validation are repaired; it is a one-off artifact script, not a reusable KG pipeline (`ai-agent-skills/scripts/generate_blogging_collapse_kg.py`).
- Do not copy the FuXi API snippets wholesale into beep-effect; steal proof/profile concepts and put the external engine behind a typed service boundary (`ai-agent-skills/fuxi-engineer/SKILL.md`).
