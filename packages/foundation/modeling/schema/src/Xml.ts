/**
 * XML parsing and schema transforms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Effect, flow, SchemaIssue, SchemaTransformation } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";

const $I = $SchemaId.create("Xml");

const encodeUnsupported = (value: unknown): Effect.Effect<string, SchemaIssue.Issue> =>
  Effect.fail(
    new SchemaIssue.InvalidValue(O.some(value), {
      message: "Encoding unknown values to XML text is not supported by XmlTextToUnknown.",
    })
  );

const makeXmlParser = () =>
  new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
    parseAttributeValue: false,
    parseTagValue: false,
    textNodeName: "text",
    trimValues: true,
  });

const invalidXmlInput = (content: string, message: string): SchemaIssue.InvalidValue =>
  new SchemaIssue.InvalidValue(O.some(content), {
    message,
  });

const invalidXmlValidationFailure = (content: string, cause: unknown): SchemaIssue.InvalidValue =>
  invalidXmlInput(content, P.isError(cause) ? `Invalid XML input (${cause.message}).` : "Invalid XML input.");

const validateXmlSyntax = (content: string) =>
  Effect.try({
    try: () => SyntaxValidator.validate(content),
    catch: (cause) => invalidXmlValidationFailure(content, cause),
  });

const decodeXmlUnknown = Effect.fn("Xml.decodeXmlUnknown")(function* (content: string) {
  const validation = yield* validateXmlSyntax(content);

  if (validation !== true) {
    const details = validation.err;

    return yield* Effect.fail(
      invalidXmlInput(content, `Invalid XML input (${details.msg} at ${details.line}:${details.col}).`)
    );
  }

  return yield* Effect.try({
    try: () => makeXmlParser().parse(content),
    catch: (cause) =>
      invalidXmlInput(content, P.isError(cause) ? `Invalid XML input (${cause.message}).` : "Invalid XML input."),
  });
});

/**
 * Schema transformation that decodes XML text into an unknown parsed document
 * using `fast-xml-parser`.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { XmlTextToUnknown } from "@beep/schema/Xml"
 *
 * const program = S.decodeUnknownEffect(XmlTextToUnknown)("<root><name>Beep</name></root>")
 * const parsed = await Effect.runPromise(program)
 * console.log(parsed)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const XmlTextToUnknown = S.String.pipe(
  S.decodeTo(
    S.Unknown,
    SchemaTransformation.transformOrFail({
      decode: decodeXmlUnknown,
      encode: encodeUnsupported,
    })
  ),
  $I.annoteSchema("XmlTextToUnknown", {
    description: "Schema transformation that parses XML text into unknown values.",
  })
);

/**
 * {@inheritDoc XmlTextToUnknown}
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { XmlTextToUnknown } from "@beep/schema/Xml"
 *
 * const program = S.decodeUnknownEffect(XmlTextToUnknown)("<root><name>Beep</name></root>")
 * const parsed: typeof XmlTextToUnknown.Type = await Effect.runPromise(program)
 * console.log(parsed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XmlTextToUnknown = typeof XmlTextToUnknown.Type;

/**
 * Builds a decoder that parses XML text and then decodes the result through a
 * target schema.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { decodeXmlTextAs } from "@beep/schema/Xml"
 *
 * const Doc = S.Struct({ root: S.Struct({ name: S.String }) })
 * const decodeDoc = decodeXmlTextAs(Doc)
 *
 * const program = decodeDoc("<root><name>Beep</name></root>")
 * const doc = await Effect.runPromise(program)
 * console.log(doc.root.name)
 * ```
 *
 * @param schema - Target schema to decode parsed XML document into.
 * @returns Decoder function from XML text to the target schema type.
 * @category utilities
 * @since 0.0.0
 */
export const decodeXmlTextAs = <Schema extends S.Top>(schema: Schema) => {
  const decodeXmlUnknownText = S.decodeUnknownEffect(XmlTextToUnknown);
  const decodeTargetSchema = S.decodeUnknownEffect(schema);
  const decodeTarget = Effect.fnUntraced(function* (input: Parameters<typeof decodeTargetSchema>[0]) {
    return yield* decodeTargetSchema(input);
  });

  return flow(decodeXmlUnknownText, Effect.flatMap(decodeTarget));
};
