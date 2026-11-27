import { admission } from "@beep/sbom/internal/admission";
import { Sbom } from "@beep/sbom/Sbom";
import { Component } from "@beep/sbom/SbomDocument";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import { sourceOf } from "./support/sourceGraph.ts";
import type { SbomDocument } from "@beep/sbom/SbomDocument";
import type * as S from "effect/Schema";

const nodesOf = (input: unknown): number =>
  P.hasProperty(input, "components") && A.isArray(input.components) ? input.components.length + 1 : 1;

// decision: admission-counted-through-the-seam
class AdmissionCount extends Context.Service<
  AdmissionCount,
  { readonly admissionsOf: (build: () => unknown) => Effect.Effect<number> }
>()("@beep/sbom/test/Sbom.admission.test/AdmissionCount") {
  static readonly layer = Layer.effect(
    AdmissionCount,
    Effect.acquireRelease(
      Effect.sync(() => {
        const tally = MutableRef.make(0);
        const admit = admission.admit;
        admission.admit = <Self extends S.Top>(schema: Self, input: Self["~type.make.in"]): Self["Type"] => {
          MutableRef.update(tally, (count) => count + nodesOf(input));
          return admit(schema, input);
        };
        return {
          admit,
          service: AdmissionCount.of({
            admissionsOf: Effect.fn("AdmissionCount.admissionsOf")((build: () => unknown) =>
              Effect.sync(() => {
                MutableRef.set(tally, 0);
                build();
                return MutableRef.get(tally);
              })
            ),
          }),
        };
      }),
      ({ admit }) =>
        Effect.sync(() => {
          admission.admit = admit;
        })
    ).pipe(Effect.map(({ service }) => service))
  );
}

const root = Component.make({ type: "application", name: "root", version: "1.0.0" });
const dependencies = A.makeBy(5_000, (index) =>
  Component.make({ type: "library", name: `dep-${index}`, version: "1.0.0", bomRef: `dep-${index}@1.0.0` })
);

const readmittingGenerate = (components: ReadonlyArray<Component>): SbomDocument =>
  Sbom.generate({ root, components: A.map(components, (component) => admission.admit(Component, component)) });

describe("Sbom.generate admission", () => {
  it.layer(AdmissionCount.layer, { timeout: "5 seconds" })((it) => {
    it.effect("admission work is exactly affine in components: one document make over n + 1 nodes", () =>
      Effect.gen(function* () {
        const { admissionsOf } = yield* AdmissionCount;
        const generateOf = (components: ReadonlyArray<Component>) =>
          admissionsOf(() => Sbom.generate({ root, components }));
        const none = yield* generateOf(A.empty());
        const small = yield* generateOf(A.take(dependencies, 1_000));
        const large = yield* generateOf(dependencies);
        assert.strictEqual(none, 1, "a document walks its components plus the root on its metadata");
        assert.strictEqual(small, none + 1_000, `admissions(1k) = ${small}`);
        assert.strictEqual(large, none + 5_000, `admissions(5k) = ${large}`);
      })
    );

    it.effect("the counter flags a builder that re-admits each component", () =>
      Effect.gen(function* () {
        const { admissionsOf } = yield* AdmissionCount;
        const none = yield* admissionsOf(() => readmittingGenerate(A.empty()));
        const small = yield* admissionsOf(() => readmittingGenerate(A.take(dependencies, 1_000)));
        assert.strictEqual(none, 1);
        assert.strictEqual(
          small,
          none + 2 * 1_000,
          "each component is walked twice, as a Component.make in the sort would"
        );
      })
    );
  });
});

const COMMENT_LINE = /^\s*(?:\/\/|\/\*\*?|\*).*$/gm;

const MAKE_REFERENCE = /\b([A-Za-z_$][\w$]*)\s*\.\s*make\b/g;

const SEAM_CALL = /\badmission\s*\.\s*admit\s*\(/g;

const NON_ADMITTING_MAKES = HashSet.make("SbomWriteError", "Order");

// decision: admission-counted-through-the-seam
const constructionsOf = (
  source: string
): { readonly directMakes: ReadonlyArray<string>; readonly seamCalls: number } => {
  const code = Str.replace(COMMENT_LINE, "")(source);
  return {
    directMakes: A.filter(
      A.flatMap(A.fromIterable(Str.matchAll(MAKE_REFERENCE)(code)), (match) =>
        match[1] === undefined ? [] : [match[1]]
      ),
      (name) => !HashSet.has(NON_ADMITTING_MAKES, name)
    ),
    seamCalls: A.length(A.fromIterable(Str.matchAll(SEAM_CALL)(code))),
  };
};

describe("Sbom.generate construction path", () => {
  it("src/Sbom.ts admits only through the seam, with no direct schema make", () => {
    const { directMakes, seamCalls } = constructionsOf(sourceOf("Sbom.ts"));
    assert.deepStrictEqual(directMakes, [], "a direct make bypasses the admission counter");
    assert.strictEqual(seamCalls, 1, "generate admits the document through admission.admit once");
  });

  it("the scan flags a direct make in code and ignores one in a doc comment", () => {
    const fixture = A.join(
      [
        "/**",
        ' * const root = Component.make({ type: "application", name: "app" })',
        " */",
        "const generate = (input) =>",
        "  admission.admit(SbomDocument, {",
        "    components: A.map(input.components, Component.make),",
        "    metadata: SbomMetadata.make({ component: input.root }),",
        "  });",
        "const order = Order.make(compare);",
      ],
      "\n"
    );
    const { directMakes, seamCalls } = constructionsOf(fixture);
    assert.deepStrictEqual(
      directMakes,
      ["Component", "SbomMetadata"],
      "a called and a point-free make both count; Order.make builds no node"
    );
    assert.strictEqual(seamCalls, 1);
  });
});
