/**
 * Schemas and data for the schema idiom hint: the kinds of value a field name
 * can read as, the tell table that maps each kind to its name pattern and the
 * shipped schemas to consider, and the hint itself.
 *
 * **Details**
 *
 * Only definition-site name tells are here. Use-site tells and escape hatches
 * were measured and excluded; see
 * `decisions/2026-11-26-schema-idiom-hints-name-tells-only.md`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { SchemaWireType } from "./SchemaIdioms.model.ts";

const $I = $RepoCliId.create("commands/SchemaIdioms/SchemaIdiomHints.model");

/**
 * **Example** (Name a tell kind)
 *
 * ```ts
 * import { SchemaIdiomKind } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * console.log(SchemaIdiomKind.Enum["byte-size"]) // "byte-size"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SchemaIdiomKind = LiteralKit([
  "instant",
  "duration",
  "byte-size",
  "url",
  "network-address",
  "port",
  "version",
]).pipe(
  $I.annoteSchema("SchemaIdiomKind", {
    description:
      "Kind of richer value a schema field's name reads as: an instant, a duration, a byte size, a URL, a network address, a port or a version.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SchemaIdiomKind = typeof SchemaIdiomKind.Type;

/**
 * **Example** (Describe a primitive head)
 *
 * ```ts
 * import { SchemaPrimitiveHead } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * const head = SchemaPrimitiveHead.make({ name: "NumberFromString", decodes: "number", wire: "string" })
 * console.log(head.wire) // "string"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaPrimitiveHead extends S.Opaque<SchemaPrimitiveHead, { readonly brand: unique symbol }>()(
  S.Struct({
    name: S.String,
    decodes: SchemaWireType,
    wire: SchemaWireType,
  }).pipe(
    $I.annoteSchema("SchemaPrimitiveHead", {
      description:
        "A shipped effect/Schema value that decodes to a primitive string, number or Date, with the wire type it reads.",
    })
  )
) {}

/**
 * The shipped schemas whose decoded value is a primitive `string`, `number`
 * or `Date`: a field whose schema starts from one of them "decodes to a
 * primitive".
 *
 * **Example** (Find the number heads)
 *
 * ```ts
 * import { SCHEMA_PRIMITIVE_HEADS } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as A from "effect/Array"
 *
 * const numbers = A.filter(SCHEMA_PRIMITIVE_HEADS, (head) => head.decodes === "number")
 * console.log(A.map(numbers, (head) => head.name)) // ["Number", "Finite", "Int", "Natural", "NumberFromString", "FiniteFromString"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SCHEMA_PRIMITIVE_HEADS: ReadonlyArray<SchemaPrimitiveHead> = [
  SchemaPrimitiveHead.make({ name: "String", decodes: "string", wire: "string" }),
  SchemaPrimitiveHead.make({ name: "NonEmptyString", decodes: "string", wire: "string" }),
  SchemaPrimitiveHead.make({ name: "Trim", decodes: "string", wire: "string" }),
  SchemaPrimitiveHead.make({ name: "Trimmed", decodes: "string", wire: "string" }),
  SchemaPrimitiveHead.make({ name: "Char", decodes: "string", wire: "string" }),
  SchemaPrimitiveHead.make({ name: "Number", decodes: "number", wire: "number" }),
  SchemaPrimitiveHead.make({ name: "Finite", decodes: "number", wire: "number" }),
  SchemaPrimitiveHead.make({ name: "Int", decodes: "number", wire: "number" }),
  SchemaPrimitiveHead.make({ name: "Natural", decodes: "number", wire: "number" }),
  SchemaPrimitiveHead.make({ name: "NumberFromString", decodes: "number", wire: "string" }),
  SchemaPrimitiveHead.make({ name: "FiniteFromString", decodes: "number", wire: "string" }),
  SchemaPrimitiveHead.make({ name: "Date", decodes: "date", wire: "date" }),
];

/**
 * **Example** (Describe a tell row)
 *
 * ```ts
 * import { SchemaIdiomTell } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * const tell = SchemaIdiomTell.make({
 *   kind: "port",
 *   readsAs: "a port",
 *   namePattern: "^port$|[a-z0-9]Port$",
 *   decodes: ["number"],
 *   richMarkers: ["Port"],
 *   shipped: ["Port"],
 * })
 *
 * console.log(new RegExp(tell.namePattern).test("listenPort")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIdiomTell extends S.Opaque<SchemaIdiomTell, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: SchemaIdiomKind,
    readsAs: S.String,
    namePattern: S.String,
    decodes: S.NonEmptyArray(SchemaWireType),
    richMarkers: S.Array(S.String),
    shipped: S.NonEmptyArray(S.String),
  }).pipe(
    $I.annoteSchema("SchemaIdiomTell", {
      description:
        "One row of the name-tell table: the field-name pattern (a regular expression source), the primitive decoded types it fires over, the identifier fragments that mean the schema is already rich, and the effect/Schema exports to suggest.",
    })
  )
) {}

/**
 * The name-tell table, in match order: the first row whose name pattern and
 * decoded primitive fit a field is the hint for that field.
 *
 * **Details**
 *
 * `instant` precedes `duration` so `startedAtMs` reads as an instant, not a
 * duration. The `network-address` row reads `host`, `hostname`, `ip` and
 * `ipAddress` alone or as a suffix, and `Address` only after a network word
 * (`hostAddress`, `socketAddress`, `peerAddress`, `bindAddress`,
 * `listenAddress`, `remoteAddress`, `serverAddress`, `clientAddress`). A bare
 * `address`, or a postal, billing, wallet or email address, is never hinted.
 * Suggested names are `effect/Schema`
 * export names without the `S.` prefix; a test asserts each one exists in the generated index.
 *
 * **Example** (Find the duration row)
 *
 * ```ts
 * import { SCHEMA_IDIOM_TELLS } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as A from "effect/Array"
 *
 * const duration = A.findFirst(SCHEMA_IDIOM_TELLS, (tell) => tell.kind === "duration")
 * console.log(duration) // Some with shipped ["DurationFromMillis", "DurationFromNanos", "DurationFromString"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SCHEMA_IDIOM_TELLS: ReadonlyArray<SchemaIdiomTell> = [
  SchemaIdiomTell.make({
    kind: "instant",
    readsAs: "an instant",
    namePattern: "^(?:timestamp|until|since)(?:Ms|Millis)?$|[a-z0-9](?:At|Timestamp|Until|Since)(?:Ms|Millis)?$",
    decodes: ["string", "number", "date"],
    richMarkers: ["DateTime"],
    shipped: ["DateTimeUtcFromString", "DateTimeUtcFromMillis", "DateTimeUtcFromDate"],
  }),
  SchemaIdiomTell.make({
    kind: "duration",
    readsAs: "a duration",
    namePattern:
      "^(?:ms|millis|seconds|secs|timeout|ttl|duration|interval|delay)$|[a-z0-9](?:Ms|Millis|Seconds|Secs|Timeout|Ttl|Duration|Interval|Delay)$",
    decodes: ["number"],
    richMarkers: ["Duration"],
    shipped: ["DurationFromMillis", "DurationFromNanos", "DurationFromString"],
  }),
  SchemaIdiomTell.make({
    kind: "byte-size",
    readsAs: "a byte size",
    namePattern: "^(?:bytes|byteSize)$|[a-z0-9](?:Bytes|ByteSize)$",
    decodes: ["number"],
    richMarkers: ["ByteSize"],
    shipped: ["ByteSizeFromNumber", "ByteSizeFromBigInt", "ByteSizeFromString"],
  }),
  SchemaIdiomTell.make({
    kind: "url",
    readsAs: "a URL",
    namePattern: "^(?:url|uri|href)$|[a-z0-9](?:Url|Uri|Href|URL|URI)$",
    decodes: ["string"],
    richMarkers: ["URL"],
    shipped: ["URLFromString"],
  }),
  SchemaIdiomTell.make({
    kind: "network-address",
    readsAs: "a network address",
    namePattern:
      "^(?:host|hostname|ip|ipAddress)$|[a-z0-9](?:Host|Hostname|Ip|IpAddress|IPAddress)$|^(?:host|socket|peer|bind|listen|remote|server|client)Address$|[a-z0-9](?:Host|Socket|Peer|Bind|Listen|Remote|Server|Client)Address$",
    decodes: ["string"],
    richMarkers: ["IpAddress", "HostFromString", "HostPort", "InetAddress"],
    shipped: ["IpAddressFromString", "HostFromString", "HostPortFromString"],
  }),
  SchemaIdiomTell.make({
    kind: "port",
    readsAs: "a port",
    namePattern: "^port$|[a-z0-9]Port$",
    decodes: ["number"],
    richMarkers: ["Port"],
    shipped: ["Port"],
  }),
  SchemaIdiomTell.make({
    kind: "version",
    readsAs: "a version",
    namePattern: "^version$|[a-z0-9]Version$",
    decodes: ["string"],
    richMarkers: ["SemVer"],
    shipped: ["SemVerFromString"],
  }),
];

/**
 * **Example** (Describe a byte-size hint)
 *
 * ```ts
 * import { SchemaIdiomHint } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * const hint = SchemaIdiomHint.make({
 *   line: 154,
 *   field: "diskFreeBytes",
 *   schemaIdentifier: O.some("DiskFreeBytes"),
 *   kind: "byte-size",
 *   readsAs: "a byte size",
 *   wire: "number",
 *   shipped: ["ByteSizeFromNumber", "ByteSizeFromBigInt", "ByteSizeFromString"],
 * })
 *
 * console.log(hint.field) // "diskFreeBytes"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIdiomHint extends S.Opaque<SchemaIdiomHint, { readonly brand: unique symbol }>()(
  S.Struct({
    line: S.Int,
    field: S.String,
    schemaIdentifier: S.Option(S.String),
    kind: SchemaIdiomKind,
    readsAs: S.String,
    wire: SchemaWireType,
    shipped: S.NonEmptyArray(S.String),
  }).pipe(
    $I.annoteSchema("SchemaIdiomHint", {
      description:
        "Advisory hint: a schema field on a 1-based line whose name reads as a richer value while its schema (followed through one same-file identifier when named) decodes to a primitive read from the given wire type.",
    })
  )
) {}

/**
 * **Example** (Ask for the hints of a just-written block)
 *
 * ```ts
 * import { SchemaIdiomHintInput } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * const input = SchemaIdiomHintInput.make({
 *   file: "src/Fleet.ts",
 *   text: 'import * as S from "effect/Schema"\nexport const Runner = S.Struct({ timeoutMs: S.Number })\n',
 *   written: O.some("export const Runner = S.Struct({ timeoutMs: S.Number })"),
 * })
 *
 * console.log(input.file) // "src/Fleet.ts"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaIdiomHintInput extends S.Opaque<SchemaIdiomHintInput, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String,
    text: S.String,
    written: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("SchemaIdiomHintInput", {
      description:
        "A TypeScript file's path and full text, and optionally the text just written into it; only fields on a line of the written text are hinted.",
    })
  )
) {}
