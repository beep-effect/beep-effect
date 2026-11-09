# Cache baseline review: deep property sweep inputs (2026-11-09)

## Change

`turbo.json` declares two more inputs on the `test:property` task:

- `$TURBO_ROOT$/vitest.property-runner.ts`
- `$TURBO_ROOT$/packages/tooling/test-kit/fc-runs/src/PropertySelection.ts`

Under an active `BEEP_FC_NUM_RUNS` floor the root `vitest.shared.ts` now installs
`vitest.property-runner.ts` as the Vitest runner and loads the selection rules
from `PropertySelection.ts`. Together they decide which tests a package's
property sweep executes, so a change to either file has to invalidate every
package's cached `test:property` result. Without the two inputs a cached green
could outlive a change to the selection.

- Command, outputs, environment, dependency edges and cache flags are unchanged.
- Qualification scope, profile, epoch and state are unchanged.
- No computation becomes cached, and there are no new computations.
- No other task's inputs change.

This note reviews the declared configuration change only. It is not evidence
that any computation is newly qualified or that a quality gate has passed.

Current `turbo.json` SHA-256: `5ec1246aea595fff147318b8f8a4470b58c357c313c9c3a2b9c704e4f98744f6`.

## Drifted tasks

`bun run beep cache audit` reports `configuration-drift` for exactly these
86 computations, one per package that owns a `test:property` task, plus
the `configuration-source-drift` review line for `turbo.json`. The baseline
request also names the root subject `//`: its reviewed bytes are `turbo.json`
itself, which changed only by the two input lines above.

| Task | Subject | Input change |
| --- | --- | --- |
| `@beep/acp#test:property` | `@beep/acp` | two added input paths |
| `@beep/agents-client#test:property` | `@beep/agents-client` | two added input paths |
| `@beep/agents-domain#test:property` | `@beep/agents-domain` | two added input paths |
| `@beep/agents-server#test:property` | `@beep/agents-server` | two added input paths |
| `@beep/agents-use-cases#test:property` | `@beep/agents-use-cases` | two added input paths |
| `@beep/ai-provider-cli#test:property` | `@beep/ai-provider-cli` | two added input paths |
| `@beep/ai-sync#test:property` | `@beep/ai-sync` | two added input paths |
| `@beep/anthropic#test:property` | `@beep/anthropic` | two added input paths |
| `@beep/api-transport#test:property` | `@beep/api-transport` | two added input paths |
| `@beep/architecture-lab-config#test:property` | `@beep/architecture-lab-config` | two added input paths |
| `@beep/architecture-lab-domain#test:property` | `@beep/architecture-lab-domain` | two added input paths |
| `@beep/architecture-lab-proof#test:property` | `@beep/architecture-lab-proof` | two added input paths |
| `@beep/architecture-lab-server#test:property` | `@beep/architecture-lab-server` | two added input paths |
| `@beep/architecture-lab-tables#test:property` | `@beep/architecture-lab-tables` | two added input paths |
| `@beep/architecture-lab-ui#test:property` | `@beep/architecture-lab-ui` | two added input paths |
| `@beep/architecture-lab-use-cases#test:property` | `@beep/architecture-lab-use-cases` | two added input paths |
| `@beep/box#test:property` | `@beep/box` | two added input paths |
| `@beep/chalk#test:property` | `@beep/chalk` | two added input paths |
| `@beep/colors#test:property` | `@beep/colors` | two added input paths |
| `@beep/db-admin#test:property` | `@beep/db-admin` | two added input paths |
| `@beep/discord#test:property` | `@beep/discord` | two added input paths |
| `@beep/doc-text#test:property` | `@beep/doc-text` | two added input paths |
| `@beep/documents-tables#test:property` | `@beep/documents-tables` | two added input paths |
| `@beep/drizzle#test:property` | `@beep/drizzle` | two added input paths |
| `@beep/duckdb#test:property` | `@beep/duckdb` | two added input paths |
| `@beep/ecfr#test:property` | `@beep/ecfr` | two added input paths |
| `@beep/editor#test:property` | `@beep/editor` | two added input paths |
| `@beep/epistemic-domain#test:property` | `@beep/epistemic-domain` | two added input paths |
| `@beep/epistemic-tables#test:property` | `@beep/epistemic-tables` | two added input paths |
| `@beep/epistemic-use-cases#test:property` | `@beep/epistemic-use-cases` | two added input paths |
| `@beep/ffmpeg#test:property` | `@beep/ffmpeg` | two added input paths |
| `@beep/file-processing#test:property` | `@beep/file-processing` | two added input paths |
| `@beep/govinfo#test:property` | `@beep/govinfo` | two added input paths |
| `@beep/html#test:property` | `@beep/html` | two added input paths |
| `@beep/hubspot#test:property` | `@beep/hubspot` | two added input paths |
| `@beep/identity#test:property` | `@beep/identity` | two added input paths |
| `@beep/langextract#test:property` | `@beep/langextract` | two added input paths |
| `@beep/law-practice-domain#test:property` | `@beep/law-practice-domain` | two added input paths |
| `@beep/law-practice-use-cases#test:property` | `@beep/law-practice-use-cases` | two added input paths |
| `@beep/lexical-schema#test:property` | `@beep/lexical-schema` | two added input paths |
| `@beep/libpff#test:property` | `@beep/libpff` | two added input paths |
| `@beep/lint-rules#test:property` | `@beep/lint-rules` | two added input paths |
| `@beep/m365#test:property` | `@beep/m365` | two added input paths |
| `@beep/m365-mcp#test:property` | `@beep/m365-mcp` | two added input paths |
| `@beep/mcp-kit#test:property` | `@beep/mcp-kit` | two added input paths |
| `@beep/md#test:property` | `@beep/md` | two added input paths |
| `@beep/nlp#test:property` | `@beep/nlp` | two added input paths |
| `@beep/nlp-mcp#test:property` | `@beep/nlp-mcp` | two added input paths |
| `@beep/nlp-processing#test:property` | `@beep/nlp-processing` | two added input paths |
| `@beep/observability#test:property` | `@beep/observability` | two added input paths |
| `@beep/oip-web#test:property` | `@beep/oip-web` | two added input paths |
| `@beep/onepassword-cli#test:property` | `@beep/onepassword-cli` | two added input paths |
| `@beep/ontology#test:property` | `@beep/ontology` | two added input paths |
| `@beep/ontology-server#test:property` | `@beep/ontology-server` | two added input paths |
| `@beep/ontology-use-cases#test:property` | `@beep/ontology-use-cases` | two added input paths |
| `@beep/openai-compat#test:property` | `@beep/openai-compat` | two added input paths |
| `@beep/pacer#test:property` | `@beep/pacer` | two added input paths |
| `@beep/pandoc-ast#test:property` | `@beep/pandoc-ast` | two added input paths |
| `@beep/pglite#test:property` | `@beep/pglite` | two added input paths |
| `@beep/phoenix#test:property` | `@beep/phoenix` | two added input paths |
| `@beep/postgres#test:property` | `@beep/postgres` | two added input paths |
| `@beep/professional-desktop#test:property` | `@beep/professional-desktop` | two added input paths |
| `@beep/provenance#test:property` | `@beep/provenance` | two added input paths |
| `@beep/rdf#test:property` | `@beep/rdf` | two added input paths |
| `@beep/rdf-canonize#test:property` | `@beep/rdf-canonize` | two added input paths |
| `@beep/repo-ai-metrics#test:property` | `@beep/repo-ai-metrics` | two added input paths |
| `@beep/repo-cli#test:property` | `@beep/repo-cli` | two added input paths |
| `@beep/repo-configs#test:property` | `@beep/repo-configs` | two added input paths |
| `@beep/repo-docgen#test:property` | `@beep/repo-docgen` | two added input paths |
| `@beep/repo-utils#test:property` | `@beep/repo-utils` | two added input paths |
| `@beep/runpod#test:property` | `@beep/runpod` | two added input paths |
| `@beep/sanity#test:property` | `@beep/sanity` | two added input paths |
| `@beep/schema#test:property` | `@beep/schema` | two added input paths |
| `@beep/semantic-web#test:property` | `@beep/semantic-web` | two added input paths |
| `@beep/shared-domain#test:property` | `@beep/shared-domain` | two added input paths |
| `@beep/test-utils#test:property` | `@beep/test-utils` | two added input paths |
| `@beep/tika#test:property` | `@beep/tika` | two added input paths |
| `@beep/ui#test:property` | `@beep/ui` | two added input paths |
| `@beep/uspto#test:property` | `@beep/uspto` | two added input paths |
| `@beep/uspto-mcp#test:property` | `@beep/uspto-mcp` | two added input paths |
| `@beep/utils#test:property` | `@beep/utils` | two added input paths |
| `@beep/wink#test:property` | `@beep/wink` | two added input paths |
| `@beep/workspace-domain#test:property` | `@beep/workspace-domain` | two added input paths |
| `@beep/workspace-server#test:property` | `@beep/workspace-server` | two added input paths |
| `@beep/workspace-tables#test:property` | `@beep/workspace-tables` | two added input paths |
| `@beep/workspace-use-cases#test:property` | `@beep/workspace-use-cases` | two added input paths |
