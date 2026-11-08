# Cache-policy baseline re-record for scripts-to-beep-cli PR 2 (2026-11-07)

Reviewer: Claude Opus 5.5 (`goals/scripts-to-beep-cli-p2`, PR 2 of the packet).

## What changed

- Root `package.json` gains `lint:tracked-shell-allowlist`
  (`bun run beep laws tracked-shell-allowlist --check`), the new repository-wide law that the
  `lint:tracked-shell-allowlist` cheap-gates lane runs. A root script edit moves the scripts digest
  of every cached root (`//`) task, which accounts for the 40 `//#*` `configuration-drift` rows. No
  existing root task's command, inputs, outputs, environment keys or cache flags change.
- `turbo.json` adds the uncached `//#lint:tracked-shell-allowlist` task, a copy of the
  `//#lint:retired-iri-authorities` shape (tracked-file discovery stays fresh), and the regenerated
  policy-fingerprint seals; that is the root `configuration-source-drift` row.

No qualification is granted and the qualification scope is unchanged.

## Evidence

- Before this record, `bun run beep quality cache-policy` reported 40 blocking
  `configuration-drift` findings, all on `//#*`, plus the `turbo.json` `configuration-source-drift`
  review row.
