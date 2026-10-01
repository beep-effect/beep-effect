# P5 check-census measurement (2026-10-01)

Single-checker gate measurement for the P5 close (SPEC goal-time rows
2026-09-16 and 2026-09-29). Command per package, with a fresh build-info file
for every run, the same compiler (`7.0.2+effect-tsgo.0.45.0`), and the
dependency closure built (`bunx turbo run build --filter='<pkg>^...'`):

```sh
./node_modules/.bin/tsc -p <pkg>/tsconfig.json --noEmit --extendedDiagnostics --singleThreaded --tsBuildInfoFile <fresh>
```

The base is the live merge base at the final measurement, `origin/main`
`cf97523f40`. That is the Effect pin `b5a2d4c1d6` from #1368, plus #1339, #1362,
#1363, #1364, #1369 and #1370. The P5 head is `9951f493a0` on a clean tree.
Earlier P5 measurements against `90517df719` and `a69b1956ee` read the same
direction and are superseded by this one.

| Package | Base `cf97523f40` | P5 `9951f493a0` | Delta |
| --- | ---: | ---: | ---: |
| `@beep/schema` | 460,260 | 446,382 | −13,878 |
| `@beep/repo-cli` | 4,206,806 | 4,202,537 | −4,269 |
| `@beep/law-practice-domain` | 830,007 | 799,552 | −30,455 |

None of the three packages shows an instantiation increase. Check time is
advisory and was taken on a loaded workstation.
`standards/check-census.regression-baseline.jsonc` is written by
`bun run beep quality check-census --write-baseline` on the clean tree at
`9951f493a0` (`dirtyWorktree: false`).

## Transcript: base

```text
== packages/foundation/modeling/schema @ cf97523f40 (singleThreaded)
Types:                 135850
Instantiations:        460260
Check time:            0.829s
== packages/tooling/tool/cli @ cf97523f40 (singleThreaded)
Types:                 1079184
Instantiations:        4206806
Check time:            16.622s
== packages/law-practice/domain @ cf97523f40 (singleThreaded)
Types:                  250046
Instantiations:         830007
Check time:             1.789s
```

## Transcript: P5

```text
== packages/foundation/modeling/schema @ 9951f493a0 (singleThreaded)
Types:                 133906
Instantiations:        446382
Check time:            0.890s
== packages/tooling/tool/cli @ 9951f493a0 (singleThreaded)
Types:                 1078097
Instantiations:        4202537
Check time:            14.449s
== packages/law-practice/domain @ 9951f493a0 (singleThreaded)
Types:                  248667
Instantiations:         799552
Check time:             1.381s
```
