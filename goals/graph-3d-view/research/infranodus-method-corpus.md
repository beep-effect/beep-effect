# InfraNodus Method Corpus: Semantic Intent and UX Vocabulary

## Method note

This lane extracts the meaning assigned to visual encodings, not an
implementation recipe. Evidence is weighted in this order: the 2011 method
paper and WWW'19 paper for the analytic model; InfraNodus/Nodus Labs docs for
current product language; and the MCP/plugin repositories only for public data
vocabulary and the product's own description of its 3D view. All sources are
reference-only. Repository material is understanding-only and must not be
copied into implementation. ([g3d-e-01],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/acm-www19.md:161-163`;
[g3d-e-10],
`~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:1-11`)

The method's central semantic move is to treat words or concepts as nodes and
their co-occurrence or proximity as relations, then let graph structure expose
influence, topical groupings, and missing connections. The 2011 paper is
explicit that the graph should avoid importing an external ontology: the
visualization translates proximity and connection density, while semantic
interpretation remains with the observer. ([g3d-e-02],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:196-200`;
[g3d-e-02],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:224-248`)

## 1. Encoding semantics

### Color means topical community, not an intrinsic category

Node color denotes community membership. The foundational method groups nodes
that are more densely connected to one another than to the rest of the graph,
then assigns different colors to the resulting communities. InfraNodus's
current documentation identifies its detector as a Louvain/Blondel modularity
method and calls the communities **topical clusters**. Thus color means “these
concepts repeatedly occur in the same context and form a structurally coherent
topic,” not a hand-authored taxonomy, entity type, sentiment, or confidence
class. ([g3d-e-03],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/polysingularity.md:275-293`;
[g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:384-392`)

The WWW'19 summary supplies the intended reading: detected topical clusters
represent the text's main topics and the relations among them. The earlier
paper calls them contextual clusters or clusters of meaning circulation and
treats them as the topical structure within the text. ([g3d-e-01],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/acm-www19.md:161-163`;
[g3d-e-03],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/polysingularity.md:582-590`)

Design implication: a legend should say **Topic** or **Topical cluster**, with
“detected from co-occurrence/community structure” in explanatory copy. Color
must remain a stable identity cue within a view; it should not silently double
as selection, risk, or node type, because those meanings would conflict with
the method's community encoding. This is a clean-room design inference from
the cited semantics, not a copied InfraNodus rule. ([g3d-e-04],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/how-it-works.md:185-195`)

### Size means structural influence; the canonical text method uses BC

In the 2011 method, node size is ranged by **betweenness centrality (BC)**: how
often a node lies on shortest paths between other nodes. A large node is
therefore a junction through which many potential paths run. This differs from
degree/frequency: a node may have many local connections yet do little to link
separate communities, whereas a lower-degree node can be globally influential
by bridging contexts. The paper interprets high BC as variety of contexts and
as a junction for meaning circulation. ([g3d-e-02],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:364-400`)

Later InfraNodus docs preserve BC as the default semantic story—higher BC,
bigger node, hence a more influential concept—but also permit degree as an
alternative influence metric. UI copy should therefore name the active metric:
**Size by betweenness (cross-topic influence)** or **Size by degree (number of
connections)**, rather than the ambiguous “importance.” ([g3d-e-04],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/how-it-works.md:187-195`;
[g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:403-411`)

### “Most influential,” topical brokers, and conceptual gateways

The core “most influential” ranking is BC in the published text-network
method. The product also supports degree, and its documentation says a Jenks
elbow cutoff selects the top prominent nodes whose influence is substantially
higher than the rest. High-BC nodes are described as **topical brokers** or
crossroads linking contexts and narrative shifts. ([g3d-e-06],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/centrality-support.md:37-47`;
[g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:403-411`)

**Conceptual gateways** are related but not identical to the top-BC list.
InfraNodus describes them as high-globality entrance/connector points: nodes
with unusually high BC relative to degree or frequency. They can link main and
peripheral topics without using the most obvious, highly connected terms. This
extends the 2011 paper's observation that BC/degree distinguishes mediating
concepts, but the current product term should not be collapsed into “largest
node.” ([g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:452-458`;
[g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:570-574`;
[g3d-e-02],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:548-572`)

The corpus does not define the `most_influential=bc2` URL value. It appears in
demo URLs, while the method prose defines BC, degree, and BC-relative
globality/diversivity separately. Treating `bc2` as a proven alias for
gateways, weighted BC, or any precise formula would be fabrication. ([g3d-e-08],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/text-network-analysis-uc.md:38-45`;
[g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:572-574`)

## 2. Layout lineage and the meaning of 3D

### Force Atlas lineage

The lineage is Force Atlas/force-directed layout. The 2011 paper's figures are
explicitly Force Atlas layouts; the current method describes connected hubs as
repelling one another while less-connected nodes gather around them. The
semantic purpose is readability and spatial reinforcement of community
structure: co-occurring nodes settle nearer one another, so spatial
neighborhoods correlate with the modularity-derived topical clusters. Layout
proximity is therefore a structural cue, not a literal metric distance or a
claim that nearby concepts are semantically equivalent. ([g3d-e-02],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:330-386`;
[g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:743-750`)

The papers give 2D a cognitive rationale: folding a text's local chronological
phenomena onto a plane provides a global overview, while the resulting diagram
can summarize topical structure, expose influential concepts, and support
alternate reading/navigation paths. ([g3d-e-02],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:244-252`;
[g3d-e-03],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/polysingularity.md:558-570`)

### Server/client division visible in the supplied corpus

The MCP vocabulary shows a server-returned graph node carrying `degree`, `bc`,
`community`, `x`, and `y`; graph attributes also carry modularity, top
clusters, gaps, diversity statistics, and influential nodes. The Obsidian
plugin says InfraNodus servers convert selected text into a JSON graph and
return it with visualization metrics. This establishes that analysis and 2D
coordinates are upstream data, allowing a client to render the same analytic
result rather than recompute its meaning independently. ([g3d-e-09],
`~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:1-10`;
[g3d-e-09],
`~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:70-89`;
[g3d-e-10],
`~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:273-277`)

The client-side product description adds presentation and interaction: a 3D
visualization module, topic/concept selection, context lookup, and graph-driven
navigation to source pages or statements. The README does not say that the
server's `x,y` are directly extruded, nor does it document how a `z` coordinate
is derived. ([g3d-e-10],
`~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:37-59`;
[g3d-e-10],
`~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:195-215`;
[g3d-e-10],
`~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:225-234`)

### What their writing claims for 3D

The supplied material does **not** contain a methodological argument that 3D
is more faithful, more navigable, or less occluded than 2D. The plugin calls
the module “beautiful,” lists 3D beside advanced clustering, and separately
describes graph-based vault navigation. Current network-analysis docs allow a
2D or 3D plane for the same Force Atlas/community purpose, without assigning a
distinct semantic role to depth. The defensible reading is that 3D is a
presentation and exploration affordance layered over the same analytic
semantics; any stronger claim about superiority is unresolved. ([g3d-e-10],
`~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:37-45`;
[g3d-e-10],
`~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:123-127`;
[g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:743-750`)

## 3. Label prominence: semantic hierarchy before decluttering

InfraNodus exposes a label threshold whose default shows labels only for
bigger nodes, and a proportional mode in which label size follows node size.
Its settings also warn that graphs become unreadable and slower when too many
nodes/connections are displayed. These are product controls, not a formal
label-layout theorem. ([g3d-e-07],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/graph-settings.md:36-65`)

The semantic rationale follows from the node encoding: bigger nodes are the
high-BC junctions that form the backbone of meaning circulation, and the
method aims to make the main themes visually clear. Proportional labels carry
that hierarchy into text; a prominence cutoff preserves the overview by
letting influential concepts act as entry points before secondary labels are
revealed through zoom, selection, or filtering. This is an evidence-based
design inference, not a claim that the papers prescribe a particular
anti-overlap algorithm. ([g3d-e-02],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:386-408`;
[g3d-e-02],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:548-588`)

“Reveal the main topics” needs precise wording. The literature says topical
clusters/communities reveal main topics; the largest nodes reveal influential
concepts within and between those topics. Labels help users read those two
structures, but do not create the topic model. Cluster-level names may be AI
generated (`top_clusters.aiName`), which is a separate interpretive layer from
community detection. ([g3d-e-01],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/acm-www19.md:161-163`;
[g3d-e-05],
`explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:384-392`;
[g3d-e-09],
`~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:19-30`)

Recommended meaning-preserving behavior:

- Overview: label the strongest influential concepts and optionally one topic
  name per visible cluster. ([g3d-e-05],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:384-409`)
- Zoom/focus: reveal secondary concept labels without changing their rank;
  selection is an exploration state, not a new influence score. This is a
  clean-room interaction inference from the overview/context workflow.
  ([g3d-e-10],
  `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:195-215`)
- Tooltip copy: state both the active influence metric and topic membership,
  e.g. “Cross-topic influence (betweenness): …” and “Topic: …”. ([g3d-e-06],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/centrality-support.md:37-47`;
  [g3d-e-05],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:384-392`)

## 4. UX vocabulary to reuse

Use the vocabulary as plain network-science/product concepts, with original
copy written for this workbench. Avoid importing InfraNodus's branded
philosophical framing when a direct term is clearer.

### Terminology glossary

| Term | Semantic intent | Suggested UI use | Evidence |
| --- | --- | --- | --- |
| **Topic / topical cluster** | A community of concepts that co-occur and are more densely connected to one another than to the rest of the graph. | Legend item, cluster filter, “Color by topic,” topic tooltip. | [g3d-e-05], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:384-392` |
| **Community** | The graph-analytic identity underlying a topical cluster; represented by a community id in the API vocabulary. | Advanced analytics copy and data inspector; prefer “topic” in novice-facing copy. | [g3d-e-09], `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:1-10`; [g3d-e-09], `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:19-30` |
| **Influential concept** | A structurally prominent node, canonically high in BC for text networks, with degree available as an alternate ranking. | “Size by influence,” influence tooltip, ranked concepts panel. Always name the metric. | [g3d-e-05], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:403-411` |
| **Topical broker** | A high-BC crossroads that connects contexts or topical clusters and may mark a narrative shift. | Tooltip badge or filter for cross-topic connectors. | [g3d-e-06], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/centrality-support.md:37-47` |
| **Conceptual gateway** | A less-congested entrance/connector point with high BC relative to degree/frequency, connecting main and peripheral ideas. | “Show gateways” toggle; tooltip: “high influence with relatively few connections.” | [g3d-e-05], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:452-458` |
| **Structural gap / topical gap** | Two important, distinct communities that are weakly connected; a candidate space for a new relation, question, or idea. | “Show gaps” toggle, gap inspector, “Topics to connect.” Do not imply the missing link is true. | [g3d-e-05], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:438-450` |
| **Main topics** | The prominent topical communities used for high-level understanding; topic influence is summarized from node BC within each cluster. | Overview panel and cluster navigation. | [g3d-e-05], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:384-392` |
| **Underlying ideas** | Secondary concepts or latent topics exposed after temporarily removing/hiding the dominant nodes. | “Reveal underlying ideas” action; explain that the view/ranking is being recalculated or filtered. | [g3d-e-04], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/how-it-works.md:206-214`; [g3d-e-10], `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:225-227` |
| **Topical diversity** | How concentrated or distributed influence and community structure are across the graph; current API vocabulary includes modularity and influence-distribution fields. | Analytics panel, not a node encoding; pair the score with an explanation. | [g3d-e-05], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:420-430`; [g3d-e-09], `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:108-119` |
| **Relations** | Edges/co-occurrences between concepts, not just a bag of keywords. | Edge tooltip, “Show relations,” context lookup. | [g3d-e-02], `explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:196-200`; [g3d-e-10], `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:195-203` |

Useful compact labels are **Topics**, **Influential concepts**, **Topical
brokers**, **Conceptual gateways**, **Gaps**, **Underlying ideas**, **Relations**,
and **Topical diversity**. The MCP output vocabulary confirms the same analytic
surface through `mainTopicalClusters`, `topInfluentialNodes`,
`conceptualGateways`, `contentGaps`, `top_clusters`, and `diversity_stats`.
([g3d-e-09],
`~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:70-119`;
[g3d-e-09],
`~/YeeBois/infranodus/mcp-server-infranodus/EXAMPLES.md:44-139`)

## 5. Clean-room guardrails

- Reuse the concepts, not their expression: community color, BC/degree sizing,
  proportional label hierarchy, Force Atlas lineage, gateways, gaps, and
  topic-oriented navigation are general analytic/design ideas. Write fresh UI
  copy and derive behavior from our own data contract. ([g3d-e-02],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md:236-252`)
- Do not copy code, shaders, constants, formulas, component structure,
  generated assets, or implementation-specific interaction details from the
  InfraNodus MCP server, Obsidian plugin, or other Nodus Labs repositories.
  The supplied corpus identifies Nodus Labs OSS foundations as AGPL; this lane
  uses those repositories only to understand vocabulary and declared behavior.
  ([g3d-e-05],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:769-783`)
- Do not reproduce distinctive promotional or philosophical phrasing such as
  the product's extended “pathways of meaning,” “meaning traffic,”
  polysingularity, dispositif, or rhizomatic copy. Where a term is useful,
  paraphrase it into neutral graph language: cross-topic influence, connector,
  topic, or gap. ([g3d-e-04],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/how-it-works.md:189-214`)
- Do not imply that a detected topic name, structural gap, or proposed bridge
  is ground truth. Communities are structural groupings; AI names are an
  interpretive layer; gaps are candidate opportunities for inquiry. ([g3d-e-05],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:384-392`;
  [g3d-e-05],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md:438-458`)
- Do not claim that 3D itself has academic validation in this corpus. Preserve
  the validated semantics independently of renderer dimension, and describe
  3D in our product only through behavior we test ourselves. ([g3d-e-03],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/polysingularity.md:558-566`;
  [g3d-e-10],
  `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:37-45`)

## Sources

| id | title | upstream | location | theme | disposition |
| --- | --- | --- | --- | --- | --- |
| `g3d-e-01` | InfraNodus: Generating Insight Using Text Network Analysis (WWW'19) | ACM DOI 10.1145/3308558.3314123 | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/acm-www19.md` | Peer-reviewed method summary: influence, topical clusters, diversity, gaps | `reference` |
| `g3d-e-02` | Identifying the Pathways for Meaning Circulation Using Text Network Analysis | Nodus Labs, 2011 | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/pathways-2011.md` | Foundational encoding semantics, Force Atlas, BC, contextual clusters, 2D rationale | `reference` |
| `g3d-e-03` | Visualization of Text's Polysingularity Using Network Analysis | Nodus Labs | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/polysingularity.md` | Color/community and size/BC method; topical structure | `reference` |
| `g3d-e-04` | How InfraNodus Works | InfraNodus | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/how-it-works.md` | Current method explanation, gaps, entrance points | `reference` |
| `g3d-e-05` | Network Analysis and Visualization | InfraNodus Docs | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/docs-network-analysis.md` | Louvain/modularity, Force Atlas, influence, gateways, gaps, UX vocabulary | `reference` |
| `g3d-e-06` | Betweenness Centrality: Topical Brokers | Nodus Labs Support | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/centrality-support.md` | BC versus degree; topical-broker semantics | `reference` |
| `g3d-e-07` | How to Change the Appearance and Settings for Your Graphs | Nodus Labs Support | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/graph-settings.md` | Label thresholds, proportional labels, readability limit | `reference` |
| `g3d-e-08` | Text Network Analysis Use Case | InfraNodus | `explorations/graph-3d-navigation/research/seed/web/infranodus-method/text-network-analysis-uc.md` | Product encoding summary and opaque `bc`/`bc2` selectors | `reference` |
| `g3d-e-09` | InfraNodus MCP type vocabulary and examples | Nodus Labs MCP server checkout (AGPL; understanding-only) | `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts`; `~/YeeBois/infranodus/mcp-server-infranodus/EXAMPLES.md` | API terms: community, BC, top clusters, AI names, diversity, gaps, gateways | `reference` |
| `g3d-e-10` | InfraNodus Advanced Graph View Plugin for Obsidian | Nodus Labs Obsidian plugin checkout (AGPL; understanding-only) | `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md` | Their own 3D description, navigation, server/client boundary | `reference` |

## Unresolved

- **`bc2` meaning:** the corpus exposes `most_influential=bc2` in demo URLs but
  never defines the calculation or its relationship to BC, degree, globality,
  conceptual gateways, or the Jenks cutoff. ([g3d-e-08],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/text-network-analysis-uc.md:38-45`)
- **Why analysis is server-side:** the types and plugin README establish the
  boundary, but no supplied source explains whether the motivation is
  consistency, performance, IP, privacy architecture, or API reuse.
  ([g3d-e-09],
  `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:1-10`;
  [g3d-e-10],
  `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:273-277`)
- **2D-to-3D transformation:** no supplied source states whether the client
  preserves server `x,y`, synthesizes `z`, reruns a 3D force simulation, or
  uses another layout. ([g3d-e-09],
  `~/YeeBois/infranodus/mcp-server-infranodus/src/types/index.ts:1-10`;
  [g3d-e-10],
  `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:37-45`)
- **3D-specific benefit:** the corpus does not justify 3D as analytically or
  navigationally superior to 2D. It calls the module beautiful and documents
  navigation as a product action, but supplies no comparative evidence.
  ([g3d-e-10],
  `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:37-45`;
  [g3d-e-10],
  `~/YeeBois/infranodus/infranodus-obsidian-plugin/README.md:123-127`)
- **Label anti-overlap mechanics:** the method corpus defines thresholded and
  proportional label prominence, but not collision handling, distance fading,
  occlusion rules, or fade curves. ([g3d-e-07],
  `explorations/graph-3d-navigation/research/seed/web/infranodus-method/graph-settings.md:47-65`)
