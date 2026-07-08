# Graph Application Development

Source page: <https://stateofthegraph.com/graph-application-development/>
Embedded sheet: <https://docs.google.com/spreadsheets/d/1falbK3C_UNqGKs8u6bCg6WW7TfWqbw5ECUKAShBPZfI>

Extracted from the embedded Google Sheet CSV export with raw spreadsheet rows preserved as markdown tables. Column letters correspond to the spreadsheet grid after trailing empty columns are removed.

## Graph Application Development

Rows: 20; columns: 17.

| A | B | C | D | E | F | G | H | I | J | K | L | M | N | O | P | Q |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Graph Application Development |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Product | Vendor | Short Description | Tool Type | Users | Applications | Deployment / Availability | Supported Graph Databases / Stores | Data Model | Query Languages | No-code / Low-code / Pro-code | Visual Application Builder | Visual Exploration / Result Visualization | Industry | Notes | Primary Source | Secondary Sources |
| EasyGraph | Graphifi | Platform to get a knowledge graph up and running within minutes on existing RDF stores, with guided setup and visualization. | Graph App Development Platforms | Developers, Knowledge Engineers, Data Engineers | Knowledge Graph Setup, Application Building, Data Exploration | On-Prem, Cloud | Stardog; GraphDB; MarkLogic; RDF4J; Fuseki; AWS Neptune (and other compliant RDF stores) | RDF | SPARQL | Low-code | Yes | Yes | General Purpose | Acts as an abstraction layer over multiple RDF stores, emphasizing rapid KG onboarding rather than deep store-specific features. | https://easygraph.graphifi.com/docs/docs/easygraph.html | https://easygraph.graphifi.com |
| Fluent Editor | Cognitum | Controlled natural language ontology editor for OWL and RDF, providing authoring, reasoning, and SPARQL querying in a desktop environment. | Ontology/ Taxonomy Editor | Knowledge Engineers, Ontologists, Domain Experts | Ontology Modeling, Schema / Model Design, KG Schema Governance | Desktop | OWL / RDF ontologies via files and connected triple stores (as configured) | OWL, RDF | SPARQL | Pro-code | No | Partial | General Purpose | Provides a full‑featured ontology engineering environment using controlled natural language, with reasoning support and SPARQL integration for working with OWL/RDF models. | https://www.cognitum.eu/semantics/fluenteditor/ | https://www.w3.org/2001/sw/wiki/Fluent_Editor |
| Graph.Build | Graph.Build | Collaborative no-code platform to design, configure, and automate graph model production across LPG and RDF backends. | Graph App Development Platforms | Developers, Data Engineers, Knowledge Engineers | Application Building, Schema / Model Design, Workflow Automation | Self-hosted, Cloud, Docker | Any platform that supports SPARQL, Gremlin, and openCypher | LPG, RDF | SPARQL, Gremlin, openCypher | No-code | Yes | Yes | General Purpose; Other Regulated Industries | Focus on model production and automation makes Graph.Build closer to a lifecycle platform than a simple visual builder. | https://graph.build/platform-architecture | https://www.youtube.com/watch?v=idQKCjLHLpk |
| Graph Explorer (Neptune) | Amazon Web Services (Neptune) | Web-based graph explorer and notebook integration for querying and visualizing Amazon Neptune graphs. | Graph Clients / IDEs | Developers, Data Engineers, Analysts | Querying / Debugging, Graph Visualization, Results Analysis | Cloud | Amazon Neptune | LPG, RDF | Gremlin, openCypher, SPARQL | Pro-code | No | Yes | General Purpose | Serves as the native workbench and visualization layer for Neptune, tightly integrated with Neptune notebooks. | https://docs.aws.amazon.com/neptune/latest/userguide/visualization-graph-explorer.html | https://docs.aws.amazon.com/neptune/latest/userguide/graph-notebooks.html |
| Graphileon | Graphileon | Tool for application building and visual data management on top of graph databases, helping analysts and consultants rapidly design and deploy graph-based applications. | Graph App Development Platforms | Analysts, Consultants, Developers | Application Building, Graph Visualization, Data Exploration | On-Prem, Cloud | AnzoGraph; DataStax Enterprise Graph; Memgraph; Neo4j; ONgDB; RedisGraph | LPG | Cypher | Low-code | Yes | Yes | General Purpose | Combines visual app composition with multi-database connectivity, bridging analyst workflows and custom graph applications. | https://graphileon.com | https://docs.graphileon.com/graphileon/Getting_started/Install_Graphileon_AWS_Edition.html |
| G.V() | gdotv | All-in-one graph database client to write, debug, test, and analyze results for property-graph databases with rich UI, autocomplete, visualization, editing, and connection management. | Graph Clients / IDEs | Developers, Data Engineers | Querying / Debugging, Graph Visualization, Results Analysis | On-Prem, Cloud | Aerospike Graph; Aliyun GDB; ArcadeDB; Amazon Neptune; AuraDB; Azure Cosmos DB; DataStax Enterprise Graph; Dgraph; FalkorDB; Google Cloud Spanner; JanusGraph; Kuzu; LocalStack (Neptune); Memgraph; Neo4j; Oracle Graph; PuppyGraph; Ultipa Graph | LPG | Cypher, Gremlin, SQL:2023, GQL, SPARQL | Pro-code | No | Yes | General Purpose | Broad multi-database support positions G.V() as a vendor-neutral graph client rather than tied to a single graph engine. | https://docs.aws.amazon.com/neptune/latest/userguide/gv-tool.html | https://gdotv.com/blog/gdotv-review-video-getting-started-jason-koo/ |
| Hume | GraphAware | Government grade intelligence analysis platform on top of Neo4j, combining graph analytics, multi source collection, collaboration, and a unified investigation workspace. | Graph-Powered Analytical Applications | Analysts, Investigators | Intelligence Analysis, Data Exploration, Results Analysis | Cloud, On-Prem | Neo4j | LPG | Cypher | Low-code | Partial | Yes | Government; Security / Intelligence; Other Regulated Industries | Positioned as a packaged graph intelligence solution, Hume blurs the line between platform and finished analytical application. | https://graphaware.com/hume/ | https://graphaware.com/blog/solve-challenges-intelligence-analysis/ |
| LinkedDataHub | AtomGraph | Knowledge graph application platform that exploits RDF and SPARQL for linked data–driven applications and content management. | Graph App Development Platforms | Knowledge Engineers, Developers | Knowledge Graph Setup, Application Building, Data Exploration | Cloud, On-Prem | RDF stores compatible with Linked Data / SPARQL | RDF | SPARQL | Low-code | Yes | Yes | General Purpose | Evolves from a linked data publishing framework into a broader KG application platform focused on data consumption. | https://atomgraph.github.io/LinkedDataHub/linkeddatahub/docs/about/ | https://atomgraph.github.io/LinkedDataHub |
| metaphactory | metaphacts | Enterprise knowledge graph platform with visual semantic modeling, vocabulary and taxonomy management, and low code app building on top of RDF stores and SPARQL endpoints. | Ontology/ Taxonomy Editor | Knowledge Engineers, Ontologists, Data Modelers, Domain Experts, Developers | Ontology Modeling, Taxonomy Management, Schema / Model Design, KG Schema Governance, Knowledge Graph Setup, Application Building | Cloud, On-Prem | RDF stores and SPARQL endpoints (e.g., Blazegraph, GraphDB, Virtuoso, and other SPARQL compatible backends) | RDF, OWL, SKOS, SHACL | SPARQL | Low-code | Yes | Yes | General Purpose; Other Regulated Industries | Combines collaborative ontology and vocabulary management with low code, model driven application building, positioning metaphactory as both an ontology workbench and a semantic app platform on top of RDF knowledge graphs. | https://metaphacts.com/metaphactory | https://blog.metaphacts.com/visual-ontology-modeling-for-domain-experts-and-business-users-with-metaphactory |
| OWLGrEd | Institute of Mathematics and Computer Science, University of Latvia | Graphical ontology editor for OWL that uses UML‑style diagrams to visualize, design, and export ontologies. | Ontology/ Taxonomy Editor | Knowledge Engineers, Ontologists, Data Modelers, Domain Experts | Ontology Modeling, Schema / Model Design, Taxonomy Management | Desktop, Web | OWL / RDF ontologies via import / export to standard formats and external triple stores | OWL, RDF |  | No-code, Pro-code | No | Yes | General Purpose | Provides a diagram‑based environment for editing and understanding OWL ontologies, bridging formal models and more intuitive visual representations. | https://owlgred.lumii.lv | https://www.w3.org/wiki/Ontology_editors |
| Process Tempo | Process Tempo | Data and process analytics platform with graph capabilities | Graph-Powered Analytical Applications | Analysts, Business Users | Data Exploration, Results Analysis | Cloud, On-Prem | Neo4j, PuppyGraph, Memgraph | LPG | Cypher | Low-code, No-code | Partial | Yes | General Purpose; Other Regulated Industries | Uses graph as part of a broader analytics stack, with no-code and low-code graph application capabilities | https://www.processtempo.com/platform | https://www.processtempo.com/feature/data-integration |
| Protégé | Stanford University (Center for Biomedical Informatics Research) | Open source ontology editor family for building OWL and RDF knowledge models, combining a desktop IDE (Protégé Desktop) with a collaborative web environment (WebProtégé). | Ontology/ Taxonomy Editor | Knowledge Engineers, Ontologists, Data Modelers, Domain Experts | Ontology Modeling, Schema / Model Design, KG Schema Governance | Desktop, Cloud, On-Prem | OWL / RDF ontologies stored locally, in Git, or in connected RDF/OWL backends and triple stores | OWL, RDF | SPARQL | Pro-code | No | Partial | General Purpose | Part of the Protégé family, where Protégé Desktop provides a full‑featured local OWL ontology IDE and WebProtégé extends it into a multi‑user web environment with collaboration features for ontology projects. | https://protege.stanford.edu | https://github.com/protegeproject/protege https://protegewiki.stanford.edu/wiki/WebProtege |
| reView | Data² | Neo4j-based graph analytics and review platform designed to support explainable, hallucination-resistant AI and graph-powered insight workflows. | Graph-Powered Analytical Applications | Analysts, Data Scientists | Results Analysis, Graph Visualization, Data Exploration | Cloud, On-Prem | Neo4j | LPG | Cypher | Pro-code | Partial | Yes | General Purpose; Government; Enterprise AI | Focuses on explainable AI and graph‑hybrid RAG on top of Neo4j, positioning it as an analytical and AI‑enablement application. | https://www.datasquared.ai | https://www.dbta.com/Editorial/News-Flashes/Data-Squared-and-Neo4j-Partner-to-Deliver-E28098Hallucination-Resistant-AI-Reliab-163723.aspx |
| SEMMweb Ontology Editor | Semmtech | Open source web‑based ontology editor for collaboratively modeling and managing RDF/OWL vocabularies and SHACL shapes. | Ontology/ Taxonomy Editor | Knowledge Engineers, Ontologists, Data Modelers, Domain Experts | Ontology Modeling, Schema / Model Design, KG Schema Governance | Cloud, On-Prem | RDF stores and SPARQL endpoints (as supported by deployment) | RDF, OWL, SHACL | SPARQL | No-code, Pro-code | No | Partial | General Purpose | Provides a collaborative web UI for ontology and shape management on top of RDF backends, fitting into semantic modeling workflows rather than generic admin consoles. | https://github.com/semmtech/semmweb-ontology-editor |  |
| SousLesensVocables | SousLesens | Web based tools to manage thesauri and ontologies using SKOS, OWL, and RDF, including editing, alignment, and publication features. | Ontology/ Taxonomy Editor | Knowledge Engineers, Ontologists, Data Modelers, Domain Experts | Ontology Modeling, Taxonomy Management, Schema / Model Design, KG Schema Governance | Cloud, On-Prem | RDF stores and SPARQL endpoints (as supported by deployment) | RDF, OWL, SKOS | SPARQL | Low-code | No | Yes | General Purpose | Provides a suite of web tools for thesaurus and ontology lifecycle management, with SKOS‑first workflows that can evolve into richer OWL‑based models. | https://souslesens.github.io/souslesensVocables/index.html |  |
| Stardog Designer | Stardog | No‑code environment for designing, documenting, and deploying knowledge graph models and applications on the Stardog platform. | Ontology/ Taxonomy Editor | Developers, Data Engineers, Knowledge Engineers, Analysts | Knowledge Graph Setup, Application Building, Schema / Model Design, Data Exploration | Cloud, On-Prem | Stardog | RDF, OWL, SHACL | SPARQL | No-code, Low-code, Pro-code | Yes | Yes | General Purpose: Other Regulated Industries | Positions Stardog Designer as a visual, no‑code layer for modeling and application design on top of the Stardog knowledge graph, rather than a standalone database or thin admin console. | https://docs.stardog.com/stardog-applications/designer/ | https://tdwi.org/articles/2022/03/02/stardog-designer.aspx |
| VocBench | University of Rome Tor Vergata and collaborators | Open source, web based collaborative environment for editing, managing, and publishing OWL, SKOS, and RDF vocabularies. | Ontology/ Taxonomy Editor | Knowledge Engineers, Ontologists, Data Modelers, Domain Experts | Ontology Modeling, Taxonomy Management, KG Schema Governance, Knowledge Graph Setup | Cloud, On-Prem | RDF stores and SPARQL endpoints (e.g., GraphDB, Virtuoso, Jena/Fuseki) | RDF, OWL, SKOS | SPARQL | No-code | No | Yes | General Purpose | Collaborative semantic web editor focused on managing vocabularies and ontologies at scale, including workflows, validation, and publication. | https://vocbench.uniroma2.it | https://www.bobdc.com/blog/vocbench/ |
| Zazuko Ontology Manager | Zazuko | Open source web application for creating, browsing, and managing RDF schemas and ontologies used in knowledge graph projects. | Ontology/ Taxonomy Editor | Knowledge Engineers, Data Modelers, Domain Experts | Ontology Modeling, Taxonomy Management, KG Schema Governance, Knowledge Graph Setup | Cloud, On-Prem | Any RDF store or triple store supported via SPARQL endpoints | RDF, OWL, SKOS | SPARQL | Low-code | No | Yes | General Purpose | Provides a team‑oriented environment for managing vocabularies and ontologies, including versioning and reuse across projects. | https://zazuko.com/blog/schema-manager-oss | https://github.com/zazuko/ontology-manager |

## Legend

Rows: 71; columns: 1.

| A |
| --- |
| Graph Application Development |
| Legend & Taxonomy |
| Scope |
| Main table = current graph application development tools, graph clients, graph powered analytical applications, and ontology/ taxonomy editors |
| Context fields such as Notes and Sources are included to capture how products position themselves and how they are used in practice. |
| Tool Type |
| Graph App Development Platforms – Platforms for building and operating applications on top of graph databases or RDF triple stores (often low code or no code). |
| Graph Clients / IDEs – Workbenches and clients focused on querying, debugging, visualization, and day to day developer and data engineer workflows. |
| Graph-Powered Analytical Applications – Opinionated analytical or investigative environments where graph is central to domain specific workflows. |
| Ontology and Taxonomy Editors – Web or enterprise tools for modeling, managing, and governing RDF / OWL / SKOS ontologies, vocabularies, and taxonomies in multi user, repeatable environments that underpin graph applications. |
| Users |
| Developers – Application and backend developers working directly with graph queries, APIs, and integration. |
| Data Engineers – Users responsible for pipelines, data preparation, and connecting graph stores to other systems. |
| Knowledge Engineers – Practitioners modeling knowledge graphs, ontologies, and RDF based systems. |
| Analysts / Investigators – Users running investigations, analysis, and insight workflows inside graph powered workspaces. |
| Business Users – Non technical or semi technical users consuming graph backed applications and dashboards. |
| Consultants – External experts who design, prototype, and deliver graph based applications for clients. |
| Ontologists – Specialists who design and maintain ontologies, including classes, properties, and axioms for semantic models. |
| Data Modelers – Specialists who design and evolve data and schema structures, including ontology classes, relationships, and constraints. |
| Domain Experts – Subject matter experts who contribute business concepts, term definitions, and validation for ontologies and taxonomies. |
| Applications |
| Knowledge Graph Setup – Standing up and configuring knowledge graphs on existing stores, including schema and ontology work. |
| Application Building – Designing and assembling graph backed applications, internal tools, or user facing products. |
| Schema / Model Design – Defining and evolving graph models across LPG and RDF backends. |
| Workflow Automation – Automating graph related processes such as model production, enrichment, and review flows. |
| Querying / Debugging – Writing, testing, and tuning graph queries and integrations. |
| Graph Visualization / Data Exploration – Interactive exploration of graph data, schemas, and results, including ontology and taxonomy views. |
| Results Analysis / Intelligence Analysis – Structured analytical or investigative workflows built on graph data and semantic models. |
| Deployment / Availability |
| Cloud – Vendor or customer hosted cloud deployments. |
| On-Prem – Deployed in customer data centers or private infrastructure. |
| Self-hosted – Customer operated deployments, typically in their own cloud or on premises. |
| SaaS – Vendor hosted, multi tenant software as a service. |
| Docker / Containers – Packaged images for container based deployment. |
| Supported Graph Databases / Stores |
| Lists the graph databases, RDF triple stores, or compatible platforms that the tool can connect to directly. |
| May include single vendor engines, multi database support, or “any compliant RDF store” where applicable. |
| Data Model |
| LPG – Property graph model as the underlying abstraction. |
| RDF – RDF and linked data as the underlying model, typically with SPARQL. |
| LPG, RDF – Supports both LPG and RDF backends or models. |
| OWL – Ontology Web Language used for expressive ontologies on top of RDF. |
| SKOS – Simple Knowledge Organization System used for taxonomies, thesauri, and controlled vocabularies. |
| SHACL – Shapes Constraint Language used for validating and constraining RDF graphs. |
| Query Languages |
| Cypher / openCypher / GQL – Property graph query languages exposed by the tool or its backends. |
| Gremlin – Traversal based graph query language. |
| SPARQL – RDF / semantic web query language. |
| SQL / SQL:2023 – Relational or emerging standard graph extensions exposed to users. |
| Other APIs – Additional APIs or language specific clients where relevant. |
| No-code / Low-code / Pro-code |
| No-code – End users can define applications or workflows primarily through configuration, forms, and visual builders. |
| Low-code – Combines visual configuration with optional scripting or query editing for more advanced use. |
| Pro-code – Oriented around writing queries, scripts, or code, with UI and visualization wrapped around those capabilities. |
| Visual Application Builder |
| Yes – Provides visual builders or configuration driven tools to assemble applications, flows, or interfaces on top of graph data. |
| No – Does not provide a full visual app builder, though it may still offer UI components or dashboards. |
| Visual Exploration / Result Visualization |
| Yes – Offers interactive visual exploration of graphs or rich result visualization beyond raw tables. |
| Partial – Provides basic or embedded visualization but not as a primary capability. |
| No – Primarily text or API based interaction, minimal visualization. |
| Industry |
| General Purpose – Designed to be domain neutral and usable across many industries. |
| Government / Security / Intelligence – Strong positioning around public sector, security, or intelligence workflows. |
| Other Regulated Industries – Focus on sectors like finance, healthcare, or other regulated domains. |
| Enterprise AI – Emphasis on explainable AI, RAG, or AI enablement on top of graph data. |
| Notes |
| Short narrative to capture positioning, architectural nuances, or patterns such as multi database support, lifecycle focus, or AI centric features. |
| Sources |
| Primary Source – Main product documentation, official site, or canonical vendor material. |
| Secondary Sources – Supplemental references such as blogs, talks, reviews, or marketplace listings that clarify capabilities or deployment. |

## Eligibility Criteria

Rows: 3; columns: 1.

| A |
| --- |
| Graph Application Development |
| Eligibility Criteria |
| To be included, an offering has to meet three criteria:<br>1. Graph-native application layer: The tool understands graph data models natively (nodes, edges, properties, RDF triples) and speaks graph query languages (Cypher, SPARQL, Gremlin, GSQL) as a first-class capability. It does not replace the underlying graph store as the system of record. This is what distinguishes graph app development tools from generic low-code platforms that happen to support a graph connector.<br>2. Durable application environment: Serves as a repeatable environment for building, running, and maintaining graph-powered tools and workflows. Its main role is to support ongoing applications, investigations, or workflows – not one-off demos, static viewers, or thin admin consoles.<br>3. Clear deployment model: Has a documented deployment story (SaaS, on-prem, self-hosted, containers) so architects can evaluate how it fits into an existing stack. Supported graph backends are explicitly named. |
