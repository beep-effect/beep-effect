/**
 * SPDX license-expression AST nodes and the parse/serialize facade over them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SpdxId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as SchemaIssue from "effect/SchemaIssue";
import * as SchemaTransformation from "effect/SchemaTransformation";
import { parse as parseRaw } from "./internal/parser.ts";
import { InvalidSpdxExpressionError, License } from "./License.ts";
import type * as Data from "effect/Data";
import type { RawExpression, RawSimpleLicense } from "./internal/parser.ts";

const $I = $SpdxId.create("SpdxExpression");

type InstanceOrEncodedNode = Data.TaggedEnum<{
  License: { readonly id: string; readonly plus: boolean };
  LicenseRef: {
    readonly documentRef?: string;
    readonly ref: string;
  };
  WithException: {
    readonly license: typeof LicenseNode.Encoded | typeof LicenseRefNode.Encoded;
    readonly exception: string;
  };
  And: { readonly left: InstanceOrEncodedNode; readonly right: InstanceOrEncodedNode };
  Or: { readonly left: InstanceOrEncodedNode; readonly right: InstanceOrEncodedNode };
}>;

const serializeCanonical: (node: InstanceOrEncodedNode) => string = Match.type<InstanceOrEncodedNode>().pipe(
  Match.tagsExhaustive({
    License: (node) => (node.plus ? `${node.id}+` : node.id),
    LicenseRef: (node) => {
      const prefix = node.documentRef !== undefined ? `DocumentRef-${node.documentRef}:` : "";
      return `${prefix}LicenseRef-${node.ref}`;
    },
    WithException: (node) => `${serializeCanonical(node.license)} WITH ${node.exception}`,
    And: (node) => `(${serializeCanonical(node.left)} AND ${serializeCanonical(node.right)})`,
    Or: (node) => `(${serializeCanonical(node.left)} OR ${serializeCanonical(node.right)})`,
  })
);

/**
 * **Example** (Construct a LicenseNode expression)
 *
 * ```ts
 * import { LicenseNode } from "@beep/spdx/SpdxExpression";
 *
 * const node = LicenseNode.make({ id: "GPL-2.0", plus: true });
 * console.log(node.toString()); // GPL-2.0+
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LicenseNode extends S.TaggedClass<
  LicenseNode,
  {
    readonly brand: unique symbol;
  }
>($I`LicenseNode`)(
  "License",
  {
    /** The SPDX short identifier, e.g. `"MIT"` or `"Apache-2.0"`. */
    id: S.String.pipe(
      $I.annoteKey("LicenseNode.id", { description: 'The SPDX short identifier, e.g. `"MIT"` or `"Apache-2.0"`.' })
    ),
    /** Whether the trailing `+` "or later" marker is present. */
    plus: S.Boolean.pipe(
      $I.annoteKey("LicenseNode.plus", { description: 'Whether the trailing `+` "or later" marker is present.' })
    ),
  },
  $I.annote("LicenseNode", {
    description:
      'A simple-license leaf of an SPDX expression: a license identifier with the trailing `+` ("or later") marker. This is the expression-level license node, distinct from the catalog License class, which validates and resolves an identifier but does not model the `+` operator.',
  })
) {
  /**
   * The canonical string form: the id, suffixed with `+` when `plus` is set.
   *
   * **Example** (Serialize a LicenseNode expression)
   *
   * ```ts
   * import { LicenseNode } from "@beep/spdx/SpdxExpression";
   *
   * const node = LicenseNode.make({ id: "GPL-2.0", plus: true });
   * console.log(node.toString()); // GPL-2.0+
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override toString(): string {
    return serializeCanonical(this);
  }
}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LicenseNode {
  /**
   * Encoded license identifier and its optional later-version marker.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "License";
    readonly id: string;
    readonly plus: boolean;
  }
}

/**
 * **Example** (Construct a LicenseRefNode expression)
 *
 * ```ts
 * import { LicenseRefNode } from "@beep/spdx/SpdxExpression";
 *
 * const node = LicenseRefNode.make({ documentRef: "acme", ref: "custom" });
 * console.log(node.toString()); // DocumentRef-acme:LicenseRef-custom
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class LicenseRefNode extends S.TaggedClass<
  LicenseRefNode,
  {
    readonly brand: unique symbol;
  }
>($I`LicenseRefNode`)(
  "LicenseRef",
  {
    /** The `DocumentRef-` idstring when the reference is document-scoped; absent otherwise. */
    documentRef: S.optionalKey(S.String).pipe(
      $I.annoteKey("LicenseRefNode.documentRef", {
        description: "The `DocumentRef-` idstring when the reference is document-scoped; absent otherwise.",
      })
    ),
    /** The `LicenseRef-` idstring. */
    ref: S.String.pipe($I.annoteKey("LicenseRefNode.ref", { description: "The `LicenseRef-` idstring." })),
  },
  $I.annote("LicenseRefNode", {
    description:
      "A `LicenseRef`/`DocumentRef` reference leaf. The `LicenseRef-`/`DocumentRef-` prefixes and the `:` separator are structural and are not stored; only the bare idstrings are kept, so the node round-trips to canonical form without duplicating the grammar.",
  })
) {
  /**
   * The canonical string form, re-attaching the `DocumentRef-…:` prefix when present.
   *
   * **Example** (Serialize a LicenseRefNode expression)
   *
   * ```ts
   * import { LicenseRefNode } from "@beep/spdx/SpdxExpression";
   *
   * const node = LicenseRefNode.make({ documentRef: "acme", ref: "custom" });
   * console.log(node.toString()); // DocumentRef-acme:LicenseRef-custom
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override toString(): string {
    return serializeCanonical(this);
  }
}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace LicenseRefNode {
  /**
   * Encoded custom license reference, optionally scoped to an external document.
   *
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly _tag: "LicenseRef";
    readonly documentRef?: undefined | string;
    readonly ref: string;
  }
}

/**
 * **Example** (Construct a WithExceptionNode expression)
 *
 * ```ts
 * import { WithExceptionNode, LicenseNode } from "@beep/spdx/SpdxExpression";
 *
 * const node = WithExceptionNode.make({
 *   license: LicenseNode.make({ id: "GPL-2.0", plus: false }),
 *   exception: "Bison-exception-2.2",
 * });
 * console.log(node.toString()); // GPL-2.0 WITH Bison-exception-2.2
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class WithExceptionNode extends S.TaggedClass<
  WithExceptionNode,
  {
    readonly brand: unique symbol;
  }
>($I`WithExceptionNode`)(
  "WithException",
  {
    /** The license the exception applies to: a simple license (which may carry the `+` marker) or a `LicenseRef` reference. */
    license: S.Union([LicenseNode, LicenseRefNode]).pipe(
      $I.annoteKey("WithExceptionNode.license", {
        description:
          "The license the exception applies to: a simple license (which may carry the `+` marker) or a `LicenseRef` reference.",
      })
    ),
    /** The SPDX exception short identifier, e.g. `"Bison-exception-2.2"`. */
    exception: S.String.pipe(
      $I.annoteKey("WithExceptionNode.exception", {
        description: 'The SPDX exception short identifier, e.g. `"Bison-exception-2.2"`.',
      })
    ),
  },
  $I.annote("WithExceptionNode", {
    description:
      "A `license WITH exception` node. Per the SPDX grammar, `WITH` binds to a simple expression — a license identifier (optionally `+`) or a `LicenseRef`/`DocumentRef` reference — never a compound expression, so `license` is a LicenseNode or a LicenseRefNode.",
  })
) {
  /**
   * The canonical string form: the license, then `WITH`, then the exception id.
   *
   * **Example** (Serialize a WithExceptionNode expression)
   *
   * ```ts
   * import { WithExceptionNode, LicenseNode } from "@beep/spdx/SpdxExpression";
   *
   * const node = WithExceptionNode.make({
   *   license: LicenseNode.make({ id: "GPL-2.0", plus: false }),
   *   exception: "Bison-exception-2.2",
   * });
   * console.log(node.toString()); // GPL-2.0 WITH Bison-exception-2.2
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override toString(): string {
    return serializeCanonical(this);
  }
}

/**
 * **Example** (Construct a AndNode expression)
 *
 * ```ts
 * import { AndNode, LicenseNode } from "@beep/spdx/SpdxExpression";
 *
 * const node = AndNode.make({
 *   left: LicenseNode.make({ id: "MIT", plus: false }),
 *   right: LicenseNode.make({ id: "Apache-2.0", plus: false }),
 * });
 * console.log(node.toString()); // (MIT AND Apache-2.0)
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class AndNode extends S.TaggedClass<
  AndNode,
  {
    readonly brand: unique symbol;
  }
>($I`AndNode`)(
  "And",
  {
    /** The left operand. */
    left: $I.annoteKey("AndNode.left", { description: "The left operand." })(
      S.suspend((): S.Codec<SpdxExpression, InstanceOrEncodedNode> => SpdxExpressionUnion)
    ),
    /** The right operand. */
    right: $I.annoteKey("AndNode.right", { description: "The right operand." })(
      S.suspend((): S.Codec<SpdxExpression, InstanceOrEncodedNode> => SpdxExpressionUnion)
    ),
  },
  $I.annote("AndNode", {
    description:
      "The conjunction (`AND`) of two sub-expressions. Recursive: its children are any (SpdxExpression:type), expressed via `Schema.suspend`.",
  })
) {
  /**
   * The canonical, fully-parenthesized string form `(left AND right)`.
   *
   * **Example** (Serialize a AndNode expression)
   *
   * ```ts
   * import { AndNode, LicenseNode } from "@beep/spdx/SpdxExpression";
   *
   * const node = AndNode.make({
   *   left: LicenseNode.make({ id: "MIT", plus: false }),
   *   right: LicenseNode.make({ id: "Apache-2.0", plus: false }),
   * });
   * console.log(node.toString()); // (MIT AND Apache-2.0)
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override toString(): string {
    return serializeCanonical(this);
  }
}

/**
 * **Example** (Construct a OrNode expression)
 *
 * ```ts
 * import { OrNode, LicenseNode } from "@beep/spdx/SpdxExpression";
 *
 * const node = OrNode.make({
 *   left: LicenseNode.make({ id: "MIT", plus: false }),
 *   right: LicenseNode.make({ id: "Apache-2.0", plus: false }),
 * });
 * console.log(node.toString()); // (MIT OR Apache-2.0)
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class OrNode extends S.TaggedClass<
  OrNode,
  {
    readonly brand: unique symbol;
  }
>($I`OrNode`)(
  "Or",
  {
    /** The left operand. */
    left: $I.annoteKey("OrNode.left", { description: "The left operand." })(
      S.suspend((): S.Codec<SpdxExpression, InstanceOrEncodedNode> => SpdxExpressionUnion)
    ),
    /** The right operand. */
    right: $I.annoteKey("OrNode.right", { description: "The right operand." })(
      S.suspend((): S.Codec<SpdxExpression, InstanceOrEncodedNode> => SpdxExpressionUnion)
    ),
  },
  $I.annote("OrNode", {
    description:
      "The disjunction (`OR`) of two sub-expressions. Recursive: its children are any (SpdxExpression:type), expressed via `Schema.suspend`.",
  })
) {
  /**
   * The canonical, fully-parenthesized string form `(left OR right)`.
   *
   * **Example** (Serialize a OrNode expression)
   *
   * ```ts
   * import { OrNode, LicenseNode } from "@beep/spdx/SpdxExpression";
   *
   * const node = OrNode.make({
   *   left: LicenseNode.make({ id: "MIT", plus: false }),
   *   right: LicenseNode.make({ id: "Apache-2.0", plus: false }),
   * });
   * console.log(node.toString()); // (MIT OR Apache-2.0)
   * ```
   *
   * @category formatting
   * @since 0.0.0
   */
  override toString(): string {
    return serializeCanonical(this);
  }
}

/**
 * The SPDX license-expression AST: a simple license, a reference, a
 * `WITH`-exception, or an `AND`/`OR` compound. The five variants form a
 * discriminated union on `_tag`.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SpdxExpression = LicenseNode | LicenseRefNode | WithExceptionNode | AndNode | OrNode;

const SpdxExpressionUnion = S.Union([LicenseNode, LicenseRefNode, WithExceptionNode, AndNode, OrNode]).pipe(
  $I.annoteSchema("SpdxExpressionUnion", {
    description:
      "The recursive SPDX expression AST: decoded schema-class license, reference, exception, conjunction and disjunction nodes, encoded as structurally equivalent tagged POJOs. Direct AST decoding has no string-parser depth cap. The union is declared after its member classes; AndNode and OrNode defer access through S.suspend so their static initializers never read the union before it is initialized.",
  })
);

function materializeSimple(raw: RawSimpleLicense): LicenseNode | LicenseRefNode {
  return raw.kind === "license"
    ? LicenseNode.make({ id: raw.id, plus: raw.plus })
    : LicenseRefNode.make(
        raw.documentRef !== undefined
          ? {
              documentRef: raw.documentRef,
              ref: raw.ref,
            }
          : { ref: raw.ref }
      );
}

const materializeWithOneMakePerRawNode: (raw: RawExpression) => SpdxExpression = Match.type<RawExpression>().pipe(
  Match.discriminatorsExhaustive("kind")({
    license: materializeSimple,
    licenseRef: materializeSimple,
    with: (raw) =>
      WithExceptionNode.make({
        license: materializeSimple(raw.license),
        exception: raw.exception,
      }),
    and: (raw) =>
      AndNode.make({
        left: materializeWithOneMakePerRawNode(raw.left),
        right: materializeWithOneMakePerRawNode(raw.right),
      }),
    or: (raw) =>
      OrNode.make({
        left: materializeWithOneMakePerRawNode(raw.left),
        right: materializeWithOneMakePerRawNode(raw.right),
      }),
  })
);

// decision: facade-members-const-bound
const parseResult = (input: string): Result.Result<SpdxExpression, InvalidSpdxExpressionError> =>
  O.match(parseRaw(input), {
    onNone: () => Result.fail(InvalidSpdxExpressionError.make({ input })),
    onSome: (raw) => Result.succeed(materializeWithOneMakePerRawNode(raw)),
  });

/**
 * Whether `input` is a syntactically and catalog-valid SPDX license expression.
 * The synchronous, allocation-light predicate for non-Effect callers (lint
 * hooks, config-time checks); it shares its engine with
 * {@link (SpdxExpression:variable).parse}, so a `true` here guarantees a successful parse.
 *
 * **Example** (Validate a license choice and reject an incomplete conjunction)
 *
 * ```ts
 * import { isValidExpression } from "@beep/spdx/SpdxExpression";
 *
 * console.log(isValidExpression("(MIT OR Apache-2.0)")); // true
 * console.log(isValidExpression("MIT AND")); // false
 * ```
 *
 * @param input - the candidate SPDX expression
 * @returns `true` when `input` parses, `false` otherwise
 * @public
 * @category predicates
 * @since 0.0.0
 */
export function isValidExpression(input: string): boolean {
  return Result.isSuccess(parseResult(input));
}

const parseEffect = Effect.fn("SpdxExpression.parse")((input: string) => Effect.fromResult(parseResult(input)));

const FromString: S.Codec<SpdxExpression, string> = S.String.pipe(
  S.decodeTo(
    SpdxExpressionUnion,
    SchemaTransformation.transformEffect({
      decode: (input: string) => {
        const result = parseResult(input);
        return Result.isSuccess(result)
          ? Effect.succeed(result.success)
          : Effect.fail(new SchemaIssue.InvalidValue({ message: result.failure.message }, input));
      },
      encode: (unionEncodedTaggedPojo: typeof SpdxExpressionUnion.Encoded) =>
        Effect.succeed(serializeCanonical(unionEncodedTaggedPojo)),
    })
  ),
  $I.annoteSchema("FromString", {
    description:
      "An SPDX string codec that decodes syntactically and catalog-valid expressions through the depth-bounded parser into schema-class AST nodes, rejects invalid input, and encodes the canonical fully-parenthesized expression string.",
  })
);

const catalogLicenseOfLeafDroppingPlus = (leaf: LicenseNode | LicenseRefNode): O.Option<License> =>
  Result.getSuccess(License.parseResult(leaf._tag === "License" ? leaf.id : serializeCanonical(leaf)));

const appendResolvedLicensesInWrittenOrder: (expr: SpdxExpression) => (into: Array<License>) => void =
  Match.type<SpdxExpression>().pipe(
    Match.tagsExhaustive({
      License: (expr) => (into: Array<License>) => {
        const license = catalogLicenseOfLeafDroppingPlus(expr);
        if (O.isSome(license)) into.push(license.value);
      },
      LicenseRef: (expr) => (into: Array<License>) => {
        const license = catalogLicenseOfLeafDroppingPlus(expr);
        if (O.isSome(license)) into.push(license.value);
      },
      WithException: (expr) => (into: Array<License>) => {
        appendResolvedLicensesInWrittenOrder(expr.license)(into);
      },
      And: (expr) => (into: Array<License>) => {
        appendResolvedLicensesInWrittenOrder(expr.left)(into);
        appendResolvedLicensesInWrittenOrder(expr.right)(into);
      },
      Or: (expr) => (into: Array<License>) => {
        appendResolvedLicensesInWrittenOrder(expr.left)(into);
        appendResolvedLicensesInWrittenOrder(expr.right)(into);
      },
    })
  );

/**
 * Every license named by an expression, in the order it is written, without
 * duplicates.
 *
 * **Details**
 *
 * Reach for this wherever a target permits more than one license. Collapsing
 * `(MIT OR Apache-2.0)` to a single value discards a choice the author
 * deliberately offered, and collapsing `(MIT AND Apache-2.0)` discards a term
 * that still binds — this is the accessor that does neither.
 *
 * De-duplication is by identifier, keeping first appearance, so `(MIT OR MIT)`
 * yields one license.
 *
 * **Example** (Collect the licenses in a license choice)
 *
 * ```ts
 * import { SpdxExpression } from "@beep/spdx/SpdxExpression";
 * import * as Result from "effect/Result";
 *
 * const expr = Result.getOrThrow(SpdxExpression.parseResult("(MIT OR Apache-2.0)"));
 * console.log(SpdxExpression.licensesOf(expr).map((license) => license.id).join(", ")); // MIT, Apache-2.0
 * ```
 *
 * @param expr - the expression to read
 * @returns the licenses it names, in written order
 */
const licensesOf = (expr: SpdxExpression): ReadonlyArray<License> => {
  const collected: Array<License> = [];
  appendResolvedLicensesInWrittenOrder(expr)(collected);
  const seen = MutableHashSet.empty<string>();
  return A.filter(collected, (license) => {
    if (MutableHashSet.has(seen, license.id)) return false;
    MutableHashSet.add(seen, license.id);
    return true;
  });
};

/**
 * The single license an expression can be said to be under, when there is one.
 *
 * **Details**
 *
 * Reach for this wherever a target permits exactly one license — schema.org's
 * `license`, a badge, a summary line.
 *
 * The rule is deliberately narrow, because the alternative is a confident
 * wrong answer:
 *
 * - **A simple license, or one with an exception** — that license.
 * - **`OR`** — the leftmost, which is the choice the author wrote first and
 *   npm's convention treats as preferred.
 * - **`AND`** — `Option.none()`. A conjunction means every term binds at once,
 *   so no single license represents it, and picking one would silently drop a
 *   term that legally applies. A caller that reaches this should emit the array
 *   from {@link (SpdxExpression:variable).licensesOf} instead.
 *
 * **Example** (Select the first license choice and handle a conjunction)
 *
 * ```ts
 * import { SpdxExpression } from "@beep/spdx/SpdxExpression";
 * import * as O from "effect/Option";
 * import * as Result from "effect/Result";
 *
 * const parse = (input: string) => Result.getOrThrow(SpdxExpression.parseResult(input));
 *
 * const primary = O.map(SpdxExpression.primaryLicense(parse("(MIT OR Apache-2.0)")), (license) => license.id);
 * console.log(O.getOrElse(primary, () => "none")); // MIT
 * console.log(O.isNone(SpdxExpression.primaryLicense(parse("(MIT AND Apache-2.0)")))); // true
 * ```
 *
 * @param expr - the expression to read
 * @returns the primary license, or none when the expression has no single one
 */
const primaryLicense: (expr: SpdxExpression) => O.Option<License> = Match.type<SpdxExpression>().pipe(
  Match.tagsExhaustive({
    License: catalogLicenseOfLeafDroppingPlus,
    LicenseRef: catalogLicenseOfLeafDroppingPlus,
    WithException: (expr) => catalogLicenseOfLeafDroppingPlus(expr.license),
    Or: (expr) => primaryLicense(expr.left),
    And: O.none,
  })
);

/**
 * The SPDX license-expression facade: the AST union schema plus the parse,
 * validate and codec entry points. The `SpdxExpression` name is both the AST
 * type (above) and this value namespace.
 *
 * **Example** (Parse a license choice)
 *
 * ```ts
 * import { SpdxExpression } from "@beep/spdx/SpdxExpression";
 * import * as Result from "effect/Result";
 *
 * const expression = Result.getOrThrow(SpdxExpression.parseResult("MIT OR Apache-2.0"));
 * console.log(expression.toString()); // (MIT OR Apache-2.0)
 * ```
 *
 * @public
 * @category parsing
 * @since 0.0.0
 */
export const SpdxExpression = {
  /**
   * The recursive tagged-union `Schema` for the AST.
   *
   * **Gotchas**
   *
   * The parser's nesting-depth cap guards STRING parsing only (via {@link (SpdxExpression:variable).parse}
   * and {@link (SpdxExpression:variable).FromString}); decoding an already-built POJO directly through
   * this raw `Schema` is not depth-capped.
   */
  Schema: SpdxExpressionUnion,
  /**
   * A `Schema.Codec` from a raw expression string to the AST and back. Decoding
   * runs the hardened parser; encoding emits the canonical, fully-parenthesized
   * string via each node's `toString`.
   */
  FromString,
  /**
   * Parse an SPDX license expression, failing with
   * {@link InvalidSpdxExpressionError} on any malformed or unknown input.
   * Derived from {@link (SpdxExpression:variable).parseResult} behind the
   * `SpdxExpression.parse` span, so the Effect and sync forms cannot drift.
   */
  parse: parseEffect,
  /**
   * The synchronous `Result`-returning parser — the single source of truth the
   * Effect {@link (SpdxExpression:variable).parse} and {@link isValidExpression} derive
   * from. Reach for it at synchronous boundaries.
   */
  parseResult,
  /**
   * The single license an expression can be said to be under, or none when it
   * has no single one — notably for `AND`, where every term binds at once.
   * Pair with {@link (SpdxExpression:variable).licensesOf} for the array form.
   */
  primaryLicense,
  /**
   * Every license an expression names, in written order, de-duplicated by
   * identifier. The accessor to reach for wherever more than one license is
   * permitted.
   */
  licensesOf,
} as const;
