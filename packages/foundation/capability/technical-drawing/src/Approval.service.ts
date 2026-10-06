/**
 * Sheet-set approval: print the statement an approver must write, and record
 * an approval only when a confirmation artifact the approver authored proves it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $TechnicalDrawingId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Context, DateTime, Effect, FileSystem, Layer, Path, pipe, Result } from "effect";
import * as S from "effect/Schema";
import { verifyConfirmation } from "./Approval.rules.ts";
import { ApprovalRecord, approvalStatement, EmailAddress, PdfConfirmation } from "./Approval.schemas.ts";
import { RenderManifest, Sha256Hex } from "./Manifest.schemas.ts";
import { DrawingError } from "./TechnicalDrawing.errors.ts";
import { MailReader, PdfBackend } from "./TechnicalDrawing.ports.ts";
import type { Confirmation } from "./Approval.schemas.ts";

const $I = $TechnicalDrawingId.create("Approval.service");
const decodeManifest = S.decodeUnknownEffect(S.fromJsonString(RenderManifest));
const encodeRecord = S.encodeUnknownEffect(S.fromJsonString(ApprovalRecord));
const encoder = new TextEncoder();

/**
 * Where an approval came from.
 *
 * **Example** (An email confirmation)
 *
 * ```ts
 * import { ConfirmationSource } from "@beep/technical-drawing"
 *
 * console.log(ConfirmationSource.cases.email.make({ messageId: "AAMk" })._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ConfirmationSource = S.Union([
  S.TaggedStruct("email", {
    messageId: S.NonEmptyString.annotateKey({ description: "Graph message id of the approver's reply." }),
  }),
  S.TaggedStruct("pdf", {
    path: S.NonEmptyString.annotateKey({ description: "PDF the approver initialed; must be under `allowedRoot`." }),
    initialedPage: S.Int.annotateKey({ description: "One-based page the approver initialed, named by the operator." }),
    attestedBy: S.NonEmptyString.annotateKey({ description: "Operator attesting the approver delivered the PDF." }),
    allowedRoot: S.NonEmptyString.annotateKey({ description: "Directory the PDF must live under." }),
  }),
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("ConfirmationSource", {
    description: "An email message id, or an initialed PDF page with the operator's delivery attestation.",
  })
);

/**
 * Type for {@link ConfirmationSource}.
 *
 * **Example** (Annotate a source)
 *
 * ```ts
 * import { ConfirmationSource } from "@beep/technical-drawing"
 * import type { ConfirmationSource as Source } from "@beep/technical-drawing"
 *
 * const source: Source = ConfirmationSource.cases.email.make({ messageId: "AAMk" })
 * console.log(source._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ConfirmationSource = typeof ConfirmationSource.Type;

/**
 * Request to record an approval for a rendered sheet set.
 *
 * **Example** (Sign from an email reply)
 *
 * ```ts
 * import { ConfirmationSource, EmailAddress, SignRequest } from "@beep/technical-drawing"
 *
 * const request = SignRequest.make({
 *   manifestPath: "out/manifest.json",
 *   approver: EmailAddress.make("attorney@example.com"),
 *   by: "developer",
 *   source: ConfirmationSource.cases.email.make({ messageId: "AAMk" })
 * })
 * console.log(request.source._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SignRequest extends S.Class<SignRequest>($I`SignRequest`)(
  {
    manifestPath: S.NonEmptyString.annotateKey({ description: "Render manifest of the sheet set." }),
    approver: EmailAddress.annotateKey({ description: "Approver address recorded for the matter." }),
    by: S.String.annotateKey({ description: "Who is running the command; descriptive only." }),
    source: ConfirmationSource.annotateKey({ description: "Where the approver's confirmation lives." }),
  },
  $I.annote("SignRequest", {
    description: "Manifest, approver, operator, and confirmation source of a sign request.",
  })
) {}

/**
 * Runtime shape of the {@link SheetSetApproval} service.
 *
 * **Example** (Stub service)
 *
 * ```ts
 * import type { SheetSetApprovalShape } from "@beep/technical-drawing"
 * import { Effect } from "effect"
 *
 * const service: SheetSetApprovalShape = {
 *   statement: () => Effect.die("not implemented"),
 *   sign: () => Effect.die("not implemented")
 * }
 * console.log(service)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface SheetSetApprovalShape {
  readonly sign: (request: SignRequest) => Effect.Effect<ApprovalRecord, DrawingError>;
  readonly statement: (manifestPath: string) => Effect.Effect<string, DrawingError>;
}

// shared digest idiom with FigureSet.service; no in-family home, future foundation capability candidate.
// fallow-ignore-next-line code-duplication -- shared digest idiom; no in-family home, future foundation capability candidate
const sha256 = (bytes: Uint8Array): Effect.Effect<Sha256Hex> =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", bytes.slice().buffer)).pipe(
    Effect.map((digest) =>
      Sha256Hex.make(
        pipe(
          A.fromIterable(new Uint8Array(digest)),
          A.map((b) => b.toString(16).padStart(2, "0")),
          A.join("")
        )
      )
    )
  );

const refused = (message: string): DrawingError => DrawingError.make({ reason: "approval", message });

const REFUSAL_MESSAGES = {
  "statement-missing": "the confirmation has no line that is exactly the approval statement for this sheet set",
  "statement-only-quoted":
    "the approval statement appears only in quoted or forwarded text, not in what the approver wrote",
  "sender-mismatch": "the message's from/sender is not the recorded approver",
  "delivery-mismatch": "the PDF was not attested as delivered by the recorded approver",
} as const;

const isWithin = (path: Path.Path, root: string, file: string): boolean => {
  const relative = path.relative(path.resolve(root), path.resolve(file));
  return relative.length > 0 && !relative.startsWith("..") && !path.isAbsolute(relative);
};

const makeService = Effect.fn("SheetSetApproval.makeService")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const pdf = yield* PdfBackend;
  const mail = yield* MailReader;
  const io = (what: string) => (cause: unknown) => DrawingError.fromUnknown("io", what, cause);

  // Re-hash the sheet set on disk so an approval never attaches to a PDF that
  // changed after rendering.
  const loadSheetSet = Effect.fn("SheetSetApproval.loadSheetSet")(function* (manifestPath: string) {
    const resolved = path.resolve(manifestPath);
    const text = yield* fs.readFileString(resolved).pipe(Effect.mapError(io(`Could not read "${resolved}".`)));
    const manifest = yield* decodeManifest(text).pipe(
      Effect.mapError((cause) => DrawingError.fromUnknown("spec", `Invalid render manifest "${resolved}".`, cause))
    );
    const pdfPath = path.join(path.dirname(resolved), manifest.pdfFile);
    const bytes = yield* fs.readFile(pdfPath).pipe(Effect.mapError(io(`Could not read "${pdfPath}".`)));
    const onDisk = yield* sha256(bytes);
    if (onDisk !== manifest.pdfSha256) {
      return yield* refused(`"${pdfPath}" no longer matches its manifest (sha256 ${onDisk} ≠ ${manifest.pdfSha256}).`);
    }
    return { manifestDir: path.dirname(resolved), sheetSetSha256: Sha256Hex.make(manifest.pdfSha256) };
  });

  const confirmationFor = (source: ConfirmationSource, approver: EmailAddress) =>
    ConfirmationSource.match(source, {
      email: ({ messageId }) => mail.authoredText(messageId),
      pdf: Effect.fnUntraced(function* ({ path: pdfPath, initialedPage, attestedBy, allowedRoot }) {
        if (!isWithin(path, allowedRoot, pdfPath)) {
          return yield* refused(`"${pdfPath}" is not under the corpus root "${allowedRoot}".`);
        }
        const pageText = yield* pdf.pageText(path.resolve(pdfPath), initialedPage);
        return PdfConfirmation.make({
          path: path.resolve(pdfPath),
          initialedPage,
          pageText,
          deliveredBy: approver,
          attestedBy,
        });
      }),
    });

  const locatorOf = (confirmation: Confirmation): string =>
    confirmation.kind === "email"
      ? confirmation.internetMessageId
      : `${confirmation.path}#page=${confirmation.initialedPage}`;

  const statement = Effect.fn("SheetSetApproval.statement")(function* (manifestPath: string) {
    const { sheetSetSha256 } = yield* loadSheetSet(manifestPath);
    return approvalStatement(sheetSetSha256);
  });

  const sign = Effect.fn("SheetSetApproval.sign")(function* (request: SignRequest) {
    const { manifestDir, sheetSetSha256 } = yield* loadSheetSet(request.manifestPath);
    const confirmation: Confirmation = yield* confirmationFor(request.source, request.approver);
    const checked = verifyConfirmation({ sheetSetSha256, approver: request.approver, confirmation });
    const evidence = yield* Result.match(checked, {
      onFailure: (reason) => Effect.fail(refused(`Approval refused: ${REFUSAL_MESSAGES[reason]}.`)),
      onSuccess: Effect.succeed,
    });
    const record = ApprovalRecord.make({
      sheetSetSha256,
      approver: request.approver,
      statement: approvalStatement(sheetSetSha256),
      by: request.by,
      recordedAt: DateTime.formatIso(yield* DateTime.now),
      confirmationKind: confirmation.kind,
      confirmationLocator: locatorOf(confirmation),
      confirmationSha256: yield* sha256(encoder.encode(evidence.matchedText)),
      matchedAddress: evidence.matchedAddress,
      attestedBy: confirmation.kind === "pdf" ? confirmation.attestedBy : "",
    });
    const json = yield* encodeRecord(record).pipe(Effect.mapError(io("Could not encode the approval record.")));
    yield* fs
      .writeFileString(path.join(manifestDir, "approval.json"), `${json}\n`)
      .pipe(Effect.mapError(io("Could not write approval.json.")));
    return record;
  });

  return { statement, sign } satisfies SheetSetApprovalShape;
});

/**
 * Sheet-set approval service.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { SheetSetApproval } from "@beep/technical-drawing"
 *
 * console.log(SheetSetApproval)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SheetSetApproval extends Context.Service<SheetSetApproval, SheetSetApprovalShape>()($I`SheetSetApproval`) {
  /**
   * Live layer over the {@link PdfBackend} and {@link MailReader} ports.
   *
   * **Example** (Reference the layer)
   *
   * ```ts
   * import { SheetSetApproval } from "@beep/technical-drawing"
   *
   * console.log(SheetSetApproval.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<
    SheetSetApproval,
    never,
    PdfBackend | MailReader | FileSystem.FileSystem | Path.Path
  > = Layer.effect(SheetSetApproval, Effect.map(makeService(), SheetSetApproval.of));
}
