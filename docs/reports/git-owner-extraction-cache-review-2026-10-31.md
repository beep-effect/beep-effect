# Git owner extraction cache input review

PR #2413 splits the Git driver into explicit error, model, classification,
execution, parser and SSH environment owners. The generated policy fingerprint
closure and matching Turbo seal inputs must include those extracted owners.
This review permits recording the resulting configuration digests for the five
existing seal tasks below. It grants no cache qualification and changes no
scope, profile, epoch, outputs, cache flags or task commands.

| Drifted computation | Baseline subject | Legitimate input change |
| --- | --- | --- |
| `//#lint:policy-fingerprint:goals-doctor` | `//` | Add the six extracted Git owner files to the existing transitive policy closure. |
| `//#lint:policy-fingerprint:goals-index` | `//` | Add the same six extracted Git owner files to the existing transitive policy closure. |
| `//#lint:policy-fingerprint:knowledge` | `//` | Add the same six extracted Git owner files to the existing transitive policy closure. |
| `//#lint:policy-fingerprint:lint-roadmap-refs` | `//` | Add the same six extracted Git owner files to the existing transitive policy closure. |
| `//#lint:policy-fingerprint:quality` | `//` | Add the same six extracted Git owner files to the existing transitive policy closure. |

The six files are `packages/drivers/git/src/Git.errors.ts`,
`packages/drivers/git/src/Git.models.ts`,
`packages/drivers/git/src/internal/classification.ts`,
`packages/drivers/git/src/internal/execution.ts`,
`packages/drivers/git/src/internal/parsers.ts`, and
`packages/drivers/git/src/internal/sshEnvironment.ts`.

The reviewed generated diff adds these exact paths under the five affected
entries in `standards/policy-tools.fingerprint.json` and their matching seal
tasks in `turbo.json`. The root manifest does not change in the fix wave.
A focused five-test `policy-fingerprint-turbo-inputs` regression passes and
`beep lint policy-fingerprint` reports current after regeneration.

Only the drift-named root subject `//` may be re-recorded. Existing qualification
scope, profile and epoch must be copied byte-for-value from the current baseline.
Every other subject and qualification status must remain intact. The request
must bind the exact current baseline text and this review's exact bytes by SHA-256.
