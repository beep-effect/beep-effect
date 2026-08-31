---
"@beep/acp": patch
"@beep/agents-domain": patch
"@beep/agents-use-cases": patch
"@beep/ai-sync": patch
"@beep/architecture-lab-domain": patch
"@beep/architecture-lab-use-cases": patch
"@beep/box": patch
"@beep/box-provisioning": patch
"@beep/chalk": patch
"@beep/codegen-kit": patch
"@beep/db-admin": patch
"@beep/dock": patch
"@beep/documents-domain": patch
"@beep/documents-use-cases": patch
"@beep/drizzle": patch
"@beep/duckdb": patch
"@beep/editor": patch
"@beep/epistemic-config": patch
"@beep/epistemic-domain": patch
"@beep/epistemic-server": patch
"@beep/epistemic-ui": patch
"@beep/epistemic-use-cases": patch
"@beep/exiftool": patch
"@beep/face-detection": patch
"@beep/ffmpeg": patch
"@beep/file-processing": patch
"@beep/firecrawl": patch
"@beep/gov-legal-mcp": patch
"@beep/govinfo": patch
"@beep/html": patch
"@beep/hubspot": patch
"@beep/infra": patch
"@beep/langextract": patch
"@beep/law-practice-domain": patch
"@beep/law-practice-server": patch
"@beep/law-practice-use-cases": patch
"@beep/lexical-schema": patch
"@beep/lint-rules": patch
"@beep/m365": patch
"@beep/mcp-kit": patch
"@beep/md": patch
"@beep/nlp": patch
"@beep/nlp-mcp": patch
"@beep/obs": patch
"@beep/observability": patch
"@beep/oip-web": patch
"@beep/onepassword-cli": patch
"@beep/ontology": patch
"@beep/ontology-client": patch
"@beep/ontology-domain": patch
"@beep/ontology-ui": patch
"@beep/ontology-use-cases": patch
"@beep/openai-compat": patch
"@beep/openclaw": patch
"@beep/pacer": patch
"@beep/pandoc-ast": patch
"@beep/phoenix": patch
"@beep/professional-desktop": patch
"@beep/qa-capture": patch
"@beep/rdf": patch
"@beep/repo-ai-metrics": patch
"@beep/repo-configs": patch
"@beep/repo-docgen": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/schema": minor
"@beep/semantic-web": patch
"@beep/shared-domain": patch
"@beep/shared-use-cases": patch
"@beep/skill-contract": patch
"@beep/test-utils": patch
"@beep/tika": patch
"@beep/ui": patch
"@beep/uspto": patch
"@beep/uspto-mcp": patch
"@beep/utils": patch
"@beep/venice-ai": patch
"@beep/wink": patch
"@beep/workspace-use-cases": patch
"@beep/xai": patch
---

Replace broad schema codec-static bundles with an exact, typed
`withCodecStatics(keys)` selector and add frozen `classStatics(this, keys)`
utility bags for Effect Schema classes.

Migrate consumers to their minimum required statics, make JSON-string
boundaries explicit, and remove the legacy Sync, Promise, Effect, Exit, Option,
and Result bundle helpers.
