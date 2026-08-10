import { $SchemaId } from "@beep/identity";
import { decodeXmlTextAs, XmlTextToUnknown } from "@beep/schema/Xml";
import { describe, expect, it } from "@effect/vitest";
import { Cause, Effect, Exit } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("xml_test");

class PersonNode extends S.Class<PersonNode>($I`PersonNode`)(
  {
    name: S.String,
    age: S.FiniteFromString,
  },
  $I.annote("PersonNode", {
    description: "Parsed XML person node used in schema tests.",
  })
) {}

class PeopleDocument extends S.Class<PeopleDocument>($I`PeopleDocument`)(
  {
    people: PersonNode,
  },
  $I.annote("PeopleDocument", {
    description: "Typed XML document fixture used in schema tests.",
  })
) {}

describe("Xml", () => {
  it.effect(
    "decodes XML text into typed schema values",
    Effect.fnUntraced(function* () {
      const document = yield* decodeXmlTextAs(PeopleDocument)(`<people><name>Ada</name><age>36</age></people>`);

      expect(document).toBeInstanceOf(PeopleDocument);
      expect(document.people.name).toBe("Ada");
      expect(document.people.age).toBe(36);
    })
  );

  it.effect(
    "maps invalid XML into SchemaIssue.InvalidValue",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(S.decodeEffect(XmlTextToUnknown)("<people><name>Ada</people>"));

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Invalid XML input");
      }
    })
  );

  it.effect(
    "fails to encode unknown values back into XML text",
    Effect.fnUntraced(function* () {
      const result = yield* Effect.exit(
        S.encodeEffect(XmlTextToUnknown)({
          people: {
            name: "Ada",
            age: "36",
          },
        })
      );

      expect(Exit.isFailure(result)).toBe(true);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Encoding unknown values to XML text is not supported");
      }
    })
  );
});
