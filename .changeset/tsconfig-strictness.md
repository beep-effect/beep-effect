---
"@beep/agents-client": patch
"@beep/agents-server": patch
"@beep/agents-use-cases": patch
"@beep/brand": patch
"@beep/cosmos": patch
"@beep/dock": patch
"@beep/dock-react": patch
"@beep/editor": patch
"@beep/effect-drizzle": patch
"@beep/epistemic-client": patch
"@beep/epistemic-server": patch
"@beep/epistemic-ui": patch
"@beep/epistemic-use-cases": patch
"@beep/face-detection": patch
"@beep/graph-3d": patch
"@beep/html": patch
"@beep/identity": patch
"@beep/langextract": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/m365-mcp": patch
"@beep/md": patch
"@beep/nlp": patch
"@beep/nlp-processing": patch
"@beep/observability": patch
"@beep/ontology-client": patch
"@beep/ontology-ui": patch
"@beep/ontology-use-cases": patch
"@beep/openclaw": patch
"@beep/postgres": patch
"@beep/pretext": patch
"@beep/professional-desktop": patch
"@beep/rdf": patch
"@beep/repo-ai-metrics": patch
"@beep/repo-docgen": patch
"@beep/runpod": patch
"@beep/schema": patch
"@beep/shared-domain": patch
"@beep/test-utils": patch
"@beep/ui": patch
"@beep/utils": patch
"@beep/venice-ai": patch
---

Satisfy the stricter base compiler options (lib ESNext, noImplicitReturns,
noUncheckedIndexedAccess, allowUnreachableCode=false, allowUnusedLabels=false):
browser packages declare the dom lib explicitly and indexed reads go through
Option, narrowing, or typed tuples.
