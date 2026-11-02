# #1875 Effect Vitest canon wave 18: record

Branch `claude/vitest-canon-w18` off `main` `1adc9e6e7c`. Scope: the SQLite-reopen class of
the 14 native EV010 rows that wave 17 listed.

## Detector repair: a SQLite database file is a native subject

`harnessOpensSqliteFile` in `EffectVitestDetectors.ts` accepts a platform bundle harness when
the harness callback, or a same-file helper it reaches (through the shared `harnessEvidence`
walk), calls `SqliteClient.make` or `SqliteClient.layer` from
`@effect/sql-sqlite-node/SqliteClient` or `@effect/sql-sqlite-bun/SqliteClient`. The call must
take an inline options object whose `filename` is anything but the `":memory:"` literal.

SQLite reads and writes its database file through the native filesystem, never through the
Effect `FileSystem`. A memory filesystem therefore cannot hold the file the test opens, and the
platform bundle is the subject. As before, every harness the bundle reaches must qualify.

Counterexamples (`test/effect-vitest-detectors.test.ts`), each of which reads `FileSystem`:

- accepted: `make` over a temp-directory path; `layer` over a bound path; a reopen helper; the
  Bun driver;
- still judged: `":memory:"`; an opaque options value; a spread options object; an impostor
  `@beep/fake/SqliteClient`; an unknown member; a second harness that opens no SQLite file.

## Inventory, paired by `(ruleId, file, occurrence)` against `1adc9e6e7c`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 454 | 440 | 14 |
| After | 452 | 440 | 12 |

Gone: 2 EV010 open rows, `observation-claim-population` and
`observation-launch-claims-restore`. New: 0. No exception added. No test file changed.

The other three files wave 17 listed for this class do not qualify under the every-harness
rule:

- `observation-launch-outbox`: 4 of its 7 harnesses open SQLite, and the other 3 use the bundle
  only for claim files;
- `observation-launch-claims`: the subject writes its own claim files, and the test reaches
  `chmod` through `f.fs`;
- `observation-worker`: the one `NodeServices` harness runs real transcript discovery.

They move to the fixture-field `chmod` and discovery classes.

## Still open (12)

| Class | Rows |
| --- | ---: |
| Concurrent independent processes | 1 |
| A `Deferred`-held spawner child | 1 |
| Spawned `git` | 3 |
| Fixture-field `chmod` and claim files (`observation-launch-claims`, `observation-launch-outbox`) | 2 |
| Real transcript discovery (`observation-worker`) | 1 |
| `lstat` owner metadata | 1 |
| Unix-domain sockets | 1 |
| Node and Bun crypto plus filesystem | 2 |

## Verification

| Check | Result |
| --- | --- |
| `test/effect-vitest-detectors.test.ts`, Bun and Node | 262 passed each |
| repo-cli `bun run check` | exit 0 |
| `bun run beep lint effect-vitest --write` | 454 → 452 rows, 0 new |
| `quality fallow audit --base origin/main` | 0 introduced |
| Biome on the two touched files | clean |
