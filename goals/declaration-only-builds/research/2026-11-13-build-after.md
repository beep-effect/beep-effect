# Build numbers after the declaration-only change

Packet: `goals/declaration-only-builds`. Date: 2026-11-13. This is the "after"
half of the measurement `SPEC.md` asks for, with a fresh "before" taken in the
same job so the two share a machine state.

## Method

Same script as the baseline
(`goals/declaration-only-builds/ops/measure-build-baseline.ts`, three runs,
serial, fastest run per package), in one admission job, back to back:

1. **Before:** a fresh worktree of `main` @ 7169830e846, built from cache.
   Rows: [`2026-11-13-build-before.tsv`](./2026-11-13-build-before.tsv).
2. **After:** PR 2's lane @ 7c40b759973 (that `main` plus the change), built.
   Rows: [`2026-11-13-build-after.tsv`](./2026-11-13-build-after.tsv).

The script times the compiler step of each package's own `beep:build`, so the
"after" column is the declaration-only command and the "before" column is the
full emit. 181 packages in both, every command exit 0. Compiler
`7.1.0-beta+effect-tsgo.0.68.0`. Load average 26 to 41, well below the 60 the
first baseline ran under.

## Wall time, serial, fastest of three per package

| Step | Before | After |
| --- | --- | --- |
| Compiler step of `beep:build` | 30.8 s | 32.9 s |
| `bun run babel` (168 packages) | 50.1 s | gone |
| Build work, total | 80.9 s | 32.9 s |

- Build work falls by 59%. The baseline note predicted about 60%.
- The compile itself did not get faster: 30.8 s against 32.9 s, inside the
  noise (load rose from 26 to 41 between the two halves). As predicted, the
  saving is the Babel pass.
- `@beep/repo-cli`, the largest package: 8.1 s (3.7 s compile, 4.4 s Babel)
  before, 4.3 s after.

## `dist` bytes going into the Turbo cache

| Class | Before | After |
| --- | --- | --- |
| JavaScript | 54.9 MB (4,834 files) | 0 |
| JavaScript maps | 29.8 MB | 0 |
| Declarations | 77.2 MB (4,857 files) | 77.2 MB (4,857 files) |
| Declaration maps | 7.5 MB | 7.5 MB |
| `tsconfig.tsbuildinfo` | 63.1 MB | 63.1 MB |
| Total | 232.5 MB | 147.9 MB |

- `dist` shrinks by 84.7 MB, 36%.
- After a clean `bun run build` of the lane no library package `dist` holds a
  `*.js` or `*.js.map` file.

## Against the first baseline

The 2026-11-10 baseline (`2026-11-10-build-baseline.md`) recorded a 52.2 s
compile and a 66.4 s Babel pass at load average 60 on an older compiler.
Today's "before" is faster in absolute terms and has the same shape: Babel is
62% of the build work there and 60% in the baseline. Use today's pair for the
before and after comparison; the two halves ran minutes apart.

## Caveats

- Serial per-package timings, not a `turbo run build` wall. Packages build in
  parallel under Turbo, so the wall saving is smaller than the summed one. One
  cold `bun run build` of the lane took 43 s for 201 tasks at load average
  above 100; no matching cold wall was taken before the change.
- Cold builds only.
