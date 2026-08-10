import { FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import {
  DefaultVaultFilingContext,
  legalDocumentTaxonomy,
  ProjectFiledDocumentPathInput,
  projectFiledDocumentPath,
} from "@beep/documents-domain/values/Taxonomy";
import { DocumentsServerLive } from "@beep/documents-server/layer";
import { Document } from "@beep/documents-use-cases/server";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const DocumentsIntakeTestLayer = DocumentsServerLive.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);
const complaintBytes = new TextEncoder().encode("complaint body");
const decodeIntakeInput = S.decodeUnknownEffect(Document.IntakeDroppedFileInput);
const complaintInput = Effect.fn("DocumentsIntakeTest.complaintInput")(function* (vaultRootPath: string) {
  return yield* decodeIntakeInput({
    content: Buffer.from(complaintBytes).toString("base64"),
    filingContext: DefaultVaultFilingContext,
    intakeBatchId: "batch-1",
    originalFileName: "Complaint.pdf",
    vaultRootPath,
    workspaceId: 1,
  });
});

const filedConceptId = (filing: FilingOutcome) =>
  FilingOutcome.match(filing, {
    filed: (filed) => filed.taxonomyConceptId,
    inboxed: () => null,
  });

describe("@beep/documents-server DocumentIntake", () => {
  it("round-trips dropped-file bytes through the Base64 wire codec with schema-derived arbitraries", () => {
    const decode = S.decodeUnknownResult(S.Uint8ArrayFromBase64);
    const encode = S.encodeResult(S.Uint8ArrayFromBase64);
    const equivalent = S.toEquivalence(S.Uint8ArrayFromBase64);

    fc.assert(
      fc.property(S.toArbitrary(S.Uint8ArrayFromBase64)(fc), (bytes) => {
        const encoded = Result.getOrThrow(encode(bytes));
        const decoded = Result.getOrThrow(decode(encoded));

        expect(equivalent(decoded, bytes)).toBe(true);
      }),
      fcRuns(10)
    );
  });

  it.effect(
    "materializes a dropped file atomically into the deterministic taxonomy path",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const intake = yield* Document.DocumentIntake;
      const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-vault-" });
      const input = yield* complaintInput(vaultRootPath);
      const document = yield* intake.intakeDroppedFile(input);
      const targetPath = path.resolve(vaultRootPath, ...document.vaultPath.segments);
      const written = yield* fs.readFile(targetPath);

      expect(document.filing.kind).toBe("filed");
      expect(filedConceptId(document.filing)).toBe("pleadings");
      expect(document.vaultPath.relativePath).toContain("01-pleadings");
      expect(document.vaultPath.fileName).toMatch(/^complaint--[a-f0-9]{12}\.pdf$/u);
      expect(new TextDecoder().decode(written)).toBe("complaint body");
    }, provideScopedLayer(DocumentsIntakeTestLayer))
  );

  it.effect(
    "routes an unmatched document into the intake inbox instead of a guessed folder",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const intake = yield* Document.DocumentIntake;
      const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-vault-" });
      const bytes = new TextEncoder().encode("unclassifiable body");

      const input = yield* S.decodeEffect(Document.IntakeDroppedFileInput)({
        content: Buffer.from(bytes).toString("base64"),
        filingContext: DefaultVaultFilingContext,
        intakeBatchId: "Batch 42",
        originalFileName: "untitled.xyz",
        vaultRootPath,
        workspaceId: 1,
      });
      const document = yield* intake.intakeDroppedFile(input);
      const targetPath = path.resolve(vaultRootPath, ...document.vaultPath.segments);
      const written = yield* fs.readFile(targetPath);

      expect(document.filing).toMatchObject({ kind: "inboxed", reason: "no-match" });
      expect(document.vaultPath.relativePath).toMatch(/^00-inbox\/batch-42\/untitled--[a-f0-9]{12}\.xyz$/u);
      expect(document.vaultPath.taxonomySegments).toEqual([]);
      expect(new TextDecoder().decode(written)).toBe("unclassifiable body");
    }, provideScopedLayer(DocumentsIntakeTestLayer))
  );

  it.effect(
    "rejects a projected vault ancestor that is a symlink outside the vault",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const intake = yield* Document.DocumentIntake;
      const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-vault-" });
      const outsideRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-outside-" });
      yield* fs.symlink(outsideRootPath, path.join(vaultRootPath, "matters"));

      const input = yield* complaintInput(vaultRootPath);
      const result = yield* Effect.result(intake.intakeDroppedFile(input));

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("DocumentMaterializationFailed");
        expect(result.failure.reason).toContain("escapes the allowed root");
      }
      expect(yield* fs.exists(path.join(outsideRootPath, "client-default-default-client"))).toBe(false);
    }, provideScopedLayer(DocumentsIntakeTestLayer))
  );

  it.effect(
    "does not write through the legacy predictable temporary-file symlink",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const intake = yield* Document.DocumentIntake;
      const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-vault-" });
      const outsideRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-outside-" });
      const outsideVictimPath = path.join(outsideRootPath, "victim.txt");
      const digest = bytesToHex(sha256(complaintBytes));
      const projectedPath = yield* projectFiledDocumentPath(
        ProjectFiledDocumentPathInput.make({
          contentDigest: digest,
          context: DefaultVaultFilingContext,
          originalFileName: "Complaint.pdf",
          taxonomy: legalDocumentTaxonomy,
          taxonomyConceptId: "pleadings",
        })
      );
      const targetPath = path.join(vaultRootPath, ...projectedPath.segments);
      const targetDirectory = path.dirname(targetPath);
      const legacyTemporaryPath = path.join(
        targetDirectory,
        `.${path.basename(targetPath)}.tmp-${Str.slice(0, 12)(digest)}`
      );

      yield* fs.makeDirectory(targetDirectory, { recursive: true });
      yield* fs.writeFileString(outsideVictimPath, "unchanged");
      yield* fs.symlink(outsideVictimPath, legacyTemporaryPath);

      const document = yield* intake.intakeDroppedFile(yield* complaintInput(vaultRootPath));

      expect(document.vaultPath.relativePath).toBe(projectedPath.relativePath);
      expect(yield* fs.readFileString(outsideVictimPath)).toBe("unchanged");
      expect(yield* fs.readFileString(targetPath)).toBe("complaint body");
      expect(yield* fs.readLink(legacyTemporaryPath)).toBe(outsideVictimPath);
      expect(Result.isFailure(yield* Effect.result(fs.readLink(targetPath)))).toBe(true);
    }, provideScopedLayer(DocumentsIntakeTestLayer))
  );

  it.effect(
    "materializes concurrent identical drops without temporary-path collisions",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const intake = yield* Document.DocumentIntake;
      const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-vault-" });
      const input = yield* complaintInput(vaultRootPath);
      const documents = yield* Effect.all(A.replicate(intake.intakeDroppedFile(input), 8), { concurrency: 8 });
      const firstDocument = yield* Effect.fromOption(A.head(documents));
      const targetPath = path.join(vaultRootPath, ...firstDocument.vaultPath.segments);

      expect(documents).toHaveLength(8);
      expect(yield* fs.readFileString(targetPath)).toBe("complaint body");
      expect(yield* fs.readDirectory(path.dirname(targetPath))).toEqual([firstDocument.vaultPath.fileName]);
    }, provideScopedLayer(DocumentsIntakeTestLayer))
  );
});
