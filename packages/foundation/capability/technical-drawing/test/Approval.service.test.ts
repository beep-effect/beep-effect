import {
  ApprovalRecord,
  approvalStatement,
  BoundingBox,
  ConfirmationSource,
  DrawingError,
  EmailAddress,
  EmailConfirmation,
  EngineInfo,
  MailReader,
  ModelSummary,
  PdfBackend,
  RenderManifest,
  Sha256Hex,
  SheetSetApproval,
  SignRequest,
} from "@beep/technical-drawing";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertInstanceOf } from "@effect/vitest/utils";
import { Effect, FileSystem, Layer, Path, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const approver = EmailAddress.make("attorney@example.com");
const pdfBytes = new TextEncoder().encode("%PDF-1.6 synthetic sheet set");

const sha256 = (bytes: Uint8Array) =>
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

// Mail fake: replies keyed by message id, built once the sheet-set hash is known.
const replies = new Map<string, (statement: string) => EmailConfirmation>([
  [
    "approved",
    (statement) =>
      EmailConfirmation.make({
        internetMessageId: "<approved@example.com>",
        from: approver,
        sender: approver,
        receivedAt: "2026-10-06T12:00:00Z",
        authoredText: `Thanks.\n${statement}\n`,
      }),
  ],
  [
    "impostor",
    (statement) =>
      EmailConfirmation.make({
        internetMessageId: "<impostor@example.com>",
        from: EmailAddress.make("assistant@example.com"),
        sender: EmailAddress.make("assistant@example.com"),
        receivedAt: "2026-10-06T12:00:00Z",
        authoredText: `${statement}\n`,
      }),
  ],
  [
    "forward",
    (statement) =>
      EmailConfirmation.make({
        internetMessageId: "<forward@example.com>",
        from: approver,
        sender: approver,
        receivedAt: "2026-10-06T12:00:00Z",
        authoredText: `FYI\n---------- Forwarded message ---------\nFrom: Developer\n${statement}\n`,
      }),
  ],
]);

const current = { statement: "" };

const MailFake = Layer.succeed(
  MailReader,
  MailReader.of({
    authoredText: Effect.fnUntraced(function* (messageId) {
      const make = replies.get(messageId);
      return make === undefined
        ? yield* DrawingError.make({ reason: "io", message: `no message ${messageId}` })
        : make(current.statement);
    }),
  })
);

const PdfFake = Layer.succeed(
  PdfBackend,
  PdfBackend.of({
    svgToPdf: Effect.fnUntraced(function* () {}),
    inspect: Effect.fnUntraced(function* () {
      return yield* Effect.die("unused");
    }),
    measurePage: Effect.fnUntraced(function* () {
      return yield* Effect.die("unused");
    }),
    pageText: Effect.fnUntraced(function* (_, page) {
      return page === 2 ? `Reviewed FIG. 1-8\n${current.statement}\nInitials: AB\n` : "Request page only\n";
    }),
  })
);

const TestLayer = SheetSetApproval.layer.pipe(
  Layer.provide(Layer.merge(MailFake, PdfFake)),
  Layer.provideMerge(NodeServices.layer)
);

const writeSheetSet = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped();
  yield* fs.writeFile(path.join(dir, "sheets.pdf"), pdfBytes);
  const pdfSha256 = yield* sha256(pdfBytes);
  const manifest = RenderManifest.make({
    title: "Synthetic bracket",
    specSha256: pdfSha256,
    engine: EngineInfo.make({ name: "fake", version: "0", binarySha256: "" }),
    model: ModelSummary.make({
      boundingBox: BoundingBox.make({ min: [0, 0, 0], max: [1, 1, 1] }),
      volume: 1,
      faceCount: 6,
      edgeCount: 12,
    }),
    scale: 1,
    figures: [],
    omissions: [],
    pdfFile: "sheets.pdf",
    pdfSha256,
    validation: O.none(),
  });
  const json = yield* S.encodeUnknownEffect(S.fromJsonString(RenderManifest))(manifest);
  const manifestPath = path.join(dir, "manifest.json");
  yield* fs.writeFileString(manifestPath, json);
  current.statement = approvalStatement(pdfSha256);
  return { dir, manifestPath, pdfSha256 };
});

const sign = (manifestPath: string, source: ConfirmationSource) =>
  SheetSetApproval.use((service) =>
    service.sign(SignRequest.make({ manifestPath, approver, by: "developer", source }))
  );

describe("@beep/technical-drawing sheet-set approval", () => {
  it.layer(TestLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "prints the statement and records an email approval next to the manifest",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { dir, manifestPath, pdfSha256 } = yield* writeSheetSet();
        const statement = yield* SheetSetApproval.use((service) => service.statement(manifestPath));
        expect(statement).toBe(`I approve design-figure sheet set ${pdfSha256} for filing.`);
        const record = yield* sign(manifestPath, ConfirmationSource.cases.email.make({ messageId: "approved" }));
        assertInstanceOf(record, ApprovalRecord);
        expect(record.confirmationLocator).toBe("<approved@example.com>");
        expect(record.matchedAddress).toBe("attorney@example.com");
        const written = yield* fs.readFileString(path.join(dir, "approval.json"));
        expect(written).toContain(pdfSha256);
      })
    );

    it.effect(
      "refuses an impostor sender and a forwarded statement",
      Effect.fnUntraced(function* () {
        const { manifestPath } = yield* writeSheetSet();
        const impostor = yield* Effect.flip(
          sign(manifestPath, ConfirmationSource.cases.email.make({ messageId: "impostor" }))
        );
        expect(impostor.reason).toBe("approval");
        expect(impostor.message).toContain("from/sender");
        const forward = yield* Effect.flip(
          sign(manifestPath, ConfirmationSource.cases.email.make({ messageId: "forward" }))
        );
        expect(forward.message).toContain("quoted or forwarded");
      })
    );

    it.effect(
      "accepts the initialed PDF page under the corpus root and refuses other pages or roots",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const { dir, manifestPath } = yield* writeSheetSet();
        const pdf = (initialedPage: number, root = dir) =>
          ConfirmationSource.cases.pdf.make({
            path: path.join(dir, "approval.pdf"),
            initialedPage,
            attestedBy: "operator",
            allowedRoot: root,
          });
        const record = yield* sign(manifestPath, pdf(2));
        expect(record.confirmationKind).toBe("pdf");
        expect(record.attestedBy).toBe("operator");
        const wrongPage = yield* Effect.flip(sign(manifestPath, pdf(1)));
        expect(wrongPage.message).toContain("no line that is exactly");
        const outside = yield* Effect.flip(sign(manifestPath, pdf(2, path.join(dir, "elsewhere"))));
        expect(outside.message).toContain("not under the corpus root");
      })
    );

    it.effect(
      "refuses a sheet set whose PDF changed after rendering",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { dir, manifestPath } = yield* writeSheetSet();
        yield* fs.writeFileString(path.join(dir, "sheets.pdf"), "%PDF-1.6 edited");
        const error = yield* Effect.flip(
          sign(manifestPath, ConfirmationSource.cases.email.make({ messageId: "approved" }))
        );
        expect(error.message).toContain("no longer matches its manifest");
      })
    );
  });
});
