import {
  Conformance,
  DanglingReference,
  DeprecatedProperty,
  DeprecatedType,
  NonConformantGraphError,
  PropertyNotOnType,
  UnknownTerm,
} from "@beep/schema-org/Conformance";
import { JsonLdDocument } from "@beep/schema-org/JsonLdDocument";
import { SoftwareSourceCode } from "@beep/schema-org/SoftwareSourceCode";
import { assert, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

it.effect("issues explain the node, offending term and successor or reference", () =>
  Effect.sync(() => {
    assert.strictEqual(
      PropertyNotOnType.make({ nodeId: "_:pkg", nodeType: "SoftwareSourceCode", property: "softwareVersion" }).message,
      '_:pkg: schema.org does not define "softwareVersion" on SoftwareSourceCode'
    );
    assert.strictEqual(
      DeprecatedType.make({ nodeId: "_:pkg", nodeType: "UserLikes", supersededBy: "LikeAction" }).message,
      "_:pkg: UserLikes is superseded by LikeAction"
    );
    assert.strictEqual(
      DeprecatedProperty.make({
        nodeId: "_:pkg",
        nodeType: "SoftwareSourceCode",
        property: "runtime",
        supersededBy: "runtimePlatform",
      }).message,
      "_:pkg: runtime is superseded by runtimePlatform"
    );
    assert.strictEqual(
      DanglingReference.make({
        nodeId: "_:pkg",
        nodeType: "SoftwareSourceCode",
        property: "author",
        reference: "_:author",
      }).message,
      '_:pkg: author references "_:author", which this graph does not define'
    );
    const issue = UnknownTerm.make({
      nodeId: "_:pkg",
      nodeType: "SoftwareSourceCode",
      term: "invented",
      kind: "property",
    });
    assert.match(issue.message, /defines no property "invented"$/);
    assert.match(NonConformantGraphError.make({ issues: [] }).message, /: no detail$/);
    assert.match(NonConformantGraphError.make({ issues: [issue] }).message, /defines no property "invented"$/);
    assert.match(NonConformantGraphError.make({ issues: [issue, issue] }).message, / \(and 1 more\)$/);
  })
);

it.effect("the Effect conformance gate returns the graph or all typed issues", () =>
  Effect.gen(function* () {
    const valid = yield* JsonLdDocument.build([SoftwareSourceCode.make({ "@id": "_:pkg" })]);
    const validate1 = yield* Conformance.validate(valid);
    assert.strictEqual(validate1, valid);
    const invalid = yield* JsonLdDocument.build([
      SoftwareSourceCode.make({ "@id": "_:pkg", additional: { softwareVersion: "1" } }),
    ]);
    const result2 = yield* Effect.result(Conformance.validate(invalid));
    assertFailure(result2, NonConformantGraphError.make({ issues: Conformance.check(invalid) }));
  })
);

it.effect("deprecated types close only the enabled deprecation gate", () =>
  Effect.sync(() => {
    const node = SoftwareSourceCode.make({ "@id": "_:old" });
    const graph = JsonLdDocument.make({ "@graph": [node] });
    Object.defineProperty(deliberatelyInvalid<object>(graph["@graph"][0]), "@type", { value: "UserLikes" });
    const issues = Conformance.check(graph);
    assert.deepStrictEqual(issues, [
      DeprecatedType.make({ nodeId: "_:old", nodeType: "UserLikes", supersededBy: "InteractionCounter" }),
    ]);
    assertFailure(
      Conformance.validateResult(graph, { deprecations: "report" }),
      NonConformantGraphError.make({ issues })
    );
  })
);
