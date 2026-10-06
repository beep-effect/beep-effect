/**
 * `beep drawings`: render design-figure sheet sets from a spec and validate
 * sheet-set PDFs against the filing rules.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ConfirmationSource,
  EmailAddress,
  FigureSet,
  RenderRequest,
  SheetFormat,
  SheetOptions,
  SheetSetApproval,
  SignRequest,
  ValidationOptions,
} from "@beep/technical-drawing";
import { A } from "@beep/utils";
import { Config, Effect, pipe } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { printLines } from "../../internal/cli/Printer.ts";
import { DrawingsCommandError } from "./Drawings.errors.ts";
import { FigureSetLive, MailReaderM365Live, MailReaderUnavailable, sheetSetApprovalLive } from "./Drawings.layer.ts";
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
const shadeFlag = Flag.Boolean("shade").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Add procedural 37 CFR 1.152 straight-line surface shading")
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
  `rendered "${manifest.title}": ${A.length(manifest.figures)} ${manifest.shaded ? "shaded" : "unshaded"} sheet(s) at ${manifest.scale} pt/unit → ${manifest.pdfFile}`,
  `sheet-set sha256 ${manifest.pdfSha256}`,
  ...A.map(
    manifest.figures,
    (f) =>
      `  FIG. ${f.figure} ${f.view}: ${f.svgFile} (${f.visibleSegments} segments${manifest.shaded ? `, ${f.shadingSegments} shading` : ""})`
  ),
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
  readonly shade: boolean;
}) {
  const figureSet = yield* FigureSet;
  const manifest = yield* figureSet
    .render(
      RenderRequest.make({
        specPath: options.spec,
        outputDir: options.out,
        sheet: SheetOptions.make({ format: options.format }),
        validate: !options.noValidate,
        shade: options.shade,
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
  { spec: specFlag, out: outFlag, format: formatFlag, noValidate: noValidateFlag, shade: shadeFlag },
  runRender
).pipe(
  Command.withDescription("Render a figure-set spec into 37 CFR 1.84 sheets and a PDF"),
  Command.provide(FigureSetLive)
);

const drawingsValidateCommand = Command.make("validate", { pdf: pdfArgument, pages: pagesFlag }, runValidate).pipe(
  Command.withDescription("Validate a sheet-set PDF against 37 CFR 1.84 and the Patent Center PDF rules"),
  Command.provide(FigureSetLive)
);

const manifestFlag = Flag.File("manifest", { mustExist: true }).pipe(
  Flag.withDescription("Render manifest (manifest.json) of the sheet set")
);
const approverFlag = Flag.String("approver").pipe(
  Flag.withDescription("Approver email address recorded for the matter")
);
const byFlag = Flag.String("by").pipe(Flag.withDescription("Who is running the command; descriptive, never proof"));
const messageIdFlag = Flag.String("message-id").pipe(Flag.withDescription("Graph message id of the approver's reply"));
const confirmationPdfFlag = Flag.File("pdf", { mustExist: true }).pipe(
  Flag.withDescription("PDF the approver initialed, under the corpus root")
);
const initialedPageFlag = Flag.Int("page").pipe(Flag.withDescription("One-based page the approver initialed"));
const attestedByFlag = Flag.String("attested-by").pipe(
  Flag.withDescription("Operator attesting the approver delivered the PDF")
);
const corpusRootFlag = Flag.Directory("corpus-root", { mustExist: true }).pipe(
  Flag.withFallbackConfig(Config.String("BEEP_OPPOLD_CORPUS_ROOT")),
  Flag.withDescription("Corpus root the confirmation PDF must live under")
);

const decodeApprover = (value: string) =>
  S.decodeEffect(EmailAddress)(value).pipe(
    Effect.mapError((cause) => DrawingsCommandError.new(cause, `"${value}" is not an email address.`))
  );

const runStatement = Effect.fn("DrawingsCommand.statement")(function* (options: { readonly manifest: string }) {
  const approval = yield* SheetSetApproval;
  const statement = yield* approval
    .statement(options.manifest)
    .pipe(Effect.mapError((cause) => DrawingsCommandError.new(cause, describe(cause))));
  yield* printLines([
    "Ask the approver to review the sheets and, if they approve, write this line in their own reply:",
    "",
    statement,
    "",
    "Do not pre-fill it in the request; the approver types or pastes it themselves.",
  ]);
});

const runSign = (source: (options: Record<string, unknown>) => ConfirmationSource) =>
  Effect.fn("DrawingsCommand.sign")(function* (options: {
    readonly manifest: string;
    readonly approver: string;
    readonly by: string;
    readonly [key: string]: unknown;
  }) {
    const approval = yield* SheetSetApproval;
    const approver = yield* decodeApprover(options.approver);
    const record = yield* approval
      .sign(SignRequest.make({ manifestPath: options.manifest, approver, by: options.by, source: source(options) }))
      .pipe(Effect.mapError((cause) => DrawingsCommandError.new(cause, describe(cause))));
    yield* printLines([
      `approved sheet set ${record.sheetSetSha256}`,
      `  approver ${record.approver} via ${record.confirmationKind} ${record.confirmationLocator}`,
      "  record written next to the manifest: approval.json",
    ]);
  });

const drawingsStatementCommand = Command.make("statement", { manifest: manifestFlag }, runStatement).pipe(
  Command.withDescription("Print the approval line the approver must write for a rendered sheet set"),
  Command.provide(sheetSetApprovalLive(MailReaderUnavailable))
);

const drawingsSignEmailCommand = Command.make(
  "email",
  { manifest: manifestFlag, approver: approverFlag, by: byFlag, messageId: messageIdFlag },
  runSign((options) => ConfirmationSource.cases.email.make({ messageId: String(options.messageId) }))
).pipe(
  Command.withDescription("Record an approval from the approver's email reply (M365_TENANT_ID, M365_CLIENT_ID)"),
  Command.provide(sheetSetApprovalLive(MailReaderM365Live))
);

const drawingsSignPdfCommand = Command.make(
  "pdf",
  {
    manifest: manifestFlag,
    approver: approverFlag,
    by: byFlag,
    pdf: confirmationPdfFlag,
    page: initialedPageFlag,
    attestedBy: attestedByFlag,
    corpusRoot: corpusRootFlag,
  },
  runSign((options) =>
    ConfirmationSource.cases.pdf.make({
      path: String(options.pdf),
      initialedPage: Number(options.page),
      attestedBy: String(options.attestedBy),
      allowedRoot: String(options.corpusRoot),
    })
  )
).pipe(
  Command.withDescription("Record an approval from a PDF page the approver initialed"),
  Command.provide(sheetSetApprovalLive(MailReaderUnavailable))
);

const drawingsSignCommand = Command.make("sign", {}, () => printLines(["drawings sign commands: email, pdf"])).pipe(
  Command.withDescription("Record an attorney approval keyed to the sheet-set hash"),
  Command.withSubcommands(A.make(drawingsSignEmailCommand, drawingsSignPdfCommand))
);

const printDrawingsIndex = () => printLines(["drawings commands: render, validate, statement, sign"]);

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
  Command.withSubcommands(
    A.make(drawingsRenderCommand, drawingsValidateCommand, drawingsStatementCommand, drawingsSignCommand)
  )
);
