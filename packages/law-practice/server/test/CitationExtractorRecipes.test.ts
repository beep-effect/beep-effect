import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationExtractorRecipe,
  makeCitationExtractorRecipes,
} from "@beep/law-practice-server/internal/Citation/ExtractorRecipes";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";

const $I = $LawPracticeServerId.create("test/CitationExtractorRecipes");
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-extractor-recipes/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("0e420604e7b6b9c0192e44127a5ac23ca41536890cfccfc2d2be6bfb9eeb5a10"),
    extractorsSha256: S.tag("8603461486e165c4cb98f238b58910c269e8d6b59f4a16323c075276e94eec3c"),
    counts: S.Record(S.String, S.Natural),
    editionRefs: S.Array(Sha256Hex).check(S.isBetweenLength(2533, 2533)),
    recipes: CitationExtractorRecipe.pipe(S.toType, S.Array).check(S.isBetweenLength(6805, 6805)),
  })
).pipe(
  $I.annoteSchema("Corpus", { description: "Independent exact canonical bound-class and ordered-extra observations." })
);
// The registry checks descriptor identity, not regex semantics or family safety.
const descriptor = (patternSha256: string, flags: number) => ({
  patternSha256,
  flags,
  profile: { groups: 1, names: {}, minimumWidthFloor: 1, repeatedCaptures: false, nullableMultiRepeat: false },
});

it.layer(Layer.merge(BunFileSystem.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "extractor constructor recipes",
  (it) => {
    it.effect("binds every canonical class and ordered edition occurrence without inferring class from extras", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const digest = yield* Digest.Digest;
        const bytes = yield* fs.readFile(
          NodeURL.fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/extractor-recipes.json", import.meta.url)
          )
        );
        const hash = yield* digest.digestHex(Digest.sha256, bytes);
        expect(hash).toBe("e89d62e4c27d27f36fd7748368fbb6cc4e5ac604b30c0434f0a6a07b2d5bd2cf");
        const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
        expect(corpus.counts).toEqual({
          CitationToken: 6799,
          IdToken: 1,
          SupraToken: 1,
          ParagraphToken: 1,
          StopWordToken: 1,
          PlaceholderCitationToken: 1,
          SectionToken: 1,
        });
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const editionIds = A.map(corpus.editionRefs, (ref, id) => ({ ref, id }));
        const ids = HashMap.fromIterable(A.map(editionIds, (row) => Tuple.make(row.ref, row.id)));
        const registry = yield* makeCitationExtractorRecipes(limits, corpus.recipes, editionIds);
        for (const row of corpus.recipes) {
          const actual = yield* registry.bind(row.id, descriptor(row.patternSha256, row.flags));
          expect(actual).toEqual({
            kind: row.kind,
            extra:
              row.kind === "CitationToken"
                ? {
                    exact_editions: A.map(row.exact, (ref) => HashMap.getUnsafe(ids, ref)),
                    variation_editions: A.map(row.variation, (ref) => HashMap.getUnsafe(ids, ref)),
                    short: row.short,
                  }
                : {},
          });
        }
        const first = A.getUnsafe(corpus.recipes, 0);
        const snapshot = yield* registry.bind(first.id, descriptor(first.patternSha256, first.flags));
        if (snapshot.extra.exact_editions !== undefined) snapshot.extra.exact_editions.push(999999);
        const fresh = yield* registry.bind(first.id, descriptor(first.patternSha256, first.flags));
        expect(fresh.extra.exact_editions).not.toContain(999999);
      })
    );
    it.effect("rejects unknown identities, missing editions, duplicate bindings and program mismatches", () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const ref = Str.repeat(64)("f");
        const row = {
          id: 0,
          kind: "CitationToken",
          patternSha256: ref,
          flags: 0,
          exact: [ref, ref],
          variation: [ref],
          short: false,
        };
        const bindings = [{ ref, id: 7 }];
        const registry = yield* makeCitationExtractorRecipes(limits, [row], bindings);
        const good = yield* registry.bind(0, descriptor(ref, 0));
        expect(good.extra).toEqual({ exact_editions: [7, 7], variation_editions: [7], short: false });
        for (const input of [
          [1, descriptor(ref, 0)],
          [0, descriptor(Str.repeat(64)("0"), 0)],
          [0, descriptor(ref, 2)],
        ]) {
          const failed = yield* registry.bind(input[0], input[1]).pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: input[0] === 1 ? "unknown-extractor" : "program-mismatch" });
        }
        for (const [recipes, editions] of [
          [[row, row], bindings],
          [[row], []],
          [[row], [...bindings, ...bindings]],
          [[{ ...row, kind: "IdToken" }], bindings],
        ]) {
          const failed = yield* makeCitationExtractorRecipes(limits, recipes, editions).pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: "invalid-bindings" });
        }
        const exhausted = yield* makeCitationExtractorRecipes(
          { ...limits, patterns: 1 },
          [row, { ...row, id: 1 }],
          bindings
        ).pipe(Effect.flip);
        expect(exhausted).toMatchObject({ limit: "patterns" });
      })
    );
  }
);
