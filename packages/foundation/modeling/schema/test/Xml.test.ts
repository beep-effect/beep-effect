import { $SchemaId } from "@beep/identity";
import { decodeXmlTextAs, XmlTextToUnknown } from "@beep/schema/Xml";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";
import XMLBuilder from "fast-xml-builder";

const decodeXmlTextToUnknown = S.decodeEffect(XmlTextToUnknown);
const encodeXmlTextToUnknown = S.encodeEffect(XmlTextToUnknown);

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
    "preserves text elements and nested text content without a key collision",
    Effect.fnUntraced(function* () {
      const document = yield* decodeXmlTextToUnknown(
        '<root><text lang="en">Outer &amp; content<text kind="nested">Inner &amp; content</text></text></root>'
      );

      expect(document).toEqual({
        root: {
          text: {
            lang: "en",
            "#text": "Outer & content",
            text: { kind: "nested", "#text": "Inner & content" },
          },
        },
      });

      const xml = new XMLBuilder({
        ignoreAttributes: false,
        attributeNamePrefix: "",
        textNodeName: "#text",
      }).build(document);

      expect(yield* decodeXmlTextToUnknown(xml)).toEqual(document);
    })
  );

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
      const result = yield* Effect.exit(decodeXmlTextToUnknown("<people><name>Ada</people>"));

      pipe(result, Exit.isFailure, assertTrue);
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
        encodeXmlTextToUnknown({
          people: {
            name: "Ada",
            age: "36",
          },
        })
      );

      pipe(result, Exit.isFailure, assertTrue);
      if (Exit.isFailure(result)) {
        const rendered = Cause.pretty(result.cause);

        expect(rendered).toContain("Encoding unknown values to XML text is not supported");
      }
    })
  );
});
