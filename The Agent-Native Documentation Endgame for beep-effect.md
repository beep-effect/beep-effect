# The Agent-Native Documentation Endgame for `beep-effect`

## Executive conclusion

There is no single “ultimate” agent-readable file format. The strongest architecture is a **polyglot publication system with one identity model and many deterministic projections**:

**TypeScript/source + authored Markdown + ontology → normalized knowledge IR → HTML + Markdown + linked data + indexes + MCP + discovery surfaces.**

For `beep-effect`, I would make the stack:

| Concern | Preferred representation |
|---|---|
| Human web experience and browser agents | **Semantic HTML** |
| Clean text for LLMs, copy/paste, Git, local agents | **CommonMark-compatible Markdown/GFM** |
| Per-page/per-entity machine semantics | **JSON-LD** |
| T-box ontology authoring | **Turtle + OWL/RDFS/SKOS** |
| Whole graph / provenance export | **TriG or N-Quads** |
| Graph validation | **SHACL** |
| Graph querying | **SPARQL**, plus simpler purpose-built query APIs |
| Local full-text/queryable bundle | **SQLite + FTS5** |
| Dynamic agent interface | **MCP 2026-07-28**, designed stateless |
| HTTP API description | **OpenAPI 3.2.x** |
| Domain-level API discovery | **`/.well-known/api-catalog`** |
| LLM-oriented site map | **`/llms.txt`**, kept short and curated |
| Search-engine discovery | **`/sitemap.xml`** |
| Crawler policy | **`/robots.txt`** |
| Coding-agent repository instructions | **`AGENTS.md`** |
| Markdown compiler representation | **mdast, internally only** |
| Semantic retrieval | **FTS + graph first; embeddings as a derived optional index** |
| Training-oriented release artifact | **Markdown/source corpus + JSONL metadata + graph/provenance exports** |

That division follows the strengths of the standards rather than forcing one representation to solve every problem. HTML has first-class document structure; Markdown has a registered `text/markdown` media type and excellent portability; JSON-LD is specifically designed to express Linked Data in JSON; OWL gives a formally defined ontology language; SKOS is designed for knowledge-organization systems; SHACL validates RDF graphs; SPARQL queries RDF; and MCP now has a stateless protocol core suitable for horizontally scalable query services. citeturn22view0turn4view2turn3view0turn12search0turn14search0turn14search1turn12search3turn18search6

The key idea is:

> **Do not choose between Markdown, semantic HTML, JSON-LD, RDF, and MCP. Give them separate jobs and generate them from the same knowledge model.**

That is also unusually well aligned with the direction already captured in `knowledge-endgame`: your repository notes describe “practice-as-repo with ontologies as the type system,” “dereferenceable know-how,” nested knowledge flywheels, and explicitly imagine a projection of `beep-effect` APIs/docs with linked data, machine-readable semantics, AEO/SEO/GEO, and a training-data flywheel. fileciteturn1file0L1-L13 fileciteturn4file0L8-L15

The architecture I would aim for is therefore:

```text
                      AUTHORITATIVE SUBSTRATE
 ┌───────────────────────────────────────────────────────────┐
 │ TypeScript source / TSDoc                                 │
 │ authored CommonMark/GFM docs                              │
 │ ontology.ttl + shapes.ttl                                 │
 │ examples / tests / release metadata                       │
 └──────────────────────────────┬────────────────────────────┘
                                │
                         deterministic build
                                │
                ┌───────────────▼────────────────┐
                │      KNOWLEDGE COMPILER       │
                │                               │
                │ TS AST + mdast + docgen       │
                │ stable IDs / IRIs              │
                │ symbols / sections / examples │
                │ T-box + A-box                 │
                │ provenance / backlinks        │
                └───────────────┬────────────────┘
                                │
     ┌──────────────────────────┼───────────────────────────┐
     │                          │                           │
     ▼                          ▼                           ▼
 WEB PROJECTIONS          QUERY ARTIFACTS             AGENT INTERFACES
 HTML                     RDF dataset                 MCP
 .md twins                SQLite/FTS5                 OpenAPI
 JSON-LD                  search indexes              SPARQL
 Turtle                    optional embeddings         resource URIs
 sitemap.xml
 llms.txt
 api-catalog
```

The major architectural rule is **generate, do not hand-maintain, the duplication**. HTML, Markdown, JSON-LD, backlinks, source links, taxonomy pages, MCP resources, and search indexes should all be views of the same build graph. That is what keeps an ambitious semantic system from becoming five mutually inconsistent documentation systems.

## The format stack and what each format should actually do

The most important distinction is between **authoring formats, semantic representations, delivery formats, indexes, and protocols**. Several technologies in your list are excellent, but they are excellent at completely different layers.

### Semantic HTML should be the primary public document projection

For browser agents and humans, semantic HTML is still the highest-leverage surface. The current HTML Living Standard gives explicit semantics to `article`, `section`, `nav`, headings, `header`, `footer`, and related structures; for example, `article` identifies self-contained distributable content, `section` represents thematic sections, and `nav` identifies major navigation blocks. citeturn22view0

This matters even more for agents that operate through browser/computer-use tooling. OpenAI's current publisher/developer guidance says its browser agent uses ARIA roles, labels, and states to understand page structure and interactive controls and specifically recommends accessible semantics for buttons, menus, forms, and other controls. WAI's ARIA Authoring Practices likewise exists to expose UI semantics programmatically. citeturn13view2turn21search1

So a `beep-effect` API page should not merely *look* structured. Its DOM should actually resemble:

```html
<main>
  <article>
    <header>...</header>

    <nav aria-label="On this page">...</nav>

    <section id="signature">...</section>
    <section id="description">...</section>
    <section id="examples">...</section>
    <section id="related">...</section>
    <section id="referenced-by">...</section>

    <footer>...</footer>
  </article>
</main>
```

For your FOLIO-like explorer, this means the visual graph should **not be the sole representation**. Any graph rendered with canvas/SVG should have an equivalent DOM-accessible tree/list of nodes, edges, parents, children, and actions. A browser agent should be able to navigate “Asset Type → Financial Assets” through links or tree controls without having to infer coordinates from pixels. WAI provides patterns for accessible tree/treegrid-style widgets, while OpenAI explicitly identifies accessible labels and roles as useful to browser agents. citeturn21search33turn13view2

### Markdown should be the primary text projection

For prose, examples, local search, copying, Git, and context injection, I would standardize on a **conservative CommonMark-compatible GFM dialect**. CommonMark provides a precise specification, and Markdown has the registered `text/markdown` media type. citeturn22view1turn4view2

Every meaningful documentation page should therefore have an explicit Markdown twin:

```text
/docs/getting-started
/docs/getting-started.md

/docs/v4/api/schema/Struct
/docs/v4/api/schema/Struct.md

/glossary/effect
/glossary/effect.md
```

The `.md` form should contain the **actual useful content**, not rendered-site chrome and not a lossy HTML-to-Markdown scrape.

This is the Better Auth-style interaction pattern I would strongly copy: a human sees a polished page but can immediately **View Markdown**, **Copy Markdown**, or hand the `.md` URI to an agent.

Markdown also makes `beep-effect` clone-friendly: an agent operating without a web browser can `find`, `grep`, parse headings, read examples, and traverse ordinary links with almost no infrastructure.

### mdast belongs inside the compiler, not on the public wire

This is an important distinction in your original list.

`mdast` is explicitly a specification for representing Markdown as an **abstract syntax tree**; its own project describes it as extending `unist` and representing CommonMark, GFM, and other Markdown flavors as typed syntax-tree nodes. fileciteturn2file0L1-L2

That makes mdast ideal for your build pipeline:

```text
Markdown
   ↓ parse
mdast
   ├── extract heading hierarchy
   ├── assign stable section IDs
   ├── collect links
   ├── build backlinks
   ├── identify code examples
   ├── attach ontology annotations
   ├── chunk by semantic section
   └── render HTML / clean Markdown / search records
```

But I would **not** make mdast an agent-facing publication format. Agents understand Markdown naturally; forcing consumers to reconstruct prose from an AST adds tokens and implementation complexity without improving interoperability.

So:

**CommonMark/GFM = public interchange.  
mdast = internal compiler IR.**

### JSON-LD should be the semantic per-resource API

JSON-LD 1.1 is a W3C Recommendation designed for Linked Data in JSON. It provides IRIs, contexts, typed values, relationships, and a mapping to the RDF data model, and it can be embedded in HTML. citeturn3view0

That makes it an excellent answer to:

> “Give me this exact API symbol/concept/module/page as machine-readable structured knowledge.”

For example, conceptually:

```json
{
  "@context": "/ontology/context.jsonld",
  "@id": "/id/api/v4/Schema/Struct",
  "@type": "beep:ApiSymbol",
  "name": "Struct",
  "kind": "function",
  "definedIn": {
    "@id": "/id/module/v4/effect/Schema"
  },
  "relatedConcept": [
    { "@id": "/id/concept/schema" }
  ],
  "examples": [
    { "@id": "/docs/v4/api/schema/Struct#example-basic" }
  ],
  "source": {
    "@id": "/source/<commit>/packages/effect/src/Schema.ts#..."
  }
}
```

That is much more useful to graph-aware agents than trying to reverse-engineer an ontology from Markdown frontmatter.

I would embed a **small SEO-oriented schema.org JSON-LD block** in the HTML and expose the **full domain JSON-LD graph** as an alternate representation. Google recommends JSON-LD as a supported structured-data encoding and requires structured data to match the visible page content; its search guidance should therefore be treated as a presentation layer over your ontology, not as the ontology itself. citeturn11view1

### Turtle, TriG, and N-Quads are the semantic engineering formats

For your actual T-box, I would author the ontology in **Turtle**, not JSON-LD. JSON-LD is excellent for APIs and web developers; Turtle is generally a much more pleasant ontology-review format.

For bulk exports:

- Turtle for a single ontology or graph.
- TriG when named graphs and readable grouped datasets matter.
- N-Quads when you want a mechanically simple, streaming-friendly dataset export.
- JSON-LD for individual entities and web integrations.
- RDF/XML only as a compatibility projection where a consumer genuinely needs it.

RDF defines graph data around subject-predicate-object statements and RDF datasets around default and named graphs. As of October 2026, RDF 1.2 is progressing through the W3C process while RDF 1.1 remains the established Recommendation baseline, so I would design the model to be RDF 1.2-compatible without requiring 1.2-only semantics for core functionality yet. citeturn4view0

That means your FOLIO-inspired:

```text
/id/<entity>
/id/<entity>.jsonld
/id/<entity>.ttl
/id/<entity>.md
```

is exactly the right *family* of idea.

### SQLite should be the operational local agent format

For a local “download once, query everything” artifact, I would choose **SQLite**, not RDF serialization alone and not a vector database.

SQLite's FTS5 extension provides built-in full-text indexes, phrase search, prefix search, proximity search, column filtering, ranking, snippets, and extensibility. citeturn17search6

A release artifact such as:

```text
beep-knowledge-v4.sqlite
```

could contain:

```text
documents
sections
packages
modules
symbols
concepts
aliases
examples
edges
backlinks
source_locations
provenance
releases
fts_documents
embeddings_optional
```

That gives a local coding agent one portable read-only artifact that can answer:

```text
search "Schema.Struct"
filter package = @effect/schema
filter kind = Function
find examples
find callers
find related concepts
find backlinks
find source
walk graph depth 2
```

without starting a graph database or hitting a remote service.

I would still publish the RDF exports because SQLite is an **operational index**, not your semantic interchange standard.

### `llms.txt` is useful, but it is a guidepost rather than the foundation

The official `llms.txt` site still describes the format as a **proposal** for a short Markdown file containing background information, guidance, and links to more detailed Markdown resources. citeturn19view3

That makes it valuable, but its proper role is:

> **A curated table of contents and orientation document for agents.**

Not:

> “A dump of my entire website into one 8 MB context file.”

The newer `llms.txt` work explicitly moves toward linking clean Markdown alternatives and allowing scoped `llms.txt` surfaces, while relying on standard Web Linking mechanisms for discovery. citeturn0search0turn0search4

For `beep-effect`, I would use several small scopes:

```text
/llms.txt
/docs/llms.txt
/docs/v4/llms.txt
/docs/v4/api/llms.txt
/ontology/llms.txt
/examples/llms.txt
```

The root one should say, essentially:

```markdown
# beep-effect

> Effect v4 mega-monorepo and knowledge substrate.

## Start here
- Architecture
- Effect v4 API
- Concepts and glossary
- Examples
- Ontology
- Query API
- MCP server

## Machine interfaces
- API catalog
- OpenAPI
- MCP
- JSON-LD graph
- bulk dataset

## Source
- repository
- contribution guide
```

AI Hero is a particularly good real-world example of the layered model: its `llms.txt` points agents separately to `/.well-known/api-catalog`, a JSON discovery document, `sitemap.md`, `sitemap.xml`, clean `.md` twins, OpenAPI, and search/resource APIs instead of pretending `llms.txt` itself is the entire machine interface. citeturn19view1

## Identity, URLs, alternate representations, and provenance

The most important piece of the whole system is actually not the file formats. It is the **identity scheme**.

If the identity model is sound, you can add representations forever. If the identity model is sloppy, JSON-LD and OWL merely make the sloppiness machine-readable.

### Give every meaningful thing a stable IRI

I would distinguish at least:

```text
/id/package/...
/id/module/...
/id/symbol/...
/id/concept/...
/id/example/...
/id/guide/...
/id/release/...
```

and make API identities version-aware:

```text
/id/symbol/v4/effect/Schema/Struct
```

A page URL and a semantic identity do not have to be the same route, although they may resolve to one another.

A useful split is:

```text
/docs/v4/api/schema/Struct       human documentation page
/id/symbol/v4/effect/Schema/Struct   semantic entity identity
```

The documentation page *documents* the symbol; the symbol is not ontologically identical to the HTML document describing it.

That distinction becomes extremely useful once you attach examples, source files, commits, releases, concepts, discussions, and other representations.

### Use explicit representation URLs and content negotiation

HTTP defines representations and content negotiation, including the `Accept` request field and `Vary` response field. Web Linking gives a standardized mechanism for declaring relationships between resources through HTML `<link>` elements or HTTP `Link` headers. citeturn15view0turn22view3

I would support **both** mechanisms:

```text
/id/symbol/v4/...              → useful HTML by default
/id/symbol/v4/....md           → Markdown
/id/symbol/v4/....jsonld       → JSON-LD
/id/symbol/v4/....ttl          → Turtle
```

and also honor:

```http
Accept: text/markdown
Accept: application/ld+json
Accept: text/turtle
```

for clients that know how to negotiate.

Explicit suffixes are worth keeping even when content negotiation exists: they are easy to paste into prompts, easy to cache, easy to inspect in a browser, and extremely convenient for simple agents.

Advertise the relationships from the HTML and headers:

```http
Link: </docs/.../Struct.md>; rel="alternate"; type="text/markdown"
Link: </id/.../Struct.jsonld>; rel="alternate"; type="application/ld+json"
Link: </llms.txt>; rel="describedby"; type="text/markdown"
```

The current `llms.txt` work specifically embraces standard alternate/described-by link relations for discovering the Markdown representation and the applicable `llms.txt`; the relation infrastructure itself comes from the IETF Web Linking standard. citeturn0search0turn22view3

### Make source provenance first-class

Every generated API entity should retain:

```text
repository
commit SHA
source path
symbol name / qualified name
start/end position
package
release/version
generator version
generated-at timestamp
```

The “view source” button should therefore point to an **immutable commit-pinned source location** for versioned documentation. You can separately provide a “latest source” link.

For RDF provenance, PROV-O is purpose-built for describing entities, activities, derivation, and provenance, and its W3C Recommendation is designed specifically to let provenance information be represented, exchanged, and integrated across systems. citeturn12search2turn12search18

That gives you statements along the lines of:

```text
DocumentationEntity
    wasDerivedFrom → SourceSymbol
    wasGeneratedBy → DocgenBuild
    specializationOf → ApiSymbol
```

and it enables agents to answer a much more valuable question than “what does the documentation claim?”:

> “Where did this assertion come from, in which release, and which source declaration produced it?”

### Keep document chunks addressable

Do not let your retrieval layer return anonymous chunks such as:

```json
{ "text": "...", "score": 0.81 }
```

Return:

```json
{
  "uri": "/docs/v4/api/schema/Struct#examples",
  "entity": "/id/symbol/v4/effect/Schema/Struct",
  "heading": "Examples",
  "kind": "ApiExample",
  "text": "...",
  "source": "...",
  "relationships": [...],
  "score": 0.81
}
```

Your mdast pipeline already gives you document structure. Use heading boundaries and API-symbol boundaries as the natural chunks instead of arbitrary token windows.

That makes retrieval results **navigable, citable, graph-connected knowledge objects** rather than vector-store fragments.

## Discovery, AEO/GEO/SEO, browser agents, and model training

This is the area where I would be most careful about separating real standards from AI-SEO folklore.

### `llms.txt` is not a magic GEO ranking file

Google's current guidance for AI Overviews and AI Mode is unusually explicit: its ordinary SEO fundamentals continue to apply, there are **no additional technical requirements** to appear in those AI features, and site owners do not need to create special AI text files or special schema markup solely for them. Pages still need to be crawlable, indexed, internally linked, useful, textual, and eligible to appear in Search. citeturn11view0

Therefore:

**Use `llms.txt` because it makes your site easier for agents to navigate. Do not build a business case around an unsupported assertion that `/llms.txt` boosts Google AI rankings.**

The two goals overlap but are not identical:

```text
SEO / Google AI visibility
    semantic crawlable HTML
    strong internal links
    useful content
    sitemap
    valid structured data
    canonicalization
    normal search quality signals

Direct agent usability
    everything above
    + clean .md twins
    + llms.txt
    + JSON-LD
    + discovery APIs
    + MCP
    + API catalog
```

Google's structured-data guidance also says the structured data should correspond to the visible page, and JSON-LD is one of its supported formats. That strongly favors **one knowledge model projected into both visible HTML and JSON-LD**, rather than an invisible “SEO ontology” that diverges from what readers see. citeturn11view1

### Search-engine discovery still means real internal links and sitemaps

Google describes a sitemap as a mechanism for telling search engines about important pages and their relationships so they can crawl a site more efficiently, while also noting that inclusion in a sitemap does not guarantee crawling or indexing. It further emphasizes that properly linked pages are often discoverable through normal navigation. citeturn21search6turn21search18

So I would put only **canonical web documents** into `sitemap.xml`, not every `.md`, `.jsonld`, `.ttl`, and SQLite representation.

For example:

```text
YES: /docs/v4/api/schema/Struct
YES: /glossary/schema
YES: /guides/schema-validation

NO:  /docs/v4/api/schema/Struct.md
NO:  /id/.../Struct.jsonld
NO:  /id/.../Struct.ttl
```

Those alternates are discoverable from the canonical resource through `Link` relationships.

### Use the standardized API catalog for machine service discovery

RFC 9727 standardizes `/.well-known/api-catalog` as a well-known URI and link relationship for discovering APIs associated with a domain. citeturn22view2

That should be your machine-level “what services exist here?” root.

It can point toward:

```text
OpenAPI description
documentation/search API
MCP endpoint
SPARQL endpoint
ontology
dataset manifest
human API documentation
```

This is substantially stronger than inventing `/agent-manifest-v7.json` as your sole discovery convention.

OpenAPI itself is expressly designed so humans and computers can discover and understand the capabilities of HTTP APIs without source-code inspection; the official OpenAPI site currently carries the 3.2 specification family. citeturn14search3turn14search9

### Search crawlers, AI-search crawlers, training crawlers, and user agents are distinct

OpenAI currently treats these as independent controls. `OAI-SearchBot` is used to surface sites in ChatGPT search; `GPTBot` crawls content that may be used for training generative foundation models; and `ChatGPT-User` is used for certain user-initiated retrieval and is not the crawler that controls search inclusion. OpenAI explicitly says a publisher can allow the search crawler while blocking the training crawler. citeturn13view0

Anthropic similarly documents separate `Claude-SearchBot`, `ClaudeBot`, and `Claude-User` roles for search indexing, potential training retrieval, and user-directed access. citeturn9search6

So if the explicit goal is:

> “Please discover my open-source project, recommend it, link to it, and—where your policies and dataset selection permit—consider its public corpus for training,”

then crawler policy should be **intentional rather than `User-agent: *` cargo cult**.

For an OSS project deliberately opting into both search and potential training, the conceptual policy is:

```text
Search crawlers          → allow
Training crawlers        → allow intentionally
User-directed retrieval  → accessible
ordinary search bots     → allow
canonical docs           → indexable
```

But this is only permission. OpenAI carefully says GPTBot crawls content that **may** be used in training; exposing your corpus cannot compel any lab to include it. citeturn13view0

### Optimize browser-agent UX as seriously as search-engine UX

Your interactive docs should be unusually good for computer-use agents:

- Real anchors rather than click handlers on arbitrary `<div>` elements.
- Native buttons, links, inputs, headings, and tables.
- Accessible names for icon-only controls.
- Useful ARIA state on expandable taxonomy nodes.
- Direct URLs for every selected concept/symbol.
- Search state reflected in the URL where sensible.
- No requirement to hover to discover critical information.
- No canvas-only ontology navigation.
- A “View Markdown” **link** as well as a “Copy Markdown” button.
- A source link that is visible and accessible.
- Explicit text labels such as “JSON-LD”, “Turtle”, “Source”, “Backlinks”.
- Server-rendered or otherwise immediately available primary documentation content.

Those recommendations follow the web's native semantic model and align directly with OpenAI's current statement that accessible ARIA semantics improve its browser agent's ability to interpret interactive pages. citeturn22view0turn13view2

### AEO/GEO should primarily be a content architecture strategy

The durable “answer optimization” opportunity is not a secret metadata file. It is making your knowledge unusually **easy to cite and difficult to misunderstand**.

An API page should answer, near the top:

```text
What is this?
When should I use it?
What package exports it?
What is its exact signature?
What are the common examples?
What concepts does it depend on?
What replaced/deprecated it?
Where is the source?
What references it?
```

A glossary page should provide:

```text
preferred label
one-sentence definition
full definition
aliases
broader/narrower concepts
related concepts
relevant API symbols
guides
examples
source/provenance
```

That is good human documentation, good retrieval data, good answer-engine material, and good ontology data simultaneously.

## The T-box/A-box knowledge graph and the FOLIO-style explorer

Your FOLIO screenshot is very close to the UI model I would recommend for the semantic layer:

![FOLIO Ontology Explorer reference supplied with the request](sandbox:/mnt/data/Screenshot_20261006_234945.png)

The crucial step is to build something **deeper than a pretty ontology tree**: the taxonomy browser, API docs, Markdown pages, source code graph, MCP server, and search engine should all query the same normalized identities and relations.

### Separate ontology, taxonomy, and instance knowledge

I would use three related semantic layers.

**The formal T-box** defines what sorts of things exist:

```text
Package
Module
ApiSymbol
Function
Type
Interface
Service
Layer
Schema
Example
Guide
Concept
Release
SourceArtifact
DocumentationSection
```

and relations such as:

```text
declaredIn
exportedBy
accepts
returns
extends
implements
dependsOn
documents
hasExample
relatedConcept
definedAt
supersedes
references
generatedFrom
```

OWL 2 is the W3C ontology language with formally defined meaning for classes, properties, individuals, and relationships. Its standardized profiles allow implementations to choose useful subsets rather than requiring unrestricted reasoning. citeturn12search0turn12search16

For a documentation graph I would deliberately stay toward a **small, tractable OWL/RDFS vocabulary**, roughly in an OWL 2 RL-friendly spirit, rather than demonstrating every expressive feature of OWL.

**The taxonomy/glossary layer** should use SKOS. SKOS is specifically intended to represent knowledge-organization systems and can coexist with more formal OWL ontologies. citeturn14search0turn12search17

That makes it a natural model for:

```text
prefLabel
altLabel
definition
broader
narrower
related
inScheme
exact/close mappings
```

This distinction is worth taking seriously:

> An ontology class hierarchy and a glossary/taxonomy hierarchy are not automatically the same thing.

For example, `Effect` as a conceptual glossary term can be a SKOS concept linked to multiple APIs. `Effect.Effect<A,E,R>` as a formal API type is an API-symbol entity. Conflating them usually produces a confusing ontology.

**The A-box** is then generated instance knowledge:

```text
@effect/platform is a Package
effect/Schema is a Module
Schema.Struct is an ApiSymbol
example-X is an Example
docs-page-Y is a DocumentationPage
commit-Z is a SourceRevision
```

This is where your doc generator becomes a graph compiler.

### SHACL should make the knowledge graph lintable

SHACL's W3C Recommendation defines shapes for validating RDF graphs against constraints, and the specification explicitly notes uses beyond validation such as UI generation, code generation, and integration. citeturn14search1

That gives you exactly the “ontology as type system for non-code work” behavior your `knowledge-endgame` notes envision. fileciteturn1file0L1-L13

For example:

```text
Every ApiSymbol:
  exactly one stable IRI
  at least one label
  exactly one kind
  exactly one package/module
  at least one source location
  exactly one version
  at least one documentation representation

Every Concept:
  exactly one preferred English label
  at least one definition
  exactly one concept scheme

Every Example:
  references at least one API symbol
  has source provenance
  identifies language
```

Run SHACL in CI. A new package export that exists in source but not in the semantic documentation graph becomes a **build failure**, not an invisible documentation omission.

### Named graphs are ideal for provenance partitions

RDF datasets include named graphs, which gives you a clean way to represent provenance boundaries. citeturn4view0

For example:

```text
graph:ontology
graph:release/v4.0.0
graph:source/<commit>
graph:docgen/<build>
graph:authored-docs
graph:inferred-links
```

Then an agent can distinguish:

```text
authored assertion
compiler-extracted fact
inferred relation
LLM-generated suggestion
```

I would **never silently merge model-generated relationships into the authoritative graph**. Give generated/inferred facts their own provenance, method, confidence, and review state.

That would make `beep-effect` unusually valuable as a machine corpus because the line between “source fact” and “AI interpretation” would itself be encoded.

### Backlinks should be graph-derived, not manually duplicated

Obsidian-style `[[wikilinks]]` are great authoring UX, but they should not become a proprietary interchange dependency.

I would support them as sugar if you enjoy writing them:

```markdown
[[Schema]]
[[Effect]]
[[Layer]]
```

but resolve them at build time to ordinary Markdown links pointing at stable IRIs or canonical docs routes.

Then:

```text
forward link in source
       ↓
build edge
       ↓
inverse index
       ↓
"Referenced by" projection
```

The Markdown standard representation stays portable, while the knowledge graph provides true bidirectionality.

A generated page can expose:

```text
Referenced by
  • Guide: Designing service schemas
  • API: decodeUnknown
  • Concept: Validation
  • Example: Config decoding
```

and JSON-LD/MCP can return the exact same inverse edge set.

Graft's current design provides a useful adjacent precedent: its repository describes a graph represented as linked Markdown nodes that agents can open, grep, and follow using ordinary repository operations, while treating that graph as a regenerable cache. fileciteturn3file0L2-L2

I would take that principle one step further: **linked Markdown is the human/agent projection, but the same graph should also exist structurally as typed RDF and SQLite edges.**

### Build the explorer from the graph rather than separately

Your explorer could have:

```text
LEFT
  Search
  Classes
  Concepts
  Packages
  Modules
  Symbol kinds

CENTER
  Definition
  Formal properties
  API references
  Examples
  Provenance
  Backlinks

RIGHT
  Entity graph
  Superclasses
  Subclasses
  Broader/narrower
  Related concepts
  Modules/symbols implementing concept
```

Each selected entity should have immediately visible actions:

```text
Read
Markdown
JSON-LD
Turtle
Source
SPARQL
Copy IRI
Backlinks
Examples
```

and the selected state should correspond to a real URL so both humans and browser agents can deep-link directly into a node.

SPARQL 1.1 is explicitly designed to query RDF graphs using graph patterns, including optional patterns, alternatives, property paths, and aggregation, so it is the right advanced query language for this representation. citeturn12search3turn12search7

But I would **not force ordinary agents to generate SPARQL**. Give them high-level typed MCP tools first and SPARQL as an escape hatch.

## A stateless documentation MCP and local-agent distribution

The timing for the MCP portion of your design is particularly good.

The July 2026 MCP specification introduced a **stateless protocol core**: the project describes removal of the protocol-level initialization/session requirement, self-describing requests, cacheable list results, and the ability for independent requests to land on any server instance without shared session storage. citeturn18search6

That maps almost perfectly to a read-only documentation service.

### Make MCP a query facade over immutable artifacts

I would build each release as an immutable knowledge snapshot:

```text
source commit
      ↓
knowledge build
      ↓
beep-knowledge.sqlite
beep-knowledge.trig
ontology.ttl
shapes.ttl
docs manifest
      ↓
stateless MCP workers
```

No conversation memory is required.

A request arrives, queries a read-only bundle, and returns stable URIs.

That is operationally simpler than letting the MCP server itself become the knowledge store.

### Use MCP resources for knowledge objects

MCP's resource model is expressly intended to expose contextual data as URI-addressed resources that clients can list and read, with MIME types and resource templates. citeturn7view0

I would expose resource templates conceptually like:

```text
beep://doc/{path}
beep://section/{id}
beep://symbol/{qualified-name}
beep://concept/{id}
beep://module/{package}/{module}
beep://example/{id}
beep://source/{commit}/{path}
```

For web interoperability, results should also return the equivalent HTTPS canonical URI.

The server should make the resource catalog relatively stable and cacheable rather than inventing thousands of dynamically different tool names. The 2026 MCP revision explicitly introduced cache hints and deterministic ordering for list results. citeturn18search6

### Keep the tool surface small and orthogonal

I would resist an MCP with 80 narrowly overlapping documentation tools.

Something close to this is enough:

| Tool | Purpose |
|---|---|
| `search` | Hybrid lexical/entity search with filters |
| `resolve` | Resolve alias, FQN, path, CURIE, or IRI to an entity |
| `neighbors` | Traverse typed relationships and backlinks |
| `examples` | Find examples associated with symbols/concepts |
| `query` | Structured advanced query; optionally permit read-only SPARQL |

Tool definitions in MCP use JSON Schema for their arguments/results, which gives you a strong typed interface for agents. citeturn7view1

A search input might be:

```json
{
  "query": "schema decode errors",
  "kind": ["ApiSymbol", "Guide", "Example"],
  "package": ["effect"],
  "version": "v4",
  "concept": ["validation"],
  "limit": 12
}
```

and results:

```json
{
  "results": [
    {
      "uri": "...",
      "kind": "ApiSymbol",
      "name": "...",
      "summary": "...",
      "matchedSection": "...#errors",
      "source": "...",
      "relations": ["..."],
      "score": 0.91
    }
  ]
}
```

That is far more useful than returning an unstructured paragraph answering the search query. The **agent should receive evidence it can continue navigating**.

### Retrieval should be lexical + structural before vector-first

For software documentation I would rank approximately:

```text
exact IRI/FQN/identifier
        ↓
alias / package / export match
        ↓
graph and taxonomy constraints
        ↓
FTS lexical match
        ↓
semantic embedding similarity
```

This is one place I would diverge somewhat from typical “RAG = vectors” architectures.

When an agent searches for `Schema.Struct`, exact symbol identity is better evidence than cosine similarity. When it asks for “all examples involving ConfigProvider,” a typed graph edge is better than semantic similarity. When it asks an open-ended conceptual question, embeddings can then improve recall.

Therefore embeddings should be treated as **replaceable derived acceleration data**, not your knowledge model.

### Ship a local knowledge pack

For coding agents working in a cloned repository, I would expose a command along the lines of:

```text
pnpm beep knowledge build
pnpm beep knowledge search ...
pnpm beep knowledge resolve ...
pnpm beep knowledge graph ...
pnpm beep knowledge mcp
```

The default local artifact can be:

```text
.beep/knowledge/
  manifest.json
  knowledge.sqlite
  ontology.ttl
```

and remain regenerable or downloadable rather than forcing a large binary database into Git.

Meanwhile, commit the things whose readability is intrinsically valuable:

```text
AGENTS.md
docs/**/*.md
ontology/**/*.ttl
ontology/**/*.md
examples/**
```

`AGENTS.md` now has a dedicated open-format convention intended to act as a predictable “README for agents.” citeturn17search4

A root `AGENTS.md` should tell a coding agent only the high-value operational facts:

```text
what beep-effect is
package topology
build/test/lint commands
where authoritative docs live
how to query the knowledge index
where ontology lives
how generated docs are produced
what must not be edited manually
how to resolve symbols
```

Nested `AGENTS.md` files can add package-specific guidance without turning the root file into an encyclopedia.

### Publish the MCP server to the official registry

The official MCP Registry now provides discovery for MCP servers and a registry API/documentation surface. citeturn18search3turn18search9

So there are two complementary discovery paths:

```text
your domain
  /.well-known/api-catalog
      → MCP endpoint
      → OpenAPI
      → docs/search API

MCP ecosystem
  Official MCP Registry
      → beep-effect docs MCP
```

That is a much stronger agent-discovery story than expecting an agent to notice a README paragraph saying “we also have an MCP.”

## The concrete `beep-effect` blueprint

If I were designing the “Effect V4 mega-monorepo knowledge substrate” from scratch, this is the shape I would ship.

### Repository layout

```text
/
├── AGENTS.md
├── README.md
├── LICENSE
│
├── ontology/
│   ├── beep.ttl                 # T-box
│   ├── concepts.ttl             # SKOS concept scheme
│   ├── shapes.ttl               # SHACL
│   ├── context.jsonld           # JSON-LD context
│   └── README.md
│
├── docs/
│   ├── index.md
│   ├── architecture/
│   ├── concepts/
│   ├── guides/
│   ├── recipes/
│   ├── glossary/
│   └── api/                     # generated @beep/docgen projections
│
├── examples/
│
└── tooling/
    └── knowledge/
        ├── extract/
        ├── graph/
        ├── render/
        ├── index/
        ├── validate/
        └── mcp/
```

The authored repository remains understandable with nothing except a filesystem and text editor. That preserves the strongest property of the linked-Markdown/Graft idea while adding a formal semantic plane. Graft itself explicitly emphasizes ordinary linked files that agents can grep and follow, and your own `knowledge-endgame` notes emphasize dereferenceable know-how and ontology-backed practice. fileciteturn3file0L2-L2 fileciteturn1file0L1-L13

### Published site layout

```text
/
├── robots.txt
├── sitemap.xml
├── sitemap.md
├── llms.txt
│
├── .well-known/
│   └── api-catalog
│
├── api/
│   ├── openapi.json
│   ├── search
│   ├── resources
│   └── graph
│
├── mcp
│
├── ontology/
│   ├── beep.ttl
│   ├── shapes.ttl
│   ├── context.jsonld
│   └── llms.txt
│
├── graph/
│   ├── latest.trig
│   ├── latest.nq.zst
│   └── manifest.json
│
├── downloads/
│   ├── knowledge.sqlite.zst
│   └── corpus.jsonl.zst
│
├── id/
│   ├── symbol/...
│   ├── concept/...
│   ├── module/...
│   └── example/...
│
└── docs/
    ├── ...
    ├── ....md
    └── v4/
        ├── llms.txt
        └── api/...
```

`/.well-known/api-catalog` has a standards-track discovery role from RFC 9727, while `sitemap.xml` remains the search-crawler discovery mechanism and `llms.txt` remains the agent-oriented hint surface. citeturn22view2turn21search6turn19view3

### Every API page should be an entity hub

An Effect-v4-style API reference page should contain:

```text
Symbol name
Qualified name
Package
Module
Kind
Since/version
Signature
Short semantic summary
Detailed documentation
Type parameters
Parameters
Return/error/environment information
Examples
Related concepts
Related symbols
Used by / references
Referenced by
Source
Previous/next or broader/narrower navigation
```

and buttons/links:

```text
Copy Markdown
View Markdown
JSON-LD
Turtle
View Source
Copy IRI
Open Graph
```

The same entity metadata feeds HTML, Markdown, JSON-LD, RDF, SQLite, search, and MCP.

### Give concepts the same status as API symbols

Most API documentation treats conceptual knowledge as second-class prose. I think this project should do the opposite.

A concept such as:

```text
Effect
Layer
Context
Service
Schema
Cause
Scope
Fiber
Stream
Channel
Schedule
```

should have a stable concept IRI and its own page containing:

```text
Definition
Aliases
Broader concepts
Narrower concepts
Related concepts
Canonical APIs
Examples
Guides
Design rationale
Source references
Backlinks
```

SKOS is a standard model specifically suited to that type of concept scheme, while OWL can represent the more formal software/domain ontology alongside it. citeturn14search0turn12search0

That gives an agent a route from **language → semantics → code**:

```text
"What does dependency injection mean in Effect?"
        ↓
Concept: Service / Context / Layer
        ↓
related APIs
        ↓
examples
        ↓
exact source symbols
```

rather than relying on embedding similarity over disconnected API pages.

### Add a training-oriented corpus export, but do not pollute the source model for it

For the “please train on my beautiful repository” ambition, I would publish a derived release corpus containing records such as:

```json
{
  "id": "...",
  "kind": "api-reference",
  "version": "v4",
  "language": "en-US",
  "title": "Schema.Struct",
  "text": "...clean Markdown...",
  "entity": "...",
  "sourceCommit": "...",
  "sourcePath": "...",
  "license": "...",
  "relations": ["..."],
  "concepts": ["..."]
}
```

alongside the pristine Markdown and source tree.

The important property is not JSONL specifically. The important property is that **every record remains attributable to a stable entity and source revision**.

Then a lab or researcher that chooses to ingest it has several options:

```text
plain Git/source
Markdown corpus
JSONL corpus
RDF graph
SQLite query pack
web pages
```

without needing to scrape React hydration payloads or infer which generated text came from which symbol.

Crawler permission still does not guarantee that any specific lab will select the material for training; OpenAI's current language deliberately describes GPTBot content as content that *may* be used. citeturn13view0

### Build a cold-agent evaluation harness as a first-class product test

Your existing `knowledge-endgame` README specifically lists a “cold-agent eval” as one possible reason to reopen the exploration. fileciteturn1file0L1-L13

I think that is exactly the right acceptance test.

Take a fresh agent with no prior repository context and ask questions such as:

```text
Where is Schema.Struct defined?
Which package exports it?
Show a minimal example.
What concepts relate to it?
What docs link to it?
What changed between two releases?
Which examples use it?
What API should I use instead of deprecated X?
What modules depend on Y?
Explain Layer to someone who understands Context.
```

Run each task against:

```text
cold repository
repository + AGENTS.md
repository + Markdown docs
Markdown + lexical search
Markdown + graph
full MCP
```

Measure:

```text
answer correctness
source-grounding correctness
tool calls
tokens
latency
navigation dead ends
unsupported claims
```

That transforms “agent-native docs” from a collection of fashionable file formats into an **empirically testable interface**.

### The priority order I would actually implement

The first tranche should be almost boring:

**Semantic HTML + excellent CommonMark twins + stable URLs + source links + `sitemap.xml` + `robots.txt` + small `llms.txt` + `AGENTS.md`.**

This immediately benefits humans, ordinary search crawlers, direct-fetch agents, and local coding agents. Google itself says its AI search surfaces need the same fundamentals as ordinary Search rather than a special AI-specific file, while `llms.txt` provides a complementary agent-oriented orientation surface. citeturn11view0turn19view3

The second tranche is where `beep-effect` becomes unusual:

**Stable entity IRIs + JSON-LD + Turtle ontology + SKOS glossary + SHACL + generated backlinks + a FOLIO-style explorer.**

OWL, SKOS, SHACL, JSON-LD, and RDF have complementary standardized roles here rather than competing with one another. citeturn12search0turn14search0turn14search1turn3view0turn4view0

The third tranche turns it into infrastructure:

**SQLite knowledge pack + exact/FTS/graph retrieval + stateless MCP + OpenAPI + `/.well-known/api-catalog` + official MCP Registry publication + optional SPARQL.**

SQLite FTS5 supplies a robust local lexical layer; MCP's 2026 protocol is explicitly stateless and cache-aware; OpenAPI gives conventional HTTP interface description; and RFC 9727 gives a standardized discovery root. citeturn17search6turn18search6turn14search3turn22view2

The fourth tranche is the actual moat:

**provenance-rich recommendation edges, inferred-vs-authored knowledge separation, release-to-release graph diffs, cold-agent evals, corpus exports, and ontology-guided retrieval.**

That is where this stops being “nice docs with `/llms.txt`” and becomes a **versioned, queryable software knowledge base that happens to project an excellent documentation website**.

The deepest design principle is therefore:

> **The website is not the knowledge base. Markdown is not the knowledge base. RDF is not the knowledge base. MCP is not the knowledge base.**
>
> **The knowledge base is the identity- and provenance-preserving compiler graph produced from your source, documentation, examples, and ontology. HTML, Markdown, JSON-LD, RDF, SQLite, search, and MCP are interoperable projections of that graph.**

That architecture would satisfy nearly every goal in your prompt at once: excellent ordinary docs, Effect-style API reference, source-linked examples, FOLIO-class semantic exploration, Obsidian-class backlinks, local coding-agent navigation, browser-agent usability, queryable stateless MCP, conventional web/API discovery, and an unusually clean public corpus for whichever search engines, agents, researchers, or frontier labs choose to consume it.