import { TextAnchor } from "@beep/provenance/TextAnchor";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Correction = S.Struct({
  originalSha256: S.String,
  replacements: S.Array(S.Struct({ case: S.String, termOrdinal: S.Int, oldOuter: TextAnchor, newOuter: TextAnchor })),
});
const Source = S.Struct({
  fixtures: S.Array(
    S.Struct({
      case: S.String,
      qualifiedText: S.String,
      nominals: S.Array(S.Struct({ outer: TextAnchor })).pipe(S.optionalKey),
    })
  ),
});
it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer, BunPath.layer))(
  "immutable authored plan fixture correction",
  (it) => {
    it.effect("checks original bytes and every old outer field before the source-led three-field overlay", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const sourcePath = yield* path.fromFileUrl(
          new URL("../../domain/test/fixtures/claim-element/source-projection-plans.json", import.meta.url)
        );
        const correctionPath = yield* path.fromFileUrl(
          new URL("../../domain/test/fixtures/claim-element/source-projection-outer-correction.json", import.meta.url)
        );
        const sourceBytes = yield* fs.readFile(sourcePath);
        const correctionBytes = yield* fs.readFile(correctionPath);
        const originalDigest = yield* S.decodeEffect(Sha256HexFromBytes)(sourceBytes);
        const correctionDigest = yield* S.decodeEffect(Sha256HexFromBytes)(correctionBytes);
        assert.strictEqual(originalDigest, "85610a4b583e904fa0d108bd9582a45dbc48df5b3ccc3a4904b5af82ceff9b24");
        assert.strictEqual(correctionDigest, "ed5a6ddec6e22f31c3e847cbaa5a694cebe2b97cb2e4e398feb2068aa09d8255");
        const rawSource = yield* fs.readFileString(sourcePath);
        const rawCorrection = yield* fs.readFileString(correctionPath);
        const source = yield* S.decodeEffect(S.fromJsonString(Source))(rawSource);
        const correction = yield* S.decodeEffect(S.fromJsonString(Correction))(rawCorrection);
        assert.strictEqual(correction.originalSha256, originalDigest);
        assert.strictEqual(correction.replacements.length, 3);
        for (const row of correction.replacements) {
          const fixture = O.getOrThrow(A.findFirst(source.fixtures, (f) => f.case === row.case));
          const nominal = O.getOrThrow(
            A.get(
              O.getOrElse(O.fromUndefinedOr(fixture.nominals), () => []),
              row.termOrdinal
            )
          );
          assert.deepStrictEqual(nominal.outer, row.oldOuter);
          assert.strictEqual(
            Str.slice(row.newOuter.startChar, row.newOuter.endChar)(fixture.qualifiedText),
            row.newOuter.quote
          );
        }
      })
    );
  }
);
