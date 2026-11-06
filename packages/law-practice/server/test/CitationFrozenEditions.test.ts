import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
  readCitationFrozenEdition,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import { encodeCitationRuntimeEdition } from "@beep/law-practice-server/internal/Citation/PublicationResourceHash";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
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
        const source = yield* adapter.source(row.edition);
        expect(source).toBe(edition.value.reporter.source);
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
      const missingSource = yield* adapter.source(CitationEditionRef.make(Str.repeat(64)("0"))).pipe(Effect.flip);
      expect(missingSource.reason).toBe("missing-edition");
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

  it.effect("rejects malformed digest output before accepting an authenticated bundle", () =>
    Effect.gen(function* () {
      const { bundle } = yield* loadCitationFrozenEditionFixtures();
      const failure = yield* makeCitationFrozenEditions(bundle).pipe(
        Effect.provideService(
          Digest.Digest,
          makeTestCitationDigest(() => Effect.succeed(new Uint8Array(1)))
        ),
        Effect.flip
      );
      expect(failure).toMatchObject({ _tag: "CitationFrozenEditionFailure", reason: "digest-failed" });
      expect("cause" in failure).toBe(false);
    })
  );
  it.effect("rejects authenticated artifacts whose decoded model or reporter reference is corrupt", () =>
    Effect.gen(function* () {
      const { bundle } = yield* loadCitationFrozenEditionFixtures();
      const crypto = yield* Digest.Digest;
      const reporter = A.getUnsafe(bundle.reporters, 0);
      const edition = A.getUnsafe(bundle.editions, 0);
      const missingReporter = Str.repeat(64)("0");
      const malformedEdition = `{"pythonType":"eyecite.models.Edition","fields":{"short_name":"Test","reporter":{"artifactSha256":"${missingReporter}"},"start":null,"end":null}}`;
      const cases = [
        { kind: "reporter", original: reporter, payload: "{}" },
        { kind: "edition", original: edition, payload: "{}" },
        { kind: "edition", original: edition, payload: malformedEdition },
      ];
      for (const row of cases) {
        const altered = { ...row.original, payload: row.payload };
        const input = {
          reporters: row.kind === "reporter" ? O.getOrThrow(A.replace(bundle.reporters, 0, altered)) : bundle.reporters,
          editions: row.kind === "edition" ? O.getOrThrow(A.replace(bundle.editions, 0, altered)) : bundle.editions,
        };
        let authenticatedAlteredPayload = false;
        // Deliberately authenticate the changed bytes to isolate structural validation
        // from the independently tested artifact digest check.
        const digest = makeTestCitationDigest((algorithm, bytes) => {
          if (new TextDecoder().decode(bytes) === row.payload) {
            authenticatedAlteredPayload = true;
            return crypto.digest(algorithm, new TextEncoder().encode(row.original.payload));
          }
          return crypto.digest(algorithm, bytes);
        });
        const failure = yield* makeCitationFrozenEditions(input).pipe(
          Effect.provideService(Digest.Digest, digest),
          Effect.flip
        );
        expect(authenticatedAlteredPayload).toBe(true);
        expect(failure).toMatchObject({ _tag: "CitationFrozenEditionFailure", reason: "corrupt-artifact" });
        expect("cause" in failure).toBe(false);
      }
    })
  );

  it.effect("bounds lookup batches and refuses unknown source families before lookup", () =>
    Effect.gen(function* () {
      const { bundle, expected } = yield* loadCitationFrozenEditionFixtures();
      const adapter = yield* makeCitationFrozenEditions(bundle);
      const first = A.getUnsafe(expected.editions, 0);
      const failure = yield* adapter
        .lookupMany(A.replicate(first.edition, CitationEngineAbsoluteMaxima.candidates + 1), first.family)
        .pipe(Effect.flip);
      expect(failure.reason).toBe("invalid-input");
      let lookups = 0;
      const unknownSource = CitationFrozenEditions.of({
        ...adapter,
        source: Effect.fn("FrozenEditionTest.source")(() => Effect.succeed("unsupported-private-source")),
        lookup: Effect.fn("FrozenEditionTest.lookup")((reference, family) => {
          lookups++;
          return adapter.lookup(reference, family);
        }),
      });
      const sourceFailure = yield* readCitationFrozenEdition(unknownSource, first.edition).pipe(Effect.flip);
      expect(sourceFailure.reason).toBe("corrupt-artifact");
      expect(lookups).toBe(0);
    })
  );
});
