# Party policy-fingerprint cache input review — 2026-11-03

Reviewer: Codex, party-slice completion owner.

The source cache audit names exactly `//#lint:policy-fingerprint` as a
configuration-drift blocker and `turbo.json` as changed source configuration.
The canonical policy-fingerprint generator adds only
`packages/party/server/package.json` and `packages/party/use-cases/package.json`
to the fingerprint manifest and that task's explicit inputs. These are the two
new packages whose policy scripts must participate in policy drift detection.
The command, outputs, cache flag and all other task declarations stay unchanged.

This request reviews only the root subject `//`. Existing package reviews are
carried forward. Qualification scope, profile and epoch are copied unchanged;
no new cache qualification or exception is granted. Reverse by reverting the
package registration and regenerating the fingerprint/input list together.
