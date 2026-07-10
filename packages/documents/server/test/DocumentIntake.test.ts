import { DefaultVaultFilingContext } from "@beep/documents-domain/values/Taxonomy";
import { DocumentsServerLive } from "@beep/documents-server/layer";
import { Document } from "@beep/documents-use-cases/server";
import { provideScopedLayer } from "@beep/test-utils";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Result } from "effect";
import * as S from "effect/Schema";

const DocumentsIntakeTestLayer = DocumentsServerLive.pipe(
  Layer.provideMerge(BunFileSystem.layer),
  Layer.provideMerge(BunPath.layer)
);

describe("@beep/documents-server DocumentIntake", () => {
  it.effect("materializes a dropped file atomically into the deterministic taxonomy path", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const intake = yield* Document.DocumentIntake;
      const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-vault-" });
      const bytes = new TextEncoder().encode("complaint body");

      const input = yield* S.decodeUnknownEffect(Document.IntakeDroppedFileInput)({
        content: Buffer.from(bytes).toString("base64"),
        filingContext: DefaultVaultFilingContext,
        intakeBatchId: "batch-1",
        originalFileName: "Complaint.pdf",
        vaultRootPath,
        workspaceId: 1,
      });
      const document = yield* intake.intakeDroppedFile(input);
      const targetPath = path.resolve(vaultRootPath, ...document.vaultPath.segments);
      const written = yield* fs.readFile(targetPath);

      expect(document.taxonomyConceptId).toBe("pleadings");
      expect(document.vaultPath.relativePath).toContain("01-pleadings");
      expect(document.vaultPath.fileName).toMatch(/^complaint--[a-f0-9]{12}\.pdf$/u);
      expect(new TextDecoder().decode(written)).toBe("complaint body");
    }).pipe(provideScopedLayer(DocumentsIntakeTestLayer))
  );

  it.effect("rejects a projected vault ancestor that is a symlink outside the vault", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const intake = yield* Document.DocumentIntake;
      const vaultRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-vault-" });
      const outsideRootPath = yield* fs.makeTempDirectoryScoped({ prefix: "beep-documents-outside-" });
      yield* fs.symlink(outsideRootPath, path.join(vaultRootPath, "matters"));

      const input = yield* S.decodeUnknownEffect(Document.IntakeDroppedFileInput)({
        content: Buffer.from(new TextEncoder().encode("complaint body")).toString("base64"),
        filingContext: DefaultVaultFilingContext,
        intakeBatchId: "batch-1",
        originalFileName: "Complaint.pdf",
        vaultRootPath,
        workspaceId: 1,
      });
      const result = yield* Effect.result(intake.intakeDroppedFile(input));

      expect(Result.isFailure(result)).toBe(true);
      if (Result.isFailure(result)) {
        expect(result.failure._tag).toBe("DocumentMaterializationFailed");
        expect(result.failure.reason).toContain("escapes the allowed root");
      }
      expect(yield* fs.exists(path.join(outsideRootPath, "client-default-default-client"))).toBe(false);
    }).pipe(provideScopedLayer(DocumentsIntakeTestLayer))
  );
});
