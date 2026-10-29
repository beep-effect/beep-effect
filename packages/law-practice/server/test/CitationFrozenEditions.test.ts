import { fileURLToPath } from "node:url";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import { makeCitationFrozenEditions } from "@beep/law-practice-server/_test/Citation/FrozenEditions";
import { encodeCitationRuntimeEdition } from "@beep/law-practice-server/_test/Citation/PublicationResourceHash";
import { Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
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
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const SourceType = S.fromJsonString(S.Struct({ pythonType: S.String }));
const Corpus = S.fromJsonString(
  S.Struct({ artifacts: S.Record(Sha256Hex, S.Struct({ kind: S.String, payload: S.String })) })
);
const Expected = S.fromJsonString(
  S.Struct({
    schemaVersion: S.Literal("citation-frozen-editions/v1"),
    manifestSha256: S.Literal("b6d3fdd9b6fb4e006c3ede86639c46e7579ff03d39091bdd74ca60919dfe648e"),
    editions: S.Array(
      S.Struct({
        edition: CitationEditionRef,
        family: S.Literals(["case", "law", "journal"]),
        shortName: S.String,
        runtimePayloadSha256: Sha256Hex,
      })
    ),
  })
);
const fixtures = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/operation-cases.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
    "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1"
  );
  const corpus = yield* S.decodeEffect(Corpus)(raw);
  let reporters = A.empty<{ ref: Sha256Hex; payload: string }>();
  let editions = A.empty<{ ref: Sha256Hex; payload: string }>();
  for (const [ref, row] of R.toEntries(corpus.artifacts)) {
    if (row.kind !== "model-value") continue;
    const tag = yield* S.decodeEffect(SourceType)(row.payload);
    if (tag.pythonType === "eyecite.models.Reporter") reporters = A.append(reporters, { ref, payload: row.payload });
    if (tag.pythonType === "eyecite.models.Edition") editions = A.append(editions, { ref, payload: row.payload });
  }
  const expectedRaw = yield* fs.readFileString(
    fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/frozen-editions.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(expectedRaw))).toBe(
    "0c23ff189ec5c381303af14c79f630a4d7910a11374308f9c7400ca3f79faf0d"
  );
  return { bundle: { reporters, editions }, expected: yield* S.decodeEffect(Expected)(expectedRaw) };
});

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("authenticated frozen editions", (it) => {
  it.effect("authenticates all 2430 reporters / 2533 editions and matches every actual source runtime payload", () =>
    Effect.gen(function* () {
      const { bundle, expected } = yield* fixtures;
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
        const { bundle } = yield* fixtures;
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
      const { bundle } = yield* fixtures;
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
