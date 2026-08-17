You are a repo-archaeology lane in a 16-lane parallel study. Your output is a report FILE, not a chat answer.

OUTPUT CONTRACT:
- Write to: goals/agentic-cad-patent-tooling/research/2026-08-17-fanout/reports/r8-beep-kg-model.md
- CREATE within FIRST 5 turns, APPEND as you read. Final chat message = pointer only.
- Cite `path/to/file.ts:LINE`. Read real code. DO NOT build, install, run, or MODIFY any file outside your report path. You are in a throwaway worktree snapshot; still, do not modify it — read-only.

TARGET: <repo-worktree-snapshot> (an isolated, detached git worktree snapshot of the beep-effect2 repo at HEAD — read this, never the original checkout) — Effect-v4 monorepo. Focus on the knowledge-graph / domain-model side: `packages/law-practice`, `packages/epistemic`, `packages/ontology`, `packages/documents`, and `apps/practice-kg-mcp`.

The question: **if a CAD model and its rendered figures become first-class nodes in this knowledge graph, where do they go and what do they connect to?**

Answer with file:line evidence:
1. ENTITY INVENTORY — the existing domain entities in `packages/law-practice` (Matter, Client, Document, Deadline, Claim, ...?). List them with their file locations and their key schema fields. Show 2-3 representative schema definitions verbatim so the conventions are legible.
2. GRAPH MODEL — how are nodes and edges represented? Is there a generic node/edge substrate (`packages/ontology`? `packages/epistemic`?) or are relations just foreign keys? Find the actual mechanism and show it.
3. DOCUMENT MODEL — `packages/documents`: how is a document represented, stored, chunked, and linked to a matter? Are there attachments/artifacts/binary blobs today? How does provenance/citation work (spans, evidence)?
4. EPISTEMIC LAYER — `packages/epistemic`: claims, evidence, contradictions, bitemporality. What would it mean for a CAD figure to carry epistemic status (e.g. "this rendering is derived from disclosure X, version 3")? Describe the existing primitives that would carry that.
5. ONTOLOGY LAYER — `packages/ontology`: is there a formal ontology (RDF/OWL/SHACL? a TS-native one?), and how are new concepts added? Is there a `bun run beep architecture` scaffold for new slices/concepts? Show the command and what it generates.
6. THE MCP SURFACE — `apps/practice-kg-mcp`: what tools are exposed to agents today, with their schemas. What would a "cad" toolset need to look like to fit the existing conventions? Quote an existing tool definition verbatim as the template.
7. PERSISTENCE — database (drizzle? sqlite? postgres?), migration workflow, and how a new entity gets a table. Cite the migration conventions.
8. VERDICT — a concrete schema-first proposal sketch: the new entities needed (e.g. `CadModel`, `Figure`, `ReferenceNumeral`, `FigureSet`) and their edges to existing entities, expressed in this repo's conventions. Flag anything that already exists and should be reused instead of created.
