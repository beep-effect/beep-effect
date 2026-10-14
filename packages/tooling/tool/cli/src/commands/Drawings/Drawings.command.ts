/**
 * `beep drawings`: render design-figure sheet sets from a spec, validate
 * sheet-set PDFs against the filing rules, judge them, record deliveries and
 * attorney review rounds, record approvals, and pull reviewer attachments in
 * from Outlook.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { M365 } from "@beep/m365";
import { PdfTools } from "@beep/pdf-tools";
import {
  ConfirmationSource,
  EmailAddress,
  FigureSet,
  isPerspectiveView,
  RenderRequest,
  SheetFormat,
  SheetOptions,
  SheetSetApproval,
  SignRequest,
  ValidationOptions,
} from "@beep/technical-drawing";
import { A } from "@beep/utils";
import * as Config from "effect/Config";
import { Argument, Command, Flag } from "effect/cli";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { printLines } from "../../internal/cli/Printer.ts";
import { isRequiredSeverity } from "../Qa/Inventory.schemas.ts";
import { DrawingsCommandError } from "./Drawings.errors.ts";
import { drawingIntakeLaneLayer, runDrawingIntake } from "./Drawings.intake.ts";
import { buildDrawingJudgePack, ingestDrawingJudgeInventory } from "./Drawings.judge.ts";
import { FigureSetLive, MailReaderM365Live, MailReaderUnavailable, sheetSetApprovalLive } from "./Drawings.layer.ts";
import {
  findingFigures,
  openRequiredFindings,
  parseFigureOverride,
  reviewFindingRef,
} from "./Drawings.review.rules.ts";
import {
  DeliverRequest,
  ReviewIngestRequest,
  ReviewOpenRequest,
  ReviewPlanRequest,
  ReviewRoundLocation,
} from "./Drawings.review.schemas.ts";
import { DrawingReview } from "./Drawings.review.ts";
import type { OcctError } from "@beep/occt";
import type { Sha256Hex } from "@beep/schema";
import type { DrawingError, RenderManifest, ValidationReport } from "@beep/technical-drawing";
import type { ReviewFinding, ReviewStatus } from "./Drawings.review.schemas.ts";

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

const sheetEquivalence = S.toEquivalence(SheetOptions);

const sheetSummary = (manifest: RenderManifest, requested: SheetOptions): ReadonlyArray<string> =>
  pipe(
    manifest.sheet,
    O.match({
      onNone: () => [],
      onSome: (sheet) => [
        `sheet: ${sheet.format}, margins ${sheet.margins}${sheetEquivalence(sheet, requested) ? "" : " (from the spec; the --format flag was not used)"}`,
      ],
    })
  );

// A pictorial camera without a focus is the isometric projection.
const projectionNote = (figure: RenderManifest["figures"][number]): string =>
  isPerspectiveView(figure.view)
    ? pipe(
        figure.camera,
        O.match({
          onNone: () => "",
          onSome: (camera) => (O.isNone(camera.focus) ? ", isometric" : ", perspective"),
        })
      )
    : "";

/**
 * Lines `beep drawings render` prints for a finished render.
 *
 * **Details**
 *
 * Names the effective sheet format and margin standard, and says when the
 * spec's own sheet options replaced the ones the flags asked for. Each font
 * embedded for text labels is listed with its file and sha256. Pictorial
 * figures carry their projection (a pictorial camera without a focus is
 * isometric).
 *
 * **Example** (Summarise a manifest)
 *
 * ```ts
 * import { renderManifestSummary } from "@beep/repo-cli/commands/Drawings"
 * import { BoundingBox, ModelSummary } from "@beep/technical-drawing/Geometry.schemas"
 * import { EngineInfo, RenderManifest } from "@beep/technical-drawing/Manifest.schemas"
 * import { SheetOptions } from "@beep/technical-drawing/Sheet.schemas"
 * import * as O from "effect/Option"
 *
 * const manifest = RenderManifest.make({
 *   title: "Synthetic bracket",
 *   specSha256: "00",
 *   engine: EngineInfo.make({ name: "replicad", version: "1.1.0", binarySha256: "00" }),
 *   model: ModelSummary.make({ boundingBox: BoundingBox.make({ min: [0, 0, 0], max: [1, 1, 1] }), volume: 1, faceCount: 6, edgeCount: 12 }),
 *   scale: 1,
 *   figures: [],
 *   omissions: [],
 *   pdfFile: "sheets.pdf",
 *   pdfSha256: "00",
 *   validation: O.none(),
 *   sheet: O.some(SheetOptions.make({ margins: "cfr-strict" }))
 * })
 * console.log(renderManifestSummary({ manifest, requested: SheetOptions.make({}) }).join("\n"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderManifestSummary = ({
  manifest,
  requested,
}: {
  readonly manifest: RenderManifest;
  readonly requested: SheetOptions;
}): ReadonlyArray<string> => [
  `rendered "${manifest.title}": ${A.length(manifest.figures)} ${manifest.shaded ? "shaded" : "unshaded"} sheet(s) at ${manifest.scale} pt/unit → ${manifest.pdfFile}`,
  `sheet-set sha256 ${manifest.pdfSha256}`,
  ...sheetSummary(manifest, requested),
  ...A.map(manifest.fonts, (pin) => `label font: ${pin.family} → ${pin.file} (sha256 ${pin.sha256})`),
  ...A.map(
    manifest.figures,
    (f) =>
      `  FIG. ${f.figure} ${f.view}: ${f.svgFile} (${f.visibleSegments} segments${manifest.shaded ? `, ${f.shadingSegments} shading` : ""}${projectionNote(f)})`
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
  const requested = SheetOptions.make({ format: options.format });
  const manifest = yield* figureSet
    .render(
      RenderRequest.make({
        specPath: options.spec,
        outputDir: options.out,
        sheet: requested,
        validate: !options.noValidate,
        shade: options.shade,
      })
    )
    .pipe(
      Effect.mapError((cause) => DrawingsCommandError.new(cause, `Rendering the figure set failed: ${describe(cause)}`))
    );
  yield* printLines(renderManifestSummary({ manifest, requested }));
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
const byFlag = Flag.String("by").pipe(Flag.withDescription("Who is running the command; descriptive, never proof"));
const messageIdFlag = Flag.String("message-id").pipe(Flag.withDescription("Graph message id of the approver's reply"));
const confirmationPdfFlag = Flag.File("pdf", { mustExist: true }).pipe(
  Flag.withDescription("PDF the approver initialed, under the corpus root")
);
const initialedPageFlag = Flag.Int("page").pipe(Flag.withDescription("One-based page the approver initialed"));
const attestedByFlag = Flag.String("attested-by").pipe(
  Flag.withDescription("Operator attesting who delivered the PDF")
);
const deliveredByFlag = Flag.String("delivered-by").pipe(
  Flag.withDescription("Email address the PDF was delivered from; must equal the approver recorded in the spec")
);
const corpusRootBaseFlag = Flag.Directory("corpus-root", { mustExist: true }).pipe(
  Flag.withFallbackConfig(Config.String("BEEP_OPPOLD_CORPUS_ROOT"))
);
const corpusRootFlag = corpusRootBaseFlag.pipe(
  Flag.withDescription("Corpus root the confirmation PDF must live under")
);

const decodeDeliverer = (value: string) =>
  S.decodeEffect(EmailAddress)(value).pipe(
    Effect.mapError((cause) => DrawingsCommandError.new(cause, `"${value}" is not an email address.`))
  );

const reviewDirFlag = Flag.Directory("review-dir", { mustExist: true }).pipe(
  Flag.optional,
  Flag.withDescription("The matter's review/ directory; found from the manifest's ancestors when omitted")
);

// Shared by `statement` and `sign`: refuse while any review round of the
// matter is not cleared, else print the guard's warnings.
const guardApproval = Effect.fn("DrawingsCommand.guardApproval")(function* (
  what: string,
  manifest: string,
  reviewDir: O.Option<string>
) {
  const review = yield* DrawingReview;
  const verdict = yield* review.guard(manifest, reviewDir);
  if (A.isReadonlyArrayNonEmpty(verdict.refusals)) {
    return yield* DrawingsCommandError.new(
      verdict,
      `No ${what} while a review round of this matter is not cleared:\n${A.join(
        A.map(verdict.refusals, (line) => `  ${line}`),
        "\n"
      )}\nIngest every open round, then resolve or decline each required finding in the round's dispositions (beep drawings review plan). Rendering another set does not clear a round.`
    );
  }
  yield* printLines(A.map(verdict.warnings, (line) => `warning: ${line}`));
});

const runStatement = Effect.fn("DrawingsCommand.statement")(function* (options: {
  readonly manifest: string;
  readonly reviewDir: O.Option<string>;
}) {
  yield* guardApproval("approval statement", options.manifest, options.reviewDir);
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

// The approver is never a flag: `sign` reads it from the manifest, which carries
// the address the spec recorded when the set was rendered. Flags are checked
// first, then the review guard, so an approval line printed earlier, or derived
// by hand, cannot be recorded over a round that is not cleared.
const runSign = (
  source: (options: Record<string, unknown>) => Effect.Effect<ConfirmationSource, DrawingsCommandError>
) =>
  Effect.fn("DrawingsCommand.sign")(function* (options: {
    readonly manifest: string;
    readonly by: string;
    readonly reviewDir: O.Option<string>;
    readonly [key: string]: unknown;
  }) {
    const confirmation = yield* source(options);
    yield* guardApproval("approval", options.manifest, options.reviewDir);
    const approval = yield* SheetSetApproval;
    const record = yield* approval
      .sign(SignRequest.make({ manifestPath: options.manifest, by: options.by, source: confirmation }))
      .pipe(Effect.mapError((cause) => DrawingsCommandError.new(cause, describe(cause))));
    yield* printLines([
      `approved sheet set ${record.sheetSetSha256}`,
      `  approver ${record.approver} via ${record.confirmationKind} ${record.confirmationLocator}`,
      "  record written next to the manifest: approval.json",
    ]);
  });

const drawingReviewLive = DrawingReview.layer.pipe(Layer.provide(PdfTools.makeLayer()));

const drawingsStatementCommand = Command.make(
  "statement",
  { manifest: manifestFlag, reviewDir: reviewDirFlag },
  runStatement
).pipe(
  Command.withDescription(
    "Print the approval line the approver must write for a rendered sheet set; refused while a review round of the matter is not cleared"
  ),
  Command.provide(Layer.merge(sheetSetApprovalLive(MailReaderUnavailable), drawingReviewLive))
);

const drawingsSignEmailCommand = Command.make(
  "email",
  { manifest: manifestFlag, by: byFlag, messageId: messageIdFlag, reviewDir: reviewDirFlag },
  runSign((options) => Effect.succeed(ConfirmationSource.cases.email.make({ messageId: String(options.messageId) })))
).pipe(
  Command.withDescription(
    "Record an approval from the email reply of the approver recorded in the spec (M365_TENANT_ID, M365_CLIENT_ID); refused while a review round of the matter is not cleared"
  ),
  Command.provide(Layer.merge(sheetSetApprovalLive(MailReaderM365Live), drawingReviewLive))
);

const drawingsSignPdfCommand = Command.make(
  "pdf",
  {
    manifest: manifestFlag,
    by: byFlag,
    pdf: confirmationPdfFlag,
    page: initialedPageFlag,
    attestedBy: attestedByFlag,
    deliveredBy: deliveredByFlag,
    corpusRoot: corpusRootFlag,
    reviewDir: reviewDirFlag,
  },
  runSign((options) =>
    Effect.map(decodeDeliverer(String(options.deliveredBy)), (deliveredBy) =>
      ConfirmationSource.cases.pdf.make({
        path: String(options.pdf),
        initialedPage: Number(options.page),
        attestedBy: String(options.attestedBy),
        deliveredBy,
        allowedRoot: String(options.corpusRoot),
      })
    )
  )
).pipe(
  Command.withDescription(
    "Record an approval from a PDF page the approver initialed; refused while a review round of the matter is not cleared"
  ),
  Command.provide(Layer.merge(sheetSetApprovalLive(MailReaderUnavailable), drawingReviewLive))
);

const drawingsSignCommand = Command.make("sign", {}, () => printLines(["drawings sign commands: email, pdf"])).pipe(
  Command.withDescription("Record an attorney approval keyed to the sheet-set hash"),
  Command.withSubcommands(A.make(drawingsSignEmailCommand, drawingsSignPdfCommand))
);

const roundFlag = Flag.Int("round").pipe(Flag.withDefault(1), Flag.withDescription("Judge round number"));
const photosFlag = Flag.Directory("photos", { mustExist: true }).pipe(
  Flag.optional,
  Flag.withDescription("Reference photos of the article (ground truth for the judge)")
);
const packFlag = Flag.Directory("pack", { mustExist: true }).pipe(Flag.withDescription("Judge pack directory"));
const replyFlag = Flag.File("reply", { mustExist: true }).pipe(
  Flag.withDescription("The judge's final message, or a bare qa-inventory/v1 JSON file")
);

const reviewFlag = Flag.File("review", { mustExist: true }).pipe(
  Flag.optional,
  Flag.withDescription("A review round's round.json: add the reviewer's requests to the pack")
);

const runJudge = Effect.fn("DrawingsCommand.judge")(function* (options: {
  readonly manifest: string;
  readonly round: number;
  readonly photos: O.Option<string>;
  readonly review: O.Option<string>;
}) {
  const pack = yield* buildDrawingJudgePack({
    manifestPath: options.manifest,
    round: options.round,
    photosDir: options.photos,
    reviewPath: options.review,
  });
  yield* printLines([
    `judge pack: ${pack.packDir}`,
    `  ${pack.sheets} sheet(s), ${pack.photos} reference photo(s)${pack.reviewed ? ", reviewer requests" : ""}`,
    `  give the vision judge (claude-opus-5-5) ${pack.packDir}/prompt.md, then:`,
    `  bun run beep drawings judge-ingest --pack ${pack.packDir} --reply <reply file>`,
  ]);
});

const runJudgeIngest = Effect.fn("DrawingsCommand.judgeIngest")(function* (options: {
  readonly pack: string;
  readonly reply: string;
}) {
  const inventory = yield* ingestDrawingJudgeInventory({ packDir: options.pack, replyPath: options.reply });
  yield* printLines([
    `inventory: ${A.length(inventory.findings)} finding(s), REQUIRED FINDINGS: ${inventory.requiredCount}`,
    ...A.map(inventory.findings, (f) => `  ${f.id} ${f.severity} [${f.lens}] ${f.title}`),
  ]);
});

const drawingsJudgeCommand = Command.make(
  "judge",
  { manifest: manifestFlag, round: roundFlag, photos: photosFlag, review: reviewFlag },
  runJudge
).pipe(
  Command.withDescription("Build a vision-judge pack (sheet PNGs, photos, drawing-rubric prompt) for a sheet set"),
  Command.provide(PdfTools.makeLayer())
);

const drawingsJudgeIngestCommand = Command.make(
  "judge-ingest",
  { pack: packFlag, reply: replyFlag },
  runJudgeIngest
).pipe(Command.withDescription("Validate a judge reply as a drawing-rubric qa-inventory/v1 and store it in the pack"));

const intakeMessageFlag = Flag.String("message").pipe(
  Flag.withDescription("Outlook web link, or a Graph message or conversation id")
);
const intakeMailboxFlag = Flag.String("mailbox").pipe(
  Flag.optional,
  Flag.withDescription("Mailbox to read (address or user id); defaults to <PREFIX>_MAILBOX")
);
const intakeOutFlag = Flag.Directory("out").pipe(
  Flag.withDescription("Directory under the corpus root for the attachments and intake.json")
);
const intakeCorpusRootFlag = corpusRootBaseFlag.pipe(
  Flag.withDescription("Corpus root the intake directory must lie under")
);
const intakePickFlag = Flag.String("pick").pipe(
  Flag.withDefault("latest"),
  Flag.withDescription("For a conversation: latest, or n for the n-th newest message")
);
const intakeIncludeOwnFlag = Flag.Boolean("include-own").pipe(
  Flag.withDefault(false),
  Flag.withDescription("For a conversation: let --pick choose the mailbox's own sent mail (drafts are never chosen)")
);
// Intake only reads mail, so it defaults to the docket-intake registration (Mail.ReadWrite on the
// attorney's mailbox, no Mail.Send) rather than the send-capable M365_OUTBOX one.
const intakeEnvPrefixFlag = Flag.String("env-prefix").pipe(
  Flag.withDefault("CLOUD_M365_DOCKET"),
  Flag.withDescription(
    "Prefix of the app-only settings: <PREFIX>_TENANT_ID, _CLIENT_ID, _CERT_THUMBPRINT_SHA256, _CERT_PRIVATE_KEY, _MAILBOX (run under op run); defaults to the docket-intake registration (Mail.ReadWrite, no Mail.Send)"
  )
);

const drawingsIntakeCommand = Command.make(
  "intake",
  {
    message: intakeMessageFlag,
    mailbox: intakeMailboxFlag,
    out: intakeOutFlag,
    corpusRoot: intakeCorpusRootFlag,
    pick: intakePickFlag,
    includeOwn: intakeIncludeOwnFlag,
    envPrefix: intakeEnvPrefixFlag,
  },
  runDrawingIntake
).pipe(
  Command.withDescription(
    "Pull a message's file attachments into a directory under the corpus root, deduped by sha256, with intake.json (reads mail only; app-only settings from CLOUD_M365_DOCKET_*, a Mail.ReadWrite registration without Mail.Send, unless --env-prefix names another)"
  ),
  Command.provide((input) =>
    drawingIntakeLaneLayer({ envPrefix: input.envPrefix, mailLayer: M365.makeAppOnlyLiveLayer })
  )
);

const matterFlag = Flag.Directory("matter", { mustExist: true }).pipe(
  Flag.withDescription("Matter directory under the corpus root; rounds live in <matter>/review/round-<n>/")
);
const reviewRoundFlag = Flag.Int("round").pipe(Flag.withDescription("Review round number"));
const deliveryFlag = Flag.File("delivery", { mustExist: true }).pipe(
  Flag.optional,
  Flag.withDescription("delivery.json written by `drawings deliver record` for the send being reviewed")
);
const reviewerPdfFlag = Flag.File("pdf", { mustExist: true }).pipe(
  Flag.withDescription("A PDF the reviewer sent back, under the corpus root; repeat for each file"),
  Flag.atLeast(1)
);
const figureFlag = Flag.String("figure").pipe(
  Flag.withDescription("<file>[:<page>]=<FIG.> for a page ink coverage cannot match; repeat as needed"),
  Flag.atLeast(0)
);
const dispositionsFlag = Flag.File("dispositions", { mustExist: true }).pipe(
  Flag.withDescription("dispositions.json with one entry per finding")
);
const draftFlag = Flag.File("draft", { mustExist: true }).pipe(
  Flag.withDescription("JSON the outbox returned for the draft (create_draft or get_draft)")
);
const sentMessageIdFlag = Flag.String("sent-message-id").pipe(
  Flag.optional,
  Flag.withDescription("Graph id of the sent message")
);
const internetMessageIdFlag = Flag.String("internet-message-id").pipe(
  Flag.optional,
  Flag.withDescription("Internet Message-ID of the sent message")
);
const deliveryOutFlag = Flag.String("out").pipe(
  Flag.optional,
  Flag.withDescription("Where to write the record; defaults to delivery.json next to the manifest")
);

const locationOf = (options: { readonly corpusRoot: string; readonly matter: string; readonly round: number }) =>
  S.decodeEffect(ReviewRoundLocation)({
    corpusRoot: options.corpusRoot,
    matter: options.matter,
    round: options.round,
  }).pipe(Effect.mapError((cause) => DrawingsCommandError.new(cause, `Round ${options.round} is not a valid round.`)));

const oneLine = (text: string): string => text.replace(/\s*\n\s*/g, " / ");

const findingLine = (finding: ReviewFinding, sheetSetSha256: Sha256Hex): string =>
  `  ${reviewFindingRef(finding.id, sheetSetSha256)} ${finding.severity} ${finding.status} ${
    finding.scope === "all-sheets" ? "all sheets" : `FIG. ${findingFigures(finding)}`
  }: ${oneLine(finding.notes[0].text)}${A.length(finding.notes) > 1 ? ` (×${A.length(finding.notes)})` : ""}`;

const renderReviewStatus = (status: ReviewStatus): ReadonlyArray<string> => [
  `review round ${status.round.round}: ${status.round.status}, sheet set ${status.round.reviewedSheetSetSha256}`,
  `  ${status.roundDir}`,
  ...O.match(status.intake, {
    onNone: () => [],
    onSome: (intake) =>
      A.map(
        intake.pages,
        (page) =>
          `  ${page.file} page ${page.page} → FIG. ${page.match.figure} (${page.match.basis}, coverage ${page.match.coverage.toFixed(3)}), ${A.length(page.notes)} note(s)`
      ),
  }),
  ...O.match(status.inventory, {
    onNone: () => ["  not ingested yet"],
    onSome: (inventory) => [
      `  ${A.length(inventory.findings)} finding(s), ${A.length(openRequiredFindings(inventory.findings))} open required, ${A.length(
        A.filter(inventory.findings, (finding) => isRequiredSeverity(finding.severity))
      )} required in all`,
      ...A.map(inventory.findings, (finding) => findingLine(finding, inventory.reviewedSheetSetSha256)),
    ],
  }),
];

const runReviewOpen = Effect.fn("DrawingsCommand.reviewOpen")(function* (options: {
  readonly corpusRoot: string;
  readonly matter: string;
  readonly round: number;
  readonly manifest: string;
  readonly delivery: O.Option<string>;
}) {
  const review = yield* DrawingReview;
  const status = yield* review.open(
    ReviewOpenRequest.make({
      location: yield* locationOf(options),
      manifestPath: options.manifest,
      deliveryPath: options.delivery,
    })
  );
  yield* printLines(renderReviewStatus(status));
});

const runReviewIngest = Effect.fn("DrawingsCommand.reviewIngest")(function* (options: {
  readonly corpusRoot: string;
  readonly matter: string;
  readonly round: number;
  readonly manifest: string;
  readonly pdf: ReadonlyArray<string>;
  readonly figure: ReadonlyArray<string>;
}) {
  const review = yield* DrawingReview;
  const overrides = yield* Effect.forEach(options.figure, (text) =>
    Result.match(parseFigureOverride(text), {
      onFailure: (reason) => Effect.fail(DrawingsCommandError.make({ message: reason })),
      onSuccess: Effect.succeed,
    })
  );
  const [first, ...rest] = options.pdf;
  if (first === undefined) {
    return yield* DrawingsCommandError.make({ message: "Name at least one reviewer PDF with --pdf." });
  }
  const status = yield* review.ingest(
    ReviewIngestRequest.make({
      location: yield* locationOf(options),
      manifestPath: options.manifest,
      pdfPaths: [first, ...rest],
      figureOverrides: overrides,
    })
  );
  yield* printLines(renderReviewStatus(status));
});

const runReviewPlan = Effect.fn("DrawingsCommand.reviewPlan")(function* (options: {
  readonly corpusRoot: string;
  readonly matter: string;
  readonly round: number;
  readonly dispositions: string;
}) {
  const review = yield* DrawingReview;
  const status = yield* review.plan(
    ReviewPlanRequest.make({ location: yield* locationOf(options), dispositionsPath: options.dispositions })
  );
  yield* printLines(renderReviewStatus(status));
});

const runReviewStatus = Effect.fn("DrawingsCommand.reviewStatus")(function* (options: {
  readonly corpusRoot: string;
  readonly matter: string;
  readonly round: number;
}) {
  const review = yield* DrawingReview;
  yield* printLines(renderReviewStatus(yield* review.status(yield* locationOf(options))));
});

const roundFlags = { corpusRoot: corpusRootFlag, matter: matterFlag, round: reviewRoundFlag };

const drawingsReviewCommand = Command.make("review", {}, () =>
  printLines(["drawings review commands: open, ingest, plan, status"])
).pipe(
  Command.withDescription("Attorney review rounds: markup ingest, dispositions, and status per sent sheet set"),
  Command.withSubcommands(
    A.make(
      Command.make("open", { ...roundFlags, manifest: manifestFlag, delivery: deliveryFlag }, runReviewOpen).pipe(
        Command.withDescription("Open a review round over the sheet set that was sent")
      ),
      Command.make(
        "ingest",
        { ...roundFlags, manifest: manifestFlag, pdf: reviewerPdfFlag, figure: figureFlag },
        runReviewIngest
      ).pipe(
        Command.withDescription(
          "Match each returned page to a sent sheet by ink coverage and turn the reviewer's notes into findings"
        )
      ),
      Command.make("plan", { ...roundFlags, dispositions: dispositionsFlag }, runReviewPlan).pipe(
        Command.withDescription("Apply a dispositions file; every finding needs exactly one disposition")
      ),
      Command.make("status", roundFlags, runReviewStatus).pipe(
        Command.withDescription("Print a review round's pages, findings, and open required count")
      )
    )
  ),
  Command.provide(drawingReviewLive)
);

const runDeliverRecord = Effect.fn("DrawingsCommand.deliverRecord")(function* (options: {
  readonly manifest: string;
  readonly draft: string;
  readonly sentMessageId: O.Option<string>;
  readonly internetMessageId: O.Option<string>;
  readonly out: O.Option<string>;
}) {
  const review = yield* DrawingReview;
  const written = yield* review.deliver(
    yield* S.decodeEffect(DeliverRequest)({
      manifestPath: options.manifest,
      draftPath: options.draft,
      sentMessageId: options.sentMessageId,
      internetMessageId: options.internetMessageId,
      outPath: options.out,
    }).pipe(Effect.mapError((cause) => DrawingsCommandError.new(cause, "The delivery flags are not valid.")))
  );
  yield* printLines([
    `delivery of sheet set ${written.record.sheetSetSha256} recorded: ${written.path}`,
    ...A.map(
      written.record.attachments,
      (attachment) => `  ${attachment.name} ${attachment.size} B ${attachment.sha256}`
    ),
  ]);
});

const drawingsDeliverCommand = Command.make("deliver", {}, () =>
  printLines(["drawings deliver commands: record"])
).pipe(
  Command.withDescription("Record which sheet set, by hash, went to the reviewer"),
  Command.withSubcommands(
    A.make(
      Command.make(
        "record",
        {
          manifest: manifestFlag,
          draft: draftFlag,
          sentMessageId: sentMessageIdFlag,
          internetMessageId: internetMessageIdFlag,
          out: deliveryOutFlag,
        },
        runDeliverRecord
      ).pipe(Command.withDescription("Write delivery.json from an outbox draft's attachment facts"))
    )
  ),
  Command.provide(drawingReviewLive)
);

const printDrawingsIndex = () =>
  printLines(["drawings commands: render, validate, judge, judge-ingest, statement, sign, deliver, review, intake"]);

/**
 * Design-figure drawings command group.
 *
 * **Example** (Run the drawings command group)
 *
 * ```ts
 * import { drawingsCommand } from "@beep/repo-cli"
 * import { Command } from "effect/cli"
 * import * as Effect from "effect/Effect";
 * const run = Command.run(drawingsCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const drawingsCommand = Command.make("drawings", {}, printDrawingsIndex).pipe(
  Command.withDescription("Design-figure sheet rendering, filing validation, approval, and reviewer intake"),
  Command.withSubcommands(
    A.make(
      drawingsRenderCommand,
      drawingsValidateCommand,
      drawingsJudgeCommand,
      drawingsJudgeIngestCommand,
      drawingsStatementCommand,
      drawingsSignCommand,
      drawingsDeliverCommand,
      drawingsReviewCommand,
      drawingsIntakeCommand
    )
  )
);
