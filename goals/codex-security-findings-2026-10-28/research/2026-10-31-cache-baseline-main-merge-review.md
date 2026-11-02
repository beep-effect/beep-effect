# Cache review addendum — main retirement merge

Retain the reviewed six-task correction from
`2026-10-31-cache-baseline-review.md` after integrating main PR #2376
(`3fbb6e614b`). Subject remains `//`. The full audit again names exactly:

- `//#lint:policy-fingerprint:goals-doctor`
- `//#lint:policy-fingerprint:goals-index`
- `//#lint:policy-fingerprint:knowledge`
- `//#lint:policy-fingerprint:lint-deprecated-apis`
- `//#lint:policy-fingerprint:lint-roadmap-refs`
- `//#lint:policy-fingerprint:quality`

Relative to the main baseline, all six remove the deleted glob helper; quality
also adds the directly imported JsDocNodes helper. Main retired the Graft
command, so the quality closure additionally removes its deleted schema and
the UnitInterval dependency no longer reachable through that schema.
Canonical fingerprint generation owns these dependency lists.

The resolution starts from main's complete cache baseline to preserve its
retirement of environment names and exclusions, then applies only the reviewed
six seal corrections. Root review and current Turbo source hash are refreshed.
All other subjects, scope, profile, epoch, qualification, task commands,
outputs and cache flags remain unchanged. No new exception or qualification
is granted.
