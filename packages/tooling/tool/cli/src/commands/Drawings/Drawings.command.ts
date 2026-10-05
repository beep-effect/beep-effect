/**
 * `beep drawings`: render design-figure sheet sets from a spec and validate
 * sheet-set PDFs against the filing rules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { FigureSet, RenderRequest, SheetFormat, SheetOptions, ValidationOptions } from "@beep/technical-drawing";
import { A } from "@beep/utils";
import { Effect, pipe } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import * as O from "effect/Option";
import { printLines } from "../../internal/cli/Printer.ts";
import { DrawingsCommandError } from "./Drawings.errors.ts";
import { FigureSetLive } from "./Drawings.layer.ts";
import type { OcctError } from "@beep/occt";
import type { DrawingError, RenderManifest, ValidationReport } from "@beep/technical-drawing";

const specFlag = Flag.File("spec", { mustExist: true }).pipe(Flag.withDescription("Figure-set spec JSON"));
const outFlag = Flag.Directory("out").pipe(Flag.withDescription("Output directory for sheets, PDF, and manifest"));
const formatFlag = Flag.ChoiceWithValue("format", [
  ["letter", "letter"],
  ["a4", "a4"],
] as const).pipe(Flag.withDefault(SheetFormat.Enum.letter), Flag.withDescription("Sheet format"));
const noValidateFlag = Flag.Boolean("no-validate").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Skip the filing validator after rendering")
);
const pagesFlag = Flag.Int("pages").pipe(Flag.optional, Flag.withDescription("Expected page count"));
const pdfArgument = Argument.File("pdf", { mustExist: true }).pipe(
  Argument.withDescription("Sheet-set PDF to validate")
);

const describe = (error: DrawingError | OcctError): string =>
  pipe(error.cause, O.match({ onNone: () => error.message, onSome: (cause) => `${error.message} (${cause})` }));

const renderFindings = (report: ValidationReport): ReadonlyArray<string> =>
  A.length(report.findings) === 0
    ? [`validator: ok (${report.pageCount} page(s), sha256 ${report.pdfSha256})`]
    : [
        `validator: ${A.length(report.findings)} finding(s) on ${report.pageCount} page(s), sha256 ${report.pdfSha256}`,
        ...A.map(report.findings, (f) =>
          pipe(
            f.page,
            O.match({
              onNone: () => `  [${f.code}] ${f.message}`,
              onSome: (page) => `  [${f.code}] page ${page}: ${f.message}`,
            })
          )
        ),
      ];

const renderManifestSummary = (manifest: RenderManifest): ReadonlyArray<string> => [
  `rendered "${manifest.title}": ${A.length(manifest.figures)} sheet(s) at ${manifest.scale} pt/unit → ${manifest.pdfFile}`,
  `sheet-set sha256 ${manifest.pdfSha256}`,
  ...A.map(manifest.figures, (f) => `  FIG. ${f.figure} ${f.view}: ${f.svgFile} (${f.visibleSegments} segments)`),
  ...A.map(manifest.omissions, (o) => `  omitted ${o.omitted}: ${o.relation} to ${o.shown} — proven`),
  ...pipe(
    manifest.validation,
    O.map(renderFindings),
    O.getOrElse(() => ["validator: skipped"])
  ),
];

const failOnFindings = (manifest: RenderManifest): Effect.Effect<void, DrawingsCommandError> =>
  pipe(
    manifest.validation,
    O.filter((report) => !report.ok),
    O.match({
      onNone: () => Effect.void,
      onSome: (report) =>
        Effect.fail(
          DrawingsCommandError.new(`The rendered sheet set has ${A.length(report.findings)} validator finding(s).`)(
            report
          )
        ),
    })
  );

const runRender = Effect.fn("DrawingsCommand.render")(function* (options: {
  readonly spec: string;
  readonly out: string;
  readonly format: SheetFormat;
  readonly noValidate: boolean;
}) {
  const figureSet = yield* FigureSet;
  const manifest = yield* figureSet
    .render(
      RenderRequest.make({
        specPath: options.spec,
        outputDir: options.out,
        sheet: SheetOptions.make({ format: options.format }),
        validate: !options.noValidate,
      })
    )
    .pipe(
      Effect.mapError((cause) => DrawingsCommandError.new(cause, `Rendering the figure set failed: ${describe(cause)}`))
    );
  yield* printLines(renderManifestSummary(manifest));
  yield* failOnFindings(manifest);
});

const runValidate = Effect.fn("DrawingsCommand.validate")(function* (options: {
  readonly pdf: string;
  readonly pages: O.Option<number>;
}) {
  const figureSet = yield* FigureSet;
  const report = yield* figureSet
    .validate(options.pdf, ValidationOptions.make({ expectedPages: options.pages }))
    .pipe(
      Effect.mapError((cause) => DrawingsCommandError.new(cause, `Validating the sheet set failed: ${describe(cause)}`))
    );
  yield* printLines(renderFindings(report));
  if (!report.ok) {
    return yield* DrawingsCommandError.new(`${A.length(report.findings)} validator finding(s).`)(report);
  }
});

const drawingsRenderCommand = Command.make(
  "render",
  { spec: specFlag, out: outFlag, format: formatFlag, noValidate: noValidateFlag },
  runRender
).pipe(
  Command.withDescription("Render a figure-set spec into 37 CFR 1.84 sheets and a PDF"),
  Command.provide(FigureSetLive)
);

const drawingsValidateCommand = Command.make("validate", { pdf: pdfArgument, pages: pagesFlag }, runValidate).pipe(
  Command.withDescription("Validate a sheet-set PDF against 37 CFR 1.84 and the Patent Center PDF rules"),
  Command.provide(FigureSetLive)
);

const printDrawingsIndex = () => printLines(["drawings commands: render, validate"]);

/**
 * Design-figure drawings command group.
 *
 * **Example** (Run the drawings command group)
 *
 * ```ts
 * import { drawingsCommand } from "@beep/repo-cli"
 * import { Command } from "effect/cli"
 * import { Effect } from "effect"
 *
 * const run = Command.run(drawingsCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const drawingsCommand = Command.make("drawings", {}, printDrawingsIndex).pipe(
  Command.withDescription("Design-figure sheet rendering and filing validation"),
  Command.withSubcommands(A.make(drawingsRenderCommand, drawingsValidateCommand))
);
