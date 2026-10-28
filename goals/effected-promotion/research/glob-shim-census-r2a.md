# Bun.Glob shim census: roadmap PR R2a

Recorded 2026-10-28 for roadmap PR R2a of `goals/effected-promotion` (W4-p: the root `vitest.setup.ts`
`GlobShim` matcher moves from `picomatch` to `@beep/glob` `GlobPattern`, `dot: true`; `toml` and its
`Bun.TOML` shim leave with it). The oracle the wave-4 plan names for R2a is this census: the set of paths
each `GlobShim` pattern matched before the switch, and a proof that the set is the same after.

## What was measured

- **Universe** (66,959 paths at `f77a32de6d`): every git-tracked path and each of its ancestor directories,
  repo-relative, plus the same paths relative to every tracked `package.json` directory that contains them
  (199 package directories). Directories are included because the shim's `scanSync` walker asks the matcher
  about directories as well as files. No path carries a trailing slash, because the walker never produces one.
- **Patterns** (16): the five literals the repo hands to `new Bun.Glob(...)` (`**/*.ts`, `*.json`, `*`,
  `**/*` for the relativized `${repoPath}/**/*`, `**/package.json`), the `vitest.shared.ts` include and
  coverage globs, the package test scripts' `test/integration/**` exclude, three repo-wide test globs, and
  four semantics probes (brace expansion, dotfiles, dot directories, a trailing globstar after a file-shaped
  segment).
- **Engines**: `picomatch` 4.0.7 with `{ dot: true }` (before) and `@beep/glob` `GlobPattern.compileResult`
  under `GlobPatternOptions.make({ dot: true })` (after; minimatch 10.2.6 underneath). Each side is recorded
  as a count, a sha256 of the newline-joined sorted list, and the list itself when it holds at most 400 paths.

The record is `research/glob-shim-census-r2a.json`. Its `before` side was taken once, on the lane at
`f77a32de6d` with `picomatch` still installed, by a scratch script run on Bun 1.4.4 (so every difference
also carries real `Bun.Glob.match` verdicts for its witness paths). `ops/glob-shim-census.ts` recomputes the
`after` side on the current tree and compares it with the record:

```
bun goals/effected-promotion/ops/glob-shim-census.ts --out <report.json>
# universe 66959 paths matches the census; patterns identical 16/16
```

## Result

| Pattern | Origin | picomatch | `@beep/glob` | Verdict |
| --- | --- | --- | --- | --- |
| `**/*.ts` | effect-drizzle `test/import-boundary.test.ts`, `scratchpad/effect-ontology/scripts/audit-arbitraries.ts` | 15,783 | 15,783 | identical |
| `*.json` | repo-cli `Cache/Cache.command.ts` | 37 | 37 | identical |
| `*` | repo-cli `Files/internal/MatchPerson.ts` | 191 | 191 | identical |
| `**/*` | repo-cli `test/architecture-operation-plan.test.ts` (`${repoPath}/**/*`), `test/effect-vitest-detectors.test.ts` fixture | 66,959 | 66,959 | identical |
| `**/package.json` | repo-cli `test/foundation-topology.test.ts` | 213 | 213 | identical |
| `test/**/*.test.{ts,tsx}` | `vitest.shared.ts` include | 2,787 | 2,787 | identical |
| `src/**/*.{ts,tsx}` | `vitest.shared.ts` includeSource and coverage include | 4,103 | 4,103 | identical |
| `test/integration/**` | package test scripts `--exclude` | 90 | 89 | 1 picomatch-only path: the bare directory `test/integration` |
| `test/example.test.ts` | `vitest.shared.ts` doctest include | 0 | 0 | identical |
| `**/*.test.ts` | repo-wide test glob | 5,753 | 5,753 | identical |
| `**/test/**/*.test.{ts,tsx}` | repo-wide test glob | 5,821 | 5,821 | identical |
| `packages/**/test/**` | repo-wide test directory glob | 8,691 | 8,519 | 172 picomatch-only paths: the bare `test` directories |
| `**/*.{md,mdx}` | brace-expansion probe | 9,027 | 9,027 | identical |
| `**/.*` | dotfile probe | 690 | 690 | identical |
| `**/.*/**` | dot-directory probe | 849 | 849 | identical |
| `src/**/*.{ts,tsx}/**` | trailing-globstar probe | 4,103 | 0 | 4,103 picomatch-only paths: `src/**/*.{ts,tsx}` files |

Every pattern a repo caller or a vitest config actually uses matches the same set under both engines. The
three differences are all one semantics: picomatch lets a trailing `/**` match zero segments, so `x/**`
matches the bare `x`; minimatch (and `@beep/glob`) require the slash, so `x/**` matches `x/` and `x/...`
but not `x`. Real `Bun.Glob.match` returns `false` for every picomatch-only witness in the record
(`a/**` does not match `a`; it matches `a/`), so on those patterns the switch moves the shim onto Bun's
side rather than away from it.

One further probe, outside the census because the walker never produces the input: `Bun.Glob.match` and
picomatch both reject `a/b.ts/` (a file path with a trailing slash) for `**/*.ts`, while minimatch accepts
it. The shim's `scanSync` strips nothing and appends nothing, so no path with a trailing slash reaches
`match`.

## scanSync parity (found while pinning the census)

The parity test `packages/tooling/tool/cli/test/vitest-bun-glob-shim.test.ts` runs the same expectations on
Bun (native `Bun.Glob`) and on Node (the shim). Writing it exposed one pre-existing walker divergence,
unrelated to the matcher: `Bun.Glob.scanSync` defaults `onlyFiles` to `true`, while the shim listed
directories unless the caller passed `onlyFiles: true` or the pattern ended in `/**/*`. R2a fixes the
default (`includeDirectories = options?.onlyFiles === false`) and drops the pattern special case; the test
pins `*`, `src/**/*`, `src/**`, `src`, `**/*` with and without `onlyFiles: false` and `dot: true`. No repo
caller depended on the old default: `MatchPerson.ts` passes `onlyFiles: false` explicitly and the other
four callers list files. A 23-case probe over the same fixture agrees between native Bun and the shim except
for the pattern `*/` with `onlyFiles: false` (Bun lists the directories, the shim lists nothing); no caller
uses a trailing-slash pattern, and it is left as recorded.
