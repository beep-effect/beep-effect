# @beep/repo-gate-vitest

The Vitest adapter of the gate report contract. A reporter, registered once in the shared Vitest config, turns every package's test run into gate events, reduces them with the `@beep/gate-report` model, and writes the package's `test` record and raw log through `@beep/repo-gate-record`:

- `<package>/.beep/gates/test/report.json`, the `gate-report/v1` record;
- `<package>/.beep/gates/test/report.log`, every line the tests printed through `console`, then every failed item in full (message, diff and stack).

Both files are declared outputs of the Turbo `test` task, so a cache hit restores them. The console an agent or a person reads is rendered from the record by the repo CLI, never by this package.

## Usage

The shared config (`vitest.shared.ts`) appends the reporter by package specifier after Vitest's own default selection:

```ts
import { configDefaults, defineConfig } from "vitest/config"

export default defineConfig({
  test: { reporters: [...configDefaults.reporters, "@beep/repo-gate-vitest/Vitest.reporter"] },
})
```

It is left out of doctest runs and deep property sweeps, which share the config but must not overwrite the test record. A command-line `--reporter` replaces the configured list, so coverage runs write no record. A run under `test/integration` records the `test-integration` gate instead of `test`.

## Rules the reporter keeps

- The registered module imports no workspace package at the top level. The implementation (`src/internal/GateVitestRun.ts`) loads when Vitest starts; if it cannot load, or a record cannot be written, the reporter prints one line on stderr, turns itself off and leaves the run's exit code alone.
- It prints nothing on success, strips no reporter, patches no stream and changes no Vitest setting.
- It loads under Node and Bun and reaches no `bun:` module (`test/RuntimeBoundary.test.ts` spawns Node to prove it).
- The input fingerprint is Turbo's task hash (`TURBO_HASH`) when Turbo ran the task, otherwise a value unique to the run.

## Development

```bash
# from the repository root
bun x turbo run build --filter=@beep/repo-gate-vitest^...
bun run beep quality package-verify @beep/repo-gate-vitest
```

The tests call the reporter class directly with synthetic Vitest objects, and `test/EndToEnd.test.ts` runs real Vitest on fixture packages written under the checkout's ignored `.beep/` directory: a green run, a red run with an assertion diff, a timeout and a module that fails to load, and an empty run. `test/ReporterList.test.ts` resolves the package's real config and checks the reporter list is Vitest's default selection plus the adapter.

## Provenance

Ported from the MIT project vitest-agent by C. Spencer Beggs: the batch synthesis of a finished Vitest run into run events (`@vitest-agent/ui` `synthesize.ts`), the Vitest object handling of the report builder (`@vitest-agent/sdk` `build-report.ts`: stack-frame formatting, missing results and diagnostics, unknown states, throwing getters, suite-level failures), the guarded error-field reads (`coerce-error-text.ts`), the top-frame selection (`@vitest-agent/plugin` `process-failure.ts`) and the stray-output recorder (`@vitest-agent/sdk` `stray-output.ts`), widened from one test runner to the gate report contract by `goals/gate-report-core`. The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices. No `@vitest-agent/*` package is a dependency.

### Attribution

- Upstream packages: `@vitest-agent/ui` 6.0.7, `@vitest-agent/sdk` 9.0.5, `@vitest-agent/plugin` 6.0.15
- Upstream commit: `1cf1ab94` (reference checkout `.repos/vitest-agent`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)

### Deviations

Upstream's reporter is a 3,141-line plugin that owns the reporter chain, patches Vitest's logger streams, renders its own console and persists to SQLite. This reporter is one entry in the shared config: it writes two files and prints nothing. It synthesizes from the finished module tree at the end of the run instead of per-test hooks, which is upstream's own replay path. A module that failed to load and a hook that threw are unit faults with their own totals instead of synthetic failed tests, and an unhandled error is its own item. The failure signature uses the raw-line bucket only: the function-boundary refinement needs a parser the model does not take. The stray-output recorder and reader are ported; the capture that installs the recorder by wrapping the `Logger`'s streams is not, because the adapter patches no stream, so a run records stray output only when some other party publishes a capture under the recorder's key. Nothing here derives from upstream's two Vitest-derived files.

## License

[MIT](LICENSE)
