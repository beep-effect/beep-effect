# Build baseline before the declaration-only change

Packet: `goals/declaration-only-builds`. Date: 2026-11-10. This is the
"before" half of the measurement `SPEC.md` asks for. PR 2 records the "after"
half with the same script.

## Method

- Tree: `main` @ 2cadc8caa0d, in a clean worktree with every package built.
- Script: `goals/declaration-only-builds/ops/measure-build-baseline.ts`, run
  as one admission job:
  `beep-heavy bun goals/declaration-only-builds/ops/measure-build-baseline.ts --out <tsv> --runs 3`.
- For each of the 181 packages whose `beep:build` emits (168 of them carry the
  Babel step), three times over, serially:
  1. remove `dist`, time `tsrs -p tsconfig.json` (cold emit);
  2. size `dist` by file class;
  3. time `bun run babel`, then size the JavaScript again;
  4. time a cold `tsrs -p tsconfig.json --emitDeclarationOnly --sourceMap false`
     into a scratch directory inside the package, and size it.
- Raw rows: [`2026-11-10-build-baseline.tsv`](./2026-11-10-build-baseline.tsv),
  543 rows, every command exit 0.
- Machine: AMD Ryzen Threadripper 9970X, 64 threads. Load average was 63 at
  the start and 59 at the end, from other agent lanes. Seconds are inflated;
  the three steps are interleaved per package, so their ratios hold better
  than their absolute values. Sums below use each package's fastest run.

## Wall time, serial, fastest of three per package

| Step | 181 emitting packages | 168 with Babel |
| --- | --- | --- |
| `tsrs -p tsconfig.json` (JavaScript, maps, declarations) | 52.2 s | 44.5 s |
| `bun run babel` | n/a | 66.4 s |
| `tsrs` declarations only | 53.2 s | not split |

- Babel takes longer than the compile in 152 of the 168 packages. Across them
  it is 60% of the generated build's serial work (66.4 s of 110.9 s).
- Emitting declarations only is not faster than emitting everything (53.2 s
  against 52.2 s, inside the noise). Writing JavaScript is close to free for
  `tsrs`. The time saved by PR 2 is the Babel pass, nothing else.
- Per-run sums, to show the spread: emit 84.7, 72.1 and 68.9 s; Babel 74.0,
  71.1 and 72.7 s; declarations only 74.8, 77.8 and 67.8 s.

Largest Babel passes (fastest run, ms):

| Package | Babel | Emit | Declarations only |
| --- | --- | --- | --- |
| `@beep/repo-cli` | 6202 | 4663 | 4312 |
| `@beep/repo-ai-metrics` | 1230 | 711 | 728 |
| `@beep/data` | 962 | 446 | 423 |
| `@beep/schema` | 902 | 363 | 376 |
| `@beep/cli-kit` | 875 | 328 | 632 |
| `@beep/yaml` | 843 | 265 | 271 |

## `dist` bytes going into the Turbo cache

| Class | Files | Bytes |
| --- | --- | --- |
| JavaScript (after Babel) | 4,808 | 54.4 MB |
| JavaScript maps (after Babel) | | 29.5 MB |
| Declarations | 4,831 | 76.5 MB |
| Declaration maps | | 7.5 MB |
| `tsconfig.tsbuildinfo` | 181 | 60.7 MB |
| Total | | 228.6 MB |

- JavaScript and its maps are 84.0 MB, 37% of what a build writes and caches.
  Before Babel rewrites them they are 88.1 MB.
- A declaration-only build writes 76.5 MB of declarations and 7.5 MB of maps,
  the same as today, and a 61.9 MB tsbuildinfo (2% larger).
- tsbuildinfo is the second-largest class. It is out of scope here.

## What PR 2 should show

- The serial build work of the 168 packages falls by about 60%.
- `dist` shrinks by about 84 MB (37%).
- No change in compile time. A result that claims a compile speed-up from
  dropping JavaScript emit is noise.

## Caveats

- Serial per-package timings, not a `turbo run build` wall. Under Turbo the
  packages run in parallel, so the wall saving is smaller than the summed one.
- Cold emit only. The warm-incremental build cost was not measured here.
- One machine, one session, under load.
