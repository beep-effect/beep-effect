---
"@beep/repo-cli": patch
"@beep/repo-utils": patch
---

Scope workspace lint surfaces off self-contained Lambda bundle packages:
`infra/lambda/**` joins the shared TypeScript source exclusions and the
schema-first scan globs narrow to `infra/{src,test}`, so esbuild-bundled
deploy-artifact source (own package.json, no workspace deps) stops tripping
workspace-reachability and Effect-law gates.
