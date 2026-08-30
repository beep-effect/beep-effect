# Citation consumer contract — 2026-08-27

## Result

The citation-engine boundary can consume the court/reporter substrate through
one public import only:

```ts
import {
  CourtReporterArtifact,
  findCourtById,
  findReporterById,
  isCurrentCourtReporterArtifactVersion,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary"
```

`CourtReporterArtifact.artifactVersion` is
`crv1:f353e51400a5:fad63b383b92`. The exact-version predicate accepts that
version and rejects a stale parser build. The stable-ID lookups resolve decoded
`CourtId` and `ReporterId` values. Alias lookups return every candidate, so a
reused reporter abbreviation is not silently collapsed.

The focused consumer test imports no module below `src/internal/generated/` and
asserts that resolver regexes, reporter variation tables, and raw court template
fields are absent from the public records. Citation extraction itself remains
outside this goal.

## Reproduction

```sh
bun run --cwd packages/law-practice/domain beep:check
bun run --cwd packages/law-practice/domain beep:test -- CourtReporterVocabulary.test.ts
! rg -n "internal/generated/free-law-project" \
  packages/law-practice/domain/test/CourtReporterVocabulary.test.ts
```

Result: typecheck passed; 7 focused tests passed; the raw-import scan returned
no matches.
