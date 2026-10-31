/**
 * Circular-import lint: `beep lint circular`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils";
import { A, thunkEmptyStr } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Inspectable from "effect/Inspectable";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { failWithReportedExit } from "../../internal/cli/ExitCodeError.ts";
import { qualityStepOutputBound, runCaptured } from "../../internal/process/StepExec.ts";
import { PosInt } from "../../internal/schema/PosInt.ts";
import { OXLINT_CIRCULAR_CONFIG } from "./internal/LintPackage.ts";
import { LintCircularAnalysisError } from "./Lint.errors.ts";

const $I = $RepoCliId.create("commands/Lint/LintCircular.command");

class CircularDiagnostic extends S.Opaque<CircularDiagnostic, { readonly brand: unique symbol }>()(
  S.Struct({
    code: S.tag("import(no-cycle)"),
    severity: S.tag("error"),
    filename: S.String,
    message: S.String,
    note: S.OptionFromOptionalKey(S.String),
  }).pipe($I.annoteSchema("CircularDiagnostic", { description: "Native oxlint value-import cycle diagnostic." }))
) {}

class CircularLintReport extends S.Opaque<CircularLintReport, { readonly brand: unique symbol }>()(
  S.Struct({
    diagnostics: S.Array(CircularDiagnostic),
    number_of_files: PosInt,
    number_of_rules: S.tag(1),
  }).pipe(
    $I.annoteSchema("CircularLintReport", {
      description: "Single-rule oxlint cycle report proving that at least one source file was checked.",
    })
  )
) {}

const decodeCircularLintReport = S.decodeUnknownEffect(S.fromJsonString(CircularLintReport));

const runLintCircular = Effect.fn("Lint.circular")(function* () {
  const root = yield* findRepoRoot();
  const path = yield* Path.Path;
  const result = yield* runCaptured({
    command: path.join(root, "node_modules/.bin/oxlint"),
    args: [
      "--config",
      path.join(root, OXLINT_CIRCULAR_CONFIG),
      "--disable-nested-config",
      "--tsconfig",
      path.join(root, "tsconfig.json"),
      "--format",
      "json",
      "packages/tooling/tool/cli/src",
      "packages/tooling/library/repo-utils/src",
    ],
    cwd: root,
    bound: qualityStepOutputBound,
  }).pipe(Effect.mapError((cause) => LintCircularAnalysisError.new(Inspectable.toStringUnknown(cause, 0))));

  if (result.truncated || (result.exitCode !== 0 && result.exitCode !== 1)) {
    return yield* LintCircularAnalysisError.new(`Oxlint cycle analysis failed (${result.exitCode}): ${result.output}`);
  }
  const report = yield* decodeCircularLintReport(result.output).pipe(
    Effect.mapError((cause) =>
      LintCircularAnalysisError.new(`Invalid oxlint cycle report: ${Inspectable.toStringUnknown(cause, 0)}`)
    )
  );
  if (A.isReadonlyArrayNonEmpty(report.diagnostics)) {
    for (const diagnostic of report.diagnostics) {
      yield* Console.error(
        `${diagnostic.filename}: ${diagnostic.message}\n${O.getOrElse(diagnostic.note, thunkEmptyStr)}`
      );
    }
    return yield* failWithReportedExit("lint circular: circular dependencies found.");
  }
  if (result.exitCode !== 0) {
    return yield* LintCircularAnalysisError.new(`Oxlint cycle analysis exited ${result.exitCode} without diagnostics.`);
  }
  yield* Console.log("No circular dependencies found.");
});

/**
 * Lint command for circular dependency checks.
 *
 * **Example** (Reference the circular-import subcommand)
 *
 * ```ts
 * console.log("docgen metadata")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const lintCircularCommand = Command.make("circular", {}, runLintCircular).pipe(
  Command.withDescription("Detect circular dependencies in tooling source directories")
);
