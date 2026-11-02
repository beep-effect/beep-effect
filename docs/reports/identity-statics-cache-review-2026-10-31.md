# Identity statics cache input review

PR2410 extracts schema-static preservation into an internal owner. The canonical
policy fingerprint adds `packages/foundation/modeling/identity/src/internal/schemaStatics.ts`
to the shared transitive seal inputs.

| Drifted computation | Baseline subject | Legitimate input change |
| --- | --- | --- |
| `//#lint:policy-fingerprint:shared` | `//` | Add the extracted schemaStatics owner to the shared policy import closure. |

The complete cache audit after merging main reports only this blocking computation.
Main already carries its reviewed Markdown and dependency changes. This update
records only the drift-named root subject; it grants no cache qualification.
Task commands, outputs, cache flags and qualification statuses remain unchanged.
Copy scope, profile and epoch from the exact current baseline without alteration.
Bind the request to the baseline and this review by exact-text SHA-256.
