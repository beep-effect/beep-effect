import { fileURLToPath } from "node:url";
import { CitationCaseResourceHash } from "@beep/law-practice-server/_test/Citation/CaseResourceHash";
import {
  CitationPublicationResourceHashInput,
  makeCitationPublicationResourceHash,
} from "@beep/law-practice-server/_test/Citation/PublicationResourceHash";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

const Cases = S.Struct({
  schemaVersion: S.Literal("citation-publication-resource-hashes/v1"),
  oracleCommit: S.Literal("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  cases: S.Array(
    S.Struct({
      name: S.NonEmptyString,
      input: CitationPublicationResourceHashInput,
      expected: CitationCaseResourceHash,
    })
  ),
});
const inputs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/publication-resource-hashes.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
    "57962d12465617aca8f4f483329ac1c0ef94b2f2c866e7f836edc0a29a7e8599"
  );
  return yield* S.decodeEffect(S.fromJsonString(Cases))(raw);
});

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("exact publication resource hashes", (it) => {
  it.effect("matches all 22 source observations including stable ties and Unicode code-point ordering", () =>
    Effect.gen(function* () {
      const data = yield* inputs;
      expect(data.cases).toHaveLength(22);
      for (const row of data.cases)
        expect(yield* makeCitationPublicationResourceHash(row.input), row.name).toEqual(row.expected);
    })
  );

  it.effect(
    "checks ordered lookup occurrences and recomputes changed edition ordering without content memoization",
    () =>
      Effect.gen(function* () {
        const rows = (yield* inputs).cases;
        const row = A.getUnsafe(rows, 8).input;
        expect((yield* Effect.flip(makeCitationPublicationResourceHash({ ...row, editions: [] }))).reason).toBe(
          "missing-edition"
        );
        expect(
          (yield* Effect.flip(makeCitationPublicationResourceHash({ ...row, editions: A.reverse(row.editions) })))
            .reason
        ).toBe("missing-edition");
        const mutable = { ...row };
        const first = yield* makeCitationPublicationResourceHash(mutable);
        mutable.citation = A.getUnsafe(rows, 9).input.citation;
        mutable.editions = A.getUnsafe(rows, 9).input.editions;
        const second = yield* makeCitationPublicationResourceHash(mutable);
        expect(first).not.toEqual(second);
        expect(second).toEqual(A.getUnsafe(rows, 9).expected);
        expect((yield* Effect.flip(makeCitationPublicationResourceHash({}))).reason).toBe("invalid-input");
      })
  );

  it.effect("redacts digest causes through the shared runtime encoder", () =>
    Effect.gen(function* () {
      const row = A.getUnsafe((yield* inputs).cases, 0).input;
      const result = yield* Effect.flip(
        makeCitationPublicationResourceHash(row).pipe(
          Effect.provideService(
            Crypto.Crypto,
            Crypto.make({
              randomBytes: (size) => new Uint8Array(size),
              digest: () =>
                Effect.fail(
                  PlatformError.systemError({
                    module: "Crypto",
                    method: "digest",
                    _tag: "Unknown",
                    cause: "private-document-text",
                  })
                ),
            })
          )
        )
      );
      expect(result.reason).toBe("digest-failed");
      expect("cause" in result).toBe(false);
    })
  );
});
