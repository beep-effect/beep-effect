import { fileURLToPath } from "node:url";
import { CitationComponents, FullCaseCitation } from "@beep/law-practice-domain/values";
import {
  CitationCaseResourceHash,
  CitationCaseResourceHashInput,
  makeCitationCaseResourceHash,
} from "@beep/law-practice-server/_test/Citation/CaseResourceHash";
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
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

const Cases = S.Struct({
  schemaVersion: S.Literal("citation-case-resource-hashes/v1"),
  oracleCommit: S.Literal("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  cases: S.Array(
    S.Struct({
      name: S.NonEmptyString,
      identityMode: S.Literals(["content", "controlled-source-id-hook"]),
      input: CitationCaseResourceHashInput,
      expected: S.Union([
        CitationCaseResourceHash,
        S.Struct({ error: S.Literals(["missing-page", "missing-reporter"]) }),
      ]),
    })
  ),
});
const inputs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/case-resource-hashes.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
    "b468cd539a9adc728c719ab01c941789d8cae2878c1bcb014e56999b7af462c4"
  );
  return yield* S.decodeEffect(S.fromJsonString(Cases))(raw);
});

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("exact source case resource hashes", (it) => {
  it.effect("matches every captured hash and source field-access failure", () =>
    Effect.gen(function* () {
      const rows = (yield* inputs).cases;
      expect(A.length(rows)).toBe(24);
      for (const row of rows) {
        if ("error" in row.expected) {
          expect((yield* Effect.flip(makeCitationCaseResourceHash(row.input))).reason).toBe(row.expected.error);
        } else {
          expect(yield* makeCitationCaseResourceHash(row.input)).toEqual(row.expected);
        }
      }
    })
  );

  it.effect("requires an explicit identity only for null pages and does not memoize changed content", () =>
    Effect.gen(function* () {
      const rows = (yield* inputs).cases;
      const row = A.getUnsafe(rows, 18).input;
      expect(
        (yield* Effect.flip(makeCitationCaseResourceHash({ ...row, missingPageIdentityHash: O.none() }))).reason
      ).toBe("identity-unavailable");
      const baseline = A.getUnsafe(rows, 0).input;
      const components = yield* S.encodeEffect(CitationComponents)(baseline.citation.components);
      const mutable = { ...baseline };
      const one = yield* makeCitationCaseResourceHash(mutable);
      mutable.citation = FullCaseCitation.make({
        ...baseline.citation,
        components: yield* S.decodeEffect(CitationComponents)({ ...components, page: "2" }),
      });
      const two = yield* makeCitationCaseResourceHash(mutable);
      expect(two).toEqual(A.getUnsafe(rows, 1).expected);
      expect(one.resourceHash).not.toBe(two.resourceHash);
      expect(yield* makeCitationCaseResourceHash(A.getUnsafe(rows, 0).input)).toEqual(one);
    })
  );

  it.effect("rejects missing selected-edition lookup on known pages", () =>
    Effect.gen(function* () {
      const row = A.getUnsafe((yield* inputs).cases, 14).input;
      expect((yield* Effect.flip(makeCitationCaseResourceHash({ ...row, selectedEdition: O.none() }))).reason).toBe(
        "missing-edition"
      );
      expect((yield* Effect.flip(makeCitationCaseResourceHash({}))).reason).toBe("invalid-input");
    })
  );

  it.effect("redacts digest service errors", () =>
    Effect.gen(function* () {
      const row = A.getUnsafe((yield* inputs).cases, 0).input;
      const result = yield* Effect.flip(
        makeCitationCaseResourceHash(row).pipe(
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
