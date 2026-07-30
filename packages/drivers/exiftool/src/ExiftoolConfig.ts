/**
 * Perl `-config` template and XMP-beepQA provenance codecs for the native
 * ExifTool driver.
 *
 * The rendered config declares the custom `%Image::ExifTool::UserDefined::beepQA`
 * XMP namespace; the service materializes it once per layer into a scoped temp
 * file and passes it as the FIRST exiftool argument on every spawn.
 *
 * Verified against exiftool 13.55: `-j -G1` keeps the group name's exact case
 * (`XMP-beepQA`) but ucfirst-capitalizes tag names, so `sessionId` reads back
 * as `XMP-beepQA:SessionId`. {@link provenanceFromRawTags} encodes that answer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ExiftoolId } from "@beep/identity/packages";
import { Fn, LiteralKit, SchemaUtils } from "@beep/schema";
import { A, N, O, P, pipe, Str } from "@beep/utils";
import * as S from "effect/Schema";
import { BeepQaProvenance, EpochMilliseconds, TagAssignment } from "./Exiftool.models.ts";

const $I = $ExiftoolId.create("ExiftoolConfig");

/**
 * Canonical XMP namespace URI for beep QA provenance.
 *
 * @example
 * ```ts
 * import { BEEP_QA_XMP_NAMESPACE_URI } from "@beep/exiftool"
 *
 * console.log(BEEP_QA_XMP_NAMESPACE_URI)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BEEP_QA_XMP_NAMESPACE_URI = "https://ns.beep.sh/qa/1.0/";

/**
 * XMP namespace prefix registered by the rendered exiftool config.
 *
 * @example
 * ```ts
 * import { BEEP_QA_XMP_NAMESPACE_PREFIX } from "@beep/exiftool"
 *
 * console.log(BEEP_QA_XMP_NAMESPACE_PREFIX)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BEEP_QA_XMP_NAMESPACE_PREFIX = "beepQA";

/**
 * Family-1 group name exiftool uses for beep QA tags in `-G1` output and
 * group-qualified tag assignments.
 *
 * @example
 * ```ts
 * import { BEEP_QA_XMP_GROUP } from "@beep/exiftool"
 *
 * console.log(BEEP_QA_XMP_GROUP)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BEEP_QA_XMP_GROUP = `XMP-${BEEP_QA_XMP_NAMESPACE_PREFIX}`;

/**
 * Tag names declared inside the XMP-beepQA namespace.
 *
 * @example
 * ```ts
 * import { BeepQaTagName } from "@beep/exiftool"
 *
 * console.log(BeepQaTagName.Options)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BeepQaTagName = LiteralKit([
  "sessionId",
  "scenarioName",
  "actionId",
  "commitSha",
  "capturedAtEpochMs",
  "sourceVideo",
  "clockOffsetMs",
  "toolVersions",
]).pipe(
  $I.annoteSchema("BeepQaTagName", {
    description: "Tag names declared inside the XMP-beepQA namespace.",
  })
);

/**
 * Tag names declared inside the XMP-beepQA namespace.
 *
 * @example
 * ```ts
 * import type { BeepQaTagName } from "@beep/exiftool"
 *
 * const tagName: BeepQaTagName = "sessionId"
 * console.log(tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BeepQaTagName = typeof BeepQaTagName.Type;

/**
 * XMP namespace prefix usable as a bare Perl identifier in the rendered config.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { XmpNamespacePrefix } from "@beep/exiftool"
 *
 * const prefix = S.decodeUnknownSync(XmpNamespacePrefix)("beepQA")
 * console.log(prefix)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XmpNamespacePrefix = S.String.check(
  S.isPattern(/^[A-Za-z][A-Za-z0-9]*$/, {
    identifier: $I`XmpNamespacePrefixPatternCheck`,
    title: "XMP Namespace Prefix Pattern",
    description: "Namespace prefixes must be alphanumeric Perl bareword identifiers.",
    message: "Expected an alphanumeric namespace prefix starting with a letter",
  })
).pipe(
  $I.annoteSchema("XmpNamespacePrefix", {
    description: "XMP namespace prefix usable as a bare Perl identifier.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * XMP namespace prefix usable as a bare Perl identifier in the rendered config.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { XmpNamespacePrefix } from "@beep/exiftool"
 *
 * const prefix: XmpNamespacePrefix = S.decodeUnknownSync(XmpNamespacePrefix)("beepQA")
 * console.log(prefix)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XmpNamespacePrefix = typeof XmpNamespacePrefix.Type;

/**
 * XMP property name usable as a bare Perl hash key in the rendered config.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { XmpPropertyName } from "@beep/exiftool"
 *
 * const name = S.decodeUnknownSync(XmpPropertyName)("sessionId")
 * console.log(name)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XmpPropertyName = S.String.check(
  S.isPattern(/^[A-Za-z_][A-Za-z0-9_]*$/, {
    identifier: $I`XmpPropertyNamePatternCheck`,
    title: "XMP Property Name Pattern",
    description: "Property names must be Perl bareword identifiers.",
    message: "Expected a property name matching ^[A-Za-z_][A-Za-z0-9_]*$",
  })
).pipe(
  $I.annoteSchema("XmpPropertyName", {
    description: "XMP property name usable as a bare Perl hash key.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * XMP property name usable as a bare Perl hash key in the rendered config.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { XmpPropertyName } from "@beep/exiftool"
 *
 * const name: XmpPropertyName = S.decodeUnknownSync(XmpPropertyName)("sessionId")
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XmpPropertyName = typeof XmpPropertyName.Type;

/**
 * XMP namespace URI safe to inline inside a single-quoted Perl string.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { XmpNamespaceUri } from "@beep/exiftool"
 *
 * const uri = S.decodeUnknownSync(XmpNamespaceUri)("https://ns.beep.sh/qa/1.0/")
 * console.log(uri)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const XmpNamespaceUri = S.String.check(
  S.isPattern(/^[^'\\]+$/, {
    identifier: $I`XmpNamespaceUriPatternCheck`,
    title: "XMP Namespace URI Pattern",
    description: "Namespace URIs must not contain single quotes or backslashes.",
    message: "Expected a namespace URI without single quotes or backslashes",
  })
).pipe(
  $I.annoteSchema("XmpNamespaceUri", {
    description: "XMP namespace URI safe to inline inside a single-quoted Perl string.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * XMP namespace URI safe to inline inside a single-quoted Perl string.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { XmpNamespaceUri } from "@beep/exiftool"
 *
 * const uri: XmpNamespaceUri = S.decodeUnknownSync(XmpNamespaceUri)("https://ns.beep.sh/qa/1.0/")
 * console.log(uri)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type XmpNamespaceUri = typeof XmpNamespaceUri.Type;

/**
 * Options for rendering the exiftool user-defined XMP namespace config.
 *
 * @example
 * ```ts
 * import { RenderBeepQaConfigOptions } from "@beep/exiftool"
 *
 * const options = RenderBeepQaConfigOptions.make({})
 * console.log(options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RenderBeepQaConfigOptions extends S.Class<RenderBeepQaConfigOptions>($I`RenderBeepQaConfigOptions`)(
  {
    namespacePrefix: XmpNamespacePrefix.pipe(
      SchemaUtils.withKeyDefaults(BEEP_QA_XMP_NAMESPACE_PREFIX),
      $I.annoteKey("RenderBeepQaConfigOptions.namespacePrefix", {
        description: "XMP namespace prefix registered by the rendered config.",
      })
    ),
    namespaceUri: XmpNamespaceUri.pipe(
      SchemaUtils.withKeyDefaults(BEEP_QA_XMP_NAMESPACE_URI),
      $I.annoteKey("RenderBeepQaConfigOptions.namespaceUri", {
        description: "XMP namespace URI registered by the rendered config.",
      })
    ),
    propertyNames: S.Array(XmpPropertyName).pipe(
      SchemaUtils.withKeyDefaults(BeepQaTagName.Options),
      $I.annoteKey("RenderBeepQaConfigOptions.propertyNames", {
        description: "String-writable property names declared inside the namespace.",
      })
    ),
  },
  $I.annote("RenderBeepQaConfigOptions", {
    description: "Options for rendering the exiftool user-defined XMP namespace config.",
  })
) {}

const RenderBeepQaExiftoolConfig = Fn({
  input: RenderBeepQaConfigOptions,
  output: S.String,
}).pipe(
  $I.annoteSchema("RenderBeepQaExiftoolConfig", {
    description: "Schema-backed renderer for the exiftool user-defined XMP namespace config.",
  })
);

/**
 * Render the Perl `-config` source declaring the XMP-beepQA namespace.
 *
 * @example
 * ```ts
 * import { RenderBeepQaConfigOptions, renderBeepQaExiftoolConfig } from "@beep/exiftool"
 *
 * const source = renderBeepQaExiftoolConfig(RenderBeepQaConfigOptions.make({}))
 * console.log(source)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderBeepQaExiftoolConfig: (options: RenderBeepQaConfigOptions) => string =
  RenderBeepQaExiftoolConfig.implementSync((options) => {
    const table = `Image::ExifTool::UserDefined::${options.namespacePrefix}`;
    const propertyLines = pipe(
      options.propertyNames,
      A.map((name) => `    ${name} => { },`),
      A.join("\n")
    );

    return `%${table} = (
    GROUPS => { 0 => 'XMP', 1 => 'XMP-${options.namespacePrefix}', 2 => 'Image' },
    NAMESPACE => { '${options.namespacePrefix}' => '${options.namespaceUri}' },
    WRITABLE => 'string',
${propertyLines}
);

%Image::ExifTool::UserDefined = (
    'Image::ExifTool::XMP::Main' => {
        ${options.namespacePrefix} => {
            SubDirectory => {
                TagTable => '${table}',
            },
        },
    },
);

1;  # end
`;
  });

const encodeJsonText = S.encodeUnknownSync(S.UnknownFromJsonString);
const decodeToolVersions = S.decodeUnknownOption(S.fromJsonString(S.Record(S.String, S.String)));

const qualifiedTagName = (name: BeepQaTagName): string => `${BEEP_QA_XMP_GROUP}:${name}`;

/**
 * Group-qualified `-j -G1` JSON key a beep QA tag reads back under.
 *
 * exiftool ucfirst-capitalizes tag names in its output, so `sessionId` reads
 * back as `XMP-beepQA:SessionId` (verified against exiftool 13.55).
 *
 * @example
 * ```ts
 * import { beepQaRawTagKey } from "@beep/exiftool"
 *
 * console.log(beepQaRawTagKey("sessionId"))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const beepQaRawTagKey = (name: BeepQaTagName): string => `${BEEP_QA_XMP_GROUP}:${Str.capitalize(name)}`;

/**
 * Encode a provenance payload into ordered XMP-beepQA tag assignments.
 *
 * Required fields render first; `None` optional fields are omitted entirely,
 * and `toolVersions` is embedded as a JSON string value.
 *
 * @example
 * ```ts
 * import { BeepQaProvenance, provenanceTagAssignments } from "@beep/exiftool"
 *
 * const assignments = provenanceTagAssignments(BeepQaProvenance.make({
 *   actionId: "act-9",
 *   capturedAtEpochMs: 1753900000000,
 *   scenarioName: "sash-drag",
 *   sessionId: "qa-round-1-1754000000000"
 * }))
 * console.log(assignments)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const provenanceTagAssignments = (provenance: BeepQaProvenance): ReadonlyArray<TagAssignment> => {
  const required = [
    TagAssignment.make({ tagName: qualifiedTagName("sessionId"), value: provenance.sessionId }),
    TagAssignment.make({ tagName: qualifiedTagName("scenarioName"), value: provenance.scenarioName }),
    TagAssignment.make({ tagName: qualifiedTagName("actionId"), value: provenance.actionId }),
    TagAssignment.make({
      tagName: qualifiedTagName("capturedAtEpochMs"),
      value: `${provenance.capturedAtEpochMs}`,
    }),
  ];
  const optional = A.getSomes([
    O.map(provenance.commitSha, (value) => TagAssignment.make({ tagName: qualifiedTagName("commitSha"), value })),
    O.map(provenance.sourceVideo, (value) => TagAssignment.make({ tagName: qualifiedTagName("sourceVideo"), value })),
    O.map(provenance.clockOffsetMs, (value) =>
      TagAssignment.make({ tagName: qualifiedTagName("clockOffsetMs"), value: `${value}` })
    ),
    O.map(provenance.toolVersions, (value) =>
      TagAssignment.make({ tagName: qualifiedTagName("toolVersions"), value: encodeJsonText(value) })
    ),
  ]);

  return A.appendAll(required, optional);
};

const rawTextAt = (raw: Readonly<Record<string, unknown>>, name: BeepQaTagName): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(raw[beepQaRawTagKey(name)]),
    O.flatMap((value) =>
      P.isString(value) ? O.some(value) : P.isNumber(value) && Number.isFinite(value) ? O.some(`${value}`) : O.none()
    )
  );

const rawNumberAt = (raw: Readonly<Record<string, unknown>>, name: BeepQaTagName): O.Option<number> =>
  pipe(
    O.fromUndefinedOr(raw[beepQaRawTagKey(name)]),
    O.flatMap((value) =>
      P.isNumber(value) && Number.isFinite(value)
        ? O.some(value)
        : P.isString(value)
          ? pipe(
              N.parse(value),
              O.filter((parsed) => Number.isFinite(parsed))
            )
          : O.none()
    )
  );

/**
 * Decode a provenance payload back out of a raw `-j -G1` exiftool record.
 *
 * Reads the ucfirst-capitalized `XMP-beepQA:*` keys exiftool emits (numeric
 * values tolerated as JSON numbers or text) and returns `None` when any
 * required field is missing.
 *
 * @example
 * ```ts
 * import { provenanceFromRawTags } from "@beep/exiftool"
 *
 * const provenance = provenanceFromRawTags({
 *   "XMP-beepQA:ActionId": "act-9",
 *   "XMP-beepQA:CapturedAtEpochMs": 1753900000000,
 *   "XMP-beepQA:ScenarioName": "sash-drag",
 *   "XMP-beepQA:SessionId": "qa-round-1-1754000000000"
 * })
 * console.log(provenance)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const provenanceFromRawTags = (raw: Readonly<Record<string, unknown>>): O.Option<BeepQaProvenance> =>
  pipe(
    O.all({
      actionId: rawTextAt(raw, "actionId"),
      capturedAtEpochMs: pipe(rawNumberAt(raw, "capturedAtEpochMs"), O.flatMap(EpochMilliseconds.decodeOption)),
      scenarioName: rawTextAt(raw, "scenarioName"),
      sessionId: rawTextAt(raw, "sessionId"),
    }),
    O.map((required) =>
      BeepQaProvenance.make({
        ...required,
        clockOffsetMs: rawNumberAt(raw, "clockOffsetMs"),
        commitSha: rawTextAt(raw, "commitSha"),
        sourceVideo: rawTextAt(raw, "sourceVideo"),
        toolVersions: pipe(rawTextAt(raw, "toolVersions"), O.flatMap(decodeToolVersions)),
      })
    )
  );
