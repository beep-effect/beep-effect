import { ClaimElementEdge, ClaimElementTree, claimNumberOfPath } from "@beep/law-practice-domain/values/ClaimElement";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Manifest = S.Struct({
  referenceProtocolVersion: S.Literal("semantic-reference/v2"),
  families: S.Array(S.Struct({ familyId: S.String })),
});
const Source = S.Struct({
  labelClaimNumbers: S.Array(S.Finite),
  claims: S.Array(S.Struct({ claimNumber: S.Finite, claimText: S.String })),
});
const Receipt = S.Struct({
  protocolVersion: S.Literal("semantic-reference/v2"),
  resolvedClaimNumbers: S.Array(S.Finite),
  unresolved: S.Array(S.Struct({ claimNumber: S.Finite, reason: S.String })),
});
const encodeReferenceEdge = ClaimElementEdge.pipe(S.fromJsonString, S.encodeEffect);
// Source/schema integrity only. Semantic approval and corpus completeness are separate.
// The test never imports the decomposer, policy, or checker predictions.
describe("Independent semantic reference integrity", () => {
  it.layer(Layer.mergeAll(BunFileSystem.layer, BunPath.layer))((it) => {
    it.effect("preserves selected coverage and every local/cross-claim source anchor", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const manifestPath = yield* path.fromFileUrl(
          new URL("../../../../goals/claim-element-antecedent-check/research/positive-sampling.json", import.meta.url)
        );
        const manifest = yield* S.decodeEffect(S.fromJsonString(Manifest))(yield* fs.readFileString(manifestPath));
        let referenceFamilies = 0;
        for (const { familyId } of manifest.families) {
          const directory = yield* path.fromFileUrl(
            new URL(`../../domain/test/fixtures/claim-element/positive/${familyId}/`, import.meta.url)
          );
          const expectedPath = path.join(directory, "expected.json");
          referenceFamilies++;
          const source = yield* S.decodeEffect(S.fromJsonString(Source))(
            yield* fs.readFileString(path.join(directory, "claims.json"))
          );
          const receipt = yield* S.decodeEffect(S.fromJsonString(Receipt))(
            yield* fs.readFileString(path.join(directory, "extractor.json"))
          );
          const trees = yield* ClaimElementTree.pipe(
            S.Array,
            S.fromJsonString,
            S.decodeEffect
          )(yield* fs.readFileString(expectedPath));
          assert.deepStrictEqual(
            A.map(trees, (t) => t.claimNumber),
            receipt.resolvedClaimNumbers
          );
          assert.deepStrictEqual(
            A.sort(
              A.appendAll(
                receipt.resolvedClaimNumbers,
                A.map(receipt.unresolved, (u) => u.claimNumber)
              ),
              N.Order
            ),
            A.sort(source.labelClaimNumbers, N.Order)
          );
          for (const tree of trees) {
            assert.strictEqual(tree.producer, "llm");
            const edgeValues = yield* Effect.forEach(tree.edges, (edge) => encodeReferenceEdge(edge));
            assert.strictEqual(A.dedupe(edgeValues).length, tree.edges.length);
            const claimOption = A.findFirst(source.claims, (c) => c.claimNumber === tree.claimNumber);
            if (O.isNone(claimOption)) return yield* Effect.die(`Missing source claim ${tree.claimNumber}`);
            const claim = claimOption.value;
            for (const element of tree.elements)
              for (const anchor of [element.anchor, ...A.map(element.terms, (t) => t.anchor)])
                assert.strictEqual(Str.slice(anchor.startChar, anchor.endChar)(claim.claimText), anchor.quote);
            for (const edge of tree.edges) {
              if (edge.kind === "functional")
                for (const part of edge.parts)
                  if (part.kind === "text")
                    assert.strictEqual(
                      Str.slice(part.anchor.startChar, part.anchor.endChar)(claim.claimText),
                      part.anchor.quote
                    );
              if (edge.kind !== "antecedent") continue;
              for (const ref of [edge.referring, edge.introducing]) {
                const contextOption = A.findFirst(source.claims, (c) => c.claimNumber === claimNumberOfPath(ref.path));
                if (O.isNone(contextOption)) return yield* Effect.die(`Missing edge source claim ${ref.path}`);
                const context = contextOption.value;
                assert.strictEqual(
                  Str.slice(ref.anchor.startChar, ref.anchor.endChar)(context.claimText),
                  ref.anchor.quote
                );
                for (const owner of A.filter(trees, (t) => t.claimNumber === claimNumberOfPath(ref.path)))
                  assert.isTrue(
                    A.some(
                      owner.elements,
                      (e) =>
                        e.path === ref.path &&
                        A.some(
                          e.terms,
                          (t) =>
                            t.anchor.startChar === ref.anchor.startChar &&
                            t.anchor.endChar === ref.anchor.endChar &&
                            t.anchor.quote === ref.anchor.quote
                        )
                    )
                  );
              }
            }
          }
        }
        assert.strictEqual(referenceFamilies, manifest.families.length);
      })
    );
  });
});
