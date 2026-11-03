import * as NodeURL from "node:url";
import { CitationComponents, FullCaseCitation } from "@beep/law-practice-domain/values";
import {
  CitationCaseResourceHash,
  CitationCaseResourceHashInput,
  makeCitationCaseResourceHash,
} from "@beep/law-practice-server/internal/Citation/CaseResourceHash";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";

const Cases = S.Struct({
  schemaVersion: S.tag("citation-case-resource-hashes/v1"),
  oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
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
const CasesJson = S.fromJsonString(Cases);

const inputs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/case-resource-hashes.json", import.meta.url))
  );
  const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
  expect(citationResult1).toBe("b468cd539a9adc728c719ab01c941789d8cae2878c1bcb014e56999b7af462c4");
  return yield* S.decodeEffect(CasesJson)(raw);
});

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("exact source case resource hashes", (it) => {
  it.effect("matches every captured hash and source field-access failure", () =>
    Effect.gen(function* () {
      const rows = (yield* inputs).cases;
      expect(A.length(rows)).toBe(24);
      for (const row of rows) {
        if ("error" in row.expected) {
          const citationResult2 = yield* Effect.flip(makeCitationCaseResourceHash(row.input));
          expect(citationResult2.reason).toBe(row.expected.error);
        } else {
          const citationResult3 = yield* makeCitationCaseResourceHash(row.input);
          expect(citationResult3).toEqual(row.expected);
        }
      }
    })
  );

  it.effect("requires an explicit identity only for null pages and does not memoize changed content", () =>
    Effect.gen(function* () {
      const rows = (yield* inputs).cases;
      const row = A.getUnsafe(rows, 18).input;
      const citationResult4 = yield* Effect.flip(
        makeCitationCaseResourceHash({ ...row, missingPageIdentityHash: O.none() })
      );
      expect(citationResult4.reason).toBe("identity-unavailable");
      const baseline = A.getUnsafe(rows, 0).input;
      const components = yield* S.encodeEffect(CitationComponents)(baseline.citation.components);
      const mutable = { ...baseline };
      const one = yield* makeCitationCaseResourceHash(mutable);
      const citationResult5 = yield* S.decodeEffect(CitationComponents)({ ...components, page: "2" });
      mutable.citation = FullCaseCitation.make({
        ...baseline.citation,
        components: citationResult5,
      });
      const two = yield* makeCitationCaseResourceHash(mutable);
      expect(two).toEqual(A.getUnsafe(rows, 1).expected);
      expect(one.resourceHash).not.toBe(two.resourceHash);
      const citationResult6 = yield* makeCitationCaseResourceHash(A.getUnsafe(rows, 0).input);
      expect(citationResult6).toEqual(one);
    })
  );

  it.effect("rejects missing selected-edition lookup on known pages", () =>
    Effect.gen(function* () {
      const citationResult7 = yield* inputs;
      const row = A.getUnsafe(citationResult7.cases, 14).input;
      const citationResult8 = yield* Effect.flip(makeCitationCaseResourceHash({ ...row, selectedEdition: O.none() }));
      expect(citationResult8.reason).toBe("missing-edition");
      const citationResult9 = yield* Effect.flip(makeCitationCaseResourceHash({}));
      expect(citationResult9.reason).toBe("invalid-input");
    })
  );

  it.effect("redacts digest service errors", () =>
    Effect.gen(function* () {
      const citationResult10 = yield* inputs;
      const row = A.getUnsafe(citationResult10.cases, 0).input;
      const result = yield* Effect.flip(
        makeCitationCaseResourceHash(row).pipe(
          Effect.provideService(
            Digest.Digest,
            makeTestCitationDigest(() =>
              Effect.die(
                PlatformError.systemError({
                  module: "Crypto",
                  method: "digest",
                  _tag: "Unknown",
                  cause: "private-document-text",
                })
              )
            )
          )
        )
      );
      expect(result.reason).toBe("digest-failed");
      expect("cause" in result).toBe(false);
    })
  );
});
