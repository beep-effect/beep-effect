import * as NodeURL from "node:url";
import { CitationCaseResourceHash } from "@beep/law-practice-server/internal/Citation/CaseResourceHash";
import {
  CitationPublicationResourceHashInput,
  makeCitationPublicationResourceHash,
} from "@beep/law-practice-server/internal/Citation/PublicationResourceHash";
import { makeCitationRuntimeStringOrder } from "@beep/law-practice-server/internal/Citation/RuntimeHashEncoding";
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
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";

const Cases = S.Struct({
  schemaVersion: S.tag("citation-publication-resource-hashes/v1"),
  oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  cases: S.Array(
    S.Struct({
      name: S.NonEmptyString,
      input: CitationPublicationResourceHashInput,
      expected: CitationCaseResourceHash,
    })
  ),
});
const CasesJson = S.fromJsonString(Cases);

const inputs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    NodeURL.fileURLToPath(
      new URL("../../use-cases/test/fixtures/eyecite/publication-resource-hashes.json", import.meta.url)
    )
  );
  const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
  expect(citationResult1).toBe("57962d12465617aca8f4f483329ac1c0ef94b2f2c866e7f836edc0a29a7e8599");
  return yield* S.decodeEffect(CasesJson)(raw);
});

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("exact publication resource hashes", (it) => {
  it.effect("matches all 22 source observations including stable ties and Unicode code-point ordering", () =>
    Effect.gen(function* () {
      const data = yield* inputs;
      expect(data.cases).toHaveLength(22);
      for (const row of data.cases) {
        const citationResult6 = yield* makeCitationPublicationResourceHash(row.input);
        expect(citationResult6, row.name).toEqual(row.expected);
      }
    })
  );

  it.effect(
    "checks ordered lookup occurrences and recomputes changed edition ordering without content memoization",
    () =>
      Effect.gen(function* () {
        const rows = (yield* inputs).cases;
        const row = A.getUnsafe(rows, 8).input;
        const citationResult2 = yield* Effect.flip(makeCitationPublicationResourceHash({ ...row, editions: [] }));
        expect(citationResult2.reason).toBe("missing-edition");
        const citationResult3 = yield* Effect.flip(
          makeCitationPublicationResourceHash({ ...row, editions: A.reverse(row.editions) })
        );
        expect(citationResult3.reason).toBe("missing-edition");
        const mutable = { ...row };
        const first = yield* makeCitationPublicationResourceHash(mutable);
        mutable.citation = A.getUnsafe(rows, 9).input.citation;
        mutable.editions = A.getUnsafe(rows, 9).input.editions;
        const second = yield* makeCitationPublicationResourceHash(mutable);
        expect(first).not.toEqual(second);
        expect(second).toEqual(A.getUnsafe(rows, 9).expected);
        const citationResult4 = yield* Effect.flip(makeCitationPublicationResourceHash({}));
        expect(citationResult4.reason).toBe("invalid-input");
      })
  );

  it.effect("redacts digest causes through the shared runtime encoder", () =>
    Effect.gen(function* () {
      const citationResult5 = yield* inputs;
      const row = A.getUnsafe(citationResult5.cases, 0).input;
      const result = yield* Effect.flip(
        makeCitationPublicationResourceHash(row).pipe(
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
  it.effect("redacts malformed digest output separately for citation and enclosing resource hashes", () =>
    Effect.gen(function* () {
      const data = yield* inputs;
      const row = A.getUnsafe(data.cases, 0).input;
      const crypto = yield* Digest.Digest;
      for (const failAt of [1, 2]) {
        let calls = 0;
        const digest = makeTestCitationDigest((algorithm, bytes) => {
          calls++;
          return calls === failAt ? Effect.succeed(new Uint8Array(1)) : crypto.digest(algorithm, bytes);
        });
        const failure = yield* makeCitationPublicationResourceHash(row).pipe(
          Effect.provideService(Digest.Digest, digest),
          Effect.flip
        );
        expect(calls).toBe(failAt);
        expect(failure).toMatchObject({ _tag: "CitationPublicationResourceHashFailure", reason: "digest-failed" });
        expect("cause" in failure).toBe(false);
      }
    })
  );
});

it("orders equal-prefix source strings by remaining Unicode code points", () => {
  const order = makeCitationRuntimeStringOrder();
  for (const prefix of ["", "a", "😀", "\ud800"]) {
    expect(order(prefix, `${prefix}a`)).toBe(-1);
    expect(order(`${prefix}a`, prefix)).toBe(1);
    expect(order(prefix, prefix)).toBe(0);
  }
});
