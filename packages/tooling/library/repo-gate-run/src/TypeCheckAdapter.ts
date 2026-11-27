/**
 * The type checker's adapter: compiler output and the unbuilt-reference
 * probe become the gate events of a `check` run, one diagnostic item per
 * reported error or warning.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { GateEvent } from "@beep/gate-report/GateEvent";
import { Unit } from "@beep/gate-report/GateReport";
import { Item, Location } from "@beep/gate-report/Item";
import { DiagnosticKeyInput, diagnosticKey } from "@beep/gate-report/ItemKey";
import { Count, DurationMs, IsoInstant, Text } from "@beep/gate-report/Scalars";
import { $RepoGateRunId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { boundedExcerpt } from "./Excerpt.ts";
import { DiagnosticSeverity, parseDiagnosticLine, TsDiagnostic } from "./TsDiagnostic.ts";

const $I = $RepoGateRunId.create("TypeCheckAdapter");

/**
 * What every `check` run states before its diagnostics: its id, gate,
 * package, project file, start, duration and input fingerprint.
 *
 * **Details**
 *
 * `project` is the configuration the compiler checked, relative to the
 * package; a diagnostic printed without a file is keyed on it.
 *
 * **Example** (Describe a check run)
 *
 * ```ts
 * import { CheckRun } from "@beep/repo-gate-run/TypeCheckAdapter";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = CheckRun.make({
 *   runId: "r1", subject: "@beep/glob", startedAt: DateTime.makeUnsafe(0), durationMs: 900, inputFingerprint: "x",
 * });
 * console.log(run.gate, run.project); // check tsconfig.json
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CheckRun extends S.Opaque<CheckRun, { readonly brand: unique symbol }>()(
  S.Struct({
    runId: Text,
    gate: Text.pipe(S.withConstructorDefault(Effect.succeed("check"))),
    subject: Text,
    project: Text.pipe(S.withConstructorDefault(Effect.succeed("tsconfig.json"))),
    startedAt: IsoInstant,
    durationMs: DurationMs,
    inputFingerprint: Text,
    head: S.OptionFromOptionalKey(Text).pipe(S.withConstructorDefault(Effect.succeedNone)),
    branch: S.OptionFromOptionalKey(Text).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("CheckRun", {
      description: "A check run's id, gate, package, project file, start, duration and input fingerprint.",
    })
  )
) {}

/**
 * **Example** (Describe a clean compiler run)
 *
 * ```ts
 * import { CheckRun, CompilerRun } from "@beep/repo-gate-run/TypeCheckAdapter";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = CheckRun.make({
 *   runId: "r1", subject: "@beep/glob", startedAt: DateTime.makeUnsafe(0), durationMs: 900, inputFingerprint: "x",
 * });
 * console.log(CompilerRun.make({ run, exitCode: 0, output: "" }).unitsChecked); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CompilerRun extends S.Opaque<CompilerRun, { readonly brand: unique symbol }>()(
  S.Struct({
    run: CheckRun,
    exitCode: S.Int,
    output: S.String,
    unitsChecked: Count.pipe(S.withConstructorDefault(Effect.succeed(1))),
  }).pipe(
    $I.annoteSchema("CompilerRun", {
      description: "A finished compiler run: its exit code, its output and how many units it checked.",
    })
  )
) {}

/**
 * One project a package references whose declaration index is not built,
 * as the unbuilt-reference probe finds it.
 *
 * **Example** (Describe a missing output)
 *
 * ```ts
 * import { UnbuiltReference } from "@beep/repo-gate-run/TypeCheckAdapter";
 *
 * const missing = UnbuiltReference.make({ reference: "../upstream", declarationFile: "../upstream/dist/index.d.ts" });
 * console.log(missing.reference); // ../upstream
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UnbuiltReference extends S.Opaque<UnbuiltReference, { readonly brand: unique symbol }>()(
  S.Struct({
    reference: Text,
    declarationFile: Text,
  }).pipe(
    $I.annoteSchema("UnbuiltReference", {
      description: "A referenced project whose declaration index is not built.",
    })
  )
) {}

/**
 * The unbuilt-reference probe's finding: the run, and every referenced
 * project with no declaration index, which stopped the check before its
 * compiler.
 *
 * **Example** (Describe a probe failure)
 *
 * ```ts
 * import { CheckRun, UnbuiltProbe, UnbuiltReference } from "@beep/repo-gate-run/TypeCheckAdapter";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = CheckRun.make({
 *   runId: "r1", subject: "@beep/glob", startedAt: DateTime.makeUnsafe(0), durationMs: 5, inputFingerprint: "x",
 * });
 * const probe = UnbuiltProbe.make({
 *   run,
 *   missing: [UnbuiltReference.make({ reference: "../upstream", declarationFile: "../upstream/dist/index.d.ts" })],
 * });
 * console.log(probe.missing.length); // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UnbuiltProbe extends S.Opaque<UnbuiltProbe, { readonly brand: unique symbol }>()(
  S.Struct({
    run: CheckRun,
    missing: UnbuiltReference.pipe(S.NonEmptyArray),
  }).pipe(
    $I.annoteSchema("UnbuiltProbe", {
      description: "The referenced projects with no declaration index that stopped a check before its compiler.",
    })
  )
) {}

const stripAnsi: (text: string) => string = Str.replace(/\u001b\[[0-9;]*m/gu, "");

const locationOf = (file: string, diagnostic: TsDiagnostic): O.Option<Location> =>
  Location.makeOption({ file, line: diagnostic.line, column: diagnostic.column });

const diagnosticItem = (input: {
  readonly keyFile: string;
  readonly unit: string;
  readonly diagnostic: TsDiagnostic;
}): Item =>
  Item.make({
    key: diagnosticKey(
      DiagnosticKeyInput.make({ file: input.keyFile, code: input.diagnostic.code, message: input.diagnostic.message })
    ),
    unit: input.unit,
    path: [],
    name: input.diagnostic.message,
    outcome: DiagnosticSeverity.is.warning(input.diagnostic.severity) ? "warned" : "failed",
    location: locationOf(input.unit, input.diagnostic),
    code: O.some(input.diagnostic.code),
    severity: O.some(input.diagnostic.severity),
  });

const compilerItem =
  (project: string) =>
  (diagnostic: TsDiagnostic): Item => {
    const file = O.getOrElse(diagnostic.file, () => project);
    return diagnosticItem({ keyFile: file, unit: file, diagnostic });
  };

const runEvents = (input: {
  readonly run: CheckRun;
  readonly items: ReadonlyArray<Item>;
  readonly exitCode: number;
  readonly unitsChecked: number;
  readonly logExcerpt: O.Option<string>;
}): ReadonlyArray<GateEvent> => [
  GateEvent.cases.RunStarted.make({
    runId: input.run.runId,
    gate: input.run.gate,
    subject: input.run.subject,
    itemKind: "diagnostic",
    startedAt: input.run.startedAt,
    inputFingerprint: input.run.inputFingerprint,
    head: input.run.head,
    branch: input.run.branch,
  }),
  GateEvent.cases.UnitQueued.make({ unit: Unit.make({ id: input.run.subject, kind: "package" }) }),
  ...A.map(input.items, (item) => GateEvent.cases.ItemFinished.make({ item })),
  GateEvent.cases.RunFinished.make({
    durationMs: input.run.durationMs,
    reason: input.exitCode === 0 ? "passed" : "failed",
    exitCode: O.some(input.exitCode),
    collected: O.some(input.unitsChecked),
    logExcerpt: input.logExcerpt,
  }),
];

/**
 * Turn compiler output into the events of a `check` run.
 *
 * **Details**
 *
 * Every line the compiler printed a diagnostic on becomes one item: an
 * error fails, a warning warns. Colour codes are stripped first and lines
 * that are not diagnostics (continuations, summaries) are skipped. A
 * diagnostic printed without a file is keyed on the run's project file.
 * Repeated diagnostics of one file, code and message share one plain key,
 * which the reducer numbers by their locations. A
 * nonzero exit with no diagnostic reduces to an errored run carrying an
 * excerpt of the output, under the recorder's 8 KiB bound; an empty output
 * carries none, so the recorder's excerpt of the raw log is used instead.
 *
 * **Example** (Read one diagnostic)
 *
 * ```ts
 * import { CheckRun, CompilerRun, compilerEvents } from "@beep/repo-gate-run/TypeCheckAdapter";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = CheckRun.make({
 *   runId: "r1", subject: "@beep/glob", startedAt: DateTime.makeUnsafe(0), durationMs: 900, inputFingerprint: "x",
 * });
 * const events = compilerEvents(CompilerRun.make({ run, exitCode: 2, output: "src/a.ts(3,7): error TS2322: nope\n" }));
 * console.log(events.map((event) => event._tag).join(",")); // RunStarted,UnitQueued,ItemFinished,RunFinished
 * ```
 *
 * @param compiler - the finished compiler run: its exit code, output and units checked
 * @returns the run's events, one item per diagnostic line the compiler printed
 * @category adapters
 * @since 0.0.0
 */
export const compilerEvents = (compiler: CompilerRun): ReadonlyArray<GateEvent> => {
  const items = pipe(
    Str.split(stripAnsi(compiler.output), /\r?\n/u),
    A.map(flow(Str.trim, parseDiagnosticLine)),
    A.getSomes,
    A.map(compilerItem(compiler.run.project))
  );
  const unexplained = compiler.exitCode !== 0 && A.isReadonlyArrayEmpty(items);
  return runEvents({
    run: compiler.run,
    exitCode: compiler.exitCode,
    unitsChecked: compiler.unitsChecked,
    items,
    logExcerpt: unexplained ? boundedExcerpt(compiler.output) : O.none(),
  });
};

/**
 * Turn the unbuilt-reference probe's finding into the events of a `check`
 * run that stopped before its compiler: one TS6305 item per missing
 * declaration index, which the console folds into one line with the build
 * command.
 *
 * **Details**
 *
 * A probe finding has no location, so each item is keyed on its reference
 * to stay distinct, with the package's project file as its unit.
 *
 * **Example** (Fold an unbuilt upstream)
 *
 * ```ts
 * import { CheckRun, UnbuiltProbe, UnbuiltReference, unbuiltReferenceEvents } from "@beep/repo-gate-run/TypeCheckAdapter";
 * import * as DateTime from "effect/DateTime";
 *
 * const run = CheckRun.make({
 *   runId: "r1", subject: "@beep/glob", startedAt: DateTime.makeUnsafe(0), durationMs: 5, inputFingerprint: "x",
 * });
 * const events = unbuiltReferenceEvents(
 *   UnbuiltProbe.make({ run, missing: [UnbuiltReference.make({ reference: "../a", declarationFile: "../a/dist/index.d.ts" })] })
 * );
 * console.log(events.length); // 4
 * ```
 *
 * @param probe - the run and every referenced project with no declaration index
 * @returns the run's events, one TS6305 item per missing declaration index
 * @category adapters
 * @since 0.0.0
 */
export const unbuiltReferenceEvents = (probe: UnbuiltProbe): ReadonlyArray<GateEvent> =>
  runEvents({
    run: probe.run,
    exitCode: 1,
    unitsChecked: 1,
    logExcerpt: O.none(),
    items: A.map(probe.missing, (missing) =>
      diagnosticItem({
        keyFile: missing.reference,
        unit: probe.run.project,
        diagnostic: TsDiagnostic.make({
          file: O.none(),
          line: 0,
          column: 0,
          severity: "error",
          code: "TS6305",
          message: `Output file '${missing.declarationFile}' has not been built from source file '${missing.reference}'.`,
        }),
      })
    ),
  });
