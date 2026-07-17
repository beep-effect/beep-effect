/**
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {SchemaUtils, LiteralKit} from "@beep/schema";
import {HashSet, SchemaGetter} from "effect";

const $I = $ScratchpadId.create("template/Template.models");

export const DirectiveKind = LiteralKit(
  [
    "placeholder",
    "clause",
    "num",
    "ref",
    "index",
    "count",
    "if",
    "elseif",
    "else",
    "endif",
    "each",
    "endeach",
  ]
).pipe(
  $I.annoteSchema("DirectiveKind", {
    description: ""
  })
);

export type DirectiveKind = typeof DirectiveKind.Type;

export const BlockDirectiveKind = LiteralKit(
  DirectiveKind.pickOptions([
    "if",
    "elseif",
    "else",
    "endif",
    "each",
    "endeach"
  ])
).pipe(
  SchemaUtils.withStatics((schema) => ({
    Set: HashSet.fromIterable(schema.Options),
    is: (kind: DirectiveKind) => S.is(schema)(kind)
  })),
  $I.annoteSchema("BlockDirectiveKind", {
    description: ""
  })
);

export type BlockDirectiveKind = typeof BlockDirectiveKind.Type;


export class MarkerMetaPlaceholder extends S.Class<MarkerMetaPlaceholder>($I`MarkerMetaPlaceholder`)(
  {
    kind: S.tag("placeholder"),
    expr: S.String,
  },
  $I.annote("MarkerMetaPlaceholder", {
    description: ""
  })
) {
}

export class MarkerMetaClause extends S.Class<MarkerMetaClause>($I`MarkerMetaClause`)(
  {
    kind: S.tag("clause"),
    name: S.String,
    version: S.OptionFromUndefinedOr(S.String)
  },
  $I.annote("MarkerMetaClause", {
    description: ""
  })
) {
}

export class MarkerMetaNum extends S.Class<MarkerMetaNum>($I`MarkerMetaNum`)(
  {
    kind: S.tag("num"),
    num: S.String,
  },
  $I.annote("MarkerMetaNum", {
    description: ""
  })
) {
}

export class MarkerMetaRef extends S.Class<MarkerMetaRef>($I`MarkerMetaRef`)(
  {
    kind: S.tag("ref"),
    ref: S.String,
  },
  $I.annote("MarkerMetaRef", {
    description: ""
  })
) {
}

export class MarkerMetaIndex extends S.Class<MarkerMetaIndex>($I`MarkerMetaIndex`)(
  {
    kind: S.tag("index"),
  },
  $I.annote("MarkerMetaIndex", {
    description: ""
  })
) {
}

export class MarkerMetaCount extends S.Class<MarkerMetaCount>($I`MarkerMetaCount`)(
  {
    kind: S.tag("count"),
  },
  $I.annote("MarkerMetaCount", {
    description: ""
  })
) {
}

export class MarkerMetaIf extends S.Class<MarkerMetaIf>($I`MarkerMetaIf`)(
  {
    kind: S.tag("if"),
    expr: S.String,
  },
  $I.annote("MarkerMetaIf", {
    description: ""
  })
) {
}

export class MarkerMetaElseIf extends S.Class<MarkerMetaElseIf>($I`MarkerMetaElseIf`)(
  {
    kind: S.tag("elseif"),
    expr: S.String,
  },
  $I.annote("MarkerMetaElseIf", {
    description: ""
  })
) {
}

export class MarkerMetaElse extends S.Class<MarkerMetaElse>($I`MarkerMetaElse`)(
  {
    kind: S.tag("else"),
  },
  $I.annote("MarkerMetaElse", {
    description: ""
  })
) {
}

export class MarkerMetaEndIf extends S.Class<MarkerMetaEndIf>($I`MarkerMetaEndIf`)(
  {
    kind: S.tag("endif"),
  },
  $I.annote("MarkerMetaEndIf", {
    description: ""
  })
) {
}

export class MarkerMetaEach extends S.Class<MarkerMetaEach>($I`MarkerMetaEach`)(
  {
    kind: S.tag("each"),
    expr: S.String,
  },
  $I.annote("MarkerMetaEach", {
    description: ""
  })
) {
}

export class MarkerMetaEndEach extends S.Class<MarkerMetaEndEach>($I`MarkerMetaEndEach`)(
  {
    kind: S.tag("endeach"),
  },
  $I.annote("MarkerMetaEndEach", {
    description: ""
  })
) {
}

export const MarkerMeta = S.Union(
  [
    MarkerMetaPlaceholder,
    MarkerMetaClause,
    MarkerMetaIf,
    MarkerMetaElseIf,
    MarkerMetaElse,
    MarkerMetaEndIf,
    MarkerMetaEach,
    MarkerMetaEndEach,
  ]
).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("MarkerMeta", {
    description: ""
  })
);

export type MarkerMeta = typeof MarkerMeta.Type;


export class ScannedMarker extends S.Class<ScannedMarker>($I`ScannedMarker`)(
  {
    /** Offset of `{{` in the source text. */
    start: S.Finite.annotateKey({
      description: "Offset of `{{` in the source text."
    }),
    /** Offset just past `}}`. */
    end: S.Finite.annotateKey({
      description: "Offset just past `}}`."
    }),
    /** The full matched marker, e.g. `{{@num:scope}}`. */
    raw: S.String.annotateKey({
      description: "The full matched marker, e.g. `{{@num:scope}}`."
    }),
    /** The (untrimmed) inner text. */
    inner: S.String.annotateKey({
      description: "The (untrimmed) inner text."
    }),
    meta: MarkerMeta,
  },
  $I.annote("ScannedMarker", {
    description: ""
  })
) {
}

/**
 * A `{{...}}` span that looks like a marker but classifies to nothing.
 *
 * @category models
 * @since 0.0.0
 */
export class InvalidMarker extends S.Class<InvalidMarker>($I`InvalidMarker`)(
  {
    /** Offset of `{{` in the source text. */
    start: S.Finite.annotateKey({
      description: "Offset of `{{` in the source text."
    }),
    /** Offset just past `}}`. */
    end: S.Finite.annotateKey({
      description: "Offset just past `}}`."
    }),
    /** The full matched span, e.g. `{{my field}}`. */
    raw: S.String.annotateKey({
      description: "The full matched span, e.g. `{{my field}}`."
    }),
    /** The (untrimmed) inner text. */
    inner: S.String.annotateKey({
      description: "The (untrimmed) inner text."
    }),
  },
  $I.annote("InvalidMarker", {
    description: ""
  })
) {}

/**
 * Binary comparisons between two operands.
 *
 * @category models
 * @since 0.0.0
 */
export const CompareOp = LiteralKit(
  [
"eq", "neq", "gt", "lt", "gte", "lte"
  ]
).pipe(
  $I.annoteSchema("CompareOp", {
    description: ""
  })
)

export type CompareOp = typeof CompareOp.Type;

/**
 * Operand-plus-payload tests (membership, emptiness, truthiness, text).
 *
 * @category models
 * @since 0.0.0
 */
export const PredicateOp = LiteralKit(
  [
  "is_empty",
  "is_not_empty",
  "is_truthy",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "contains_all",
  "in",
  ]
).pipe(
  $I.annoteSchema("PredicateOp", {
    description: ""
  })
)

export type PredicateOp = typeof PredicateOp.Type;


/**
 * Predicate operators that carry no payload value.
 */
export const NullaryPredicateOp = LiteralKit(
  [
    "is_empty",
    "is_not_empty",
    "is_truthy"
  ]
).pipe(
  $I.annoteSchema("NullaryPredicateOp", {
    description: ""
  })
)

export type NullaryPredicateOp = typeof NullaryPredicateOp.Type;


export const BuiltinField = LiteralKit(
  [
    "status",
    "priority"
  ]
).pipe(
  $I.annoteSchema("BuiltinField", {
    description: ""
  })
)

export type BuiltinField = typeof BuiltinField.Type;

export const Combinator = LiteralKit(
  [
    "and",
    "or"
  ]
).pipe(
  $I.annoteSchema("Combinator", {
    description: ""
  })
)

export type Combinator = typeof Combinator.Type;

export const LiteralValue = S.Union(
  [
    S.String.pipe(
      S.decodeTo(
        S.TaggedStruct("String", {
          value: S.String,
        }),
        {
          decode: SchemaGetter.transform((str) => (
            {
              _tag: "String" as const,
              value: str
            }
          )),
          encode: SchemaGetter.transform((struct) => struct.value)
        }
      )
    ),
    S.Finite.pipe(
      S.decodeTo(
        S.TaggedStruct("Number", {
      value: S.Finite
        }),
        {
          decode: SchemaGetter.transform((num) => (
            {
              _tag: "Number" as const,
              value: num
            }
          )),
          encode: SchemaGetter.transform((struct) => struct.value)
        }
      )
    ),
    S.Boolean.pipe(
      S.decodeTo(
        S.TaggedStruct("Boolean", {
          value: S.Boolean,
        }),
        {
          decode: SchemaGetter.transform((bool) => (
            {
              _tag: "Boolean" as const,
              value: bool
            }
          )),
          encode: SchemaGetter.transform((struct) => struct.value)
        }
      )
    ),
    S.Array(S.String).pipe(
      S.decodeTo(
        S.TaggedStruct("Array", {
        value: S.Array(S.String)
      }),
        {
          decode: SchemaGetter.transform((arr) => (
            {
              _tag: "Array" as const,
              value: arr
            }
          )),
          encode: SchemaGetter.transform((struct) => struct.value)
        }
      )
    )
  ]
).pipe(
  $I.annoteSchema("LiteralValue", {
    description: ""
  })
)

export type LiteralValue = typeof LiteralValue.Type;


export class PropertyOp extends S.Class<PropertyOp>($I`PropertyOp`)(
  {
    type: S.tag("property"),
    propertyId: S.String.check(S.isMinLength(1))
  },
  $I.annote("PropertyOp", {
    description: ""
  })
) {}

export class BuiltinOp extends S.Class<BuiltinOp>($I`BuiltinOp`)(
  {
    type: S.tag("builtin"),
    builtinId: S.String.check(S.isMinLength(1))
  },
  $I.annote("BuiltinOp", {
    description: ""
  })
) {}
