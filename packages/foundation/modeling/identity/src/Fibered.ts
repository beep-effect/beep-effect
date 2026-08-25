/**
 * Discrete fiber families with schema-validated section metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { HashMap, pipe, Result, Struct } from "effect";
import * as A from "effect/Array";
import * as R from "effect/Record";
import * as S from "effect/Schema";

declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly fiberedSection?: unknown | undefined;
    }
  }
}

type FiberMember<Point extends string, Fiber extends S.Top> = S.Struct<{
  readonly _tag: S.tag<Point>;
  readonly value: Fiber;
}>;

type FiberMembers<Points extends ReadonlyArray<string>, Fibers extends FiberMap<Points>> = {
  readonly [Point in Points[number]]: FiberMember<Point, Fibers[Point]>;
};

type FiberMemberTuple<Points extends ReadonlyArray<string>, Fibers extends FiberMap<Points>> = {
  readonly [Index in keyof Points]: Points[Index] extends Points[number]
    ? FiberMember<Points[Index], Fibers[Points[Index]]>
    : never;
};

type FiberMap<Points extends ReadonlyArray<string>> = {
  readonly [Point in Points[number]]: S.Top;
};

type RestrictedFibers<Sub extends ReadonlyArray<string>, Fibers> = {
  readonly [Point in Sub[number]]: Point extends keyof Fibers ? Fibers[Point] : never;
};

type SectionValues<Points extends ReadonlyArray<string>, Section extends S.Top> = {
  readonly [Point in Points[number]]: Section["Encoded"];
};

type SynchronousSection = S.Top & S.ConstraintDecoder<unknown>;

/**
 * Construction input for a finite discrete base, its fiber schemas, and a total section.
 *
 * **Details**
 *
 * Every literal in `base` must have both a fiber schema and an encoded section value.
 * The optional member hook may rebuild the thin `{ _tag, value }` schema while preserving
 * that shape.
 *
 * @category models
 * @since 0.0.0
 */
export interface FiberedInput<
  Points extends ReadonlyArray<string>,
  Fibers extends FiberMap<Points>,
  Section extends SynchronousSection,
> {
  readonly annotationKey?: string | undefined;
  readonly base: S.Literals<Points>;
  readonly fibers: Fibers;
  readonly member?:
    | (<Point extends Points[number]>(point: Point, fiber: Fibers[Point]) => FiberMember<Point, Fibers[Point]>)
    | undefined;
  readonly section: {
    readonly schema: Section;
    readonly values: SectionValues<Points, Section>;
  };
}

/**
 * A finite family of schemas indexed by string literals with one decoded metadata value per point.
 *
 * **Details**
 *
 * Members and section values are built once. Pullback restricts the base and reuses those
 * member and metadata references.
 *
 * @category models
 * @since 0.0.0
 */
export interface Fibered<
  Points extends ReadonlyArray<string>,
  Fibers extends FiberMap<Points>,
  Section extends SynchronousSection,
> {
  readonly base: S.Literals<Points>;
  readonly fiberOf: (value: { readonly _tag: Points[number] }) => Section["Type"];
  readonly member: <Point extends Points[number]>(point: Point) => FiberMember<Point, Fibers[Point]>;
  readonly members: FiberMembers<Points, Fibers>;
  readonly meta: <Point extends Points[number]>(point: Point) => Section["Type"];
  readonly points: Points;
  readonly project: <Point extends Points[number], Keys extends keyof Section["Type"]>(
    point: Point,
    keys: ReadonlyArray<Keys>
  ) => Pick<Section["Type"], Keys>;
  readonly pullback: <const Sub extends ReadonlyArray<Points[number]>>(
    points: Sub
  ) => Fibered<Sub, RestrictedFibers<Sub, Fibers>, Section>;
  readonly union: S.Union<FiberMemberTuple<Points, Fibers>>;
}

const defaultMember = <Point extends string, Fiber extends S.Top>(
  point: Point,
  fiber: Fiber
): FiberMember<Point, Fiber> =>
  S.Struct({
    _tag: S.tag(point),
    value: fiber,
  });

const buildFibered = <
  const Points extends ReadonlyArray<string>,
  Fibers extends FiberMap<Points>,
  Section extends SynchronousSection,
>(
  base: S.Literals<Points>,
  memberMap: HashMap.HashMap<Points[number], FiberMember<Points[number], Fibers[Points[number]]>>,
  sectionMap: HashMap.HashMap<Points[number], Section["Type"]>
): Fibered<Points, Fibers, Section> => {
  const member = <Point extends Points[number]>(point: Point): FiberMember<Point, Fibers[Point]> =>
    HashMap.getUnsafe(memberMap, point) as FiberMember<Point, Fibers[Point]>;
  const meta = <Point extends Points[number]>(point: Point): Section["Type"] => HashMap.getUnsafe(sectionMap, point);
  const members = pipe(
    base.literals,
    A.map((point) => [point, member(point)] as const),
    R.fromEntries
  ) as FiberMembers<Points, Fibers>;
  const union = S.Union(A.map(base.literals, member)) as S.Union<FiberMemberTuple<Points, Fibers>>;

  return {
    points: base.literals,
    base,
    members,
    member,
    union,
    meta,
    fiberOf: (value) => meta(value._tag),
    project: (point, keys) => Struct.pick(meta(point) as Section["Type"] & object, keys),
    pullback: (points) =>
      buildFibered(
        S.Literals(points),
        memberMap as HashMap.HashMap<
          (typeof points)[number],
          FiberMember<(typeof points)[number], RestrictedFibers<typeof points, Fibers>[(typeof points)[number]]>
        >,
        sectionMap as HashMap.HashMap<(typeof points)[number], Section["Type"]>
      ),
  };
};

const make = <
  const Points extends ReadonlyArray<string>,
  Fibers extends FiberMap<Points>,
  Section extends SynchronousSection,
>(
  input: FiberedInput<Points, Fibers, Section>
): Fibered<Points, Fibers, Section> => {
  const annotationKey = input.annotationKey ?? "fiberedSection";
  const makeMember = <Point extends Points[number]>(
    point: Point,
    fiber: Fibers[Point]
  ): FiberMember<Point, Fibers[Point]> =>
    input.member === undefined ? defaultMember(point, fiber) : input.member(point, fiber);
  const maps = A.reduce(
    input.base.literals,
    {
      members: HashMap.empty<Points[number], FiberMember<Points[number], Fibers[Points[number]]>>(),
      section: HashMap.empty<Points[number], Section["Type"]>(),
    },
    (current, point: Points[number]) => {
      const section = Result.getOrThrow(S.decodeResult(input.section.schema)(input.section.values[point]));
      const member = makeMember(point, input.fibers[point]).annotate({ [annotationKey]: section });

      return {
        members: HashMap.set(current.members, point, member),
        section: HashMap.set(current.section, point, section),
      };
    }
  );

  return buildFibered(input.base, maps.members, maps.section);
};

/**
 * Constructs a discrete fiber family and decodes its total section once.
 *
 * **Example** (Build and inspect a two-point family)
 *
 * ```ts
 * import { Fibered } from "@beep/identity"
 * import * as S from "effect/Schema"
 *
 * const family = Fibered.make({
 *   base: S.Literals(["text", "count"]),
 *   fibers: { text: S.String, count: S.Number },
 *   section: {
 *     schema: S.Struct({ label: S.String }),
 *     values: { text: { label: "Text" }, count: { label: "Count" } }
 *   }
 * })
 *
 * console.log(family.meta("text").label) // "Text"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Fibered = { make } as const;
