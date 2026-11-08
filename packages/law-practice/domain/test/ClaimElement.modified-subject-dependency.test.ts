import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement";

const treeFor = Effect.fn("ModifiedSubjectDependencyTest.tree")(function* (
  rows: ReadonlyArray<readonly [string, string]>
) {
  const claims = yield* normalizePatentClaims(rows);
  return yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
});
const bodyDependencies = (tree: ClaimElementTree) =>
  A.getSomes(
    A.map(tree.edges, (edge) =>
      edge.kind === "depends-on-element" && Str.includes(".")(edge.dependent)
        ? O.some([edge.dependent, edge.ancestor])
        : O.none()
    )
  );

describe("dependencies through already resolved modified subject references", () => {
  it.effect("refines the unique introducing owner selected for a subject with one omitted modifier", () =>
    Effect.gen(function* () {
      // Self-authored source controls: the existing resolver must first select
      // the source mention; dependency construction must preserve that identity.
      for (const [introduced, referred, verb] of [
        ["an optical sensor", "said sensor", "is"],
        ["a hollow shaft", "said shaft", "is"],
        ["one or more adjustable brackets", "said brackets", "are"],
      ]) {
        const claims = yield* normalizePatentClaims([
          ["1", `A fixture comprising ${introduced}.`],
          ["2", `The fixture of claim 1 wherein ${referred} ${verb} metallic.`],
        ]);
        const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
        const selected = A.filter(
          tree.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.path === "2.a" &&
            edge.referring.anchor.quote === referred &&
            edge.introducing.path === "1.a"
        );
        assert.strictEqual(selected.length, 1);
        assert.isTrue(
          A.some(
            tree.edges,
            (edge) => edge.kind === "depends-on-element" && edge.dependent === "2.a" && edge.ancestor === "1.a"
          )
        );
      }
    })
  );

  it.effect("retains exact source anchors and the resolver's exact-match priority", () =>
    Effect.gen(function* () {
      const parent = "A fixture comprising an optical sensor; a sensor.";
      const child = "The fixture of claim 1 wherein said sensor is metallic.";
      const tree = yield* treeFor([
        ["1", parent],
        ["2", child],
      ]);
      const edge = O.getOrThrow(
        A.findFirst(tree.edges, (value) => value.kind === "antecedent" && value.referring.path === "2.a")
      );
      assert.strictEqual(edge.kind, "antecedent");
      if (edge.kind !== "antecedent") return;
      const referringStart = O.getOrThrow(Str.indexOf("said sensor")(child));
      const introducingStart = O.getOrThrow(Str.indexOf("a sensor")(parent));
      assert.deepStrictEqual(edge.referring, {
        path: "2.a",
        anchor: TextAnchor.make({ startChar: referringStart, endChar: referringStart + 11, quote: "said sensor" }),
      });
      assert.deepStrictEqual(edge.introducing, {
        path: "1.b",
        anchor: TextAnchor.make({ startChar: introducingStart, endChar: introducingStart + 8, quote: "a sensor" }),
      });
      assert.deepStrictEqual(bodyDependencies(tree), [["2.a", "1.b"]]);
    })
  );

  it.effect("reuses existing explicit abbreviation, designator and counted-content resolutions", () =>
    Effect.gen(function* () {
      for (const [introduced, referred, verb] of [
        ["an infrared (IR) sensor", "said IR sensor", "is"],
        ["an optical sensor s1", "said optical sensor", "is"],
        ["a specified number of packets", "said packets", "are"],
      ]) {
        const tree = yield* treeFor([
          ["1", `A fixture comprising ${introduced}.`],
          ["2", `The fixture of claim 1 wherein ${referred} ${verb} encoded.`],
        ]);
        assert.isTrue(
          A.some(
            tree.edges,
            (edge) =>
              edge.kind === "antecedent" &&
              edge.referring.anchor.quote === referred &&
              edge.introducing.anchor.quote === introduced
          )
        );
        assert.deepStrictEqual(bodyDependencies(tree), [["2.a", "1.a"]]);
      }
    })
  );

  it.effect("withholds dependency when competing modified introductions prevent selection", () =>
    Effect.gen(function* () {
      const tree = yield* treeFor([
        ["1", "A fixture comprising an optical sensor; a thermal sensor."],
        ["2", "The fixture of claim 1 wherein said sensor is metallic."],
      ]);
      assert.isFalse(A.some(tree.edges, (edge) => edge.kind === "antecedent" && edge.referring.path === "2.a"));
      assert.deepStrictEqual(bodyDependencies(tree), []);
    })
  );

  it.effect("keeps sibling, alternative-route and grandparent-only donors out of direct-parent dependencies", () =>
    Effect.gen(function* () {
      for (const rows of [
        [
          ["1", "A fixture comprising a frame."],
          ["2", "A fixture comprising an optical sensor."],
          ["3", "The fixture of claim 1 wherein said sensor is metallic."],
        ],
        [
          ["1", "A fixture comprising an optical sensor."],
          ["2", "A fixture comprising a frame."],
          ["3", "The fixture of claims 1 or 2 wherein said sensor is metallic."],
        ],
        [
          ["1", "A fixture comprising an optical sensor."],
          ["2", "The fixture of claim 1 wherein a cover is metallic."],
          ["3", "The fixture of claim 2 wherein said sensor is metallic."],
        ],
      ]) {
        const tree = yield* treeFor(A.map(rows, (row) => [O.getOrThrow(A.head(row)), O.getOrThrow(A.last(row))]));
        assert.deepStrictEqual(bodyDependencies(tree), []);
      }
    })
  );

  it.effect("does not turn an action object or later referring term into a subject dependency", () =>
    Effect.gen(function* () {
      for (const body of ["creating said sensor", "a relay is coupled to said sensor"]) {
        const tree = yield* treeFor([
          ["1", "A fixture comprising an optical sensor."],
          ["2", `The fixture of claim 1 wherein ${body}.`],
        ]);
        assert.isTrue(A.some(tree.edges, (edge) => edge.kind === "antecedent" && edge.referring.path === "2.a"));
        assert.deepStrictEqual(bodyDependencies(tree), []);
      }
    })
  );

  it.effect("retains the introducing-determiner and grammatical-number requirements", () =>
    Effect.gen(function* () {
      for (const [introduced, referred, verb] of [
        ["the optical sensor", "said sensor", "is"],
        ["an optical sensor", "said sensors", "are"],
      ]) {
        const tree = yield* treeFor([
          ["1", `A fixture comprising ${introduced}.`],
          ["2", `The fixture of claim 1 wherein ${referred} ${verb} metallic.`],
        ]);
        assert.deepStrictEqual(bodyDependencies(tree), []);
      }
    })
  );
});
