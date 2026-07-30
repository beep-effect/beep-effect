---
"@beep/schema": patch
"@beep/agents-domain": patch
"@beep/mcp-kit": patch
"@beep/repo-docgen": patch
---

Update the Effect dependency catalog and align schema and tooling integrations
with the latest v4 beta APIs.

Keep variant-aware class constructors compatible with directly extendable
schemas, preserve tagged-error field equivalence through recursive class
extension, migrate valid dates and concurrency options, and give reused
package.json and assistant-content schema representations stable reference
ownership.
