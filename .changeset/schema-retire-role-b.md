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
- `HttpStatusCode` becomes an `@beep/observability` schema with the same composition. The
  client and server HTTP error `status` fields keep their wire form (the status name encoded,
  its code decoded, over the same 29 and 11 names) through a local codec over
  `effect/http/HttpStatus`. The Microsoft 365 and Venice AI drivers keep the same 73-code
  catalog (the 61 names upstream knows plus 12 unofficial codes) and still report any other
  status as 500; that coercion is a candidate follow-up, not changed here.
- `HttpMethod` becomes the upstream `HttpMethod` type plus a local `LiteralKit` field schema.
- YAML and TOML text decode through `effect/encoding/Yaml` and `effect/encoding/Toml`. Every
  real input a consumer reads parses to the same value: Codex config 8/8, workflows and
  compose files 14/14, reflection frontmatter 241/241, `.claude` frontmatter 42/42.

Recorded losses (census, consumer lines): `HttpStatus` covered 78 against uncovered 3. The
uncovered lines are whole-set enumerations: upstream exports no code list, so the two drivers
list their catalog locally, and the 12 unofficial codes (`UseProxy`, `SwitchProxy`,
`ClientClosedRequest`, `WebServerIsDown`, and eight more) have no upstream name. The shared
name-to-code kits, category kits, and per-status emoji annotations are gone; the consumers that
encoded through them keep byte-identical encodings (probe: 4xx and 5xx fields 45/45 names and
701/701 codes, driver normalization 701/701 for 0 to 700). `HttpMethod` covered 2 against
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

Type-check cost, tsgo 7.0.2, fresh build-info, before (the base branch head `eefb7cd313`) →
after. The gate is the `--singleThreaded` instantiation count:

| Package (`--singleThreaded`, gate) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 659,250 → 599,455 | 184,632 → 172,416 | 1.079 → 1.077 s |
| `@beep/repo-cli` | 4,134,988 → 4,133,109 | 1,059,693 → 1,059,335 | 10.380 → 12.333 s |
| `@beep/law-practice-domain` | 845,029 → 845,029 | 252,570 → 252,570 | 1.328 → 1.209 s |

Check time is advisory within a 5% band. Flagged: `@beep/repo-cli` read 10.380 → 12.333 s, but
repeat samples read 12.411 s (before) and 11.024 s (after) at identical instantiations, so the
swing is station load, not the change.

The default four-checker run is advisory; its totals depend on how files split across
checkers:

| Package (default, 4 checkers, advisory) | Instantiations | Types | Check time |
| --- | --- | --- | --- |
| `@beep/schema` | 1,073,688 → 990,061 | 345,459 → 329,278 | 0.477 → 0.473 s |
| `@beep/repo-cli` | 8,379,334 → 8,355,011 | 2,123,693 → 2,118,213 | 5.011 → 5.000 s |
| `@beep/law-practice-domain` | 1,237,115 → 1,237,115 | 353,921 → 353,921 | 0.785 → 0.691 s |
