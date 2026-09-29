---
"@beep/schema": minor
---

Retire the Role B concepts `HttpMethod`, `HttpStatus`, `Jsonl`, `Toml`, and `Yaml` under the
"Upstream-First Foundation/Modeling" decision (`standards/architecture/DECISIONS.md`,
2026-09-29) and the 2026-09-14 ruling that Role B modules may be retirement targets. Their
barrel and subpath exports, the `@beep/schema/test/Yaml` seam, and the `yaml` dependency go
with them; no alias is left behind. Every consumer migrates in the same change:

- Named status codes become `HttpStatus.fromLiteral(name)` from `effect/http/HttpStatus`. The
  61 names upstream knows resolve to the same numbers, including every served status (desktop
  RPC 401, GovInfo contract 200/400/404/500).
- `HttpStatusCode` becomes an `@beep/observability` schema with the same composition; status
  fields that enumerated every named code (Microsoft 365, Venice AI) and the 4xx/5xx error
  fields use `S.Int` with `S.isBetween`.
- `HttpMethod` becomes the upstream `HttpMethod` type plus a local `LiteralKit` field schema.
- YAML and TOML text decode through `effect/encoding/Yaml` and `effect/encoding/Toml`. Every
  real input a consumer reads parses to the same value: Codex config 8/8, workflows and
  compose files 14/14, reflection frontmatter 241/241, `.claude` frontmatter 42/42.

Recorded losses (census, consumer lines): `HttpStatus` covered 78 against uncovered 3. The
uncovered lines are whole-set enumerations; upstream exports no code list, so those two drivers
now keep an unnamed in-range status instead of mapping it to 500, and 12 unofficial names
(`UseProxy`, `SwitchProxy`, `ClientClosedRequest`, `WebServerIsDown`, and eight more) have no
upstream entry. Name-to-code transforms, category kits, reverse lookup, and per-status emoji
annotations are gone; no persisted or served field used them. `HttpMethod` covered 2 against
uncovered 1 (`.is.OPTIONS`, now a string equivalence); `hasBody`, `all`, `allShort`, `NoBody`,
and `WithBody` had no consumer. `Jsonl` had no consumer; upstream `Ndjson` is stream and
channel shaped. The upstream YAML parser rejects compact nested block sequences, so the
Venice AI test parses its OpenAPI fixture with `Bun.YAML.parse`; TOML offset date-times now
decode to `Date`, and no consumer input has one. Only in-memory type-mismatch messages change,
naming the new schema identifiers.

`MimeType` is deferred from this group pending an operator ruling. Upstream `effect/http/Mime`
at `df77fff939` exposes only `getType`, `getExtension`, and `getAllExtensions` over mime-db's
standard table and recognizes 274 of the 2,321 media types the concept accepts today.
`mediaType` fields typed by it reach persisted JSON manifests (file-processing
`Extraction.manifest.ts`), and KEEP `FileTypeChecker.schema.ts:238` builds its media-type union
on it, so a lookup-based replacement would reject 2,047 stored-valid values on read-back. Census:
covered 18 lines against uncovered 4; RETIRE would hold on the census, so the block is the
boundary, not the census. Options for the operator: KEEP `MimeType` (a literal domain upstream
does not provide), or a migration goal that narrows the accepted set. Rejected: retiring onto
the upstream lookup (rejects stored values); a local copy of the 2,321-literal table per
consumer (re-creates the concept).

Type-check cost, tsgo 7.0.2, fresh build-info, before → after. The gate is the
`--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 659,250 → 599,455 | 184,632 → 172,416 | 1.138 → 1.100 s |
| `@beep/repo-cli` | 4,134,481 → 4,132,602 | 1,059,635 → 1,059,277 | 11.293 → 10.877 s |
| `@beep/law-practice-domain` | 845,029 → 845,029 | 252,570 → 252,570 | 1.926 → 1.228 s |

Check time is advisory within a 5% band; no package rose.

The default four-checker run is advisory; its totals depend on how files split across
checkers:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,073,688 → 990,061 | 345,459 → 329,278 | 0.500 → 0.481 s |
| `@beep/repo-cli` | 8,378,055 → 8,353,732 | 2,123,582 → 2,118,102 | 5.303 → 4.383 s |
| `@beep/law-practice-domain` | 1,237,115 → 1,237,115 | 353,921 → 353,921 | 0.714 → 0.687 s |
