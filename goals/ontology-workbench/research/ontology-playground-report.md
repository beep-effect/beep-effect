## 1. What the project is: purpose, README claims, maturity signals, license

- Purpose: `Ontology Playground (Preview)` is a static React web app for learning Fabric IQ ontology concepts, browsing catalogue ontologies, designing ontologies, visualizing them as graphs, exporting RDF/XML, and embedding viewers. Evidence: `README.md`, `src/App.tsx`, `src/embed.tsx`.
- Catalogue scale in this checkout: `public/catalogue.json` contains `count: 71` entries across `official`, `community`, and `external` sources. Evidence: `public/catalogue.json`, `scripts/compile-catalogue.ts`.
- README claims include Cytoscape graph exploration, visual designer, RDF/XML import/export, Ontology School, quests, NL query playground, command palette, starter templates, onboarding tour, embeds, and deep links. Evidence: `README.md`.
- Maturity signals are mixed: project is explicitly “Preview” and notes AI-assisted coding, but has CI, deploy workflows, RDF validation, tests, a11y contrast tests, docs, and a roadmap. Evidence: `README.md`, `.github/workflows/ci.yml`, `.github/workflows/deploy-ghpages.yml`, `.github/workflows/secret-scan.yml`, `TODO.md`.
- License: `LICENSE` contains `MIT License`; README also says `MIT`. This is permissive for borrowing ideas/code subject to MIT notice preservation. Evidence: `LICENSE`, `README.md`.
- Important caveat: README/docs describe one-click GitHub PR submission, and `src/lib/github.ts` implements device-flow/fork/branch/PR helpers, but the visible designer submit modal only downloads RDF/metadata and gives manual PR instructions. Evidence: `README.md`, `docs/github-oauth-setup.md`, `src/lib/github.ts`, `src/components/designer/SubmitCatalogueModal.tsx`.

## 2. Tech stack: languages, frameworks, UI libs, graph/visualization libraries, ontology/RDF/OWL libraries, build tooling

- Main app: TypeScript/TSX, React, CSS, JSON, markdown content, RDF/XML catalogue files. Evidence: `src/main.tsx`, `src/App.tsx`, `src/styles/app.css`, `content/learn/`, `catalogue/`.
- Root runtime dependencies, exact locked versions: `react 19.2.4`, `react-dom 19.2.4`, `zustand 5.0.10`, `framer-motion 12.29.2`, `lucide-react 0.563.0`, `sanitize-html 2.17.1`. Evidence: `package.json`, `package-lock.json`.
- Graph/visualization: `cytoscape 3.33.1`, `cytoscape-fcose 2.2.0`, `@types/cytoscape 3.21.9`; no d3/react-flow/sigma usage found in manifests/source. Evidence: `package.json`, `package-lock.json`, `src/components/OntologyGraph.tsx`, `src/components/designer/DesignerPreview.tsx`, `src/components/EmbedWidget.tsx`.
- RDF/OWL handling: custom RDF/XML parser/serializer using browser `DOMParser` and string generation; no rdflib, N3.js, rdf-ext, sparqljs, owlready2, SHACL, or reasoner dependency found. Evidence: `src/lib/rdf/parser.ts`, `src/lib/rdf/serializer.ts`, `package.json`, `api/package.json`.
- Build/test tooling, exact locked versions: `vite 8.0.16`, `@vitejs/plugin-react 5.2.0`, `typescript 5.9.3`, `tsx 4.22.4`, `vitest 4.1.8`, `eslint 9.39.2`, `jsdom 28.0.0`, `marked 17.0.2`, `@playwright/test 1.60.0`. Evidence: `package.json`, `package-lock.json`, `vite.config.ts`, `vite.config.embed.ts`.
- Optional API: Azure Functions package with `@azure/functions 4.14.0`; used for Azure OpenAI ontology generation and GitHub OAuth proxy. Evidence: `api/package.json`, `api/package-lock.json`, `api/generate-ontology/index.ts`, `api/github-oauth-proxy/index.ts`.

## 3. Feature inventory: what can a user actually do? Editing (classes, properties, individuals, axioms)? Visualization (graph layouts, tree views)? Exploration (search, filtering, SPARQL querying)? Import/export formats (Turtle, RDF/XML, OWL/XML, JSON-LD, OBO)? Reasoning/inference support?

- Editing: users can create/edit ontology metadata, entity types/classes, entity properties, icons/colors, relationships/object properties, cardinalities, relationship attributes, and identifiers. Evidence: `src/components/OntologyDesigner.tsx`, `src/components/designer/EntityForm.tsx`, `src/components/designer/RelationshipForm.tsx`, `src/store/designerStore.ts`.
- Not present: no confirmed UI for editing individuals/instances. `EntityInstance` exists as a TypeScript interface/sample data, but the designer forms target entity types and relationships. Evidence: `src/data/ontology.ts`, `src/components/designer/EntityForm.tsx`, `src/components/designer/RelationshipForm.tsx`.
- Not present: no confirmed UI/model for OWL axioms such as subclass hierarchies, equivalent/disjoint classes, restrictions, sameAs, or SHACL constraints. Parser/serializer handle `owl:Class`, `owl:DatatypeProperty`, `owl:ObjectProperty`, and custom annotations. Evidence: `src/lib/rdf/parser.ts`, `src/lib/rdf/serializer.ts`, `docs/TODO-full-ontology-format.md`.
- Visualization: Cytoscape schema graph with fCoSE layout, pan/zoom, fit/reset, PNG export, click selection, double-click focus neighborhood, highlighted query/path results. Evidence: `src/components/OntologyGraph.tsx`.
- Exploration: catalogue search/filter, graph search/filter, inspector, stats, directed shortest-path finder, heuristic natural-language query playground. Evidence: `src/components/GalleryModal.tsx`, `src/components/SearchFilter.tsx`, `src/components/InspectorPanel.tsx`, `src/components/OntologyStatsPanel.tsx`, `src/components/PathFinderPanel.tsx`, `src/data/queryEngine.ts`.
- SPARQL querying is not present; NL query is string/pattern matching over the in-memory model, and path finding is BFS over relationships. Evidence: `src/data/queryEngine.ts`, `src/lib/pathFinder.ts`.
- Import/export: RDF/XML `.rdf`, `.owl`, and `.iq` import are supported; RDF/XML export is default. JSON import/export plus YAML/CSV export are behind `VITE_ENABLE_LEGACY_FORMATS`. Evidence: `src/components/ImportExportModal.tsx`, `src/lib/rdf/parser.ts`, `src/lib/rdf/serializer.ts`.
- Not present: no confirmed Turtle, JSON-LD, OBO, OWL/XML-specific importer/exporter. Evidence: `src/components/ImportExportModal.tsx`, `src/components/EmbedWidget.tsx`, `docs/embed-guide.md`.
- Reasoning/inference support is not present; no reasoner dependency or inference module was found. Evidence: `package.json`, `src/data/queryEngine.ts`, `src/lib/pathFinder.ts`.

## 4. Architecture: in-memory data model for the ontology, state management approach, persistence (files? triplestore? localStorage?), client-only vs server component

- Core model is plain TypeScript: `Ontology { name, description, entityTypes, relationships }`; `EntityType` has properties/icon/color; `Relationship` has `from`, `to`, cardinality, description, optional attributes. Evidence: `src/data/ontology.ts`.
- App state uses Zustand: `useAppStore` holds loaded ontology, bindings, selected/highlighted IDs, theme, quests, and query result; `useDesignerStore` holds an isolated draft ontology with validation and undo/redo snapshots. Evidence: `src/store/appStore.ts`, `src/store/designerStore.ts`.
- Persistence is mostly static/files: catalogue RDF and metadata are compiled into `public/catalogue.json`; runtime loads that JSON by fetch. Evidence: `scripts/compile-catalogue.ts`, `public/catalogue.json`, `src/components/GalleryModal.tsx`, `src/App.tsx`.
- Browser persistence is limited: theme and GitHub token use `localStorage`; share links use compressed URL fragments; ontology export uses browser downloads. Evidence: `src/store/appStore.ts`, `src/lib/github.ts`, `src/lib/shareCodec.ts`, `src/components/ImportExportModal.tsx`.
- No triplestore, local database, or durable project/workspace persistence found. Evidence: `src/store/appStore.ts`, `scripts/compile-catalogue.ts`, `package.json`.
- Main app is client/static. Server code is optional Azure Functions for AI generation and GitHub OAuth proxy, gated by env/config rather than required for normal exploration/designer use. Evidence: `README.md`, `vite.config.ts`, `api/generate-ontology/index.ts`, `api/github-oauth-proxy/index.ts`.

## 5. Key UI patterns: main screens/panels, how editing and visualization interact, anything clever worth copying

- Main workspace pattern: header action bar, central graph canvas, quest panel, and right sidebar with stats, path finder, search/filter, inspector, and query playground. Evidence: `src/App.tsx`, `src/components/Header.tsx`.
- Designer pattern: full-screen split pane with metadata topbar, entity/relationship forms on the left, live graph/RDF preview on the right, and toolbar actions for undo/redo/new/validate/export/load/submit. Evidence: `src/components/OntologyDesigner.tsx`, `src/components/designer/DesignerActions.tsx`, `src/components/designer/DesignerPreview.tsx`.
- Editing and visualization are tightly coupled: graph clicks select form items; form changes incrementally sync Cytoscape nodes/edges; RDF tab can be edited/imported back into the draft. Evidence: `src/components/designer/DesignerPreview.tsx`, `src/store/designerStore.ts`.
- Clever reusable patterns: regex-based RDF highlighter with no heavy dependency, compressed share URLs with download fallback, standalone embeddable IIFE widget, and build-time catalogue compilation with round-trip RDF validation. Evidence: `src/lib/rdf/highlighter.ts`, `src/lib/shareCodec.ts`, `src/embed.tsx`, `src/components/EmbedWidget.tsx`, `scripts/compile-catalogue.ts`.

## 6. Reusable pieces: specific modules/algorithms/components that could realistically be ported or wrapped into a TypeScript Effect-based monorepo, vs what is throwaway/language-incompatible

- Highly reusable: `src/data/ontology.ts` domain shape, `src/lib/rdf/parser.ts`, `src/lib/rdf/serializer.ts`, and `src/lib/rdf/highlighter.ts`; these are TypeScript and can be wrapped behind Effect services. Evidence: listed files.
- Reusable with minor adaptation: `src/store/designerStore.ts` validation rules, naming constraints, undo/redo snapshot logic, and draft model mutations. Evidence: `src/store/designerStore.ts`, `src/store/designerStore.test.ts`.
- Reusable UI patterns/components: Cytoscape graph setup, live designer preview, inspector, path finder, gallery filtering, and embed widget. Evidence: `src/components/OntologyGraph.tsx`, `src/components/designer/DesignerPreview.tsx`, `src/components/InspectorPanel.tsx`, `src/lib/pathFinder.ts`, `src/components/GalleryModal.tsx`, `src/components/EmbedWidget.tsx`.
- Reusable build-time algorithms: catalogue directory discovery, metadata validation, RDF parse/serialize round-trip check, and validation script structure. Evidence: `scripts/compile-catalogue.ts`, `scripts/validate-rdf.ts`, `catalogue/metadata-schema.json`.
- Reusable only if Fabric is in scope: Fabric definition conversion and REST push. It is browser-token based and maps only the simplified model, so it should be isolated behind a secure desktop credential flow if used. Evidence: `src/lib/fabric.ts`, `src/components/FabricExportModal.tsx`.
- Mostly throwaway for a professional desktop ontology editor: quests, learning content, Microsoft/Fabric-specific branding, manual community contribution flows, and Azure OpenAI demo UI. Evidence: `src/data/quests.ts`, `content/learn/`, `src/components/NLBuilderModal.tsx`, `api/generate-ontology/index.ts`, `src/components/designer/SubmitCatalogueModal.tsx`.
- Inference for the target Electron/React/Effect app: the portable core is not the full app, but the RDF subset parser/serializer, graph interaction patterns, validation/history approach, and embed-style isolated viewer are good planning inputs. Evidence basis: `src/lib/rdf/*`, `src/components/OntologyGraph.tsx`, `src/store/designerStore.ts`, `src/components/EmbedWidget.tsx`.

## 7. Gaps/weaknesses: what the project does poorly or lacks, so a new implementation can do better

- Ontology semantics are shallow: no full RDF graph model, no RDFJS dataset, no SPARQL, no reasoner, no SHACL, and no rich OWL axioms. Evidence: `package.json`, `src/lib/rdf/parser.ts`, `src/lib/rdf/serializer.ts`, `docs/TODO-full-ontology-format.md`.
- Format support is narrow: RDF/XML is first-class; JSON is legacy-gated; Turtle, JSON-LD, OBO, and OWL/XML-specific flows are not present. Evidence: `src/components/ImportExportModal.tsx`, `src/components/EmbedWidget.tsx`, `docs/embed-guide.md`.
- No robust durable project persistence: no local file workspace model, version history, triplestore, or desktop database; state is in memory plus downloads/share links/static catalogue. Evidence: `src/store/appStore.ts`, `src/store/designerStore.ts`, `src/lib/shareCodec.ts`, `scripts/compile-catalogue.ts`.
- Large ontology support appears weak by design: docs recommend 5-8 entities and warn that more than 10 gets cluttered. Evidence: `docs/authoring-guide.md`.
- NL query/search are demos, not semantic querying: they return templated interpretations and highlights rather than executable SPARQL or graph queries. Evidence: `src/data/queryEngine.ts`.
- GitHub catalogue submission is inconsistent: docs and helper library describe automated PRs, but the visible submit modal falls back to manual downloads/instructions. Evidence: `README.md`, `docs/github-oauth-setup.md`, `src/lib/github.ts`, `src/components/designer/SubmitCatalogueModal.tsx`.
- Fabric integration asks users to paste bearer tokens into UI; that is acceptable for a demo, but a professional desktop app should use a proper auth/secret store. Evidence: `src/components/FabricExportModal.tsx`.
- Accessibility and offline support remain incomplete in the roadmap: keyboard navigation, graph ARIA labels, screen-reader testing, PWA/offline cache, analytics, and ontology diffing are still TODOs. Evidence: `TODO.md`.

Codex session ID: 019f43cc-2fe4-7190-be58-8cf49ff7cc75
Resume in Codex: codex resume 019f43cc-2fe4-7190-be58-8cf49ff7cc75
