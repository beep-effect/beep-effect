---
"@beep/agents-server": patch
"@beep/agents-use-cases": patch
"@beep/ai-sync": patch
"@beep/architecture-lab-use-cases": patch
"@beep/box": patch
"@beep/box-provisioning": patch
"@beep/dock-react": patch
"@beep/documents-server": patch
"@beep/editor": patch
"@beep/effect-drizzle": patch
"@beep/epistemic-server": patch
"@beep/face-detection": patch
"@beep/ffmpeg": patch
"@beep/file-processing": patch
"@beep/firecrawl": patch
"@beep/gov-legal-mcp": patch
"@beep/identity": patch
"@beep/law-practice-use-cases": patch
"@beep/m365": patch
"@beep/nlp": patch
"@beep/nlp-mcp": patch
"@beep/nlp-processing": patch
"@beep/obs": patch
"@beep/oip-web": patch
"@beep/ontology": patch
"@beep/ontology-use-cases": patch
"@beep/openai-compat": patch
"@beep/openclaw": patch
"@beep/oxigraph": patch
"@beep/pacer": patch
"@beep/postgres": patch
"@beep/professional-desktop": patch
"@beep/qa-capture": patch
"@beep/repo-ai-metrics": patch
"@beep/runpod": patch
"@beep/sanity": patch
"@beep/schema": patch
"@beep/shared-domain": patch
"@beep/tika": patch
"@beep/todox": patch
"@beep/tsgo-shim": patch
"@beep/ui": patch
"@beep/uspto": patch
"@beep/utils": patch
"@beep/venice-ai": patch
"@beep/wink": patch
"@beep/workspace-server": patch
"@beep/xai": patch
---

Upgrade `@effect/tsgo` to 0.39.1, configure every installed diagnostic as an error, and repair the newly
enforced diagnostics across all inherited package and test projects. Effect Drizzle retains its single intentional
`missedPipeableOpportunity` exception while preserving its established multi-argument consumer APIs with
rest-tuple signatures.
