# Lane: rdf-infographic-skill

## Inventory table

| skill | one-line what-it-is | maturity (prototype/solid/polished) | steal-score 0-5 |
|---|---|---:|---:|
| `rdf-infographic-skill` | RDF-to-HTML/Markdown artifact specification plus Python/TypeScript parsers, a D3 explorer, reusable shells, and regex-based delivery gates | prototype | 4 |

## Per-skill notes

### rdf-infographic-skill

- What it actually does:
  - Defines a strict artifact protocol for an RDF source, HTML rendering, optional Markdown companion, embedded JSON-LD, resolver links, a D3 knowledge-graph explorer, a SPARQL workbench, and provenance attribution in `ai-agent-skills/rdf-infographic-skill/SKILL.md`.
  - Provides two mostly parallel generator stacks: Python (`scripts/generate_infographic.py` → `scripts/html_assembler.py` → `scripts/rdf_parser.py`) and TypeScript (`scripts/generate_infographic.ts` → `scripts/html_assembler.ts` → `scripts/rdf_parser.ts`).
  - The active assemblers parse RDF, derive URI-to-URI graph data and a few schema.org narrative sections, inject `scripts/templates/styles.css` and `scripts/templates/kg_explorer.js` into `scripts/templates/base_template.html`, write HTML, then invoke the strict validator (`scripts/html_assembler.py`; `scripts/html_assembler.ts`).
  - The reusable harness helpers do not generate a complete page. They emit a KG shell, a typed SPARQL URL builder/workbench, and attribution cards (`scripts/rdf_infographic_harness.py`; `scripts/rdf_infographic_harness.ts`).
  - A second standalone route emits only a D3 section or `kgData` JSON (`scripts/rdf-to-kg-section.py`; `scripts/rdf-to-kg-section.ts`). It is materially different from the primary template renderer.
  - A legacy parser remains beside the current parser (`scripts/rdf-parser.py` versus `scripts/rdf_parser.py`), and a legacy visual-quality linter remains beside the strict contract validator (`scripts/validate-infographic.py`; `scripts/validate-infographic.ts`; `scripts/validate-harness-contract.py`; `scripts/validate-harness-contract.ts`).
  - The nominal ~534-file size is misleading: 528 non-ZIP files were present, but the overwhelming majority are vendored `scripts/node_modules/`; only 28 non-vendored authored files make up the skill surface.

- Notable files worth a human read:
  - `ai-agent-skills/rdf-infographic-skill/SKILL.md` — the real product: a 1,223-line behavioral contract, including explicit regressions and pre/post-build gates.
  - `ai-agent-skills/rdf-infographic-skill/scripts/validate-harness-contract.py` — strongest executable gate and the best starting point for understanding what is actually enforced.
  - `ai-agent-skills/rdf-infographic-skill/scripts/validate-harness-contract.ts` — intended parity port, but weaker on RDF parsing and slightly divergent in accepted patterns.
  - `ai-agent-skills/rdf-infographic-skill/scripts/rdf_infographic_harness.py` — compact reusable contract fragments for resolver URLs, query formats, KG shell, attribution, and SPARQL workbench.
  - `ai-agent-skills/rdf-infographic-skill/scripts/templates/base_template.html` — current generator shell; useful mainly for finding contract/implementation gaps.
  - `ai-agent-skills/rdf-infographic-skill/scripts/templates/kg_explorer.js` — primary D3 behavior, filter state, drag/zoom, physics controls, and resolver dispatch.
  - `ai-agent-skills/rdf-infographic-skill/scripts/templates/styles.css` — current token set and component CSS, including separate explicit/system dark blocks.
  - `ai-agent-skills/rdf-infographic-skill/scripts/rdf_parser.py` — current Python RDF-to-graph/narrative extraction.
  - `ai-agent-skills/rdf-infographic-skill/scripts/rdf-to-kg-section.ts` — alternate D3 generator; exposes drift from both the Python version and the written contract.
  - `ai-agent-skills/rdf-infographic-skill/references/template-options.md` — concise template-selection policy and retrofit checklist.
  - `ai-agent-skills/rdf-infographic-skill/assets/templates/kg-explorer-reference.html` — markup-only KG control reference, not a complete working artifact.
  - `ai-agent-skills/rdf-infographic-skill/assets/templates/gartner-da-london-2026-claude-sonnet4-dashboard.html` — sampled dashboard artifact; useful for visual density and settings-drawer ideas.
  - `ai-agent-skills/rdf-infographic-skill/assets/templates/semantic-medallion-editorial-technical.html` — sampled editorial/technical artifact; useful for layered architecture and provenance storytelling.

- Standout mechanisms:
  - **RDF-first rendering contract.** Narrative HTML is supposed to be a projection of RDF entities rather than separately authored prose; FAQ, glossary, HowTo, people, organizations, query examples, and graph payload all have named RDF roles (`SKILL.md`).
  - **Artifact-set identity.** HTML, Markdown, and RDF share `{descriptive-slug}-{llm-id}-{n}`; HTML advertises companions with POSH links and JSON-LD, and Markdown links back relatively (`SKILL.md`).
  - **Role-sensitive semantic parity.** A visible HowTo step must resolve to the exact `schema:HowToStep`, a FAQ question to `schema:Question`, and a query title to `schema:SoftwareSourceCode`; merely linking to a topically related entity is rejected in prose (`SKILL.md`).
  - **Resolver indirection.** Visible semantic IRIs route through `describe/?url={encodedIRI}`, with the sharp `%23`-once / `%2523`-never rule (`SKILL.md`; `scripts/rdf_infographic_harness.py`).
  - **Authority-denotation policy.** Person, software, country, and glossary identifiers have explicit priority rules, with `owl:sameAs` reserved for identity alignment rather than replacing a known primary IRI (`SKILL.md`).
  - **Regression-derived UI contracts.** The navigation rules encode real failure modes: collapsed dimensions must not overwrite expanded dimensions; stale/offscreen storage must be discarded; manual hide must set `manuallyHidden`, stop click propagation, and remain hidden until the single marker is clicked (`SKILL.md`).
  - **Closed-by-default complexity.** KG controls and Advanced settings remain hidden until explicit activation; the first view is graph + Controls button + node/link count (`SKILL.md`; `scripts/rdf_infographic_harness.py`; `assets/templates/kg-explorer-reference.html`).
  - **Filter-after-link pruning.** The alternate D3 renderer filters nodes, filters links to surviving endpoints, builds an incident set, then removes visible orphan nodes (`scripts/rdf-to-kg-section.py`; `scripts/rdf-to-kg-section.ts`). This ordering is portable even though that renderer has other defects.
  - **Zoom isolation.** D3 zoom is attached only after an intentional SVG click and removed on outside click so wheel events do not hijack document scrolling (`SKILL.md`; `scripts/templates/kg_explorer.js`; `scripts/rdf-to-kg-section.py`).
  - **Sticky drag contract.** Drag fixes `fx/fy`; double-click releases the pin; `clickDistance(6)` distinguishes click-to-resolve from a drag (`SKILL.md`; correctly retained in `scripts/templates/kg_explorer.js`).
  - **Query-type result formats.** SELECT uses `text/x-html+tr`; DESCRIBE/CONSTRUCT use `text/x-html-nice-turtle`; live URLs encode the edited query (`scripts/rdf_infographic_harness.py`; `scripts/rdf_infographic_harness.ts`).
  - **Generator-level escaping rule.** SPARQL source must be HTML-escaped before insertion, and generated JS must contain real newlines rather than a displayed literal `\n`; the skill explicitly says to repair generators, not published artifacts (`SKILL.md`).
  - **Human- and machine-readable provenance.** The footer names source, companions, skills, environment, runtime, named graphs, resolver pattern, and extraction provenance; JSON-LD is supposed to mirror generation with `prov:wasGeneratedBy` (`SKILL.md`; `scripts/rdf_infographic_harness.py`).

- Full written gate map (the intended contract, not all mechanically enforced):
  - **Source/model gates** (`SKILL.md`):
    1. Parse or generate RDF before rendering narrative.
    2. Derive every modeled narrative fact from RDF.
    3. Match FAQ question and answer entities/text exactly.
    4. Wrap glossary terms in `schema:DefinedTermSet` using `schema:hasDefinedTerm`; link set from article with `schema:hasPart`; backlink each term with `schema:inDefinedTermSet`.
    5. Link a `schema:HowTo` from the article and enumerate every step through `schema:step`.
    6. Give every `schema:HowToStep` an absolute, resolver-constructible IRI and preserve `schema:name`, `schema:text`, and `schema:position`.
    7. Apply Person, SoftwareApplication, Country, DefinedTerm, and `owl:sameAs` authority rules without fabricated authority IRIs.
    8. Derive graph data from the companion RDF; do not hand-author it.
    9. Keep every represented node ID and predicate ID as an RDF IRI.
  - **Artifact/document gates** (`SKILL.md`):
    10. Use one shared filename stem for HTML/Markdown/RDF.
    11. Keep companion links relative and ensure targets exist.
    12. Advertise RDF with `rel="related"` and Markdown with `rel="alternate"`.
    13. Embed JSON-LD with `"@language": "en"`, relative companion `@id`s, Markdown encoding metadata, and generation provenance.
    14. Preserve Markdown narrative/media/query parity and resolver-backed semantic links.
    15. Give every `h1`–`h4` a stable, unique lowercase-kebab ID with native fragment resolution.
    16. Open every non-fragment HTML anchor in a new tab with `rel="noopener noreferrer"`; keep fragments same-tab.
  - **Navigation gates** (`SKILL.md`):
    17. Provide one floating section-navigation panel.
    18. Start as a compact closed header bar.
    19. Support drag, expanded-only native resize, collapse/expand, and a page-level theme control in the always-visible header.
    20. Route manual hide and inactivity fade through one `fadeOut()` and one restore marker.
    21. Make manual hide sticky via `manuallyHidden` and `stopPropagation()`.
    22. Persist expanded geometry only, under a page-specific versioned key.
    23. Reject NaN, negative, offscreen, corrupt, or cross-page localStorage state.
  - **Theme/CSS gates** (`SKILL.md`):
    24. Provide equivalent explicit `html[data-theme="dark"]` and system `prefers-color-scheme: dark` token values in separate blocks.
    25. Put colors, backgrounds, borders, gradients, and shadows behind variables.
    26. Keep accent roles stable: blue entity links, purple counters/icons, green success.
    27. Avoid competing retrofit blocks and `!important` except the documented body-background exception.
    28. Keep settings controls bounded at desktop, tablet, and mobile widths.
  - **KG Explorer gates** (`SKILL.md`):
    29. Start the controls tray closed; show graph + Controls + counts first.
    30. Provide explicit Basic/Advanced and Core/Full modes.
    31. Hide Settings and all Advanced-only controls in Basic mode.
    32. Provide multi-select Classes/Properties/Instances filtering with selected state and `aria-pressed`.
    33. Provide search, visible node/link counts, legend/state feedback, and no blank graph after filtering.
    34. Provide fullscreen, center, settings, visible close, and predictable focus return.
    35. Wire charge, link-distance, and physics controls to the live simulation.
    36. Provide predicate label mode, dynamic predicate filters, and All/None operations over the same active set.
    37. Provide dynamic node-type chips and bulk select/deselect.
    38. Provide literal filtering and resolver preference, including custom pattern where supported.
    39. Permit only directed subject→object or hidden arrows; forbid dual arrows and `marker-start`.
    40. Offset edge endpoints so arrowheads remain outside target circles.
    41. Fill the graph pane and derive width/height/viewBox from its rendered container.
    42. Use resolver-backed SVG `<a>` anchors for node and edge labels with `href`, `xlink:href`, target/rel, `data-iri`, and `data-resolver-href`.
    43. Put node labels below circles at roughly `r + 11`, add a background-color stroke halo, and truncate around 15 characters.
    44. Use sticky drag, click-distance guard, and double-click unpin.
    45. Activate zoom only on graph focus; release it outside and expose `kg-active` feedback.
    46. Keep the graph itself as the resolver surface; omit a redundant resolver-card grid.
    47. Prove zero global orphan nodes and zero default-rendered orphan nodes after filter/density emulation.
    48. Grep post-write output for the required control IDs/functions and block delivery on any absent item.
  - **SPARQL gates** (`SKILL.md`):
    49. Render RDF query entities as resolver-linked accordions and preserve query text verbatim except safe escaping.
    50. Show endpoint/service and correctly encoded live links; never ship `example.org` placeholders.
    51. Mirror queries in Markdown with resolver-linked headings and fenced `sparql` blocks.
    52. Provide a real footer workbench: named graph, recipe, editable textarea, format display, live link, refresh, and copy.
    53. Use query-type-specific result formats.
    54. Use the canonical SAMPLE-based entity-type summary, not bare `SELECT *`.
    55. Keep document entity IRIs distinct from hosted named-graph IRIs.
    56. Reject double-escaped displayed newlines in generated query functions.
    57. Reject raw `<IRI>` text inside HTML query blocks; require HTML escaping.
  - **Attribution/delivery gates** (`SKILL.md`):
    58. Attribute source material, companion files, skills, generation environment, runtime, named graphs, resolver pattern, and extraction provenance.
    59. Link real product/tool labels to canonical URLs rather than resolver-wrapped local aliases or generic “Visit” labels.
    60. Parse HTML and JavaScript without errors.
    61. Parse RDF and run the external KG-compliance audit.
    62. Audit resolver encoding and anchor target policy.
    63. Validate navigation behavior, theme behavior, output paths, graph rendering, and graph integrity.
    64. Deliver only at zero failures.
    65. Repair the generator/template that caused a failure instead of hand-patching only the final HTML.

- What `validate-harness-contract` actually enforces:
  - The Python validator checks POSH/JSON-LD marker strings; recognizable nav/theme/KG mode/control strings; single-direction arrow prohibitions; presence of D3/drag/resolver patterns; SPARQL workbench strings and both format labels; all eight attribution labels; three fixed platform URLs; anchor target policy; parseability/non-emptiness of a narrowly matched JSON `kgData`; missing link endpoints; edge-anchor patterns; SPARQL button; node-click resolver call; and optional RDF parsing (`scripts/validate-harness-contract.py`).
  - Its so-called orphan check detects links whose endpoints are missing, not nodes with zero incident links; it does not emulate the default rendered state (`scripts/validate-harness-contract.py`).
  - It does not parse HTML, parse JavaScript, execute UI behavior, compare RDF to narrative, validate Markdown parity, check referenced-file existence, verify heading IDs, compare dark tokens, audit hardcoded colors, confirm the canonical SAMPLE query, or run the documented SPARQL escape greps (`scripts/validate-harness-contract.py`; contract claims in `SKILL.md`).
  - Most checks are broad substring alternatives such as any `display:none`, any `literal`, or any `arrow`; unrelated text can satisfy them (`scripts/validate-harness-contract.py`).
  - The TypeScript validator only checks RDF files for existence/non-emptiness despite claiming near-identical behavior; Python actually invokes rdflib (`scripts/validate-harness-contract.ts`; `scripts/validate-harness-contract.py`).
  - The TypeScript and Python gates also diverge on accepted SPARQL button/recipe patterns and regex windows/case sensitivity, so pass/fail is language-dependent (`scripts/validate-harness-contract.ts`; `scripts/validate-harness-contract.py`).

- Weaknesses / smells:
  - **Contract-to-generator gap:** the shipped generator cannot satisfy its own strict contract. The base template has duplicate `id="kg-explorer"`, no manual-hide/inactivity path, no localStorage recovery, no expanded-only resize, no Markdown companion, and no full provenance JSON-LD (`scripts/templates/base_template.html`).
  - **D3 anchor failure:** the primary renderer attaches click handlers to `<g>`/`<text>` but does not create the required resolver-backed SVG anchors or their full attributes (`scripts/templates/kg_explorer.js`).
  - **Label geometry failure:** primary node labels use `dx=15, dy=4` instead of the documented below-circle halo pattern (`scripts/templates/kg_explorer.js`; `SKILL.md`).
  - **Core-view orphan risk:** the primary renderer selects the top 30 nodes, then retains only links internal to that set, but never prunes core nodes that lost all links (`scripts/templates/kg_explorer.js`).
  - **Incomplete RDF projection:** current parsers skip blank nodes and literal edges/nodes, so “all triples become links,” literal filtering, and complete RDF fidelity are false (`scripts/rdf_parser.py`; `scripts/rdf_parser.ts`; `SKILL.md`).
  - **Narrative mismatch:** FAQ extraction discards answer IRIs; glossary extraction looks for `schema:hasPart` rather than the contract’s `schema:hasDefinedTerm`; HowTo extraction ignores `schema:text` and `schema:position` and does not validate absolute step IRIs (`scripts/rdf_parser.py`; `scripts/rdf_parser.ts`; `SKILL.md`).
  - **Orphans are warnings:** both assemblers print orphan warnings and continue to write output before validation; failed output remains on disk (`scripts/html_assembler.py`; `scripts/html_assembler.ts`).
  - **Pairing is not generated:** CLI accepts arbitrary RDF/output names, does not enforce a shared stem, emits only HTML, and writes minimal JSON-LD with `sameAs` as a string instead of the documented `relatedLink`/relative `@id` shape (`scripts/generate_infographic.py`; `scripts/html_assembler.py`).
  - **Unsafe/raw template channels:** Python disables Jinja autoescape, and title/tagline/meta HTML/context values are inserted raw; TypeScript similarly treats most `{{ var }}` substitutions as raw (`scripts/html_assembler.py`; `scripts/html_assembler.ts`; `scripts/templates/base_template.html`).
  - **SPARQL drift:** the primary template always uses SELECT’s result format even if the edited query becomes DESCRIBE/CONSTRUCT, and its recipe set includes bare triple queries rather than the canonical SAMPLE summary (`scripts/templates/base_template.html`; `scripts/html_assembler.py`).
  - **Alternate D3 Python runtime bug:** `resolvePredicateIRI` is called but never defined; clicking an edge raises a JavaScript `ReferenceError` (`scripts/rdf-to-kg-section.py`).
  - **Alternate D3 TypeScript semantic bug:** its `resolvePredicateIRI` simply returns a display label, so resolver calls receive labels rather than predicate IRIs; its partial predicate `<a>` still lacks `href`, `xlink:href`, target/rel, and `data-iri` (`scripts/rdf-to-kg-section.ts`).
  - **Alternate D3 behavior drift:** controls start open, Settings is visible in Basic, node labels sit inside circles, and drag-end clears `fx/fy`, contradicting closed-default, below-circle, and sticky-drag rules (`scripts/rdf-to-kg-section.py`; `scripts/rdf-to-kg-section.ts`; `SKILL.md`).
  - **Semantic loss by design:** the alternate extractor suppresses `rdf:type`, subclass/domain/range, sameAs, and seeAlso edges and drops literals/blank nodes, despite the contract requiring class/property nodes and all RDF relationships (`scripts/rdf-to-kg-section.py`; `scripts/rdf-to-kg-section.ts`; `SKILL.md`).
  - **Python/TypeScript are not parity ports:** the Python alternate renderer has no predicate anchor and no predicate resolver function; TypeScript adds a partial anchor and a no-op resolver (`scripts/rdf-to-kg-section.py`; `scripts/rdf-to-kg-section.ts`).
  - **Legacy validator is actively misleading:** it rewards a pin marker prohibited by the current contract and considers warnings non-blocking. It scored sampled Gartner/Semantic artifacts 89%/90% while the strict validator reported 21/31 failures (`scripts/validate-infographic.py`; `scripts/validate-harness-contract.py`; sampled assets below).
  - **Sample references are not golden tests:** strict validation produced 35 failures for `assets/templates/kg-explorer-reference.html`, 21 for `assets/templates/gartner-da-london-2026-claude-sonnet4-dashboard.html`, and 31 for `assets/templates/semantic-medallion-editorial-technical.html` when run without absent companions (`scripts/validate-harness-contract.py`).
  - **Showcase link discipline is stale:** static audit found 67 non-fragment anchors without `_blank` plus 9 fragments wrongly using `_blank` in the Gartner sample, and 92 non-fragment anchors without `_blank` in the Semantic Medallion sample (`assets/templates/gartner-da-london-2026-claude-sonnet4-dashboard.html`; `assets/templates/semantic-medallion-editorial-technical.html`).
  - **Showcase D3 is mixed quality:** Gartner’s Basic drag sticks and its labels use roughly `radius+11`, but Advanced drag clears pins; neither sampled full artifact provides the required complete resolver-backed SVG anchor surface (`assets/templates/gartner-da-london-2026-claude-sonnet4-dashboard.html`; `assets/templates/semantic-medallion-editorial-technical.html`).
  - **Core asset is corrupt/stale:** `assets/html-template.html` contains one complete HTML document ending at line 728 followed by a second CSS/HTML/JS document through line 1184; it also implements the prohibited separate pin-marker model.
  - **Documentation drift:** `references/technical-guide.md` teaches a close button, pin marker, 10-second fade, wrong `describe/?uri=` parameter, and unsafe `innerHTML` linkification, all superseded by `SKILL.md`.
  - **Naive parsing reference:** `references/rdf-to-d3-parser.md` uses regex splitting that cannot correctly parse general Turtle while simultaneously claiming all triples are represented.
  - **Missing promised files:** `SKILL.md` references absent `scripts/validate-kg-compliance.sh`, `scripts/validate-infographic.js`, `assets/css-framework.css`, `assets/js-utilities.js`, `scripts/index.js`, `templates/corpus-index.css`, and `templates/corpus-index.js`.
  - **Non-self-contained memory dependency:** the SPARQL escape rule points to `preferences.ttl` Step 57 and `howto/sparql-html-escape-gate.ttl`, which are not inside this skill; this is a cross-reference into the already-mined agent RDF memory system (`SKILL.md`).
  - **Portability smell:** vendored `scripts/node_modules/@esbuild/darwin-arm64/bin/esbuild` is a Mach-O arm64 binary, so the checked-in dependency tree is platform-specific (`scripts/node_modules/@esbuild/darwin-arm64/`).

## Cross-cutting patterns in this lane

- The best idea is **contract-first artifact generation**: treat a generated page as a multi-file protocol with invariants, not as a blob of HTML (`SKILL.md`).
- The strongest requirements are regression notes expressed as state-machine invariants: manual-hide stickiness, stale storage recovery, zoom capture/release, sticky drag, edge direction, and SPARQL escaping (`SKILL.md`).
- The repository uses **closed-by-default progressive disclosure** for expert controls; this is good browser/desktop QA policy because initial rendering remains inspectable before complex state is introduced (`scripts/rdf_infographic_harness.py`; `assets/templates/kg-explorer-reference.html`).
- **Semantic-role equality** is more valuable than generic link presence: exact RDF type + exact entity IRI + exact displayed text is the intended cross-artifact join (`SKILL.md`).
- **Provenance is both content and build metadata**: source entities, generation agents/skills, runtime, named graph, and extraction process are expected to appear in human footer and JSON-LD/PROV-O form (`SKILL.md`; `scripts/rdf_infographic_harness.py`).
- The skill repeatedly duplicates the same contract in prose, Python, TypeScript, templates, references, and showcases; without a single schema-derived gate registry, those copies drift (`SKILL.md`; `scripts/`; `references/`; `assets/templates/`).
- Regex/substring validators are useful as cheap smoke tests, but cannot substantiate the advertised “zero-failure” behavior contract (`scripts/validate-harness-contract.py`; `scripts/validate-infographic.py`).
- Python/TypeScript parity is asserted in file headers rather than proven by shared fixtures or differential tests, and concrete behavior has diverged (`scripts/validate-harness-contract.ts`; `scripts/rdf-to-kg-section.ts`).
- The already-mined `agent-rdf-memory/` system is only indirectly coupled: this skill cites memory-held escape guidance but does not expose a typed memory interface or validate that dependency (`SKILL.md`).

## Steal-worthy for beep-effect (ranked, concrete — name the mechanism and the port)

1. **ArtifactSet contract → Effect Schema aggregate.** Model `ArtifactSet` with branded `Stem`, `RelativePath`, `EntityIri`, `ResolverUrl`, `NamedGraphIri`, HTML/MD/RDF members, and provenance. Decode once before generation and again before delivery; express missing/mismatched members as tagged errors. Port the shape from `SKILL.md`, not the current assemblers.
2. **Gate registry with evidence → Effect validation pipeline.** Replace scattered prose/regexes with `Gate` services (`id`, severity, applicability predicate, typed evidence, remediation owner) composed through Effect. Emit a machine-readable verdict that distinguishes parse, static semantic, runtime interaction, visual, and provenance gates. The seed list is the 65-item map in `SKILL.md`; avoid copying `scripts/validate-harness-contract.py` literally.
3. **RDF projection parity → schema-first render AST.** Parse RDF into typed `Faq`, `Answer`, `DefinedTermSet`, `HowTo`, `HowToStep`, `SoftwareSourceCode`, `Person`, and `Organization` models, then render HTML and Markdown from the same immutable AST. This directly fixes the drift visible in `scripts/rdf_parser.py` and `scripts/html_assembler.py`.
4. **GraphIntegrity service → exact pre/post-filter proof.** Build branded Node/Edge IRIs, verify all endpoints, compute incident sets, emulate default filters/density, and reject visible orphans. Preserve the filter-links-then-prune-nodes ordering from `scripts/rdf-to-kg-section.ts`, but retain all RDF semantics unless an explicit projection policy records omissions.
5. **Resolver codec → single-encoding boundary type.** Centralize IRI-to-resolver conversion in a service that takes a decoded `EntityIri` and returns a branded `ResolverHref`; prohibit accepting already encoded input. Add round-trip and `%23`/`%2523` property tests based on `SKILL.md` and `scripts/rdf_infographic_harness.ts`.
6. **UI interaction contracts → reducer/state-machine tests.** Represent nav visibility, manual hide, inactivity fade, collapsed/expanded geometry, KG mode, settings visibility, zoom armed state, pinned nodes, and filter sets as explicit transitions. Use browser automation to prove invariants derived from `SKILL.md`, rather than grepping function names.
7. **SPARQL Recipe ADT → typed formatter/escaper.** Use a discriminated query kind (`Select | Describe | Construct`) to derive result MIME, live URL, HTML-escaped display, and Markdown fence from one source. Port `sparql_result_format`/`sparql_live_url` from `scripts/rdf_infographic_harness.py`, then add AST/query-parser validation and escape regression fixtures.
8. **PROV-flavored BuildReceipt → fleet handoff contract.** Record source hashes/IRIs, model/client, skills, generator version, named graphs, extraction transforms, gates, and evidence URIs as a typed receipt. Map it to JSON-LD/PROV-O for legal/patent KG ingestion and to compact JSON for Claude/Codex/Grok A2A handoffs. Seed fields from `SKILL.md` and `scripts/rdf_infographic_harness.py`.
9. **Template capability manifest → selection without coupling.** Give each visual template declared capabilities and required adapters; choose by content/audience, then require the same artifact/gate contract. This preserves the loose-coupling rule in `references/template-options.md` while making compatibility machine-checkable.
10. **Generator-owned remediation → error routing.** Attach every failed gate to the generator stage that owns it (RDF extraction, render AST, HTML serializer, D3 adapter, Markdown serializer, provenance builder). Preserve the “fix generator, not output” rule from `SKILL.md` as an Effect error-routing policy.

## Exploration-packet leads (open questions worth a deeper research phase)

- Can one Effect Schema describe both the source artifact manifest and the evidence/verdict JSON, so each fleet agent exchanges the same typed handoff rather than prose checklists? Seed from `SKILL.md` and `scripts/validate-harness-contract.py`.
- Which checks belong to parse5/HTML validation, Acorn or a JS parser, a CSS parser, RDF/SHACL, graph algorithms, and Playwright browser tests? The current regex gate mixes all layers (`scripts/validate-harness-contract.py`).
- Should RDF-to-narrative projection use SHACL shapes, Effect Schemas, SPARQL CONSTRUCTs, or a hybrid so `schema:position`, language tags, blank nodes, and list order remain deterministic (`scripts/rdf_parser.py`)?
- How should a graph projection declare intentionally omitted triples (literals, provenance internals, schema scaffolding) without falsely claiming “all triples represented” (`scripts/rdf-to-kg-section.py`; `references/rdf-to-d3-parser.md`)?
- Can browser QA capture evidence for drag pinning, outside-click zoom release, stale localStorage recovery, collapsed defaults, focus restoration, dark-token equivalence, and responsive settings bounds (`SKILL.md`)?
- What is the right A2A message shape for “artifact generated,” “gate failed,” “repair requested,” and “evidence accepted” across Claude Code, Codex CLI, and Grok? The BuildReceipt fields in `SKILL.md` are a good starting payload.
- Should provenance record only generation agents, or every transform/activity from source retrieval through RDF projection, render, validation, and publication for legal/patent KG traceability (`SKILL.md`; `assets/templates/semantic-medallion-editorial-technical.html`)?
- Can the `agent-rdf-memory/` cross-reference become an optional `Context.Service` that supplies regression knowledge while the skill remains independently executable (`SKILL.md`)?
- Would property-based tests over arbitrary IRIs, labels, query text, blank nodes, language tags, and malformed storage expose the exact regressions now buried in prose (`SKILL.md`; `scripts/rdf_parser.ts`)?
- How should template capabilities and validator versions be content-addressed so old showcase artifacts are evaluated against the contract version they were built for (`references/template-options.md`; `assets/templates/`)?
- Is a single HTML file still the right deployment boundary when CSP, offline D3, provenance integrity, and large graphs matter (`scripts/templates/base_template.html`)?
- Can generated graph/node anchors remain accessible without relying on `window.open`, including keyboard traversal and SVG `<a>` semantics (`scripts/templates/kg_explorer.js`)?

## Dead ends (what to NOT spend time on, and why)

- Do not port `scripts/validate-infographic.py` or `scripts/validate-infographic.ts`; they are keyword-counting aesthetic linters, reward a now-forbidden pin marker, and let nearly all substantive failures remain warnings.
- Do not treat `scripts/validate-harness-contract.py` as the finished gate architecture; retain its checklist ideas, but replace broad substring matching with typed parsers, semantic comparisons, graph proofs, and browser evidence.
- Do not use `assets/html-template.html`; it is two documents concatenated after an early `</html>` and implements superseded navigation.
- Do not use `references/technical-guide.md` as current navigation or resolver guidance; it conflicts with `SKILL.md` on close/pin behavior, timeout, and resolver parameter name.
- Do not port the regex Turtle parser in `references/rdf-to-d3-parser.md`; it cannot cover valid Turtle syntax, blank nodes, lists, multiline literals, prefixes, or general IRIs.
- Do not use the three sampled assets as golden fixtures without version labels. All fail the strict validator (`assets/templates/kg-explorer-reference.html`; `assets/templates/gartner-da-london-2026-claude-sonnet4-dashboard.html`; `assets/templates/semantic-medallion-editorial-technical.html`).
- Do not port both Python and TypeScript stacks. Select one Effect-native implementation and generate any secondary bindings/fixtures from shared schemas; asserted parity has already drifted (`scripts/*.py`; `scripts/*.ts`).
- Do not vendor `scripts/node_modules/`; it dominates the skill size and includes platform-specific esbuild payloads. Rebuild dependencies from `scripts/package.json`/lockfile for the target platform.
- Do not build against the absent `validate-kg-compliance.sh`, index generator, CSS framework, or JS utilities until their intended contracts are recovered; they are documentation ghosts referenced only by `SKILL.md`.
- Do not transplant URIBurner-, DBpedia-, LinkedIn-, or hosted-DAV-specific identity policy as universal domain law. Make resolver, authority, and publication topology injectable services while retaining the useful priority/validation shape from `SKILL.md`.
- Do not promise “zero failure” from static checks alone. Runtime interactions, visual layout, focus behavior, and theme equivalence require browser execution and evidence (`SKILL.md`; `scripts/validate-harness-contract.py`).
