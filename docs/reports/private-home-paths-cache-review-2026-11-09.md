# Cache-policy baseline re-record for the private home path law (2026-11-09)

Reviewer: Claude Opus 5.5 (`fix/redact-ten-minute-certainty-home-path` lane).

## What changed

- Root `package.json` gains `lint:private-home-paths`
  (`bun run beep laws private-home-paths --check`), the repository-wide law that the
  `lint:private-home-paths` cheap-gates lane runs. A root script edit moves the scripts digest
  of every cached root (`//`) task, which accounts for the 40 `//#*` `configuration-drift` rows. No
  existing root task's command, inputs, outputs, environment keys or cache flags change.
- `turbo.json` adds the uncached `//#lint:private-home-paths` task, a copy of the
  `//#lint:retired-iri-authorities` shape (tracked-file discovery stays fresh), and the regenerated
  policy-fingerprint seals for the two new law sources; that is the root
  `configuration-source-drift` row.

No qualification is granted and the qualification scope is unchanged.

## Evidence

- Before this record, `bun run beep quality cache-policy` reported 40 blocking
  `configuration-drift` findings, all on `//#*`, plus the `turbo.json` `configuration-source-drift`
  review row.

Re-recorded on the merges of main `fda98a2c4b` and `1291ae94f2`: each merge took main's baseline
(whose `//` review recorded the agent-memory-store workspaces, then the property-sweep inputs) and
this request is replayed on top of it. `turbo.json` and `standards/policy-tools.fingerprint.json`
carry the bytes main wrote plus this lane's law task and seals; nothing else in the review changed.
