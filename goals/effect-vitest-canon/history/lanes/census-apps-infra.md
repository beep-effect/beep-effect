# Apps and Infrastructure Census Lane

- Lane: `codex-census-apps-infra`
- Model: `gpt-daybreak-blue-latest`
- Effort: `medium`
- Date: `2026-09-08`
- Phase: P0a only
- Status: complete — corrected after orchestrator review

## Corrected outcome

The live census under `goals/effect-vitest-canon/research/census/apps-infra/` contains 55 JSON
artifacts plus the reproducible scanner. `scope.json` is a bare array whose rows contain exactly
`{file,package,kind,bytes,lines}`. Its `kind` domain is exactly `test|support`.

| Root | Test/spec | Support `.ts` | Total |
| --- | ---: | ---: | ---: |
| `apps/**` | 88 | 5 | 93 |
| `infra/**` | 11 | 2 | 13 |
| Total | 99 | 7 | 106 |

The 106 unique paths span 920,686 bytes, 22,002 lines, and 11 registered workspace owners.

## Scope and ownership method

Verified on 2026-09-08 from the live checkout. Discovery began with
`rg --files --hidden apps infra`. Eligible files are `.test.*` and `.spec.*` files using the
requested extensions, plus `.ts` support modules beneath `test/`.

The explicit D9 path exclusions are only `scratchpad`, `.claude`, `goals`, `explorations`,
`docs`, and `node_modules`. Normal `rg` discovery also honors confirmed ignored output patterns:
`coverage/`, `dist/`, `build/`, `.turbo`, `.next/`, and `src-tauri/target/`.

`discovery-differences.json` compares normal discovery with `rg --files --hidden --no-ignore`
after the same D9 and file-kind filters. Both found 106 eligible paths. No eligible file is
currently hidden only by ignore rules, and no source path was found under a directory literally
named `build`, `generated`, or `vendor`. Those names are not hard-coded source exclusions.

Ownership is the longest containing workspace root registered in root `package.json`. A nearer
nested manifest not registered there cannot take ownership. Therefore every `infra/**` row is
owned by `@beep/infra`; no `@mock/pkg-*` fixture owns a row; and
`infra/ci-runners/sdks/ghaRunners/test/build.test.js` remains an in-scope SDK test owned by
`@beep/infra`, not by its nested generated manifest. Its SDK location remains a later judgment
fact, not a reason to drop it.

## Historical comparison

The 2026-09-04 figure 945 is combined `apps/**` plus `packages/**` test files, excluding support;
it is not a historical packages-only count. Infra is directly comparable: ten tests then versus
eleven live now.

The orchestrator-provided 2026-09-08 provisional test totals are 865 packages, 88 apps, and 11
infra, for 964. Live apps plus packages are provisionally 953, eight above the historical
combined 945; infra is one above ten; the provisional total is nine above 955. Support modules
are excluded from those comparisons. The packages figure was not independently verified here.

## Corrected class summary

Exact call classes use a ts-morph syntax-only `Project` with
`skipAddingFilesFromTsConfig: true`; no tsconfig project or `getType()` was used.

| Class | Files | Occurrences | Contract |
| --- | ---: | ---: | --- |
| `@effect/vitest` imports | 62 | 62 | exact module text |
| `@effect/vitest/plain` imports | 0 | 0 | exact module text |
| plain `vitest` imports | 58 | 58 | exact module text |
| `it.effect(...)` | 50 | 189 | exact identity; excludes `it.effect.prop` |
| `it.effect.prop(...)` | 0 | 0 | separately counted |
| `it.live(...)` | 7 | 28 | exact identity |
| `it.layer(...)` | 2 | 4 | exact identity |
| `it.flakyTest(...)` | 0 | 0 | exact identity |
| `it.prop(...)` / `effect.prop(...)` | 0 | 0 | separate exact identities |
| `fc.assert(...)` | 18 | 22 | exact identity |
| `Effect.runPromise(...)` | 15 | 73 | exact identity |
| `Effect.runSync(...)` | 12 | 37 | exact identity |
| `Effect.runFork(...)` | 0 | 0 | exact identity |
| `Effect.provide(...)` | 20 | 25 | exact identity |
| `Effect.scoped(...)` | 20 | 47 | exact identity |
| `Effect.exit(...)` | 3 | 6 | exact identity |
| `Effect.result(...)` | 2 | 4 | exact identity |
| `Effect.sleep(...)` | 7 | 11 | exact identity |
| `TestClock` / `TestClock.adjust(...)` | 3 / 2 | 12 / 2 | token / call shape |
| `@effect/vitest/utils` imports | 0 | 0 | exact module text |
| `BunFileSystem` or `NodeFileSystem` | 11 | 43 | token census |
| raw `node:fs` imports | 1 | 2 | exact module text |
| `os.tmpdir(...)` | 1 | 2 | exact textual shape |
| `vi.mock(...)` or `vi.spyOn(...)` | 10 | 31 | exact textual shape |
| retry/attempt/backoff | 14 | 31 | broad heuristic tokens |

`effect-provide.json` includes only calls whose AST expression is exactly `Effect.provide`.
`Effect.provideService` and longer names are excluded. EV002 separately reports five exact
`Effect.provide` calls in four files that also contain exact `it.effect` or `it.live` calls. It
remains a semantic heuristic: file co-occurrence does not prove callback containment or whether
the provided layer is a permitted pure stub.

The assertion measures are explicitly file-level: 49 `it.effect` files also contain 1,273
`expect(...)` occurrences, while 12 contain 100 `assert` call/member occurrences. These figures
do not assert callback containment.

## EV001–EV015 candidates

Every EV file exists, including empty EV015. These are candidates, not accepted violations.

| Rule | Files | Occurrences | Boundary |
| --- | ---: | ---: | --- |
| EV001 | 23 | 110 | exact run calls; callback containment unresolved |
| EV002 | 4 | 5 | exact provide calls; semantics unresolved |
| EV003 | 11 | 53 | lexical `withXyz(...)` candidates |
| EV004 | 4 | 7 | exact scoped calls with file co-occurrence |
| EV005 | 2 | 4 | exact result calls; assertion use unresolved |
| EV006 | 40 | 144 | heuristic Option/Result/Exit expectations |
| EV007 | 18 | 22 | direct property assertion shape |
| EV008 | 1 | 1 | file-level clock heuristic |
| EV009 | 7 | 28 | exact `it.live` calls; need is judgment |
| EV010 | 12 | 47 | platform filesystem judgment candidates |
| EV011 | 50 | 50 | verified import co-occurrence |
| EV012 | 10 | 31 | mock/spy target is judgment |
| EV013 | 14 | 31 | broad retry/attempt heuristic |
| EV014 | 2 | 4 | file-level resource/timeout heuristic |
| EV015 | 0 | 0 | no file-level layer plus clock-adjust candidate |

EV008 identifies `apps/professional-desktop/test/dock-shell.test.tsx:116`. EV014 identifies four
layer calls across `apps/professional-desktop/test/theme-atoms.test.tsx` and
`infra/test/OpenClaw.test.ts`; it does not prove resource cost, scope, or option ownership.

## Complete wrapper declarations

`wrappers.json` uses the same syntax-only project. Each `body` is the complete variable statement
or function declaration returned by ts-morph, with AST start/end lines. This removes the first
pass's lexical truncation risk.

Eight local definitions were found. Six are effect/layer-oriented candidates:
`withBunServices`, `withContactConfig`, `withPgliteSql`, `withChatDbPath`,
`withHttpServerImpl`, and dualized `withHttpServer`. `withReportDigest` and `withSocials` are pure
data helpers; they remain naming candidates but are not resource wrappers.

There are 53 lexical call-like occurrences across 11 files. Examples: `withReportDigest` 15,
`withHttpServer` 12, `withSocials` 7, `withContactConfig` 5, `withPgliteSql` 4, and
`withBunServices` 2. `withTempDirectory`, `withTempWorkingDirectory`, `withTempRepo`,
`withAdmissionTempRoot`, and `withEnvVar` are zero. Calls can include member APIs such as
`withLive`; definitions and calls remain separate.

## Validation and limitations

`validation.json` passes: 106 unique exact-shape scope rows; only registered owners; all infra
owned by `@beep/infra`; no mock fixture owners; aggregate/path checks for 35 class files and all
15 EV files; every finding path restricted to scope; eight unique wrapper definitions; and 13
unique file/name call aggregates. All 55 JSON files parse successfully.

Imports and judgment classes still use bounded textual heuristics where AST identity cannot settle
semantics. Comments, strings, aliases, computed properties, and unusual syntax can cause textual
false positives or misses; each JSON states its method and limitations. Wrapper resource/layer
arrays are token inventories from complete declarations, not semantic proof.

No test, package source, configuration, install, detector, or later-phase change was made. No
package verification was run, as required.
