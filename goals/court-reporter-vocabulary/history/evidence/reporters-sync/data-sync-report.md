# Official Data Sync Report

Mode: write

## Targets

| Target | Status | Records | Summary | Changed files |
| --- | --- | --- | --- | --- |
| reporters\-db | changed | 2729 | 1262 reporters, 798 journals, 373 laws, and companion abbreviation/regex data from reporters\-db 3\.2\.66 | packages/law\-practice/domain/src/internal/generated/free\-law\-project/reporters\-vocabulary\.ts, packages/law\-practice/domain/src/internal/generated/free\-law\-project/reporters\-vocabulary\.data\.json, packages/law\-practice/domain/src/internal/generated/free\-law\-project/reporters\-db\.data\.json |

## Canonical Patch

| Target | Op | Path | Value |
| --- | --- | --- | --- |
| reporters\-db | add | artifact | \{<br/>  "version": "crv1:f353e51400a5:fad63b383b92",<br/>  "schemaVersion": "court\-reporter\-vocabulary/v1",<br/>  "projectionVersion": 1,<br/>  "vocabularyPath": "packages/law\-practice/domain/src/internal/generated/free\-law\-project/reporters\-vocabulary\.data\.json"<br/>\} |
| reporters\-db | add | counts\.stableReporterIds | 1262 |
