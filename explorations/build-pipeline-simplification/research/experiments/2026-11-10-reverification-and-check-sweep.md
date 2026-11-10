# Experiment 3: re-verification on `main` and the source-resolved check sweep

Packet: `explorations/build-pipeline-simplification`. Date: 2026-11-10. Repo
`main` @ 6d47006fa1d (the checkout carried one extra commit that touches only
an IDE file). Nothing in the tree was changed; every output went to a session
scratch directory.

The October research ran on `main` @ e62411d63f. This note re-checks its census
and timings a month later, then measures the one option the report dismissed in
a parenthesis: type-checking packages straight from source, with no `dist`.

## Machine and versions

- AMD Ryzen Threadripper 9970X, `nproc` = 64. Load average 59 to 63 for the
  whole session: other agent lanes were running. Absolute times are inflated;
  the with/without comparison is interleaved per project, so the ratios hold
  better than the seconds.
- `tsrs` prints `Version 7.1.0-beta+effect-tsgo.0.67.5 (tsrs 0.23.0-ts7.1.0-beta)`.
- `effect` 4.1.2, Bun 1.4.4, `babel-plugin-annotate-pure-calls` unchanged.

## What moved since 2026-10-09

| Fact | Research (e62411d63f) | Today (6d47006fa1d) |
| --- | --- | --- |
| Build and check compiler | effect-tsgo 0.47.2 (Go), as `tsc` | Effect-patched `tsrs` 0.23 (Rust), `goals/tsrs-gates` |
| Tracked manifests under `packages/` and `apps/` | 161 (149 without fixtures) | 220 (210 without fixtures) |
| `beep:build` with the Babel pair | 123 | 169 (`tsrs -p tsconfig.json && bun run babel`) |
| Bare emit / no-emit build | 13 / 5 | 13 / 9 (`tsrs -p tsconfig.check.json`) |
| tsbuildinfo location | `node_modules/.tmp/` | inside `dist` (#1874, 2026-10-18) |
| `private: true` with `publishConfig.access: "public"` | 127 of 149 | 172 of 210 |
| Workspace packages with `private: false` | 0 | 0 |

`standards/architecture/14-ecosystem-packages.md` ("Release Lane") calls
`publishConfig.access: "public"` a dormant template setting, "not a publication
promise". The report used that field as the publishable-tier predicate. It
selected 85% of the repo on the day it was written and selects no package that
publishes. `drizzle-orm` is still `1.0.0-rc.5`, so the first member's activation
condition has not been met.

#1874 moved tsbuildinfo into `outDir` and added a Turbo task-contract test. That
is the stale-tsbuildinfo incident the report assigned to a new build-kit package.

## Who reads `dist/*.js`

- No workspace manifest points `main`, `module`, `types`, `bin` or `exports` at
  `dist` outside `publishConfig` (jq over every tracked manifest).
- `packages/ecosystem/effect-drizzle/test/bundle-build.ts` aliases
  `@beep/effect-drizzle/pg` and `/sqlite` to `src`, so the bundle probe never
  reads the Babel output. The package hand-writes 92 `__PURE__` markers in `src`.
- Still an inference until a declaration-only build passes the full hosted gate.

## `@beep/schema` emit and Babel, re-timed

Emit to a scratch `outDir` with a scratch tsbuildinfo, then the package's Babel
command over that directory. Six runs, cold each time.

| Step | Min | Range |
| --- | --- | --- |
| `tsrs -p tsconfig.json` (emit) | 0.27 s | 0.27 to 1.11 s |
| `babel … annotate-pure-calls` | 0.64 s | 0.64 to 1.52 s |

Output: 176 `.js`, 176 `.d.ts`, 1,742 `__PURE__` markers. JavaScript plus maps
are 1.08 MB; declarations plus maps are 2.06 MB. In October the emit minimum was
0.59 to 0.62 s and Babel 0.39 to 0.40 s. The compiler got faster and Babel did
not, so Babel went from about 40% of this build to more than half. Indicative
only at this load.

## Source-resolved check sweep

Question: can `check` stop depending on `^build`? Every `exports` map already
points at `src`. Only the `references` array makes the compiler read a
dependency's `dist/*.d.ts`, and `references` is not inherited through `extends`.

Method: for each of the 199 tracked `tsconfig.check.json` files, write a scratch
config `{ "extends": "<abs path to tsconfig.check.json>", "compilerOptions":
{ "typeRoots": [...] } }` with no `references`. Run `tsrs -p <config> --noEmit`
twice per project, once on the real config (`ref`) and once on the scratch one
(`noref`), interleaved, serial, inside one `beep-heavy` job. `/usr/bin/time`
records wall and max RSS. Raw rows:
[`2026-11-10-check-sweep.tsv`](./2026-11-10-check-sweep.tsv).

| Measure | With references | Source-resolved |
| --- | --- | --- |
| Projects passing | 198 of 199 | 187 of 199 |
| Serial wall, all 199 | 31.9 s | 87.4 s |
| Serial wall, the 186 that pass both ways | 26.1 s | 79.7 s (3.1x) |
| Median per-project wall ratio | 1.0 | 2.3x |
| Median per-project RSS ratio | 1.0 | 1.46x |
| Peak RSS (`@beep/repo-cli`) | 2.5 GB | 4.0 GB |

Failures:

- **With references, 1:** `packages/tooling/tool/cli`, one TS2353 (`'noWalk'
  does not exist in type 'LogOptions'`). The source-resolved run of the same
  project passes, so a dependency's `dist/*.d.ts` in this checkout is older than
  its source. This is the coherence hazard, observed live.
- **Source-resolved, 11 harness artifacts:** TS2688 for `vite/client` (6) and
  `bun-types` (5). The scratch config sits outside the package, so package-local
  type roots are not found. A config inside the package would not hit this.
- **Source-resolved, 1 real:** `packages/ontology/ui` fails with TS2305 inside a
  dependency's source (`foundation/ui-system/ui/src/components/native-select.tsx`,
  `CaretDownIcon` from `@phosphor-icons/react`). `ui-system` passes its own
  check. Dependency source is being checked under the consumer's compiler
  options, and it resolves differently there. Source-resolved checking would
  need every consumer's options to be a superset of every dependency's.

Reading: source-resolved checking works for most of the repo with no build at
all, and it costs about 2.3x wall and 1.5x memory per project because every
consumer re-checks its dependencies' sources. That cost lands on the per-package
`check` every lane runs most.

## Check re-does the build's type-check

197 of 199 `tsconfig.check.json` files differ from the package `tsconfig.json`
only in emit options (`composite`, `declaration`, `declarationMap`,
`incremental`, `noEmit`, `rootDir`); two add `scripts` to `include`. For the
packages that emit, `beep:check` starts with `tsrs -p tsconfig.check.json`, the
same program `beep:build` already type-checked. A full run type-checks each
package's `src` twice. Whether one pass can serve both (identical diagnostics,
incremental state included) is not tested here.

## Other state checked

- Effect 4.1.2 `src/internal/schema/codegen.ts` still excludes `Declaration` and
  `Suspend` (lines 42, 53, 156); `SchemaAOTCompiler` is still
  `@stability unstable`. Two of the three DEFER re-entry triggers have not fired.
- `packages/ecosystem/effect-drizzle/test/bundle-build.ts` still blames
  `Bun.build 1.3.14`; Experiment 1 retired that on 2026-10-09.
- `turbo.json` `build.outputs` still lists `**/node_modules/.tmp/*.tsbuildinfo`,
  the pre-#1874 location.

## Caveats

- Load 59 to 63 throughout. Treat seconds as upper bounds.
- The sweep covers `tsconfig.check.json` only. The 178 `tsconfig.test.json`
  projects were not swept.
- Repo-wide Babel cost was not measured; `@beep/schema` is one of the larger
  packages.
- Emit was assumed to cost about what a no-emit check costs, per Experiment 2
  ("emitting JS is nearly free"). It was not re-measured repo-wide.
