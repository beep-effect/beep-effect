import * as NodeURL from "node:url";
import { makeCitationExtractorRecipes } from "@beep/law-practice-server/internal/Citation/ExtractorRecipes";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
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
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { decodeCitationExtractorRecipeCorpus } from "./CitationExtractorRecipes.fixtures.ts";

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
        expect(hash).toBe("5b7438f1026b059bbe4ab76fd8cfec624de64e0e4c0561fa87d51a0a4ad159ca");
        const corpus = yield* decodeCitationExtractorRecipeCorpus(new TextDecoder().decode(bytes));
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
          [-1, descriptor(ref, 0)],
          [1, descriptor(ref, 0)],
          [0, {}],
          [0, descriptor(Str.repeat(64)("0"), 0)],
          [0, descriptor(ref, 2)],
        ]) {
          const failed = yield* registry.bind(input[0], input[1]).pipe(Effect.flip);
          expect(failed).toMatchObject({ reason: input[0] !== 0 ? "unknown-extractor" : "program-mismatch" });
        }
        for (const [recipes, editions] of [
          [null, bindings],
          [[row], null],
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

it.effect("rejects malformed policy with a closed failure before installing operations", () =>
  Effect.gen(function* () {
    for (const policy of [null, {}, { sourceUtf16: 0 }]) {
      const failure = yield* makeCitationExtractorRecipes(policy, [], []).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "invalid-bindings" });
      expect("cause" in failure).toBe(false);
    }
  })
);
