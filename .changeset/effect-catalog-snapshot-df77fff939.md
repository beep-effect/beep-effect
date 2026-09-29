---
"@beep/acp": patch
"@beep/agents-client": patch
"@beep/agents-domain": patch
"@beep/agents-server": patch
"@beep/agents-use-cases": patch
"@beep/ai-provider-cli": patch
"@beep/ai-sync": patch
"@beep/anthropic": patch
"@beep/api-docs": patch
"@beep/api-transport": patch
"@beep/architecture-lab-config": patch
"@beep/architecture-lab-domain": patch
"@beep/architecture-lab-proof": patch
"@beep/architecture-lab-server": patch
"@beep/architecture-lab-tables": patch
"@beep/architecture-lab-ui": patch
"@beep/architecture-lab-use-cases": patch
"@beep/box": patch
"@beep/box-provisioning": patch
"@beep/brand": patch
"@beep/chalk": patch
"@beep/ciops": patch
"@beep/codegen-kit": patch
"@beep/cosmos": patch
"@beep/colors": patch
"@beep/db-admin": patch
"@beep/discord": patch
"@beep/doc-text": patch
"@beep/dock": patch
"@beep/dock-react": patch
"@beep/documents-domain": patch
"@beep/documents-server": patch
"@beep/documents-use-cases": patch
"@beep/drizzle": patch
"@beep/duckdb": patch
"@beep/ecfr": patch
"@beep/editor": patch
"@beep/effect-drizzle": patch
"@beep/epistemic-client": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-server": patch
"@beep/epistemic-tables": patch
"@beep/epistemic-ui": patch
"@beep/epistemic-use-cases": patch
"@beep/exiftool": patch
"@beep/face-detection": patch
"@beep/fc-runs": patch
"@beep/ffmpeg": patch
"@beep/file-processing": patch
"@beep/firecrawl": patch
"@beep/freshbooks": patch
"@beep/gov-legal-mcp": patch
"@beep/govinfo": patch
"@beep/html": patch
"@beep/hubspot": patch
"@beep/identity": patch
"@beep/infra": patch
"@beep/langextract": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/law-practice-tables": patch
"@beep/law-practice-use-cases": patch
"@beep/lejeune-bolt-workbench": patch
"@beep/lexical-schema": patch
"@beep/libpff": patch
"@beep/lint-rules": patch
"@beep/m365": patch
"@beep/m365-mcp": patch
"@beep/mcp-kit": patch
"@beep/md": patch
"@beep/nlp": patch
"@beep/nlp-mcp": patch
"@beep/nlp-processing": patch
"@beep/obs": patch
"@beep/observability": patch
"@beep/oip-web": patch
"@beep/onepassword-cli": patch
"@beep/ontology": patch
"@beep/ontology-client": patch
"@beep/ontology-server": patch
"@beep/ontology-ui": patch
"@beep/ontology-use-cases": patch
"@beep/openai": patch
"@beep/openai-compat": patch
"@beep/openclaw": patch
"@beep/pacer": patch
"@beep/pandoc-ast": patch
"@beep/pglite": patch
"@beep/phoenix": patch
"@beep/postgres": patch
"@beep/practice-kg-mcp": patch
"@beep/professional-desktop": patch
"@beep/provenance": patch
"@beep/qa-capture": patch
"@beep/rdf": patch
"@beep/rdf-canonize": patch
"@beep/repo-ai-metrics": patch
"@beep/repo-configs": patch
"@beep/repo-docgen": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/schema": patch
"@beep/semantic-web": patch
"@beep/semantica": patch
"@beep/shared-domain": patch
"@beep/skill-contract": patch
"@beep/storybook": patch
"@beep/tailscale": patch
"@beep/test-runner": patch
"@beep/test-utils": patch
"@beep/tika": patch
"@beep/todox": patch
"@beep/ui": patch
"@beep/uspto": patch
"@beep/uspto-mcp": patch
"@beep/utils": patch
"@beep/venice-ai": patch
"@beep/wink": patch
"@beep/workspace-domain": patch
"@beep/workspace-server": patch
"@beep/workspace-use-cases": patch
"@beep/xai": patch
---

Move the Effect catalog from the pkg.pr.new snapshot of main commit e5f7d12af9 to
the snapshot of commit df77fff939 (2026-09-28, nine commits after the
4.0.0-rc.118 tag). The installed train still reports `4.0.0-rc.118`. The Bun
patches for `effect` and `@effect/platform-node-shared` are re-keyed to the new
snapshot URLs because the upstream sources they patch are unchanged, and the OSV
override for the URL pin is re-keyed.

Upstream #8580 now requires `S.brand` and `S.fromBrand` to receive a single
concrete brand key. `URLStr` and the NLP index brands (`TokenIndex`,
`CharPosition`, `SentenceIndex`, `DocumentIndex`) wrap an already-branded base, so
their constructors carry two keys. They now use `S.brand` directly, keeping the
`URLStr` URL check. `Thunk.TypeId` is typed as its literal identity string, and
the generic entity-id and public-id factories pass their brand type explicitly.
