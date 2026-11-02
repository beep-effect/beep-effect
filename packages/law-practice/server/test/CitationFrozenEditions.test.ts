import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationFrozenEditions } from "../src/internal/Citation/FrozenEditions.ts";
import { encodeCitationRuntimeEdition } from "../src/internal/Citation/PublicationResourceHash.ts";
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
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(encoded)), row.edition).toBe(
          row.runtimePayloadSha256
        );
      }
      const first = A.getUnsafe(expected.editions, 0);
      const sameKind = A.filter(expected.editions, (row) => row.family === first.family);
      const second = A.getUnsafe(sameKind, 1);
      const refs = [second.edition, first.edition, second.edition];
      expect(A.map(yield* adapter.lookupMany(refs, first.family), (edition) => edition.edition)).toEqual(refs);
      expect((yield* Effect.flip(adapter.lookup(first.edition, first.family === "case" ? "law" : "case"))).reason).toBe(
        "kind-mismatch"
      );
      expect(
        (yield* Effect.flip(adapter.lookup(CitationEditionRef.make(Str.repeat(64)("0")), first.family))).reason
      ).toBe("missing-edition");
      const returned = yield* adapter.lookup(first.edition, first.family);
      const originalName = returned.value.reporter.name;
      const mutable: { name: string } = returned.value.reporter;
      mutable.name = "Changed";
      expect((yield* adapter.lookup(first.edition, first.family)).value.reporter.name).toBe(originalName);
      A.getUnsafe(bundle.reporters, 0).payload = "changed caller state";
      expect((yield* adapter.lookup(first.edition, first.family)).value.reporter.name).toBe(originalName);
    })
  );

  it.effect(
    "rejects missing/duplicate identities, edited reporter/edition payloads and self-consistent replacement identities",
    () =>
      Effect.gen(function* () {
        const { bundle } = yield* loadCitationFrozenEditionFixtures();
        expect(
          (yield* Effect.flip(makeCitationFrozenEditions({ ...bundle, reporters: A.drop(bundle.reporters, 1) }))).reason
        ).toBe("invalid-input");
        const duplicate = {
          ...bundle,
          reporters: O.getOrThrow(A.replace(bundle.reporters, 1, A.getUnsafe(bundle.reporters, 0))),
        };
        expect((yield* Effect.flip(makeCitationFrozenEditions(duplicate))).reason).toBe("manifest-mismatch");
        const first = A.getUnsafe(bundle.reporters, 0);
        const edited = { ...first, payload: Str.replace("false", "true")(first.payload) };
        if (edited.payload === first.payload) throw new Error("fixture requires false reporter flag");
        expect(
          (yield* Effect.flip(
            makeCitationFrozenEditions({ ...bundle, reporters: O.getOrThrow(A.replace(bundle.reporters, 0, edited)) })
          )).reason
        ).toBe("corrupt-artifact");
        const replacementRef = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(edited.payload));
        expect(
          (yield* Effect.flip(
            makeCitationFrozenEditions({
              ...bundle,
              reporters: O.getOrThrow(A.replace(bundle.reporters, 0, { ref: replacementRef, payload: edited.payload })),
            })
          )).reason
        ).toBe("manifest-mismatch");
        const firstEdition = A.getUnsafe(bundle.editions, 0);
        expect(
          (yield* Effect.flip(
            makeCitationFrozenEditions({
              ...bundle,
              editions: O.getOrThrow(
                A.replace(bundle.editions, 0, { ...firstEdition, payload: `${firstEdition.payload} ` })
              ),
            })
          )).reason
        ).toBe("corrupt-artifact");
        expect((yield* Effect.flip(makeCitationFrozenEditions({}))).reason).toBe("invalid-input");
      })
  );

  it.effect("drops failing digest service causes before exposing a partial adapter", () =>
    Effect.gen(function* () {
      const { bundle } = yield* loadCitationFrozenEditionFixtures();
      const failure = yield* Effect.flip(
        makeCitationFrozenEditions(bundle).pipe(
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
      expect(failure.reason).toBe("digest-failed");
      expect("cause" in failure).toBe(false);
    })
  );
});
