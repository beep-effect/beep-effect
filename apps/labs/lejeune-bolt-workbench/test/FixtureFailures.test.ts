// @vitest-environment node

import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { afterEach, expect, vi } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { PDFDocument } from "pdf-lib";
import { buildFixtureArtifacts, FixtureError } from "@/fixtures/Sources";

afterEach(() => vi.restoreAllMocks());

it.layer(BunCrypto.layer)("fixture generation failures", (it) => {
  it.effect("preserves the PDF engine creation failure as fixture evidence", () =>
    Effect.gen(function* () {
      const cause = FixtureError.make({ stage: "test-pdf", message: "PDF engine unavailable" });
      vi.spyOn(PDFDocument, "create").mockRejectedValueOnce(cause);
      const error = yield* buildFixtureArtifacts.pipe(Effect.flip);
      expect(error._tag).toBe("FixtureError");
      expect(error.stage).toBe("pdf-generate");
      expect(error.cause).toBe(cause);
    })
  );

  it.effect("preserves metadata write failures without producing a partial fixture bundle", () =>
    Effect.gen(function* () {
      const document = yield* Effect.promise(() => PDFDocument.create());
      const cause = FixtureError.make({ stage: "test-pdf", message: "PDF metadata is read-only" });
      vi.spyOn(document, "setAuthor").mockImplementationOnce(() => {
        throw cause;
      });
      vi.spyOn(PDFDocument, "create").mockResolvedValueOnce(document);
      const error = yield* buildFixtureArtifacts.pipe(Effect.flip);
      expect(error._tag).toBe("FixtureError");
      expect(error.stage).toBe("pdf-generate");
      expect(error.cause).toBe(cause);
    })
  );

  it.effect("preserves font embedding failures without producing a partial fixture bundle", () =>
    Effect.gen(function* () {
      const document = yield* Effect.promise(() => PDFDocument.create());
      const cause = FixtureError.make({ stage: "test-pdf", message: "PDF font unavailable" });
      vi.spyOn(document, "embedFont").mockRejectedValueOnce(cause);
      vi.spyOn(PDFDocument, "create").mockResolvedValueOnce(document);
      const error = yield* buildFixtureArtifacts.pipe(Effect.flip);
      expect(error._tag).toBe("FixtureError");
      expect(error.stage).toBe("pdf-generate");
      expect(error.cause).toBe(cause);
    })
  );
});
