# Cache baseline review: policy fingerprint seal

Reviewed 2026-11-07 for `feat/research-library-routes`. No qualification is granted.

| Subject | Tasks named by `beep cache audit` | Input change |
| --- | --- | --- |
| `//` | root task configuration-drift | `bun run beep lint policy-fingerprint --write` resealed `standards/policy-tools.fingerprint.json` and the `//#lint:policy-fingerprint:*` inputs in root `turbo.json`, because `@beep/repo-cli` now depends on `@beep/box`, `@beep/firecrawl` and `@beep/onepassword-cli`. |

`packages/drivers/firecrawl/package.json` was also re-sorted for Sherif (dependency key order only); the audit reports no drift for `@beep/firecrawl`.
