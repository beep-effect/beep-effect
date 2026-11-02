# Cache input review after the 2026-10-31 main integration

The incoming main baseline is retained as the previous state. Main introduced
per-task policy fingerprints; the canonical `lint policy-fingerprint --write`
projection recomputes their actual dependency closure in the combined tree.
This request acknowledges configuration changes only and grants no qualification.

The audit identifies exactly these eleven blocking cached-task configuration findings:

- `//#lint:policy-fingerprint:goals-doctor`
- `//#lint:policy-fingerprint:goals-index`
- `//#lint:policy-fingerprint:knowledge`
- `//#lint:policy-fingerprint:lint-deprecated-apis`
- `//#lint:policy-fingerprint:lint-roadmap-refs`
- `//#lint:policy-fingerprint:quality`
- `@beep/repo-ai-metrics#build`
- `@beep/repo-ai-metrics#check`
- `@beep/repo-ai-metrics#lint:deprecated-apis`
- `@beep/repo-ai-metrics#test`
- `@beep/repo-ai-metrics#test:property`

For the six root policy seal tasks, canonical closure generation removes the
retired CLI-local GlobPattern.ts input after main switched its importers to the
shared glob package. The quality seal additionally includes the existing
Docgen/internal/JsDocNodes.ts module reached in the combined foundation tree.
The tasks retain their scripts, outputs, cache flags, and qualification status.

For the five ai-metrics tasks, the manifest adds runtime JSONL, Node platform and
protobuf providers, and development providers for synthetic sessions and SQLite
proofs. Existing scripts and outputs remain unchanged. Platform-node moves from
development to runtime; platform-bun and both SQLite implementations support
explicit cross-runtime integration tests. These dependency changes are inputs
to the task identity, not new cache qualification.

The uncached ai-metrics audit, coverage and package-test-typecheck tasks also
inherit the added JSONL/provider workspace edges through audit/build/transit.
Their derived dependencies may update within the same reviewed subject; their
uncached posture must remain intact. These are not additional qualification.

Only subjects `//` and `@beep/repo-ai-metrics` may be re-recorded. Preserve
exact scope, profile, epoch, all other reviews and the qualification ledger.
After writing, compare projections, run cache audit again, and preserve receipts.

Exact combined-tree input hashes:

- `turbo.json`: `979364fae7d4c7cf95500d7b058de37c58de36479aa3128cbce1259819858b8b`
- `standards/policy-tools.fingerprint.json`: `436e495419264c16b5a8b03b4b14fc868ff3c7791586e89de69379b1246e7b79`
- `packages/tooling/library/ai-metrics/package.json`: `af2f21d8ae15e426aa8de8ef182779a8da655e8896cf4362f63d879d1006309e`
