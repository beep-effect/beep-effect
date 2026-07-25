/**
 * `Stdlib`
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {
  LiteralKit,
  SchemaUtils,
  FilePath,
  MappedLiteralKit,
  NonNegativeInt,
  PosInt
} from "@beep/schema";
import {P, A, O, Str, R, Struct, pipe, dual} from "@beep/utils";
import {HashMap, HashSet} from "effect";

const $I = $ScratchpadId.create("StdLib.json");

/**
 * The `ToolDescription` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { ToolDescription } from "@beep/codemode";
 *
 * const thing: ToolDescription = ToolDescription.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ToolDescription extends S.Class<ToolDescription>($I`ToolDescription`)(
  {
    path: FilePath,
    description: S.String,
    signature: S.String,
  },
  $I.annote("ToolDescription", {
    description: "The `ToolDescription` model"
  })
) {
}

/**
 * The `SearchInput` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { SearchInput } from "@beep/codemode";
 *
 * const thing: SearchInput = SearchInput.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchInput extends S.Class<SearchInput>($I`SearchInput`)(
  {
    query: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault
    ),
    namespace: S.String.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault
    ),
    limit: PosInt.pipe(
      SchemaUtils.withKeyDefaults(PosInt.make(10))
    ),
    offset: NonNegativeInt.pipe(
      S.OptionFromOptionalKey,
      SchemaUtils.withNoneDefault
    )
  },
  $I.annote("SearchInput", {
    description: "The `SearchInput` model"
  })
) {
}


/**
 * The `SearchItem` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { SearchItem } from "@beep/codemode";
 *
 * const thing: SearchItem = SearchItem.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchItem extends S.Class<SearchItem>($I`SearchItem`)(
  {
    path: S.String,
    description: S.String,
    signature: S.String,
  },
  $I.annote("SearchItem", {
    description: "The `SearchItem` model"
  })
) {
}

/**
 * The `SearchOutput` model.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { SearchOutput } from "@beep/codemode";
 *
 * const thing: SearchOutput = SearchOutput.make()
 *
 * console.log(thing); // `{}`
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchOutput extends S.Class<SearchOutput>($I`SearchOutput`)(
  {
    items: SearchItem.pipe(
      S.Array,
      SchemaUtils.withEmptyArrayDefaults
    ),
    remaining: NonNegativeInt,
    next: S.Struct({
      offset: NonNegativeInt
    }).pipe(
      S.OptionFromNullOr,
      SchemaUtils.withNoneDefault
    ),
  },
  $I.annote("SearchOutput", {
    description: "The `SearchOutput` model"
  })
) {
}

/**
 * "json" mirrors JSON.stringify (undefined object values drop, undefined array elements become
 * null, a bare undefined passes through): use it wherever data leaves as JSON, like tool
 * arguments and stringify-style formatting. "nullify" turns every undefined, including a bare
 * one, into null: use it for program results, where the consumer must never see undefined.
 *
 * **Example**
 *
 * @example
 * ```ts
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CopyOutMode = LiteralKit(
  [
    "json",
    "nullify"
  ]
).pipe(
  $I.annoteSchema("CopyOutMode", {
    description: "TODO"
  })
)

/**
 * Companion runtime type for {@link CopyOutMode}.
 *
 * **Example**
 *
 * @example
 * ```ts
 * TODO
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type CopyOutMode = typeof CopyOutMode.Type;

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchEntry extends S.Class<SearchEntry>($I`SearchEntry`)(
  {
    description: ToolDescription,
    namespace: S.String,
    searchText: S.String,
    
  },
  $I.annote("SearchEntry", {
    description: ""
  })
) {}

/**
 * TODO: description
 *
 * **Example**
 *
 * @example
 * ```ts
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DiscoveryPlan extends S.Class<DiscoveryPlan>($I`DiscoveryPlan`)(
  {
    catalog: ToolDescription.pipe(S.Array),
    searchIndex: SearchEntry.pipe(S.Array)
  },
  $I.annote("DiscoveryPlan", {
    description: ""
  })
) {}




