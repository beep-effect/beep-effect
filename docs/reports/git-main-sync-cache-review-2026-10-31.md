# Git cache review after protected producer main sync

PR #2413's merge of accepted main `900023804b` takes main's canonical cache
baseline as its regeneration base. That preserves the approved protected producer
posture. This review reapplies only the two previously reviewed Git changes:

- `docs/reports/git-owner-extraction-cache-review-2026-10-31.md`: six extracted
  Git owner files added to five existing generated policy seal closures.
- `docs/reports/git-doctest-scripts-cache-review-2026-10-31.md`: canonical
  generation adds only `doctest` and `beep:doctest`; all prior script values and
  every manifest field outside `scripts` remain unchanged. The new lane is
  unassessed, not newly qualified.

The exact incoming main baseline has profile `local-linux-x64-bun1.4.4`, epoch
`qualification-v3`, and the existing four-entry lint scope. Copy these values
unchanged. The complete post-merge audit names exactly the following 14 blockers:

| Computation | Subject | Reviewed input change |
| --- | --- | --- |
| `//#lint:policy-fingerprint:goals-doctor` | `//` | Six extracted Git owners in the generated transitive input closure. |
| `//#lint:policy-fingerprint:goals-index` | `//` | Same six-owner closure change. |
| `//#lint:policy-fingerprint:knowledge` | `//` | Same six-owner closure change. |
| `//#lint:policy-fingerprint:lint-roadmap-refs` | `//` | Same six-owner closure change. |
| `//#lint:policy-fingerprint:quality` | `//` | Same six-owner closure change. |
| `@beep/git#build` | `@beep/git` | Canonically generated manifest bytes; existing command unchanged. |
| `@beep/git#check` | `@beep/git` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#docgen` | `@beep/git` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#doctest` | `@beep/git` | New generated runtime documentation lane; record unassessed posture only. |
| `@beep/git#lint` | `@beep/git` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#lint:deprecated-apis` | `@beep/git` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#lint:jsdoc` | `@beep/git` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#lint:laws` | `@beep/git` | Same manifest-byte change; existing command unchanged. |
| `@beep/git#test` | `@beep/git` | Same manifest-byte change; existing command unchanged. |

Live comparison to main confirms exactly 30 added input paths in each generated
policy fingerprint and Turbo file (six owners times five closures), and only the
same two generated Git scripts plus canonical script ordering in its manifest.
No protected producer computation, task command, qualification or configuration
is changed by this Git delta. Do not grant qualification, add exception rows or
re-record any other subject. The canonical projection may refresh the manifest
command digest on the other existing, uncached Git nodes; their commands and
cache posture must remain unchanged.

Bind the request to this basis and the exact incoming baseline text with SHA-256.
After canonical recording, verify zero audit blockers, unchanged scope/profile/
epoch, and no changed projection node outside the five named seal tasks and the
Git subject. Retain all other review and qualification records.
