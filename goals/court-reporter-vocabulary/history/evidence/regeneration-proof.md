# Court/reporter regeneration proof — 2026-08-27

## Result

Both pinned targets regenerated the new public vocabulary projections, and a
second canonical check reported zero drift. The checked-in JSON and TypeScript
artifacts are byte-stable at the hashes below.

## Sources and counts

| Source | Release | Commit | Archive SHA-256 | Source/emitted counts | Stable IDs |
| --- | --- | --- | --- | --- | --- |
| courts-db | 0.10.27 | `f353e51400a55cc8942b230b3e12540ad364fd23` | `6c0e4fc800a8ebdb7d539960fd08b8373b219623694723af36378df229f369fa` | 2,809 assembled court records; 28 place variables | 2,809 |
| reporters-db | 3.2.66 | `fad63b383b92f9446c223ddc12bf0b6fd1a6b44c` | `11d6aee9b5927fbf29d92fbce6e502c712d3c7acd0a3ed736293d7100b1386f2` | 1,236 reporter keys / 1,262 records; 797 journal keys / 798 records; 371 law keys / 373 records; 189 case-name keys / 239 expansions; 7 regex families; 50 state abbreviations | 1,262 |

Both vocabulary sidecars record retrieval date `2026-07-25`, their exact
refresh command, source URL, archive hash, source commit, and combined artifact
version `crv1:f353e51400a5:fad63b383b92`. The courts projection also records its
semantic SHA-256
`41a20fb1916149fd5a60bf8adfcd2572fc35dd872ecb3d0fa9119bd64ef0ba05`.

## Commands

```sh
bun run beep sync-data-to-ts --target courts-db \
  --report-dir goals/court-reporter-vocabulary/history/evidence/courts-sync
bun run beep sync-data-to-ts --target reporters-db \
  --report-dir goals/court-reporter-vocabulary/history/evidence/reporters-sync
bun run beep sync-data-to-ts --target courts-db --check \
  --report-dir goals/court-reporter-vocabulary/history/evidence/courts-no-diff
bun run beep sync-data-to-ts --target reporters-db --check \
  --report-dir goals/court-reporter-vocabulary/history/evidence/reporters-no-diff
```

The second courts and reporters reports each record `changed: false`, an empty
`changedFiles` array, and an empty canonical patch.

## Checked-in artifact hashes

| Artifact | SHA-256 |
| --- | --- |
| `courts.ts` | `76ed20f8c7b3576b844f81dc0999028727eb315903da8d72c3a9a9be9a96185e` |
| `courts-db.data.json` | `55f3a943089ebf387cb24c8d6db59dca8e5fa0cddba19b406ce41458b5e6188e` |
| `courts-vocabulary.ts` | `c75c7984995c66f0968f44c736c7f30a881fefc9d04865890552bc31204e1981` |
| `courts-vocabulary.data.json` | `b9d4aa7eaa0b9078bef2e4f924206c995427d0638830fcc8cfc244531a77a513` |
| `reporters.ts` | `cb42646c2713aa9efe4e4ea8d7e447f24ba46373aa37f512d99a5a1eeb9728c2` |
| `reporters-db.data.json` | `9ccb58b51dad3a469a3ba8eaf12867447d5794f99133d15ec367ed0ebc1f4656` |
| `reporters-vocabulary.ts` | `adddf0e9829b14f4373acb78a7f4d9691b27b3cb49e53ddaea45eca562506040` |
| `reporters-vocabulary.data.json` | `dba9165974553bb829997b5fd1ee6918c7f015aae85de00220e2913b555f8dcc` |

## Boundary proof

Generated modules and JSON sidecars remain below
`packages/law-practice/domain/src/internal/generated/free-law-project/` and are
absent from package exports and public barrels. The public contract is the
schema-decoded
`@beep/law-practice-domain/values/CourtReporterVocabulary` subpath. The root
notice already records the BSD-2 text, both repositories, both final commits,
copyrights, disclaimer, and affected material.
