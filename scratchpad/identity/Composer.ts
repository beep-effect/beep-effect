import { pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CoreVocab, Curie, Predicate, VocabShape } from "./Vocab.ts";

type StaticString<Value extends string> = string extends Value ? never : Value;

export type SegmentValue<Value extends string> = StaticString<Value> extends never
  ? never
  : Value extends "" | `/${string}` | `${string}/`
    ? never
    : Value;

type RootValue<Value extends string> = SegmentValue<Value> extends never
  ? never
  : Value extends `${string}/${string}`
    ? never
    : SegmentValue<Value>;

type TailOfIdentity<Value extends string> = Value extends `@${string}/${infer Tail}` ? Tail : "";

export type IriFromIdentity<Authority extends string, Value extends string> = TailOfIdentity<Value> extends ""
  ? Authority
  : `${Authority}${TailOfIdentity<Value>}`;

export type CurieFromIdentity<Prefix extends string, Value extends string> = TailOfIdentity<Value> extends ""
  ? `${Prefix}:`
  : `${Prefix}:${TailOfIdentity<Value>}`;

type StripAt<Value extends string> = Value extends `@${infer Rest}` ? Rest : Value;
type ReplaceSlash<Value extends string> = Value extends `${infer Head}/${infer Tail}`
  ? `${ReplaceSlash<Head>}-${ReplaceSlash<Tail>}`
  : Value;
type ReplaceDot<Value extends string> = Value extends `${infer Head}.${infer Tail}`
  ? `${ReplaceDot<Head>}-${ReplaceDot<Tail>}`
  : Value;
type ReplaceUnderscore<Value extends string> = Value extends `${infer Head}_${infer Tail}`
  ? `${ReplaceUnderscore<Head>}-${ReplaceUnderscore<Tail>}`
  : Value;
type ReplaceSpace<Value extends string> = Value extends `${infer Head} ${infer Tail}`
  ? `${ReplaceSpace<Head>}-${ReplaceSpace<Tail>}`
  : Value;

export type SlugFromIdentifier<Value extends string> = Lowercase<
  ReplaceSpace<ReplaceUnderscore<ReplaceDot<ReplaceSlash<StripAt<Value>>>>>
>;

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
  ? Capitalize<Head>
  : Words extends readonly [infer Head extends string, ...infer Tail extends ReadonlyArray<string>]
    ? `${Capitalize<Head>} ${JoinTitleWords<Tail>}`
    : "";

export type TitleFromIdentifier<Value extends string> = JoinTitleWords<
  SplitTitleWords<TrimTitleSpaces<NormalizeTitleSeparators<Value>>>
>;

export type IdentitySymbol<Value extends string> = symbol & {
  readonly description: Value;
};

export type ComposerCurie<V extends VocabShape = CoreVocab> = Curie<V>;
export type ComposerPredicate<V extends VocabShape = CoreVocab> = Predicate<V>;

type MetadataKeys = "identifier" | "iri" | "curie" | "title";

export type Annotation<
  Value extends string,
  Authority extends string,
  Prefix extends string,
  Name extends string,
  Extras extends object = {},
> = Omit<Extras, MetadataKeys> & {
  readonly identifier: `${Value}/${SegmentValue<Name>}`;
  readonly iri: IriFromIdentity<Authority, `${Value}/${SegmentValue<Name>}`>;
  readonly curie: CurieFromIdentity<Prefix, `${Value}/${SegmentValue<Name>}`>;
  readonly title: TitleFromIdentifier<SegmentValue<Name>>;
};

type MakeOptions<Authority extends string, Prefix extends string, V extends VocabShape> = {
  readonly authority: Authority;
  readonly prefix: Prefix;
  readonly vocab?: V | undefined;
};

export interface IdentityComposer<
  Value extends string,
  Authority extends string,
  Prefix extends string,
  V extends VocabShape = CoreVocab,
> {
  readonly identity: Value;
  readonly iri: IriFromIdentity<Authority, Value>;
  readonly curie: CurieFromIdentity<Prefix, Value>;
  readonly slug: SlugFromIdentifier<Value>;
  readonly symbol: IdentitySymbol<Value>;
  create<const Next extends string>(
    segment: SegmentValue<Next>
  ): IdentityComposer<`${Value}/${SegmentValue<Next>}`, Authority, Prefix, V>;
  make<const Next extends string>(segment: SegmentValue<Next>): `${Value}/${SegmentValue<Next>}`;
  rebase<const Iri extends string, const NextPrefix extends string>(
    options: { readonly iri: Iri; readonly prefix: NextPrefix }
  ): IdentityComposer<Value, Iri, NextPrefix, V>;
  annote<const Next extends string, const Extras extends object = {}>(
    name: SegmentValue<Next>,
    extras?: Extras
  ): Annotation<Value, Authority, Prefix, Next, Extras>;
  <const Next extends string>(
    strings: TemplateStringsArray & readonly [SegmentValue<Next>],
    ...values: readonly []
  ): `${Value}/${SegmentValue<Next>}`;
}

const Segment = S.String.check(
  S.isNonEmpty({
    identifier: "@beep/identity/prototype/check/non-empty-segment",
    message: "Identity segments cannot be empty.",
  }),
  S.makeFilter((segment: string) => !pipe(segment, Str.startsWith("/")), {
    identifier: "@beep/identity/prototype/check/no-leading-slash",
    message: "Identity segments cannot start with /.",
  }),
  S.makeFilter((segment: string) => !pipe(segment, Str.endsWith("/")), {
    identifier: "@beep/identity/prototype/check/no-trailing-slash",
    message: "Identity segments cannot end with /.",
  })
);

const validateSegment = <const Value extends string>(segment: SegmentValue<Value>): SegmentValue<Value> => {
  S.decodeUnknownSync(Segment)(segment);
  return segment;
};

const toLocalPath = (identity: string): string =>
  pipe(
    identity,
    Str.split("/"),
    A.drop(1),
    A.join("/")
  );

const toIri = <const Authority extends string, const Value extends string>(
  authority: Authority,
  identity: Value
): IriFromIdentity<Authority, Value> => {
  const localPath = toLocalPath(identity);
  return (localPath === "" ? authority : `${authority}${localPath}`) as IriFromIdentity<Authority, Value>;
};

const toCurie = <const Prefix extends string, const Value extends string>(
  prefix: Prefix,
  identity: Value
): CurieFromIdentity<Prefix, Value> => {
  const localPath = toLocalPath(identity);
  return (localPath === "" ? `${prefix}:` : `${prefix}:${localPath}`) as CurieFromIdentity<Prefix, Value>;
};

const toSlug = <const Value extends string>(identity: Value): SlugFromIdentifier<Value> =>
  pipe(
    identity,
    Str.replace(/^@/, ""),
    Str.replace(/([a-z0-9])([A-Z])/g, "$1-$2"),
    Str.replace(/[/. _]+/g, "-"),
    Str.replace(/^-+|-+$/g, ""),
    Str.toLowerCase
  ) as SlugFromIdentifier<Value>;

const toTitle = <const Value extends string>(name: SegmentValue<Value>): TitleFromIdentifier<SegmentValue<Value>> =>
  pipe(
    name,
    Str.replace(/[_-]+/g, " "),
    Str.split(" "),
    A.filter(Str.isNonEmpty),
    A.map((word) => `${Str.toUpperCase(Str.slice(0, 1)(word))}${Str.slice(1)(word)}`),
    A.join(" ")
  ) as TitleFromIdentifier<SegmentValue<Value>>;

const validateTemplate = (strings: TemplateStringsArray, values: ReadonlyArray<unknown>): void => {
  S.decodeUnknownSync(S.Literal(1))(strings.length);
  S.decodeUnknownSync(S.Literal(0))(values.length);
};

const createComposer = <
  const Value extends string,
  const Authority extends string,
  const Prefix extends string,
  const V extends VocabShape,
>(
  identity: Value,
  authority: Authority,
  prefix: Prefix,
  vocab: V | undefined
): IdentityComposer<Value, Authority, Prefix, V> => {
  const create = <const Next extends string>(
    segment: SegmentValue<Next>
  ): IdentityComposer<`${Value}/${SegmentValue<Next>}`, Authority, Prefix, V> => {
    const next = validateSegment(segment);
    return createComposer(`${identity}/${next}` as `${Value}/${SegmentValue<Next>}`, authority, prefix, vocab);
  };

  const makeChild = <const Next extends string>(segment: SegmentValue<Next>): `${Value}/${SegmentValue<Next>}` =>
    create(segment).identity;

  const annote = <const Next extends string, const Extras extends object = {}>(
    name: SegmentValue<Next>,
    extras?: Extras
  ): Annotation<Value, Authority, Prefix, Next, Extras> => {
    const next = validateSegment(name);
    const child = create(next);
    return {
      ...extras,
      identifier: child.identity,
      iri: child.iri,
      curie: child.curie,
      title: toTitle(next),
    } as Annotation<Value, Authority, Prefix, Next, Extras>;
  };

  function template(strings: TemplateStringsArray, ...values: ReadonlyArray<unknown>) {
    validateTemplate(strings, values);
    return makeChild(strings[0] as SegmentValue<string>);
  }

  return Object.assign(template, {
    identity,
    iri: toIri(authority, identity),
    curie: toCurie(prefix, identity),
    slug: toSlug(identity),
    symbol: Symbol.for(identity) as IdentitySymbol<Value>,
    create,
    make: makeChild,
    rebase: <const Iri extends string, const NextPrefix extends string>(options: {
      readonly iri: Iri;
      readonly prefix: NextPrefix;
    }) => createComposer(identity, options.iri, options.prefix, vocab),
    annote,
  }) as IdentityComposer<Value, Authority, Prefix, V>;
};

export const make = <
  const Root extends string,
  const Authority extends string,
  const Prefix extends string,
  const V extends VocabShape = CoreVocab,
>(
  root: RootValue<Root>,
  options: MakeOptions<Authority, Prefix, V>
): IdentityComposer<`@${RootValue<Root>}`, Authority, Prefix, V> =>
  createComposer(`@${root}` as `@${RootValue<Root>}`, options.authority, options.prefix, options.vocab);
