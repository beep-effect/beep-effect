import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { makeCitationFrozenEditions } from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { encodeCitationRuntimeEdition } from "@beep/law-practice-server/internal/Citation/PublicationResourceHash";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("authenticated frozen editions", (it) => {
  it.effect("authenticates all 2430 reporters / 2533 editions and matches every actual source runtime payload", () =>
    Effect.gen(function* () {
      const { bundle, expected } = yield* loadCitationFrozenEditionFixtures();
      const adapter = yield* makeCitationFrozenEditions(bundle);
      expect(bundle.reporters).toHaveLength(2430);
      expect(expected.editions).toHaveLength(2533);
      for (const row of expected.editions) {
        const edition = yield* adapter.lookup(row.edition, row.family);
        expect(edition.value.short_name).toBe(row.shortName);
        const encoded = yield* encodeCitationRuntimeEdition(edition.value);
        const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(encoded));
        expect(citationResult1, row.edition).toBe(row.runtimePayloadSha256);
      }
      const first = A.getUnsafe(expected.editions, 0);
      const sameKind = A.filter(expected.editions, (row) => row.family === first.family);
      const second = A.getUnsafe(sameKind, 1);
      const refs = [second.edition, first.edition, second.edition];
      const citationResult2 = yield* adapter.lookupMany(refs, first.family);
      expect(A.map(citationResult2, (edition) => edition.edition)).toEqual(refs);
      const citationResult3 = yield* Effect.flip(
        adapter.lookup(first.edition, first.family === "case" ? "law" : "case")
      );
      expect(citationResult3.reason).toBe("kind-mismatch");
      const citationResult4 = yield* Effect.flip(
        adapter.lookup(CitationEditionRef.make(Str.repeat(64)("0")), first.family)
      );
      expect(citationResult4.reason).toBe("missing-edition");
      const returned = yield* adapter.lookup(first.edition, first.family);
      const originalName = returned.value.reporter.name;
      const mutable: { name: string } = returned.value.reporter;
      mutable.name = "Changed";
      const citationResult5 = yield* adapter.lookup(first.edition, first.family);
      expect(citationResult5.value.reporter.name).toBe(originalName);
      A.getUnsafe(bundle.reporters, 0).payload = "changed caller state";
      const citationResult6 = yield* adapter.lookup(first.edition, first.family);
      expect(citationResult6.value.reporter.name).toBe(originalName);
    })
  );

  it.effect(
    "rejects missing/duplicate identities, edited reporter/edition payloads and self-consistent replacement identities",
    () =>
      Effect.gen(function* () {
        const { bundle } = yield* loadCitationFrozenEditionFixtures();
        const citationResult7 = yield* Effect.flip(
          makeCitationFrozenEditions({ ...bundle, reporters: A.drop(bundle.reporters, 1) })
        );
        expect(citationResult7.reason).toBe("invalid-input");
        const duplicate = {
          ...bundle,
          reporters: O.getOrThrow(A.replace(bundle.reporters, 1, A.getUnsafe(bundle.reporters, 0))),
        };
        const citationResult8 = yield* Effect.flip(makeCitationFrozenEditions(duplicate));
        expect(citationResult8.reason).toBe("manifest-mismatch");
        const first = A.getUnsafe(bundle.reporters, 0);
        const edited = { ...first, payload: Str.replace("false", "true")(first.payload) };
        if (edited.payload === first.payload) throw new Error("fixture requires false reporter flag");
        const citationResult9 = yield* Effect.flip(
          makeCitationFrozenEditions({ ...bundle, reporters: O.getOrThrow(A.replace(bundle.reporters, 0, edited)) })
        );
        expect(citationResult9.reason).toBe("corrupt-artifact");
        const replacementRef = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(edited.payload));
        const citationResult10 = yield* Effect.flip(
          makeCitationFrozenEditions({
            ...bundle,
            reporters: O.getOrThrow(A.replace(bundle.reporters, 0, { ref: replacementRef, payload: edited.payload })),
          })
        );
        expect(citationResult10.reason).toBe("manifest-mismatch");
        const firstEdition = A.getUnsafe(bundle.editions, 0);
        const citationResult11 = yield* Effect.flip(
          makeCitationFrozenEditions({
            ...bundle,
            editions: O.getOrThrow(
              A.replace(bundle.editions, 0, { ...firstEdition, payload: `${firstEdition.payload} ` })
            ),
          })
        );
        expect(citationResult11.reason).toBe("corrupt-artifact");
        const citationResult12 = yield* Effect.flip(makeCitationFrozenEditions({}));
        expect(citationResult12.reason).toBe("invalid-input");
      })
  );

  it.effect("drops failing digest service causes before exposing a partial adapter", () =>
    Effect.gen(function* () {
      const { bundle } = yield* loadCitationFrozenEditionFixtures();
      const failure = yield* Effect.flip(
        makeCitationFrozenEditions(bundle).pipe(
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
      expect(failure.reason).toBe("digest-failed");
      expect("cause" in failure).toBe(false);
    })
  );
});
