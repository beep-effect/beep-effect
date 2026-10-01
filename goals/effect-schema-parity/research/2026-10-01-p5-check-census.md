# P5 check-census measurement (2026-10-01)

Single-checker gate measurement for the P5 close (SPEC goal-time rows
2026-09-16 and 2026-09-29). Command per package, with a fresh build-info file
for every run, the same compiler (`7.0.2+effect-tsgo.0.45.0`), and the
dependency closure built (`bunx turbo run build --filter='<pkg>^...'`):

```sh
./node_modules/.bin/tsc -p <pkg>/tsconfig.json --noEmit --extendedDiagnostics --singleThreaded --tsBuildInfoFile <fresh>
```

The base is the live merge base at measurement time, `origin/main`
`a69b1956ee` (it includes #1362, #1363, #1364, #1369 and #1370, which add
repo-cli code). The earlier P5 numbers against `90517df719` are superseded by
this measurement.

| Package | Base `a69b1956ee` | P5 `67ba9397d3` | Delta |
| --- | ---: | ---: | ---: |
| `@beep/schema` | 460,260 | 446,382 | −13,878 |
| `@beep/repo-cli` | 4,206,806 | 4,202,582 | −4,224 |
| `@beep/law-practice-domain` | 830,007 | 799,552 | −30,455 |

None of the three packages shows an instantiation increase. Check time is advisory.
`standards/check-census.regression-baseline.jsonc` is written by
`bun run beep quality check-census --write-baseline` on the clean tree at
`67ba9397d3` (`dirtyWorktree: false`).

## Transcript: base

```text
== packages/foundation/modeling/schema @ a69b1956ee (singleThreaded)
Types:                 135851
Instantiations:        460260
Check time:            0.628s
== packages/tooling/tool/cli @ a69b1956ee (singleThreaded)
Types:                 1079185
Instantiations:        4206806
Check time:            11.545s
== packages/law-practice/domain @ a69b1956ee (singleThreaded)
Types:                  250047
Instantiations:         830007
Check time:             1.149s
```

## Transcript: P5

```text
== packages/foundation/modeling/schema @ 67ba9397d3 (singleThreaded)
Types:                 133907
Instantiations:        446382
Check time:            0.594s
== packages/tooling/tool/cli @ 67ba9397d3 (singleThreaded)
Types:                 1078097
Instantiations:        4202582
Check time:            10.390s
== packages/law-practice/domain @ 67ba9397d3 (singleThreaded)
Types:                  248668
Instantiations:         799552
Check time:             1.121s
```
