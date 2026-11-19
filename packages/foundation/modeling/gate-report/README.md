# @beep/gate-report

The gate-neutral verification report model. A gate (`test`, `check`, later others) runs its tool; an adapter turns the tool's output into `GateEvent`s; `reduceEvents` folds them into one typed `GateReport` of units and items; `dispatch` picks one of twenty cells by run shape and run outcome and produces a neutral `ConsoleDocument`; `projectLines` turns that document into the plain-text agent console under a caller-supplied budget.

## Why this package

Every gate in this repository used to print its own tool's stream. An agent then read thousands of characters to learn one verdict and dug through raw logs for the failure. This package is the shared shape that ends that: one report per run with honest counts (an empty run is `ERRORED`, timeouts, load failures, hook failures and unhandled errors each keep their own total), and one console contract for every gate: the verdict line first and last, failures only, bounded, a cascade of one cause folded to one line, then the record path and the next command.

The model holds no repo specifics. Command strings (the pointer table), the record and log paths, the fix command of a folded cause and the console budget all arrive as data from the caller. The input fingerprint is an opaque string. The package depends on `effect`, `@beep/schema` and `@beep/identity` only.

## Usage

```ts
import { ConsoleBudget, GatePointers } from "@beep/gate-report/ConsoleDocument";
import { ConsoleInput, dispatch } from "@beep/gate-report/Dispatch";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { projectLines } from "@beep/gate-report/PlainText";
import { reduceEvents } from "@beep/gate-report/Reducer";
import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";

const report = reduceEvents([
  GateEvent.cases.RunStarted.make({
    runId: "r1",
    gate: "test",
    subject: "@beep/glob",
    itemKind: "test",
    startedAt: DateTime.makeUnsafe(0),
    inputFingerprint: "abc",
  }),
  GateEvent.cases.UnitCollected.make({ unit: "src/a.test.ts", items: 0 }),
  GateEvent.cases.RunFinished.make({ durationMs: 12, reason: "passed" }),
]);

if (Result.isSuccess(report)) {
  const document = dispatch(
    ConsoleInput.make({ report: report.success, pointers: { test: GatePointers.make({ failure: "beep gate show test" }) } })
  );
  const budget = ConsoleBudget.make({ maxChars: 8000, maxLineChars: 240, maxDiffLines: 12 });
  console.log(projectLines({ document, budget })[0]); // test @beep/glob: ERRORED, 0 tests collected (12ms)
}
```

## Modules

- `Vocabulary`: the closed sets as `LiteralKit` domains (item outcome, run reason, run outcome, run shape, failure kind, history label, item and unit kinds, severity, coverage metric, output stream).
- `Scalars`: counts, durations, positions, non-empty text, the ISO instant.
- `ItemKey`: the stable item key (test, diagnostic, fault), the message shape, the fingerprint and the history series key.
- `Item`, `GateReport`, `Policy`, `StrayOutput`, `GateRecord`: the report schemas and the `gate-report/v1` record envelope.
- `GateEvent`, `Reducer`: the event union and the reducer with the honest-count rules.
- `Classify`, `Format`, `FailureSignature`, `CauseFold`: the classifiers, count and duration formatting, the failure signature and the cause-folding table (TS6305 first).
- `ConsoleDocument`, `Dispatch`, `PlainText`: the neutral console document, the twenty-cell dispatch table and the plain-text projection.
- `Interchange`, `Widening`: the lossless CTRF and SARIF maps and the upstream vocabularies with their widening maps.

## Development

```bash
# from the repository root
bun x turbo run build --filter=@beep/gate-report^...
bun run beep quality package-verify @beep/gate-report

# from packages/foundation/modeling/gate-report
bun run check
bun run lint
bun run test
bun run docgen
```

Tests import package source through `@beep/gate-report/<Module>` aliases; `test/support/builders.ts` holds the shared report, event and projection builders. The console laws AC-L1 to AC-L3 are properties over inputs generated from the schemas' arbitraries (`test/ConsoleLaws.property.test.ts`).

## Provenance

Ported from the MIT project vitest-agent by C. Spencer Beggs: the pure core of `@vitest-agent/sdk` (result, event, render-state and record-file schemas, the dispatcher contract, the honest-count rules, the stray-output summary), `@vitest-agent/ui` (the reducer, the shape and outcome classifiers, the dispatch table, its cells and footer, count and duration formatting) and `@vitest-agent/engine` (the failure signature), widened from one test runner to any gate by `goals/gate-report-core`. The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices. No `@vitest-agent/*` package is a dependency.

### Attribution

- Upstream packages: `@vitest-agent/sdk` 9.0.5, `@vitest-agent/ui` 6.0.7, `@vitest-agent/engine` 3.2.8
- Upstream commit: `1cf1ab94` (reference checkout `.repos/vitest-agent`)
- License: [LICENSE](./LICENSE) (upstream MIT notice alongside the beep-effect notice)

### Deviations

The model is gate-neutral: project, file and test become gate, unit and item, and every closed set is widened as the goal's SPEC widening table lists (item outcome adds `warned`, run reason adds `errored` and renames `interrupted` to `cancelled`, run outcome adds `warnings-only` and `interrupted` and renames `threshold-violation` to `policy-violation`, shapes become `item`, `unit`, `package`, `workspace`). The report records every item, passed ones included, under a key that carries the file, so same-named tests in two files no longer collide. Totals are counted from the items, not trusted from the runner, and load, hook and unhandled failures are items with their own totals. Events reduce straight to a report rather than to an intermediate render state; a hook throw and a load failure are one `UnitFaulted` event, coverage thresholds are `PolicyBreached`, classification is `ItemLabelled`, and the module, test and suite start events carry no state. The twelve cells grow to twenty and now share one console contract: verdict line first and last, entries, fold lines, cap, delta, path, pointer; a green run prints its verdict alone, so upstream's projects table, module list, trend line, coverage-gap table, suggested actions, console-leak note and scoped-coverage note are not rendered, and stray output prints only on a red run. The pointer line names caller-supplied commands instead of MCP tools, and an unlabelled or `recovered` failure now points at the failure command instead of printing nothing. The failure signature hashes with 64-bit FNV-1a instead of a SHA-256 prefix, so the model needs neither `node:crypto` nor a parser; the function-boundary line is an input the adapter may supply. The record envelope is `gate-report/v1` with one report and no published JSON Schema URL. Vitest duck typing, stack-frame formatting, the stray-output recorder and the task-tree synthesizer are the Vitest adapter's, not this package's.

## License

[MIT](LICENSE)
