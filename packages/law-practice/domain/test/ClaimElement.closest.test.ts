import { antecedentPolicy, decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";

describe("closest-match structural gaps", () => {
  it.effect("retains explicit parenthetical aliases and links only a unique source-defined abbreviation", () =>
    Effect.gen(function* () {
      for (const { body, linked } of [
        { body: "a linked infrared (IR) channel.", linked: true },
        { body: "a linked infrared channel.", linked: false },
        { body: "a linked infrared (IR) channel; a separate input route (IR) channel.", linked: false },
      ]) {
        const claims = yield* normalizePatentClaims([
          ["1", `A controller comprising ${body}`],
          ["2", "The controller of claim 1 wherein the IR channel is active."],
        ]);
        const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
        const child = O.getOrThrow(A.last(trees));
        assert.strictEqual(
          A.some(child.edges, (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "the IR channel"),
          linked
        );
        if (linked) {
          const terms = A.flatMap(O.getOrThrow(A.head(trees)).elements, (element) => element.terms);
          assert.isTrue(
            A.some(
              terms,
              (term) =>
                term.anchor.quote === "a linked infrared (IR) channel" && term.head === "linked infrared (ir) channel"
            )
          );
          assert.isFalse(
            A.some(
              antecedentPolicy(trees, claims),
              (finding) => finding.referring.anchor.quote === "the IR channel" && finding.kind === "missing-antecedent"
            )
          );
        }
      }
      const numbered = yield* normalizePatentClaims([["1", "A controller comprising a channel (12)."]]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(numbered)), numbered);
      assert.isTrue(
        A.some(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.anchor.quote === "a channel" && term.head === "channel"
        )
      );
    })
  );

  it.effect("separates coordinated subject clauses while retaining an inline relative clause", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising the cover is a plate, and said hinge is a ring, which is coupled to the cover."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(tree.elements, (element) => [element.path, element.anchor.quote]),
        [
          ["1", "A fixture"],
          ["1.a", "the cover is a plate"],
          ["1.b", "said hinge is a ring, which is coupled to the cover"],
        ]
      );
    })
  );

  it.effect("places an explicit body claim reference on its actual source element", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A pump comprising a rotor."],
        ["2", "A vehicle comprising the pump according to claim 1."],
      ]);
      const claim = O.getOrThrow(A.last(claims));
      assert.strictEqual(claim.claimType, "dependent");
      const tree = yield* decomposeClaim(claim, claims);
      assert.deepStrictEqual(
        A.map(tree.edges, (edge) => edge.kind),
        ["part-of", "depends-on-element", "functional", "antecedent"]
      );
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) => edge.kind === "depends-on-element" && edge.dependent === "2.a" && edge.ancestor === "1"
        )
      );
      assert.isFalse(A.some(tree.edges, (edge) => edge.kind === "depends-on-element" && edge.dependent === "2"));
    })
  );

  it.effect("links a further limitation to the exact immediate-parent entity it limits", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A fixture comprising a housing."],
        ["2", "The fixture of claim 1 wherein the housing includes a liner."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) => edge.kind === "depends-on-element" && edge.dependent === "2.a" && edge.ancestor === "1.a"
        )
      );
    })
  );

  it.effect("retains bare dependent subjects and excludes dependency scaffolding from their terms", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "Method comprising a sensor."],
        ["2", "Method in accordance with claim 1 wherein the sensor is optical."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
      assert.deepStrictEqual(
        A.map(O.getOrThrow(A.head(tree.elements)).terms, (term) => term.anchor.quote),
        ["Method"]
      );
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) => edge.kind === "antecedent" && edge.referring.path === "2" && edge.introducing.path === "1"
        )
      );
      const shortenedClaims = yield* normalizePatentClaims([
        ["1", "A wideband telemetry system comprising a sensor."],
        ["2", "The system of claim 1 wherein the sensor is optical."],
      ]);
      const shortened = yield* decomposeClaim(O.getOrThrow(A.last(shortenedClaims)), shortenedClaims);
      assert.isTrue(
        A.some(
          shortened.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.path === "2" &&
            edge.introducing.anchor.quote === "A wideband telemetry system"
        )
      );
    })
  );

  it.effect("keeps structural mention identity separate from a legal missing-introduction warning", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising the axial path is straight."],
        ["2", "The tester of claim 1 wherein the axial path is curved."],
      ]);
      const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      assert.isTrue(
        A.some(
          O.getOrThrow(A.last(trees)).edges,
          (edge) => edge.kind === "antecedent" && edge.referring.path === "2.a" && edge.introducing.path === "1.a"
        )
      );
      assert.isTrue(
        A.some(
          antecedentPolicy(trees, claims),
          (finding) => finding.kind === "missing-antecedent" && finding.referring.path === "2.a"
        )
      );
    })
  );
  it.effect("treats an explicit following-steps frame as organization rather than a claimed entity", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        [
          "1",
          "A method comprising the following steps: placing a sensor in a housing, threading a cable through the housing, and turning the sensor; wherein the cable is fixed.",
        ],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(tree.elements, (element) => [element.path, element.anchor.quote]),
        [
          ["1", "A method"],
          ["1.a", "placing a sensor in a housing"],
          ["1.b", "threading a cable through the housing"],
          ["1.c", "turning the sensor"],
          ["1.d", "the cable is fixed"],
        ]
      );
    })
  );

  it.effect("retains compound nouns ending in assembly and adverbial nominal modifiers", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising a subassembly; a substantially rectangular bearing; selectively adjustable vanes."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.head
        ),
        ["tester", "subassembly", "substantially rectangular bearing", "selectively adjustable vanes"]
      );
    })
  );

  it.effect("keeps functional idioms in connecting text instead of inventing noun phrases", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising a sensor positioned side by side with a relay by means of a carrier."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.head(claims)), claims);
      assert.deepStrictEqual(
        A.map(
          A.flatMap(tree.elements, (element) => element.terms),
          (term) => term.anchor.quote
        ),
        ["A tester", "a sensor", "a relay", "a carrier"]
      );
    })
  );

  it.effect("resolves a unique bare origin ahead of its later definite reminders", () =>
    Effect.gen(function* () {
      const claims = yield* normalizePatentClaims([
        ["1", "A tester comprising a sensor for torque; the torque is recorded."],
        ["2", "The tester of claim 1 wherein the torque is displayed."],
      ]);
      const tree = yield* decomposeClaim(O.getOrThrow(A.last(claims)), claims);
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.anchor.quote === "the torque" &&
            edge.introducing.anchor.quote === "torque" &&
            edge.introducing.path === "1.a"
        )
      );
    })
  );
});
