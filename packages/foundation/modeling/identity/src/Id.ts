/**
 * Hierarchical identity system for the `@beep` namespace.
 *
 * Provides composable, type-safe identity strings and symbols for schema
 * annotations, error tagging, and service identification throughout the
 * Effect codebase. Identities follow a `@beep/{package}/{path}` convention
 * and are validated at construction time.
 *
 * @example
 * ```typescript
 * import { make } from "@beep/identity"
 *
 * // Create a package-level identity composer
 * const { $MyPkgId } = make("my-pkg")
 *
 * // Derive child identifiers for schemas and services
 * const userId = $MyPkgId.make("UserId")
 * const sym = $MyPkgId.symbol()
 *
 * console.log(userId)// "@beep/my-pkg/UserId"
 * console.log(sym)// Symbol.for("@beep/my-pkg")
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Function as Fn, flow, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { TString } from "@beep/types";
import type * as Multipart_ from "effect/unstable/http/Multipart";
import type { Get, Paths } from "type-fest";
import type { CoreVocab, VocabShape } from "./Vocab.ts";

const BeepNamespace = S.Literal("@beep");
type BeepNamespace = typeof BeepNamespace.Type;

const BeepBase = S.Literal("beep");
type BeepBase = typeof BeepBase.Type;

const IdentityVersion = S.Literal("0.0.0");
type DefaultIdentityAuthority = "https://ns.beep.sh/";
type DefaultIdentityPrefix = "beep";

const isBeepNamespace = S.is(BeepNamespace);
const isBeepBase = S.is(BeepBase);

const beepNamespace = S.decodeUnknownSync(BeepNamespace)("@beep");
const beepBase = S.decodeUnknownSync(BeepBase)("beep");
const MODULE_CHARACTERS = /^[A-Za-z0-9_-]+$/;
const MODULE_LEADING_ALPHA = /^[A-Za-z]/;
const BASE_CHARACTERS = /^[A-Za-z0-9](?:[A-Za-z0-9_-]*[A-Za-z0-9])?$/;
const SCHEMA_PROTOCOL_KEYS: ReadonlyArray<PropertyKey> = [
  "~effect/Schema/Schema",
  "annotate",
  "annotateKey",
  "ast",
  "check",
  "make",
  "makeEffect",
  "makeOption",
  "pipe",
  "rebuild",
];

const preserveSchemaStatics = <Schema extends S.Top>(
  source: Schema,
  annotated: Schema["Rebuild"]
): AnnotatedSchema<Schema> => {
  for (const key of Reflect.ownKeys(source)) {
    if (A.contains(SCHEMA_PROTOCOL_KEYS, key) || Reflect.getOwnPropertyDescriptor(annotated, key) !== undefined) {
      continue;
    }

    const descriptor = Reflect.getOwnPropertyDescriptor(source, key);

    if (descriptor !== undefined) {
      Reflect.defineProperty(annotated, key, descriptor);
    }
  }

  return annotated as AnnotatedSchema<Schema>;
};

/**
 * Error thrown when an identity template tag receives interpolation values.
 *
 * Identity template tags must be called with a single static string literal,
 * for example by calling the `$I` template tag with a static segment.
 * Passing interpolated expressions is forbidden because identity strings
 * must be statically deterministic.
 *
 * @example
 * ```typescript
 * import { make, IdentityInterpolationError } from "@beep/identity"
 *
 * const { $MyPkgId } = make("my-pkg")
 *
 * try {
 *   $MyPkgId`User${"Name"}`
 * } catch (error) {
 *   console.log(error instanceof IdentityInterpolationError)
 * }
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export class IdentityInterpolationError extends S.TaggedErrorClass<IdentityInterpolationError>(
  "@beep/identity/errors/IdentityInterpolationError"
)(
  "IdentityInterpolationError",
  {},
  {
    title: "Identity Interpolation Error",
    description: "Identity template tags do not allow interpolations.",
  }
) {
  override get message() {
    return "Identity template tags do not allow interpolations.";
  }
}

/**
 * Error thrown when an identity template tag receives more or fewer than one literal segment.
 *
 * Template tags must be called with exactly one static string segment.
 *
 * @example
 * ```typescript
 * import { IdentitySegmentCountError } from "@beep/identity"
 *
 * const error = IdentitySegmentCountError.make()
 * console.log(error.message) // "Identity template tags must use a single literal segment."
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export class IdentitySegmentCountError extends S.TaggedErrorClass<IdentitySegmentCountError>(
  "@beep/identity/errors/IdentitySegmentCountError"
)(
  "IdentitySegmentCountError",
  {},
  {
    title: "Identity Segment Count Error",
    description: "Identity template tags must use a single literal segment.",
  }
) {
  /**
   * Human-readable error message.
   *
   * @since 0.0.0
   * @category getters
   */
  override get message(): string {
    return "Identity template tags must use a single literal segment.";
  }
}

/**
 * Current version of the `@beep/identity` package.
 *
 * @example
 * ```typescript
 * import { VERSION } from "@beep/identity"
 *
 * console.log(VERSION) // "0.0.0"
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const VERSION = S.decodeUnknownSync(IdentityVersion)("0.0.0");

/**
 * Type-level constraint ensuring an identity segment does not start or end with a slash.
 *
 * Resolves to `never` when the segment starts or ends with `/`, preventing
 * invalid identity paths at compile time.
 *
 * @example
 * ```typescript
 * import type { SegmentValue } from "@beep/identity"
 *
 * type Valid = SegmentValue<"UserService">
 * type Invalid = SegmentValue<"/leading">
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SegmentValue<S extends TString.NonEmpty> = S extends `/${string}`
  ? never
  : S extends `${string}/`
    ? never
    : S;

type InvalidModuleChar =
  | "/"
  | "\\"
  | "."
  | ":"
  | ";"
  | ","
  | "'"
  | '"'
  | "["
  | "]"
  | "{"
  | "}"
  | "("
  | ")"
  | "@"
  | "#"
  | "$"
  | "%"
  | "^"
  | "&"
  | "*"
  | "+"
  | "="
  | "!"
  | "~"
  | "|"
  | "?"
  | "<"
  | ">"
  | " "
  | "\t"
  | "\n"
  | "\r";

type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";

type PascalCaseWord<Word extends string> = Word extends "" ? "" : Capitalize<Lowercase<Word>>;

type TitleWord<Word extends string> = Capitalize<Word>;

type NormalizeTitleSeparators<Value extends string> = Value extends `${infer Head}_${infer Tail}`
  ? `${NormalizeTitleSeparators<Head>} ${NormalizeTitleSeparators<Tail>}`
  : Value extends `${infer Head}-${infer Tail}`
    ? `${NormalizeTitleSeparators<Head>} ${NormalizeTitleSeparators<Tail>}`
    : Value;

type TrimTitleSpaces<Value extends string> = Value extends ` ${infer Rest}`
  ? TrimTitleSpaces<Rest>
  : Value extends `${infer Rest} `
    ? TrimTitleSpaces<Rest>
    : Value;

type SplitTitleWords<Value extends string> = Value extends `${infer Head} ${infer Tail}`
  ? Head extends ""
    ? SplitTitleWords<Tail>
    : readonly [Head, ...SplitTitleWords<Tail>]
  : Value extends ""
    ? readonly []
    : readonly [Value];

type JoinTitleWords<Words extends ReadonlyArray<string>> = Words extends readonly [infer Head extends string]
  ? TitleWord<Head>
  : Words extends readonly [infer Head extends string, ...infer Tail extends ReadonlyArray<string>]
    ? `${TitleWord<Head>} ${JoinTitleWords<Tail>}`
    : "";

type IdentityTail<Value extends string> = string extends Value
  ? string
  : Value extends "@beep"
    ? ""
    : Value extends `@beep/${infer Tail}`
      ? Tail
      : Value extends `@${string}/${infer Tail}`
        ? Tail
        : Value;

type SlugSeparator = "/" | "." | "_" | "-" | " ";
type SlugState = "start" | "separator" | "lower-or-digit" | "other";
type IsUppercaseLetter<Character extends string> =
  Character extends Lowercase<Character> ? false : Character extends Uppercase<Character> ? true : false;
type IsLowercaseLetterOrDigit<Character extends string> = Character extends Digit
  ? true
  : Character extends Lowercase<Character>
    ? Character extends Uppercase<Character>
      ? false
      : true
    : false;
type SlugStateAfter<Character extends string> =
  IsLowercaseLetterOrDigit<Character> extends true ? "lower-or-digit" : "other";
type SlugJoin<
  Value extends string,
  State extends SlugState = "start",
  Acc extends string = "",
> = Value extends `${infer Character}${infer Rest}`
  ? Character extends SlugSeparator
    ? State extends "start" | "separator"
      ? SlugJoin<Rest, "separator", Acc>
      : SlugJoin<Rest, "separator", `${Acc}-`>
    : IsUppercaseLetter<Character> extends true
      ? State extends "lower-or-digit"
        ? SlugJoin<Rest, "other", `${Acc}-${Lowercase<Character>}`>
        : SlugJoin<Rest, "other", `${Acc}${Lowercase<Character>}`>
      : SlugJoin<Rest, SlugStateAfter<Character>, `${Acc}${Lowercase<Character>}`>
  : Acc;
type TrimSlugHyphens<Value extends string> = Value extends `-${infer Rest}`
  ? TrimSlugHyphens<Rest>
  : Value extends `${infer Rest}-`
    ? TrimSlugHyphens<Rest>
    : Value;
type StripLeadingAt<Value extends string> = Value extends `@${infer Rest}` ? Rest : Value;

/**
 * Derive a human-readable title from a kebab-case or snake_case identifier.
 *
 * Converts `"my-service"` to `"My Service"` and `"user_account"` to `"User Account"`.
 *
 * @example
 * ```typescript
 * import type { TitleFromIdentifier } from "@beep/identity"
 *
 * type Title = TitleFromIdentifier<"my-service"> // "My Service"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TitleFromIdentifier<Identifier extends string> = JoinTitleWords<
  SplitTitleWords<TrimTitleSpaces<NormalizeTitleSeparators<Identifier>>>
>;

/**
 * Derive an exact IRI literal from an identity path and authority prefix.
 *
 * Converts `"@beep/a/b"` to `"https://ns.beep.sh/a/b"` when the authority is
 * `"https://ns.beep.sh/"`. Widened string inputs intentionally widen to `string`.
 *
 * @example
 * ```typescript
 * import type { IriFromIdentity } from "@beep/identity"
 *
 * type Iri = IriFromIdentity<"https://ns.beep.sh/", "@beep/schema/Entity">
 * const iri: Iri = "https://ns.beep.sh/schema/Entity"
 * console.log(iri)
 * ```
 *
 * @since 0.0.0
 * @category type-level
 */
export type IriFromIdentity<Authority extends string, Identity extends string> = string extends Authority
  ? string
  : string extends Identity
    ? string
    : IdentityTail<Identity> extends ""
      ? Authority
      : `${Authority}${IdentityTail<Identity>}`;

/**
 * Derive an exact CURIE literal from an identity path and owned prefix.
 *
 * Converts `"@beep/a/b"` to `"beep:a/b"` when the prefix is `"beep"`. Widened
 * string inputs intentionally widen to `string`.
 *
 * @example
 * ```typescript
 * import type { CurieFromIdentity } from "@beep/identity"
 *
 * type Curie = CurieFromIdentity<"beep", "@beep/schema/Entity">
 * const curie: Curie = "beep:schema/Entity"
 * console.log(curie)
 * ```
 *
 * @since 0.0.0
 * @category type-level
 */
export type CurieFromIdentity<Prefix extends string, Identity extends string> = string extends Prefix
  ? string
  : string extends Identity
    ? string
    : IdentityTail<Identity> extends ""
      ? `${Prefix}:`
      : `${Prefix}:${IdentityTail<Identity>}`;

/**
 * Derive a kebab-case slug literal from an identity or identifier.
 *
 * The type-level transform mirrors the runtime slug getter for static identity
 * paths, including slash, dot, underscore, hyphen, space, and lower-to-upper
 * word boundaries.
 *
 * @example
 * ```typescript
 * import type { SlugFromIdentifier } from "@beep/identity"
 *
 * type Slug = SlugFromIdentifier<"@beep/Ontology.models/HttpUrl">
 * const slug: Slug = "beep-ontology-models-http-url"
 * console.log(slug)
 * ```
 *
 * @since 0.0.0
 * @category type-level
 */
export type SlugFromIdentifier<Identifier extends string> = string extends Identifier
  ? string
  : TrimSlugHyphens<SlugJoin<StripLeadingAt<Identifier>>>;

type PascalCaseValue<Value extends string> = Value extends `${infer A}-${infer B}-${infer C}-${infer D}`
  ? `${PascalCaseWord<A>}${PascalCaseWord<B>}${PascalCaseWord<C>}${PascalCaseWord<D>}`
  : Value extends `${infer A}-${infer B}-${infer C}`
    ? `${PascalCaseWord<A>}${PascalCaseWord<B>}${PascalCaseWord<C>}`
    : Value extends `${infer A}-${infer B}`
      ? `${PascalCaseWord<A>}${PascalCaseWord<B>}`
      : Value extends `${infer A}_${infer B}_${infer C}_${infer D}`
        ? `${PascalCaseWord<A>}${PascalCaseWord<B>}${PascalCaseWord<C>}${PascalCaseWord<D>}`
        : Value extends `${infer A}_${infer B}_${infer C}`
          ? `${PascalCaseWord<A>}${PascalCaseWord<B>}${PascalCaseWord<C>}`
          : Value extends `${infer A}_${infer B}`
            ? `${PascalCaseWord<A>}${PascalCaseWord<B>}`
            : PascalCaseWord<Value>;

type InvalidModulePrefix<S extends string> = S extends `${Digit}${string}` | `-${string}` | `_${string}` ? true : false;

type HasInvalidModuleChar<S extends string> = S extends `${string}${InvalidModuleChar}${string}` ? true : false;

/**
 * Type-level constraint for module-safe identity segments.
 *
 * In addition to the basic {@link SegmentValue} rules, module segments must start
 * with an alphabetic character and contain only alphanumerics, hyphens, or underscores.
 * Resolves to `never` when violated.
 *
 * @example
 * ```typescript
 * import type { ModuleSegmentValue } from "@beep/identity"
 *
 * type Valid = ModuleSegmentValue<"auth">
 * type Invalid = ModuleSegmentValue<"1bad">
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ModuleSegmentValue<S extends TString.NonEmpty> =
  InvalidModulePrefix<S> extends true ? never : HasInvalidModuleChar<S> extends true ? never : SegmentValue<S>;

/**
 * Derive a PascalCase accessor name suffixed with `Id` from a module segment.
 *
 * `"my-service"` becomes `"MyServiceId"`.
 *
 * @example
 * ```typescript
 * import type { ModuleAccessor } from "@beep/identity"
 *
 * type Acc = ModuleAccessor<"my-service"> // "MyServiceId"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type ModuleAccessor<S extends TString.NonEmpty> = `${PascalCaseValue<ModuleSegmentValue<S>>}Id`;

/**
 * Derive a `$`-prefixed PascalCase accessor key from a module segment.
 *
 * `"my-service"` becomes `"$MyServiceId"`.
 *
 * @example
 * ```typescript
 * import type { TaggedAccessor } from "@beep/identity"
 *
 * type Tag = TaggedAccessor<"my-service"> // "$MyServiceId"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TaggedAccessor<S extends TString.NonEmpty> = `$${ModuleAccessor<S>}`;

/**
 * Branded string type for identity values, preventing accidental use of raw strings.
 *
 * @example
 * ```typescript
 * import type { IdentityString } from "@beep/identity"
 *
 * declare const id: IdentityString<"@beep/utils/Service">
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IdentityString<Value extends string> = Value & {
  readonly __brand: unique symbol;
};

/**
 * Branded symbol type for identity values, created via `Symbol.for` for interning.
 *
 * @example
 * ```typescript
 * import type { IdentitySymbol } from "@beep/identity"
 *
 * declare const sym: IdentitySymbol<"@beep/utils">
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IdentitySymbol<Value extends string> = symbol & {
  readonly description: Value;
};

/**
 * Additional schema annotation fields that identity annotation helpers accept.
 *
 * Mirrors `S.Annotations.Bottom` so callers can supply `description`, `documentation`,
 * and other Effect Schema annotation keys alongside identity metadata.
 *
 * @example
 * ```typescript
 * import type { SchemaAnnotationExtras } from "@beep/identity"
 *
 * type Extras = SchemaAnnotationExtras<string>
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SchemaAnnotationExtras<
  SchemaType,
  TypeParameters extends ReadonlyArray<S.Top> = readonly [],
> = S.Annotations.Bottom<SchemaType, TypeParameters>;

/**
 * Annotation fields accepted by `annoteKey`, mirroring `S.Annotations.Key`.
 *
 * @example
 * ```typescript
 * import type { KeyAnnotationExtras } from "@beep/identity"
 *
 * type Extras = KeyAnnotationExtras<string>
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type KeyAnnotationExtras<SchemaType> = S.Annotations.Key<SchemaType>;

/**
 * Mirrors the raw HTTP encoding annotation shape used by Effect's HttpApiSchema.
 *
 * The installed `effect@4.0.0-beta.28` runtime supports `~httpApiEncoding`, but
 * its published `.d.ts` does not currently export the upstream `Encoding` alias.
 *
 * @example
 * ```typescript
 * import type { HttpApiEncoding } from "@beep/identity"
 *
 * const enc: HttpApiEncoding = { _tag: "Json", contentType: "application/json" }
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type HttpApiEncoding =
  | {
      readonly _tag: "Multipart";
      readonly mode: "buffered" | "stream";
      readonly contentType: string;
      readonly limits?: Multipart_.withLimits.Options | undefined;
    }
  | {
      readonly _tag: "Json" | "FormUrlEncoded" | "Uint8Array" | "Text";
      readonly contentType: string;
    };

/**
 * Annotation fields accepted by `annoteHttp`, extending schema extras with HTTP API metadata.
 *
 * Supports optional `httpApiStatus` and `~httpApiEncoding` for Effect HTTP API annotations.
 *
 * @example
 * ```typescript
 * import type { HttpAnnotationExtras } from "@beep/identity"
 *
 * type Extras = HttpAnnotationExtras<string>
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type HttpAnnotationExtras<
  SchemaType,
  TypeParameters extends ReadonlyArray<S.Top> = readonly [],
> = SchemaAnnotationExtras<SchemaType, TypeParameters> & {
  readonly httpApiStatus?: number | undefined;
  readonly "~httpApiEncoding"?: HttpApiEncoding | undefined;
};

/**
 * Union of all annotation extras accepted by the `annote` family of helpers.
 *
 * Combines key-level and HTTP-level annotation fields into a single constraint.
 *
 * @example
 * ```typescript
 * import type { IdentityAnyAnnotationExtras } from "@beep/identity"
 *
 * type Extras = IdentityAnyAnnotationExtras<string>
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IdentityAnyAnnotationExtras<
  SchemaType,
  TypeParameters extends ReadonlyArray<S.Top> = readonly [],
> = KeyAnnotationExtras<SchemaType> & HttpAnnotationExtras<SchemaType, TypeParameters>;

/**
 * Fully resolved identity annotation record applied to Effect schemas.
 *
 * Contains a full-path `identifier` string, an interned `schemaId` symbol, and a
 * human-readable `title` derived from the local identifier segment.
 *
 * @example
 * ```typescript
 * import type { IdentityAnnotation } from "@beep/identity"
 *
 * type Ann = IdentityAnnotation<"@beep/utils/User", "User">
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IdentityAnnotation<
  Value extends string,
  Identifier extends string,
  Authority extends string | undefined = undefined,
  Prefix extends string | undefined = undefined,
> = S.Annotations.Annotations & {
  readonly identifier: IdentityString<Value>;
  readonly schemaId: IdentitySymbol<Value>;
  readonly title: TitleFromIdentifier<Identifier>;
} & IdentityProjection<Value, Authority, Prefix>;

type IdentityProjection<
  Value extends string,
  Authority extends string | undefined,
  Prefix extends string | undefined,
> = Authority extends string
  ? Prefix extends string
    ? {
        readonly iri: IriFromIdentity<Authority, Value>;
        readonly curie: CurieFromIdentity<Prefix, Value>;
      }
    : {
        readonly iri?: undefined;
        readonly curie?: undefined;
      }
  : {
      readonly iri?: undefined;
      readonly curie?: undefined;
    };

type BoundComposerIri<Authority extends string | undefined, Value extends string> = Authority extends string
  ? IriFromIdentity<Authority, Value>
  : undefined;

type BoundComposerCurie<Prefix extends string | undefined, Value extends string> = Prefix extends string
  ? CurieFromIdentity<Prefix, Value>
  : undefined;

type IdentityAnnotationMetadataKeys = "identifier" | "schemaId" | "title" | "iri" | "curie";

/**
 * Result of calling `annote` -- the identity annotation merged with any caller-supplied extras,
 * with identity metadata keys taking precedence.
 *
 * @example
 * ```typescript
 * import type { IdentityAnnotationResult } from "@beep/identity"
 *
 * type Result = IdentityAnnotationResult<"@beep/utils/User", "User">
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type IdentityAnnotationResult<
  Value extends string,
  Identifier extends string,
  Extras extends object = {},
  Authority extends string | undefined = undefined,
  Prefix extends string | undefined = undefined,
> = IdentityAnnotation<Value, Identifier> &
  IdentityProjection<Value, Authority, Prefix> &
  Omit<Extras, IdentityAnnotationMetadataKeys>;

type SchemaPath<Struct extends object> = Extract<Paths<Struct>, string>;

type KeyIdentifierPath<Identifier extends string> = Identifier extends `${string}.${infer Rest}` ? Rest : Identifier;

type StrictKeyIdentifier<Struct extends object, Identifier extends TString.NonEmpty> =
  KeyIdentifierPath<SegmentValue<Identifier>> extends SchemaPath<Struct> ? SegmentValue<Identifier> : never;

type KeyIdentifierValue<Struct extends object, Identifier extends string> = Get<Struct, KeyIdentifierPath<Identifier>>;

type SchemaStatics<Schema extends S.Top> = Omit<Schema, keyof Schema["Rebuild"] | keyof S.Top>;

type AnnotatedSchema<Schema extends S.Top> = Schema["Rebuild"] & SchemaStatics<Schema>;

/**
 * Record mapping `$`-prefixed accessor keys to child {@link IdentityComposer} instances,
 * produced by calling `compose` with one or more module segment names.
 *
 * @example
 * ```typescript
 * import type { TaggedModuleRecord } from "@beep/identity"
 *
 * type Modules = TaggedModuleRecord<"@beep/pkg", readonly ["auth", "billing"]>
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type TaggedModuleRecord<
  Value extends string,
  Segments extends ReadonlyArray<TString.NonEmpty>,
  Authority extends string | undefined = DefaultIdentityAuthority,
  Prefix extends string | undefined = DefaultIdentityPrefix,
  Vocab extends VocabShape = CoreVocab,
> = {
  readonly [K in Segments[number] as TaggedAccessor<K>]: IdentityComposer<
    `${Value}/${ModuleSegmentValue<K>}`,
    Authority,
    Prefix,
    Vocab
  >;
};

/**
 * Composable identity builder for constructing hierarchical `@beep/` identity paths.
 *
 * An `IdentityComposer` holds a current identity path and provides methods to:
 * - Extend the path with child segments (`create`, `make`, template tag)
 * - Produce annotation records for Effect schemas (`annote`, `annoteSchema`, `annoteHttp`, `annoteKey`)
 * - Batch-create named child composers (`compose`)
 *
 * @example
 * ```typescript
 * import { make } from "@beep/identity"
 *
 * // Create a root composer for "my-pkg"
 * const { $MyPkgId } = make("my-pkg")
 *
 * // Template tag: derive a child identity string
 * const serviceId = $MyPkgId`UserService`
 * console.log(serviceId)// "@beep/my-pkg/UserService"
 *
 * // make: one-shot string creation
 * const modelId = $MyPkgId.make("UserModel")
 * console.log(modelId)// "@beep/my-pkg/UserModel"
 *
 * // create: derive a child composer for further nesting
 * const sub = $MyPkgId.create("domain")
 * const nested = sub.make("Entity")
 * console.log(nested)// "@beep/my-pkg/domain/Entity"
 *
 * // compose: batch-create tagged child composers
 * const modules = $MyPkgId.compose("auth", "billing")
 * const authId = modules.$AuthId.make("Session")
 * console.log(authId)// "@beep/my-pkg/auth/Session"
 *
 * // annote: produce an annotation record for Effect schemas
 * const annotation = $MyPkgId.annote("UserSchema", {
 *
 * })
 * console.log(annotation.identifier)// "@beep/my-pkg/UserSchema"
 * console.log(annotation.title)// "UserSchema"
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface IdentityComposer<
  Value extends string,
  Authority extends string | undefined = DefaultIdentityAuthority,
  Prefix extends string | undefined = DefaultIdentityPrefix,
  Vocab extends VocabShape = CoreVocab,
> {
  /**
   * Produce an identity annotation record for an Effect schema.
   *
   * Returns an object containing `schemaId`, `identifier`, `title`, and any
   * caller-supplied extras. Use this with `S.Class`, `S.TaggedErrorClass`, or
   * similar constructors that accept an annotation record.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const ann = $MyPkgId.annote("UserCreated", { description: "A user was created." })
   *
   * console.log(ann.identifier)// "@beep/my-pkg/UserCreated"
   * console.log(ann.title)// "UserCreated"
   * console.log(ann.description)// "A user was created."
   * ```
   *
   * @since 0.0.0
   * @category combinators
   */
  annote<
    const Next extends TString.NonEmpty = TString.NonEmpty,
    const Extras extends IdentityAnyAnnotationExtras<unknown> = {},
  >(
    identifier: SegmentValue<Next>,
    extras?: undefined | Extras
  ): IdentityAnnotationResult<`${Value}/${SegmentValue<Next>}`, SegmentValue<Next>, Extras, Authority, Prefix>;

  /**
   * Produce a schema annotation function with HTTP API metadata.
   *
   * Returns a function that annotates an Effect schema with identity metadata
   * plus optional `httpApiStatus` and encoding fields.
   *
   * @since 0.0.0
   * @category combinators
   */
  annoteHttp<Schema extends S.Top, const Next extends TString.NonEmpty = TString.NonEmpty>(
    identifier: SegmentValue<Next>,
    extras?: undefined | HttpAnnotationExtras<Schema["Type"]>
  ): (self: Schema) => AnnotatedSchema<Schema>;

  /**
   * Produce a type-safe key annotation function scoped to a parent struct.
   *
   * When called with zero arguments, returns a curried builder that constrains
   * the identifier to valid paths within `Parent`.
   *
   * @since 0.0.0
   * @category combinators
   */
  annoteKey<Parent extends object>(): <
    const Next extends TString.NonEmpty = TString.NonEmpty,
    Schema extends S.Top & { readonly Type: KeyIdentifierValue<Parent, SegmentValue<Next>> } = S.Top & {
      readonly Type: KeyIdentifierValue<Parent, SegmentValue<Next>>;
    },
  >(
    identifier: SegmentValue<Next> & StrictKeyIdentifier<Parent, Next>,
    extras?: undefined | KeyAnnotationExtras<KeyIdentifierValue<Parent, SegmentValue<Next>>>
  ) => (self: Schema) => Schema["Rebuild"];

  /**
   * Produce a key annotation function for an untyped parent.
   *
   * @since 0.0.0
   * @category combinators
   */
  annoteKey(
    identifier: TString.NonEmpty,
    extras?: undefined | KeyAnnotationExtras<unknown>
  ): <Schema extends S.Top>(self: Schema) => Schema["Rebuild"];

  /**
   * Produce a generic schema annotation function.
   *
   * Returns a function that calls `self.annotate(...)` with identity metadata
   * merged with any caller-supplied extras.
   *
   * @since 0.0.0
   * @category combinators
   */
  annoteSchema<Schema extends S.Top, const Next extends TString.NonEmpty = TString.NonEmpty>(
    identifier: SegmentValue<Next>,
    extras?: undefined | S.Annotations.Bottom<Schema["Type"], Schema["~type.parameters"]>
  ): (self: Schema) => AnnotatedSchema<Schema>;

  /**
   * Batch-create child {@link IdentityComposer} instances for multiple module segments.
   *
   * Returns a record whose keys are `$`-prefixed PascalCase accessors (e.g. `$AuthId`)
   * mapped to child composers rooted at `{Value}/{segment}`.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const modules = $MyPkgId.compose("auth", "billing")
   *
   * const authId = modules.$AuthId.make("Session")
   * console.log(authId)// "@beep/my-pkg/auth/Session"
   * ```
   *
   * @since 0.0.0
   * @category constructors
   */
  compose<
    const Segments extends readonly [ModuleSegmentValue<TString.NonEmpty>, ...ModuleSegmentValue<TString.NonEmpty>[]],
  >(...segments: Segments): TaggedModuleRecord<Value, Segments, Authority, Prefix, Vocab>;

  /**
   * Create a child {@link IdentityComposer} for further path extension.
   *
   * Unlike `make` (which returns a plain string), `create` returns a full
   * composer that supports further nesting, annotation, and composition.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const sub = $MyPkgId.create("domain")
   * const entityId = sub.make("Entity")
   * console.log(entityId)// "@beep/my-pkg/domain/Entity"
   * ```
   *
   * @since 0.0.0
   * @category constructors
   */
  create<const Next extends TString.NonEmpty>(
    segment: SegmentValue<Next>
  ): IdentityComposer<`${Value}/${SegmentValue<Next>}`, Authority, Prefix, Vocab>;

  /**
   * CURIE projection for this composer's current path, or `undefined` when unbound.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
   * const curie = $BeepId.create("schema").curie
   * console.log(curie) // "beep:schema"
   * ```
   *
   * @since 0.0.0
   * @category getters
   */
  readonly curie: BoundComposerCurie<Prefix, Value>;

  /**
   * The identity string for this composer's current path.
   *
   * @since 0.0.0
   * @category getters
   */
  readonly identifier: IdentityString<Value>;

  /**
   * IRI projection for this composer's current path, or `undefined` when unbound.
   *
   * @remarks
   * One-argument `make(...)` calls intentionally produce unbound composers, so
   * callers must handle `undefined` there. Root-bound package composers derive
   * exact literals from the configured authority.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
   * const iri = $BeepId.create("schema").iri
   * console.log(iri) // "https://ns.beep.sh/schema"
   * ```
   *
   * @since 0.0.0
   * @category getters
   */
  readonly iri: BoundComposerIri<Authority, Value>;

  /**
   * Create a child identity string by appending one segment.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const id = $MyPkgId.make("UserModel")
   * console.log(id)// "@beep/my-pkg/UserModel"
   * ```
   *
   * @since 0.0.0
   * @category constructors
   */
  make<const Next extends TString.NonEmpty>(
    segment: SegmentValue<Next>
  ): IdentityString<`${Value}/${SegmentValue<Next>}`>;

  /**
   * Rebind IRI and CURIE projections without changing the identity path or symbol.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
   * const patent = $BeepId.create("ontology").create("patent")
   * const rebased = patent.rebase({ iri: "https://opip.law/ns/patent#", prefix: "patent" })
   * console.log(rebased.iri) // "https://opip.law/ns/patent#ontology/patent"
   * ```
   *
   * @since 0.0.0
   * @category combinators
   */
  rebase<const Iri extends string, const NextPrefix extends string>(options: {
    readonly iri: Iri;
    readonly prefix: NextPrefix;
  }): IdentityComposer<Value, Iri, NextPrefix, Vocab>;

  /**
   * Kebab-case slug projection for this composer's current path.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep")
   * const slug = $BeepId.create("Ontology.models").create("HttpUrl").slug
   * console.log(slug) // "beep-ontology-models-http-url"
   * ```
   *
   * @since 0.0.0
   * @category getters
   */
  readonly slug: SlugFromIdentifier<Value>;

  /**
   * Return this composer's identity as a branded string.
   *
   * @since 0.0.0
   * @category getters
   */
  string(): IdentityString<Value>;

  /**
   * Return this composer's identity as an interned symbol via `Symbol.for`.
   *
   * @since 0.0.0
   * @category getters
   */
  symbol(): IdentitySymbol<Value>;

  /**
   * Alias for {@link identifier}.
   *
   * @since 0.0.0
   * @category getters
   */
  readonly value: IdentityString<Value>;

  /**
   * Template tag call signature for creating child identity strings.
   *
   * Must be called with a single static string literal and no interpolations.
   *
   * @example
   * ```typescript
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const id = $MyPkgId`UserService`
   * console.log(id)// "@beep/my-pkg/UserService"
   * ```
   *
   * @since 0.0.0
   * @category constructors
   */
  (strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>): IdentityString<`${Value}/${string}`>;
}

type NormalizedBase<Base extends TString.NonEmpty> = Base extends `@beep/${infer Rest extends TString.NonEmpty}`
  ? Rest
  : Base extends "@beep"
    ? "beep"
    : Base extends `@${infer Rest extends TString.NonEmpty}`
      ? Rest
      : Base;

type BaseIdentity<Base extends TString.NonEmpty> =
  NormalizedBase<Base> extends BeepBase ? BeepNamespace : `${BeepNamespace}/${NormalizedBase<Base>}`;

const SegmentCheck = S.makeFilterGroup(
  [
    S.isNonEmpty({
      identifier: "@beep/identity/check/non-empty-segment",
      message: "Identity segments cannot be empty.",
    }),
    S.makeFilter((segment: string) => !pipe(segment, Str.startsWith("/")), {
      identifier: "@beep/identity/check/no-leading-slash",
      message: 'Identity segments cannot start with "/".',
    }),
    S.makeFilter((segment: string) => !pipe(segment, Str.endsWith("/")), {
      identifier: "@beep/identity/check/no-trailing-slash",
      message: 'Identity segments cannot end with "/".',
    }),
  ],
  {
    title: "Identity Segment",
    description: "Identity segments are non-empty and do not start or end with a slash.",
  }
);

const SegmentSchema = S.String.check(SegmentCheck);

const ModuleSegmentCheck = S.makeFilterGroup(
  [
    S.isPattern(MODULE_CHARACTERS, {
      identifier: "@beep/identity/check/module-characters",
      message: "Module segments must contain only alphanumeric characters, hyphens, or underscores.",
    }),
    S.isPattern(MODULE_LEADING_ALPHA, {
      identifier: "@beep/identity/check/module-leading-alpha",
      message: "Module segments must start with an alphabetic character to create valid accessors.",
    }),
  ],
  {
    title: "Identity Module Segment",
    description: "Module segments are identity segments that are safe for generated module accessor names.",
  }
);

const ModuleSegmentSchema = SegmentSchema.check(ModuleSegmentCheck);

const BaseSegmentSchema = S.String.check(
  S.isNonEmpty({
    identifier: "@beep/identity/check/non-empty-base",
    message: "Identity bases cannot be empty.",
  }),
  S.isPattern(BASE_CHARACTERS, {
    identifier: "@beep/identity/check/base-characters",
    message: "Identity bases must use alphanumeric, hyphen, or underscore characters and start/end with alphanumeric.",
  })
);

const toIdentityString = <Value extends string>(value: Value): IdentityString<Value> => value as IdentityString<Value>;

const toIdentitySymbol = <Value extends string>(value: Value): IdentitySymbol<Value> =>
  Symbol.for(value) as IdentitySymbol<Value>;

function appendIdentityValue<Value extends string, Next extends string>(value: Value, next: Next): `${Value}/${Next}`;
function appendIdentityValue(value: string, next: string): string {
  return `${value}/${next}`;
}

const toTitle = <const Identifier extends TString.NonEmpty>(identifier: Identifier): TitleFromIdentifier<Identifier> =>
  pipe(
    identifier,
    Str.replace(/[_-]+/g, " "),
    Str.trim,
    Str.split(" "),
    A.filter(Str.isNonEmpty),
    A.map((segment) => `${Str.toUpperCase(Str.slice(0, 1)(segment))}${Str.slice(1)(segment)}`),
    A.join(" ")
  ) as TitleFromIdentifier<Identifier>;

const localPathFromIdentity: (identity: string) => string = flow(Str.split("/"), A.drop(1), A.join("/"));

const toIri = <const Authority extends string, const Value extends string>(
  authority: Authority,
  identity: Value
): IriFromIdentity<Authority, Value> => {
  const localPath = localPathFromIdentity(identity);
  return (Str.isEmpty(localPath) ? authority : `${authority}${localPath}`) as IriFromIdentity<Authority, Value>;
};

const toCurie = <const Prefix extends string, const Value extends string>(
  prefix: Prefix,
  identity: Value
): CurieFromIdentity<Prefix, Value> => {
  const localPath = localPathFromIdentity(identity);
  return (Str.isEmpty(localPath) ? `${prefix}:` : `${prefix}:${localPath}`) as CurieFromIdentity<Prefix, Value>;
};

const toSlug = <const Identifier extends string>(identifier: Identifier): SlugFromIdentifier<Identifier> =>
  pipe(
    identifier,
    Str.replace(/^@/, ""),
    Str.replace(/([a-z0-9])([A-Z])/g, "$1-$2"),
    Str.replace(/[/. _-]+/g, "-"),
    Str.replace(/^-+|-+$/g, ""),
    Str.toLowerCase
  ) as SlugFromIdentifier<Identifier>;

type ModulePascal<Segment extends TString.NonEmpty> =
  ModuleAccessor<Segment> extends `${infer Pascal}Id` ? Pascal : never;

const toPascalIdentifier = <const Segment extends TString.NonEmpty>(segment: Segment): ModulePascal<Segment> =>
  pipe(segment, toTitle, Str.replace(/\s+/g, "")) as ModulePascal<Segment>;

const toTaggedKey = <const Segment extends TString.NonEmpty>(segment: Segment): TaggedAccessor<Segment> =>
  `$${toPascalIdentifier(segment)}Id` as TaggedAccessor<Segment>;

const validateSegment = <const Segment extends TString.NonEmpty>(segment: Segment): Segment => {
  S.decodeUnknownSync(SegmentSchema)(segment);
  return segment;
};

const validateModuleSegment = <const Segment extends TString.NonEmpty>(segment: Segment): Segment => {
  S.decodeUnknownSync(ModuleSegmentSchema)(segment);
  return segment;
};

const validateTemplateInterpolations = (values: ReadonlyArray<unknown>): void =>
  A.match(values, {
    onEmpty: Fn.constVoid,
    onNonEmpty: () => {
      throw IdentityInterpolationError.make({});
    },
  });

const validateTemplateSegmentCount = (strings: TemplateStringsArray): void =>
  A.match(strings, {
    onEmpty: () => {
      throw IdentitySegmentCountError.make({});
    },
    onNonEmpty: () =>
      A.match(A.drop(strings, 1), {
        onEmpty: Fn.constVoid,
        onNonEmpty: () => {
          throw IdentitySegmentCountError.make({});
        },
      }),
  });

const stripPrefix = (prefix: string) =>
  flow(O.liftPredicate(Str.startsWith(prefix)), O.map(Str.slice(Str.length(prefix))));

const normalizeBase = <const Base extends TString.NonEmpty>(base: Base): NormalizedBase<Base> => {
  const value = S.decodeUnknownSync(S.String)(base);
  const namespaceBaseOption = O.as(O.liftPredicate(isBeepNamespace)(value), beepBase);
  const scopedNamespaceOption = stripPrefix(`${beepNamespace}/`)(value);
  const atPrefixNamespaceOption = stripPrefix(beepNamespace)(value);
  const withoutNamespace = pipe(
    [namespaceBaseOption, scopedNamespaceOption, atPrefixNamespaceOption],
    O.firstSomeOf,
    O.getOrElse(() => value)
  );
  const withoutAtPrefix = pipe(
    stripPrefix("@")(withoutNamespace),
    O.getOrElse(() => withoutNamespace)
  );

  return S.decodeUnknownSync(BaseSegmentSchema)(withoutAtPrefix) as NormalizedBase<Base>;
};

const createBaseIdentity = <const Base extends TString.NonEmpty>(base: NormalizedBase<Base>): BaseIdentity<Base> =>
  O.match(O.liftPredicate(isBeepBase)(base), {
    onNone: () => `${beepNamespace}/${base}` as BaseIdentity<Base>,
    onSome: () => beepNamespace as BaseIdentity<Base>,
  });

type IdentityBinding<Authority extends string, Prefix extends string, Vocab extends VocabShape> = {
  readonly authority: Authority;
  readonly prefix: Prefix;
  readonly vocab?: Vocab | undefined;
};

const createComposer = <
  const Value extends string,
  const Authority extends string | undefined,
  const Prefix extends string | undefined,
  const Vocab extends VocabShape,
>(
  value: Value,
  binding: IdentityBinding<string, string, Vocab> | undefined
): IdentityComposer<Value, Authority, Prefix, Vocab> => {
  const identityValue = toIdentityString(value);
  const iri = pipe(
    O.fromUndefinedOr(binding),
    O.map((currentBinding) => toIri(currentBinding.authority, value)),
    O.getOrUndefined
  ) as BoundComposerIri<Authority, Value>;
  const curie = pipe(
    O.fromUndefinedOr(binding),
    O.map((currentBinding) => toCurie(currentBinding.prefix, value)),
    O.getOrUndefined
  ) as BoundComposerCurie<Prefix, Value>;
  const slug = toSlug(value);

  function createTemplateIdentity(strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) {
    validateTemplateInterpolations(values);
    validateTemplateSegmentCount(strings);

    return pipe(strings[0], S.decodeUnknownSync(ModuleSegmentSchema), (segment) =>
      toIdentityString(appendIdentityValue(value, segment))
    );
  }

  function toTaggedComposerEntry(segment: ModuleSegmentValue<TString.NonEmpty>) {
    const ensured = validateModuleSegment(segment);
    return [toTaggedKey(ensured), composeNext(ensured)] as const;
  }

  const composeNext = <const Next extends TString.NonEmpty>(
    segment: SegmentValue<Next>
  ): IdentityComposer<`${Value}/${SegmentValue<Next>}`, Authority, Prefix, Vocab> => {
    const next = validateSegment(segment);
    const composed = appendIdentityValue(value, next);
    return createComposer(composed, binding);
  };

  const identityAnnotation = <const Next extends TString.NonEmpty = TString.NonEmpty>(
    identifier: SegmentValue<Next>
  ): IdentityAnnotation<`${Value}/${SegmentValue<Next>}`, SegmentValue<Next>, Authority, Prefix> => {
    const next = validateSegment(identifier);
    const composer = composeNext(next);

    return {
      schemaId: composer.symbol(),
      identifier: composer.string(),
      ...(composer.iri === undefined || composer.curie === undefined
        ? {}
        : {
            iri: composer.iri,
            curie: composer.curie,
          }),
      title: toTitle(next),
    } as IdentityAnnotation<`${Value}/${SegmentValue<Next>}`, SegmentValue<Next>, Authority, Prefix>;
  };

  const annote = <
    const Next extends TString.NonEmpty = TString.NonEmpty,
    const Extras extends IdentityAnyAnnotationExtras<unknown> = {},
  >(
    identifier: SegmentValue<Next>,
    extras?: undefined | Extras
  ): IdentityAnnotationResult<`${Value}/${SegmentValue<Next>}`, SegmentValue<Next>, Extras, Authority, Prefix> =>
    pipe(identityAnnotation(identifier), (annotation) =>
      O.match(O.fromUndefinedOr(extras), {
        onNone: () =>
          annotation as IdentityAnnotationResult<
            `${Value}/${SegmentValue<Next>}`,
            SegmentValue<Next>,
            Extras,
            Authority,
            Prefix
          >,
        onSome: (currentExtras) =>
          ({
            ...currentExtras,
            schemaId: annotation.schemaId,
            identifier: annotation.identifier,
            ...(annotation.iri === undefined || annotation.curie === undefined
              ? {}
              : {
                  iri: annotation.iri,
                  curie: annotation.curie,
                }),
            title: annotation.title,
          }) as unknown as IdentityAnnotationResult<
            `${Value}/${SegmentValue<Next>}`,
            SegmentValue<Next>,
            Extras,
            Authority,
            Prefix
          >,
      })
    );

  const annoteSchema = <Schema extends S.Top, const Next extends TString.NonEmpty = TString.NonEmpty>(
    identifier: SegmentValue<Next>,
    extras?: undefined | S.Annotations.Bottom<Schema["Type"], Schema["~type.parameters"]>
  ): ((self: Schema) => AnnotatedSchema<Schema>) => {
    const annotation = annote(identifier, extras);

    return (self: Schema): AnnotatedSchema<Schema> => preserveSchemaStatics(self, self.annotate(annotation));
  };

  function annoteKey<Parent extends object>(): <
    const Next extends TString.NonEmpty = TString.NonEmpty,
    Schema extends S.Top & { readonly Type: KeyIdentifierValue<Parent, SegmentValue<Next>> } = S.Top & {
      readonly Type: KeyIdentifierValue<Parent, SegmentValue<Next>>;
    },
  >(
    identifier: SegmentValue<Next> & StrictKeyIdentifier<Parent, Next>,
    extras?: undefined | KeyAnnotationExtras<KeyIdentifierValue<Parent, SegmentValue<Next>>>
  ) => (self: Schema) => Schema["Rebuild"];
  function annoteKey(
    identifier: TString.NonEmpty,
    extras?: undefined | KeyAnnotationExtras<unknown>
  ): <Schema extends S.Top>(self: Schema) => Schema["Rebuild"];
  function annoteKey(identifier?: TString.NonEmpty, extras?: undefined | KeyAnnotationExtras<unknown>): unknown {
    return O.match(O.fromUndefinedOr(identifier), {
      onNone:
        () =>
        <const StrictNext extends TString.NonEmpty = TString.NonEmpty>(
          strictIdentifier: SegmentValue<StrictNext>,
          strictExtras?: undefined | KeyAnnotationExtras<unknown>
        ) =>
          annoteKey(strictIdentifier, strictExtras),
      onSome:
        (currentIdentifier) =>
        <Schema extends S.Top>(self: Schema): Schema["Rebuild"] =>
          self.annotateKey(annote(currentIdentifier, extras)),
    });
  }

  const annoteHttp = <Schema extends S.Top, const Next extends TString.NonEmpty = TString.NonEmpty>(
    identifier: SegmentValue<Next>,
    extras?: undefined | HttpAnnotationExtras<Schema["Type"]>
  ): ((self: Schema) => AnnotatedSchema<Schema>) => {
    const annotation = annote(identifier, extras);

    return (self: Schema): AnnotatedSchema<Schema> => preserveSchemaStatics(self, self.annotate(annotation));
  };

  return Object.defineProperties(createTemplateIdentity, {
    value: {
      value: identityValue,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    identifier: {
      value: identityValue,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    iri: {
      value: iri,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    curie: {
      value: curie,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    slug: {
      value: slug,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    compose: {
      value: <
        const Segments extends readonly [
          ModuleSegmentValue<TString.NonEmpty>,
          ...ModuleSegmentValue<TString.NonEmpty>[],
        ],
      >(
        ...segments: Segments
      ) => {
        const entries = pipe(segments, A.map(toTaggedComposerEntry));
        return R.fromEntries(entries) as unknown as TaggedModuleRecord<Value, Segments, Authority, Prefix, Vocab>;
      },
      enumerable: true,
      writable: true,
      configurable: true,
    },
    create: {
      value: composeNext,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    make: {
      value: <const Next extends TString.NonEmpty>(segment: SegmentValue<Next>) => composeNext(segment).string(),
      enumerable: true,
      writable: true,
      configurable: true,
    },
    string: {
      value: () => identityValue,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    symbol: {
      value: () => toIdentitySymbol(value),
      enumerable: true,
      writable: true,
      configurable: true,
    },
    rebase: {
      value: <const Iri extends string, const NextPrefix extends string>(options: {
        readonly iri: Iri;
        readonly prefix: NextPrefix;
      }) =>
        createComposer<Value, Iri, NextPrefix, Vocab>(value, {
          authority: options.iri,
          prefix: options.prefix,
          vocab: binding?.vocab,
        }),
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annote: {
      value: annote,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annoteSchema: {
      value: annoteSchema,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annoteKey: {
      value: annoteKey,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annoteHttp: {
      value: annoteHttp,
      enumerable: true,
      writable: true,
      configurable: true,
    },
  }) as unknown as IdentityComposer<Value, Authority, Prefix, Vocab>;
};

type MakeReturn<
  Base extends TString.NonEmpty,
  Authority extends string | undefined = DefaultIdentityAuthority,
  Prefix extends string | undefined = DefaultIdentityPrefix,
  Vocab extends VocabShape = CoreVocab,
> = {
  readonly [K in `$${PascalCaseValue<ModuleSegmentValue<NormalizedBase<Base>>>}Id`]: IdentityComposer<
    BaseIdentity<Base>,
    Authority,
    Prefix,
    Vocab
  >;
};

/**
 * Create a root identity composer for a `@beep` package namespace.
 *
 * Accepts a base string (with or without the `@beep/` prefix) and returns
 * a record containing a single `$`-prefixed PascalCase accessor mapped to
 * the root {@link IdentityComposer} for that package.
 *
 * @example
 * ```typescript
 * import { make } from "@beep/identity"
 *
 * // Bare name -- "@beep/" prefix is added automatically
 * const { $MyPkgId } = make("my-pkg")
 * const id = $MyPkgId.make("Service")
 * console.log(id)// "@beep/my-pkg/Service"
 * ```
 *
 * @example
 * ```typescript
 * import { make } from "@beep/identity"
 *
 * // Full scoped name works too
 * const { $UtilsId } = make("@beep/utils")
 * const sym = $UtilsId.symbol()
 * console.log(sym)// Symbol.for("@beep/utils")
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export function make<const Base extends TString.NonEmpty>(base: Base): MakeReturn<Base, undefined, undefined>;
export function make<
  const Base extends TString.NonEmpty,
  const Authority extends string,
  const Prefix extends string,
  const Vocab extends VocabShape = CoreVocab,
>(base: Base, options: IdentityBinding<Authority, Prefix, Vocab>): MakeReturn<Base, Authority, Prefix, Vocab>;
export function make<
  const Base extends TString.NonEmpty,
  const Authority extends string,
  const Prefix extends string,
  const Vocab extends VocabShape = CoreVocab,
>(
  base: Base,
  options?: IdentityBinding<Authority, Prefix, Vocab>
): MakeReturn<Base, Authority | undefined, Prefix | undefined, Vocab> {
  const normalized = normalizeBase(base);
  const baseIdentity = createBaseIdentity(normalized);
  const composer = createComposer<BaseIdentity<Base>, Authority | undefined, Prefix | undefined, Vocab>(
    baseIdentity,
    options
  );
  const key = toTaggedKey(normalized);

  return Fn.cast<
    {
      [x: string]: IdentityComposer<BaseIdentity<Base>, Authority | undefined, Prefix | undefined, Vocab>;
    },
    MakeReturn<Base, Authority | undefined, Prefix | undefined, Vocab>
  >({
    [key]: composer,
  });
}
