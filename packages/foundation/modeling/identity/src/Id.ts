/**
 * Hierarchical identity system for the `@beep` namespace.
 *
 * **Details**
 *
 * Composable, type-safe identity strings and symbols back schema annotations,
 * error tagging, and service identification throughout the Effect codebase.
 * Identities follow a `@beep/{package}/{path}` convention and are validated at
 * construction time.
 *
 * **Example** (Compose a package identity)
 *
 * ```ts import.meta.vitest name="Compose a package identity"
 * import { make } from "@beep/identity"
 *
 * // Create a package-level identity composer
 * const { $MyPkgId } = make("my-pkg")
 *
 * // Derive child identifiers for schemas and services
 * const userId = $MyPkgId.make("UserId")
 * const sym = $MyPkgId.symbol()
 *
 * userId // => "@beep/my-pkg/UserId"
 * sym // => Symbol.for("@beep/my-pkg")
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Function as Fn, flow, pipe, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { TString } from "@beep/types";
import type { Equivalence } from "effect/Equivalence";
import type { PayloadEncoding } from "effect/unstable/httpapi/HttpApiSchema";
import type { Get, Paths } from "type-fest";
import type { CoreVocab, Predicate, VocabShape } from "./Vocab.ts";

const BeepNamespace = S.Literal("@beep");
type BeepNamespace = typeof BeepNamespace.Type;

const BeepBase = S.Literal("beep");
type BeepBase = typeof BeepBase.Type;

const IdentityVersion = S.Literal("0.0.0");
type DefaultIdentityAuthority = "https://ns.beep.sh/";
type DefaultIdentityPrefix = "beep";

const isBeepNamespace = S.is(BeepNamespace);
const isBeepBase = S.is(BeepBase);

const beepNamespace = S.decodeSync(BeepNamespace)("@beep");
const beepBase = S.decodeSync(BeepBase)("beep");
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

// Effect calls the hook with the declared struct's equivalence. Narrowing it from `never` to `Self`
// is the contravariant direction (`Self` extends the struct type), so the assertion is sound.
const adoptDeclaredFieldsEquivalence = <Self>(typeParameters: readonly [Equivalence<never>]): Equivalence<Self> =>
  typeParameters[0] as Equivalence<Self>;

/**
 * Bootstrap identity annotation helper for schemas defined before `make` exists.
 *
 * **Details**
 *
 * The real `IdentityComposer` (`$I`, as used throughout the rest of the
 * workspace) is produced by calling `make`, which itself throws
 * {@link IdentityInterpolationError} and {@link IdentitySegmentCountError} --
 * so those two classes cannot depend on a composer derived from `make`. This
 * shim mirrors `IdentityComposer#annoteError`'s call shape (and adds the same
 * interned `schemaId` symbol) using only primitives already available at
 * this point in module evaluation.
 */
const $I = {
  annoteError: <Self>(identifier: string, extras: S.Annotations.Documentation<Self>): ErrorAnnotationRecord<Self> => ({
    ...extras,
    schemaId: Symbol.for(identifier),
    identifier,
    title: extras.title ?? identifier,
    toEquivalence: adoptDeclaredFieldsEquivalence<Self>,
  }),
};

/**
 * Error thrown when an identity template tag receives interpolation values.
 *
 * **Details**
 *
 * Identity template tags must be called with a single static string literal,
 * for example by calling the `$I` template tag with a static segment.
 * Passing interpolated expressions is forbidden because identity strings
 * must be statically deterministic.
 *
 * **Example** (Reject an interpolated tag call)
 *
 * ```ts
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
export class IdentityInterpolationError extends S.TaggedError<IdentityInterpolationError>(
  "@beep/identity/errors/IdentityInterpolationError"
)(
  "IdentityInterpolationError",
  {},
  $I.annoteError<IdentityInterpolationError>("@beep/identity/errors/IdentityInterpolationError", {
    description: "Identity template tags do not allow interpolations.",
  })
) {
  override get message() {
    return "Identity template tags do not allow interpolations.";
  }
}

/**
 * Error thrown when an identity template tag receives more or fewer than one literal segment.
 *
 * **Details**
 *
 * Template tags must be called with exactly one static string segment.
 *
 * **Example** (Read the segment-count message)
 *
 * ```ts import.meta.vitest name="Read the segment-count message"
 * import { IdentitySegmentCountError } from "@beep/identity"
 *
 * const error = IdentitySegmentCountError.make()
 * error.message // => "Identity template tags must use a single literal segment."
 * ```
 *
 * @since 0.0.0
 * @category error-handling
 */
export class IdentitySegmentCountError extends S.TaggedError<IdentitySegmentCountError>(
  "@beep/identity/errors/IdentitySegmentCountError"
)(
  "IdentitySegmentCountError",
  {},
  $I.annoteError<IdentitySegmentCountError>("@beep/identity/errors/IdentitySegmentCountError", {
    description: "Identity template tags must use a single literal segment.",
  })
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
 * **Example** (Read the package version)
 *
 * ```ts import.meta.vitest name="Read the package version"
 * import { VERSION } from "@beep/identity"
 *
 * VERSION // => "0.0.0"
 * ```
 *
 * @since 0.0.0
 * @category configuration
 */
export const VERSION = S.decodeSync(IdentityVersion)("0.0.0");

/**
 * Type-level constraint ensuring an identity segment does not start or end with a slash.
 *
 * **Details**
 *
 * Resolves to `never` when the segment starts or ends with `/`, preventing
 * invalid identity paths at compile time.
 *
 * **Example** (Contrast a valid and an invalid segment)
 *
 * ```ts import.meta.vitest name="Contrast a valid and an invalid segment"
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
 * **Details**
 *
 * Converts `"my-service"` to `"My Service"` and `"user_account"` to `"User Account"`.
 *
 * **Example** (Title a kebab-case identifier)
 *
 * ```ts import.meta.vitest name="Title a kebab-case identifier"
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
 * **Details**
 *
 * Converts `"@beep/a/b"` to `"https://ns.beep.sh/a/b"` when the authority is
 * `"https://ns.beep.sh/"`. Widened string inputs intentionally widen to `string`.
 *
 * **Example** (Project an identity onto a namespace authority)
 *
 * ```ts
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
 * **Details**
 *
 * Converts `"@beep/a/b"` to `"beep:a/b"` when the prefix is `"beep"`. Widened
 * string inputs intentionally widen to `string`.
 *
 * **Example** (Abbreviate an identity with an owned prefix)
 *
 * ```ts
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
 * **Details**
 *
 * The type-level transform mirrors the runtime slug getter for static identity
 * paths, including slash, dot, underscore, hyphen, space, and lower-to-upper
 * word boundaries.
 *
 * **Example** (Slug a mixed-separator identity)
 *
 * ```ts
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
 * **Details**
 *
 * In addition to the basic {@link SegmentValue} rules, module segments must start
 * with an alphabetic character and contain only alphanumerics, hyphens, or underscores.
 * Resolves to `never` when violated.
 *
 * **Example** (Reject a digit-leading segment)
 *
 * ```ts import.meta.vitest name="Reject a digit-leading segment"
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
 * **Details**
 *
 * `"my-service"` becomes `"MyServiceId"`.
 *
 * **Example** (Derive an accessor name)
 *
 * ```ts import.meta.vitest name="Derive an accessor name"
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
 * **Details**
 *
 * `"my-service"` becomes `"$MyServiceId"`. This is the key shape `compose` and
 * `make` use when they destructure composers out of their result record.
 *
 * **Example** (Derive a tagged accessor key)
 *
 * ```ts import.meta.vitest name="Derive a tagged accessor key"
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
 * **Example** (Hold a composer's identity as a branded string)
 *
 * ```ts
 * import { make } from "@beep/identity"
 * import type { IdentityString } from "@beep/identity"
 *
 * const { $UtilsId } = make("utils")
 * const id: IdentityString<string> = $UtilsId.string()
 * console.log(id)// "@beep/utils"
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
 * **Example** (Read an interned identity symbol)
 *
 * ```ts
 * import { make } from "@beep/identity"
 * import type { IdentitySymbol } from "@beep/identity"
 *
 * const { $UtilsId } = make("utils")
 * const sym: IdentitySymbol<string> = $UtilsId.symbol()
 * console.log(sym.description)// "@beep/utils"
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
 * **Details**
 *
 * Mirrors `S.Annotations.Bottom` so callers can supply `description`, `documentation`,
 * and other Effect Schema annotation keys alongside identity metadata.
 *
 * **Example** (Name the extras a schema annotation accepts)
 *
 * ```ts
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
 * Declaration annotation fields accepted by class and declaration constructors.
 *
 * **Details**
 *
 * Mirrors `S.Annotations.Declaration` so declaration-only hooks are checked
 * against both the declared value and its schema type parameters.
 *
 * **Example** (Type declaration-only annotation hooks)
 *
 * ```ts import.meta.vitest name="Type declaration-only annotation hooks"
 * import type { DeclarationAnnotationExtras } from "@beep/identity"
 * import * as S from "effect/Schema"
 *
 * const Fields = S.Struct({ value: S.String })
 * type Extras = DeclarationAnnotationExtras<{ readonly value: string }, readonly [typeof Fields]>
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DeclarationAnnotationExtras<
  T,
  TypeParameters extends ReadonlyArray<S.Top> = readonly [],
> = S.Annotations.Declaration<T, TypeParameters>;

/**
 * Annotation record produced by `annoteError`: identity metadata, caller extras, and a
 * `toEquivalence` hook that adopts the declared field struct's equivalence.
 *
 * **Details**
 *
 * Effect calls a declaration's `toEquivalence` hook with the derived equivalences of its type
 * parameters; for `S.TaggedError` that single parameter is the declared `TaggedStruct`, so the
 * hook returns it and `S.toEquivalence(ErrorClass)` compares declared fields only. The hook is
 * typed over `never` type parameters and `Self` on purpose: that shape is assignable to every
 * `S.Annotations.Declaration<Self, readonly [S.TaggedStruct<Tag, Fields>]>` without naming the
 * fields, and it does not require the compiler to infer anything from `Self` inside the class's
 * own base expression.
 *
 * The `iri` and `curie` members are present only when the record came from a composer bound to
 * an authority and prefix; the bootstrap `annoteError` shim never sets them.
 *
 * **Example** (Name the record of a tagged error annotation)
 *
 * ```ts
 * import type { ErrorAnnotationRecord } from "@beep/identity"
 *
 * class WidgetError { readonly _tag = "WidgetError" }
 * type Record = ErrorAnnotationRecord<WidgetError>
 * const identifierOf = (record: Record): string => record.identifier
 * console.log(identifierOf.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ErrorAnnotationRecord<Self> extends S.Annotations.Documentation<Self> {
  readonly curie?: string | undefined;
  readonly identifier: string;
  readonly iri?: string | undefined;
  readonly schemaId: symbol;
  readonly title: string;
  readonly toEquivalence: (typeParameters: readonly [Equivalence<never>]) => Equivalence<Self>;
}

/**
 * Annotation fields accepted by `annoteKey`, mirroring `S.Annotations.Key`.
 *
 * **Example** (Name the extras a key annotation accepts)
 *
 * ```ts
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
 * SKOS classification marker written by the composer's `class` entrypoint.
 *
 * **Details**
 *
 * Drives `@type` emission during ontology projection: `"concept"` adds
 * `skos:Concept` and `"conceptScheme"` adds `skos:ConceptScheme` beside
 * `rdfs:Class`.
 *
 * **Example** (Mark a schema as a SKOS concept)
 *
 * ```ts
 * import type { SkosClassification } from "@beep/identity"
 *
 * const marker: SkosClassification = "concept"
 * console.log(marker)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SkosClassification = "concept" | "conceptScheme";

/**
 * Options accepted by the composer's `key` entrypoint.
 *
 * **Details**
 *
 * `term` carries a borrowed vocabulary predicate as a closed CURIE literal,
 * optionally reverse-marked with a leading `^` (SPARQL inverse-path syntax).
 * Remaining fields mirror `annotateKey` extras.
 *
 * **Example** (Borrow a vocabulary predicate)
 *
 * ```ts
 * import type { OntologyKeyOptions } from "@beep/identity"
 *
 * const options: OntologyKeyOptions = { term: "skos:prefLabel" }
 * console.log(options.term)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type OntologyKeyOptions<Vocab extends VocabShape = CoreVocab> = Omit<
  KeyAnnotationExtras<unknown>,
  "identifier" | "schemaId" | "iri" | "curie"
> & {
  readonly term?: Predicate<Vocab> | undefined;
  readonly identifier?: never;
  readonly schemaId?: never;
  readonly iri?: never;
  readonly curie?: never;
};

/**
 * Extras accepted by the composer's `class` entrypoint.
 *
 * **Details**
 *
 * Extends the `annote` extras with an optional SKOS classification marker;
 * the marker is written to the `skosClassification` annotation channel.
 *
 * **Example** (Describe and classify a schema class)
 *
 * ```ts
 * import type { OntologyClassExtras } from "@beep/identity"
 *
 * const extras: OntologyClassExtras = { description: "A patent claim.", skos: "concept" }
 * console.log(extras.skos)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type OntologyClassExtras<
  SchemaType = unknown,
  TypeParameters extends ReadonlyArray<S.Top> = readonly [],
> = IdentityAnyAnnotationExtras<SchemaType, TypeParameters> & {
  readonly skos?: SkosClassification | undefined;
};

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly ontologyTerm?: string | undefined;
      readonly skosClassification?: SkosClassification | undefined;
    }
  }
}

/**
 * Annotation fields accepted by `annoteHttp`, extending schema extras with HTTP API metadata.
 *
 * **Details**
 *
 * Supports optional `httpApiStatus` and `~httpApiEncoding` for Effect HTTP API annotations.
 *
 * **Example** (Name the extras an HTTP annotation accepts)
 *
 * ```ts
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
  readonly "~httpApiEncoding"?: PayloadEncoding | undefined;
};

/**
 * Union of all annotation extras accepted by the `annote` family of helpers.
 *
 * **Details**
 *
 * Combines key-level and HTTP-level annotation fields into a single constraint.
 *
 * **Example** (Name the combined annotation extras)
 *
 * ```ts
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
 * **Details**
 *
 * Contains a full-path `identifier` string, an interned `schemaId` symbol, and a
 * human-readable `title` derived from the local identifier segment. The `iri`
 * and `curie` members are present only when the composer was bound to an
 * authority and prefix.
 *
 * **Example** (Name a resolved annotation record)
 *
 * ```ts import.meta.vitest name="Name a resolved annotation record"
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
 * **Example** (Name a merged annotation result)
 *
 * ```ts import.meta.vitest name="Name a merged annotation result"
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
> = IdentityAnnotation<Value, Identifier, Authority, Prefix> & Omit<Extras, IdentityAnnotationMetadataKeys>;

type SchemaPath<Struct extends object> = Extract<Paths<Struct>, string>;

type KeyIdentifierPath<Identifier extends string> = Identifier extends `${string}.${infer Rest}` ? Rest : Identifier;

type StrictKeyIdentifier<Struct extends object, Identifier extends TString.NonEmpty> =
  KeyIdentifierPath<SegmentValue<Identifier>> extends SchemaPath<Struct> ? SegmentValue<Identifier> : never;

type KeyIdentifierValue<Struct extends object, Identifier extends string> = Get<Struct, KeyIdentifierPath<Identifier>>;

type SchemaStatics<Schema extends S.Top> = Omit<Schema, keyof Schema["Rebuild"] | keyof S.Top>;

/**
 * Rebuilt schema type that retains custom statics after annotations are applied.
 *
 * **Example** (Describe an annotated string schema)
 *
 * ```ts import.meta.vitest name="Describe an annotated string schema"
 * import type { AnnotatedSchema } from "@beep/identity"
 * import * as S from "effect/Schema"
 *
 * type AnnotatedString = AnnotatedSchema<typeof S.String>
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type AnnotatedSchema<Schema extends S.Top> = Schema["Rebuild"] & SchemaStatics<Schema>;

/**
 * Record mapping `$`-prefixed accessor keys to child {@link IdentityComposer} instances,
 * produced by calling `compose` with one or more module segment names.
 *
 * **Example** (Name the record `compose` returns)
 *
 * ```ts import.meta.vitest name="Name the record compose returns"
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
 * **Details**
 *
 * A composer holds a current identity path and provides methods to extend the
 * path with child segments (`create`, `make`, template tag), produce annotation
 * records for Effect schemas (`annote`, `annoteClass`, `annoteSchema`,
 * `annoteHttp`, `annoteKey`), and batch-create named child composers
 * (`compose`).
 *
 * **Example** (Walk the composer surface)
 *
 * ```ts import.meta.vitest name="Walk the composer surface"
 * import { make } from "@beep/identity"
 *
 * // Create a root composer for "my-pkg"
 * const { $MyPkgId } = make("my-pkg")
 *
 * // Template tag: derive a child identity string
 * const serviceId = $MyPkgId`UserService`
 * serviceId // => "@beep/my-pkg/UserService"
 *
 * // make: one-shot string creation
 * const modelId = $MyPkgId.make("UserModel")
 * modelId // => "@beep/my-pkg/UserModel"
 *
 * // create: derive a child composer for further nesting
 * const sub = $MyPkgId.create("domain")
 * const nested = sub.make("Entity")
 * nested // => "@beep/my-pkg/domain/Entity"
 *
 * // compose: batch-create tagged child composers
 * const modules = $MyPkgId.compose("auth", "billing")
 * const authId = modules.$AuthId.make("Session")
 * authId // => "@beep/my-pkg/auth/Session"
 *
 * // annote: produce an annotation record for Effect schemas
 * const annotation = $MyPkgId.annote("UserSchema", {
 *
 * })
 * annotation.identifier // => "@beep/my-pkg/UserSchema"
 * annotation.title // => "UserSchema"
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
   * **When to use**
   *
   * Use with `S.Class`, `S.TaggedError`, or similar constructors that accept an
   * annotation record.
   *
   * **Details**
   *
   * The result carries `schemaId`, `identifier`, and `title` alongside any
   * caller-supplied extras; identity metadata wins on key collisions.
   *
   * **Example** (Annotate a domain event)
   *
   * ```ts import.meta.vitest name="Annotate a domain event"
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const ann = $MyPkgId.annote("UserCreated", { description: "A user was created." })
   *
   * ann.identifier // => "@beep/my-pkg/UserCreated"
   * ann.title // => "UserCreated"
   * ann.description // => "A user was created."
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
   * Produce a declaration-typed identity annotation record for a class constructor.
   *
   * **Details**
   *
   * Supply the declared schema and schema type-parameter tuple so
   * declaration-only hooks such as `toArbitrary` and `toEquivalence` receive
   * their real contextual types.
   *
   * **Example** (Supply a declaration-only equivalence hook)
   *
   * ```ts
   * import { make } from "@beep/identity"
   * import * as S from "effect/Schema"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const Fields = S.Struct({ value: S.String })
   * const ann = $MyPkgId.annoteClass<typeof Fields, readonly [typeof Fields]>("Value", {
   *   toEquivalence: ([sameFields]) => (self, that) => sameFields(self, that)
   * })
   *
   * console.log(ann.identifier)// "@beep/my-pkg/Value"
   * ```
   *
   * @category combinators
   * @since 0.0.0
   */
  annoteClass<
    Schema extends S.Top,
    TP extends ReadonlyArray<S.Top>,
    const Next extends TString.NonEmpty = TString.NonEmpty,
  >(
    identifier: SegmentValue<Next>,
    extras?: DeclarationAnnotationExtras<Schema["Type"], TP>
  ): S.Annotations.Declaration<Schema["Type"], TP>;

  /**
   * Produce the identity annotation record for an `S.TaggedError` whose equivalence is its
   * declared fields.
   *
   * **Details**
   *
   * Without a `toEquivalence` annotation a tagged-error declaration falls back to `Equal.equals`,
   * which compares `Error` runtime metadata and makes field-equal instances compare unequal
   * depending on construction site. This record adopts the declared field struct's equivalence, so
   * `S.toEquivalence(ErrorClass)` compares the declared fields only. Fields that must not take part
   * in identity say so on their own schema (`Defect` from `@beep/schema` declares an always-equal
   * equivalence); nothing is hand-excluded at the class.
   *
   * **Example** (Declare a tagged error with fields-only identity)
   *
   * ```ts
   * import { make } from "@beep/identity"
   * import * as S from "effect/Schema"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const $I = $MyPkgId.create("Widget")
   *
   * class WidgetError extends S.TaggedError<WidgetError>($I`WidgetError`)(
   *   "WidgetError",
   *   { reason: S.String },
   *   $I.annoteError<WidgetError>("WidgetError", { description: "Widget failed." })
   * ) {}
   *
   * const same = S.toEquivalence(WidgetError)
   * console.log(same(WidgetError.make({ reason: "x" }), WidgetError.make({ reason: "x" }))) // true
   * ```
   *
   * @category combinators
   * @since 0.0.0
   */
  annoteError<Self>(
    identifier: SegmentValue<TString.NonEmpty>,
    extras?: undefined | S.Annotations.Documentation<Self>
  ): ErrorAnnotationRecord<Self>;

  /**
   * Produce a schema annotation function with HTTP API metadata.
   *
   * **Details**
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
   * **Details**
   *
   * When called with zero arguments, returns a curried builder that constrains
   * the identifier to valid paths within `Parent`.
   *
   * **Example** (Annotate a struct field by path)
   *
   * ```ts import.meta.vitest name="Annotate a struct field by path"
   * import { make } from "@beep/identity"
   * import * as S from "effect/Schema";
   * const { $MyPkgId } = make("my-pkg")
   * const modules = $MyPkgId.compose("auth", "billing")
   *
   * const $I = modules.$AuthId.create("Session")
   * $I.string() // => "@beep/my-pkg/auth/Session"
   *
   * const MyStruct = S.Struct({
   *  prop1: S.String.annotateKey($I.annoteKey("MyStruct.prop1", { description: "A string" }))
   * })
   * ```
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
   * **Details**
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
   * Produce an ontology class annotation record for an Effect schema class.
   *
   * **Details**
   *
   * Identical to `annote` plus an optional SKOS classification marker written
   * to the `skosClassification` annotation channel. This is the nominal class
   * entrypoint for the ontology fold; membership in a fold comes from the
   * fold's `schemas` list, not from this marker.
   *
   * **Example** (Annotate an ontology concept)
   *
   * ```ts import.meta.vitest name="Annotate an ontology concept"
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg", { authority: "https://ns.beep.sh/", prefix: "beep" })
   * const $I = $MyPkgId.create("patent")
   * const ann = $I.class("Claim", { description: "A patent claim.", skos: "concept" })
   *
   * ann.identifier // => "@beep/my-pkg/patent/Claim"
   * ann.skosClassification // => "concept"
   * ```
   *
   * @since 0.0.0
   * @category combinators
   */
  class<const Next extends TString.NonEmpty = TString.NonEmpty, const Extras extends OntologyClassExtras = {}>(
    identifier: SegmentValue<Next>,
    extras?: undefined | Extras
  ): IdentityAnnotationResult<
    `${Value}/${SegmentValue<Next>}`,
    SegmentValue<Next>,
    Omit<Extras, "skos">,
    Authority,
    Prefix
  > & { readonly skosClassification?: SkosClassification };

  /**
   * Batch-create child {@link IdentityComposer} instances for multiple module segments.
   *
   * **Details**
   *
   * Returns a record whose keys are `$`-prefixed PascalCase accessors (e.g. `$AuthId`)
   * mapped to child composers rooted at `{Value}/{segment}`.
   *
   * **Example** (Create module composers in one call)
   *
   * ```ts import.meta.vitest name="Create module composers in one call"
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const modules = $MyPkgId.compose("auth", "billing")
   *
   * const authId = modules.$AuthId.make("Session")
   * authId // => "@beep/my-pkg/auth/Session"
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
   * **Details**
   *
   * Unlike `make` (which returns a plain string), `create` returns a full
   * composer that supports further nesting, annotation, and composition.
   *
   * **Example** (Nest a child composer)
   *
   * ```ts import.meta.vitest name="Nest a child composer"
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const sub = $MyPkgId.create("domain")
   * const entityId = sub.make("Entity")
   * entityId // => "@beep/my-pkg/domain/Entity"
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
   * **Example** (Read a bound CURIE)
   *
   * ```ts import.meta.vitest name="Read a bound CURIE"
   * import { make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
   * const curie = $BeepId.create("schema").curie
   * curie // => "beep:schema"
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
   * **Gotchas**
   *
   * One-argument `make(...)` calls intentionally produce unbound composers, so
   * callers must handle `undefined` there. Root-bound package composers derive
   * exact literals from the configured authority.
   *
   * **Example** (Read a bound IRI)
   *
   * ```ts import.meta.vitest name="Read a bound IRI"
   * import { make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
   * const iri = $BeepId.create("schema").iri
   * iri // => "https://ns.beep.sh/schema"
   * ```
   *
   * @since 0.0.0
   * @category getters
   */
  readonly iri: BoundComposerIri<Authority, Value>;

  /**
   * Produce a key annotator that writes a borrowed predicate to the
   * `ontologyTerm` channel.
   *
   * **Details**
   *
   * The predicate is a closed CURIE literal from the composer's vocabulary
   * (`"skos:prefLabel"`), optionally reverse-marked (`"^rdfs:subClassOf"`,
   * projected as JSON-LD `@reverse`). Owned predicates omit `term` — the
   * fold defaults the local name from the struct key. Borrowed vocabulary
   * never rides the owned `identifier` channel.
   *
   * **Example** (Borrow, reverse, and own predicates)
   *
   * ```ts import.meta.vitest name="Borrow, reverse, and own predicates"
   * import { make } from "@beep/identity"
   * import * as S from "effect/Schema"
   *
   * const { $MyPkgId } = make("my-pkg", { authority: "https://ns.beep.sh/", prefix: "beep" })
   * const $I = $MyPkgId.create("patent")
   *
   * const Claim = S.Struct({
   *   prefLabel: S.String.pipe($I.key("skos:prefLabel")),
   *   children: S.Array(S.String).pipe($I.key("^rdfs:subClassOf")),
   *   text: S.String.pipe($I.key({ description: "Claim text." })),
   * })
   *
   * S.resolveAnnotationsKey(Claim.fields.prefLabel)?.ontologyTerm // => "skos:prefLabel"
   * ```
   *
   * @since 0.0.0
   * @category combinators
   */
  key(term: Predicate<Vocab>): <Schema extends S.Top>(self: Schema) => Schema["Rebuild"];
  key(options: OntologyKeyOptions<Vocab>): <Schema extends S.Top>(self: Schema) => Schema["Rebuild"];

  /**
   * Create a child identity string by appending one segment.
   *
   * **Example** (Append one segment)
   *
   * ```ts import.meta.vitest name="Append one segment"
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const id = $MyPkgId.make("UserModel")
   * id // => "@beep/my-pkg/UserModel"
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
   * **Example** (Rebase onto a foreign namespace)
   *
   * ```ts import.meta.vitest name="Rebase onto a foreign namespace"
   * import { make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep" })
   * const patent = $BeepId.create("ontology").create("patent")
   * const rebased = patent.rebase({ iri: "https://opip.law/ns/patent#", prefix: "patent" })
   * rebased.iri // => "https://opip.law/ns/patent#ontology/patent"
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
   * **Example** (Slug a nested composer path)
   *
   * ```ts import.meta.vitest name="Slug a nested composer path"
   * import { make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep")
   * const slug = $BeepId.create("Ontology.models").create("HttpUrl").slug
   * slug // => "beep-ontology-models-http-url"
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
   * The vocabulary registry supplied at binding time, or `undefined` when the
   * composer is unbound or bound without a vocabulary extension (consumers
   * default to the core registry).
   *
   * **Example** (Read the bound vocabulary)
   *
   * ```ts import.meta.vitest name="Read the bound vocabulary"
   * import { CoreVocab, make } from "@beep/identity"
   *
   * const { $BeepId } = make("beep", { authority: "https://ns.beep.sh/", prefix: "beep", vocab: CoreVocab })
   * $BeepId.vocabRegistry === CoreVocab // => true
   * ```
   *
   * @since 0.0.0
   * @category getters
   */
  readonly vocabRegistry: Vocab | undefined;

  /**
   * Template tag call signature for creating child identity strings.
   *
   * **Gotchas**
   *
   * Must be called with a single static string literal and no interpolations;
   * either violation throws at call time rather than failing to type-check.
   *
   * **Example** (Derive a service identity)
   *
   * ```ts import.meta.vitest name="Derive a service identity"
   * import { make } from "@beep/identity"
   *
   * const { $MyPkgId } = make("my-pkg")
   * const id = $MyPkgId`UserService`
   * id // => "@beep/my-pkg/UserService"
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

const stripPrefix = (prefix: string) =>
  flow(O.liftPredicate(Str.startsWith(prefix)), O.map(Str.slice(Str.length(prefix))));

const normalizeBaseValue = (value: string): string => {
  const namespaceBaseOption = O.as(O.liftPredicate(isBeepNamespace)(value), beepBase);
  const scopedNamespaceOption = stripPrefix(`${beepNamespace}/`)(value);
  const atPrefixNamespaceOption = stripPrefix(beepNamespace)(value);
  const withoutNamespace = pipe(
    [namespaceBaseOption, scopedNamespaceOption, atPrefixNamespaceOption],
    O.firstSomeOf,
    O.getOrElse(() => value)
  );

  return pipe(
    stripPrefix("@")(withoutNamespace),
    O.getOrElse(() => withoutNamespace)
  );
};

/**
 * Schema for package identity constructor input after `@beep` prefix normalization.
 *
 * **Details**
 *
 * Decoding strips an accepted `@beep/`, `@beep`, or bare `@` prefix, so
 * `"@beep/my-pkg"` and `"my-pkg"` normalize to the same base segment.
 *
 * **Example** (Normalize a scoped package name)
 *
 * ```ts import.meta.vitest name="Normalize a scoped package name"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { BaseIdentityInput } from "@beep/identity"
 *
 * const normalized = S.decodeUnknownOption(BaseIdentityInput)("@beep/my-pkg")
 * O.getOrElse(normalized, () => "invalid") // => "my-pkg"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const BaseIdentityInput = S.String.pipe(
  S.decodeTo(
    BaseSegmentSchema,
    SchemaTransformation.transform({
      decode: normalizeBaseValue,
      encode: Fn.identity,
    })
  )
).annotate({
  identifier: "@beep/identity/Id/BaseIdentityInput",
  title: "Base Identity Input",
  description: "Package identity constructor input normalized by stripping accepted @beep prefixes.",
});

/**
 * Runtime type for {@link BaseIdentityInput}.
 *
 * **Example** (Hold a normalized base segment)
 *
 * ```ts
 * import type { BaseIdentityInput } from "@beep/identity"
 *
 * const base: BaseIdentityInput = "my-pkg"
 * console.log(base)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BaseIdentityInput = typeof BaseIdentityInput.Type;

const decodeBaseIdentityInput = S.decodeUnknownSync(BaseIdentityInput);

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
    A.map(Str.capitalize),
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

const toPascalTitle = flow(toTitle, Str.replace(/\s+/g, ""));

const toPascalIdentifier = <const Segment extends TString.NonEmpty>(segment: Segment): ModulePascal<Segment> =>
  toPascalTitle(segment) as ModulePascal<Segment>;

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

const normalizeBase = <const Base extends TString.NonEmpty>(base: Base): NormalizedBase<Base> =>
  decodeBaseIdentityInput(base) as NormalizedBase<Base>;

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

    return pipe(strings[0], S.decodeSync(ModuleSegmentSchema), (segment) =>
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

  const mergeIdentityAnnotation = <
    const Next extends TString.NonEmpty = TString.NonEmpty,
    const Extras extends object = {},
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

  const annote = <
    const Next extends TString.NonEmpty = TString.NonEmpty,
    const Extras extends IdentityAnyAnnotationExtras<unknown> = {},
  >(
    identifier: SegmentValue<Next>,
    extras?: undefined | Extras
  ): IdentityAnnotationResult<`${Value}/${SegmentValue<Next>}`, SegmentValue<Next>, Extras, Authority, Prefix> =>
    mergeIdentityAnnotation(identifier, extras);

  const annoteClass = <
    Schema extends S.Top,
    TP extends ReadonlyArray<S.Top>,
    const Next extends TString.NonEmpty = TString.NonEmpty,
  >(
    identifier: SegmentValue<Next>,
    extras?: DeclarationAnnotationExtras<Schema["Type"], TP>
  ): S.Annotations.Declaration<Schema["Type"], TP> =>
    mergeIdentityAnnotation(identifier, extras) as S.Annotations.Declaration<Schema["Type"], TP>;

  const annoteError = <Self>(
    identifier: SegmentValue<TString.NonEmpty>,
    extras?: undefined | S.Annotations.Documentation<Self>
  ): ErrorAnnotationRecord<Self> => {
    const merged = mergeIdentityAnnotation(identifier, extras);
    return {
      ...extras,
      schemaId: merged.schemaId,
      identifier: merged.identifier,
      ...(merged.iri === undefined || merged.curie === undefined
        ? {}
        : {
            iri: merged.iri,
            curie: merged.curie,
          }),
      title: extras?.title ?? merged.title,
      toEquivalence: adoptDeclaredFieldsEquivalence<Self>,
    };
  };

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

  type LooseOntologyKeyOptions = KeyAnnotationExtras<unknown> & {
    readonly term?: string | undefined;
    readonly identifier?: unknown;
    readonly schemaId?: unknown;
    readonly iri?: unknown;
    readonly curie?: unknown;
  };

  const ontologyKey = (input: string | LooseOntologyKeyOptions) => {
    const options: LooseOntologyKeyOptions = P.isString(input) ? { term: input } : input;
    const { curie: _curie, identifier: _identifier, iri: _iri, schemaId: _schemaId, term, ...extras } = options;
    const annotation = term === undefined ? extras : { ...extras, ontologyTerm: term };

    return <Schema extends S.Top>(self: Schema): Schema["Rebuild"] => self.annotateKey(annotation);
  };

  const ontologyClass = <const Next extends TString.NonEmpty = TString.NonEmpty>(
    identifier: SegmentValue<Next>,
    extras?: undefined | OntologyClassExtras
  ) => {
    const { skos, ...rest } = extras ?? {};

    return mergeIdentityAnnotation(identifier, skos === undefined ? rest : { ...rest, skosClassification: skos });
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
    vocabRegistry: {
      value: binding?.vocab,
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
    annoteClass: {
      value: annoteClass,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    annoteError: {
      value: annoteError,
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
    key: {
      value: ontologyKey,
      enumerable: true,
      writable: true,
      configurable: true,
    },
    class: {
      value: ontologyClass,
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
 * **Details**
 *
 * Accepts a base string (with or without the `@beep/` prefix) and returns
 * a record containing a single `$`-prefixed PascalCase accessor mapped to
 * the root {@link IdentityComposer} for that package. The one-argument form
 * leaves the composer unbound, so its `iri` and `curie` projections are
 * `undefined` until an authority and prefix are supplied.
 *
 * **Example** (Compose from a bare package name)
 *
 * ```ts import.meta.vitest name="Compose from a bare package name"
 * import { make } from "@beep/identity"
 *
 * // Bare name -- "@beep/" prefix is added automatically
 * const { $MyPkgId } = make("my-pkg")
 * const id = $MyPkgId.make("Service")
 * id // => "@beep/my-pkg/Service"
 * ```
 *
 * **Example** (Compose from a fully scoped name)
 *
 * ```ts
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
export const make: {
  <const Authority extends string, const Prefix extends string, const Vocab extends VocabShape = CoreVocab>(
    options: IdentityBinding<Authority, Prefix, Vocab>
  ): <const Base extends TString.NonEmpty>(base: Base) => MakeReturn<Base, Authority, Prefix, Vocab>;
  <const Base extends TString.NonEmpty>(base: Base): MakeReturn<Base, undefined, undefined>;
  <
    const Base extends TString.NonEmpty,
    const Authority extends string,
    const Prefix extends string,
    const Vocab extends VocabShape = CoreVocab,
  >(
    base: Base,
    options: IdentityBinding<Authority, Prefix, Vocab>
  ): MakeReturn<Base, Authority, Prefix, Vocab>;
} = Fn.dual(
  (args: IArguments) => P.isString(args[0]),
  <
    const Base extends TString.NonEmpty,
    const Authority extends string,
    const Prefix extends string,
    const Vocab extends VocabShape = CoreVocab,
  >(
    base: Base,
    options?: IdentityBinding<Authority, Prefix, Vocab>
  ): MakeReturn<Base, Authority | undefined, Prefix | undefined, Vocab> => {
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
);
