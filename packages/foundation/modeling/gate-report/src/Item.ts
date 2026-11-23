/**
 * One result with an outcome: a test case, a diagnostic or a step, with its
 * location, its detail, and the slots a history service fills.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GateReportId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { itemAnnotationFields, itemIdentityFields } from "./internal/itemFields.ts";
import { optionalSlot } from "./internal/slots.ts";
import { Position, Text } from "./Scalars.ts";
import { ItemOutcome } from "./Vocabulary.ts";

const $I = $GateReportId.create("Item");

/**
 * **Example** (Build a location)
 *
 * ```ts
 * import { Location } from "@beep/gate-report/Item";
 *
 * const location = Location.make({ file: "src/a.ts", line: 3, column: 7 });
 * console.log(location.line); // 3
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Location extends S.Opaque<Location, { readonly brand: unique symbol }>()(
  S.Struct({
    file: Text,
    line: Position,
    column: Position,
  }).pipe(
    $I.annoteSchema("Location", {
      description: "A position in a source file: the file, a one-based line and a one-based column.",
    })
  )
) {}

/**
 * The detail of a failed or warned item: its message, an optional diff and an
 * optional stack.
 *
 * **Details**
 *
 * Narrows upstream `ReportError`: the location, code, rule and severity it
 * gains sit on the {@link Item}, where the item key reads them. The console
 * prints the first message line and the diff, never the stack; the record
 * keeps all three.
 *
 * **Example** (Build an assertion detail)
 *
 * ```ts
 * import { ItemDetail } from "@beep/gate-report/Item";
 * import * as O from "effect/Option";
 *
 * const detail = ItemDetail.make({ message: "expected 1 to be 2", diff: O.some("- 2\n+ 1") });
 * console.log(detail.message); // expected 1 to be 2
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ItemDetail extends S.Opaque<ItemDetail, { readonly brand: unique symbol }>()(
  S.Struct({
    message: S.String,
    diff: optionalSlot(S.String),
    stack: optionalSlot(S.String),
  }).pipe(
    $I.annoteSchema("ItemDetail", {
      description: "The message, diff and stack of a failed or warned item.",
    })
  )
) {}

/**
 * **Details**
 *
 * `unit` names the leaf unit the item hangs off; `path` holds the enclosing
 * segments (a test's suites) and `name` the item's own name. `attempts` holds
 * the per-attempt outcomes when the runner retried the item. `label` is
 * filled only by a history service.
 *
 * **Example** (Build a failed test item)
 *
 * ```ts
 * import { Item } from "@beep/gate-report/Item";
 * import { ItemKey } from "@beep/gate-report/ItemKey";
 *
 * const item = Item.make({
 *   key: ItemKey.cases.TestKey.make({ file: "src/a.test.ts", fullName: "math > adds" }),
 *   unit: "src/a.test.ts",
 *   path: ["math"],
 *   name: "adds",
 *   outcome: "failed",
 * });
 * console.log(item.outcome); // failed
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Item extends S.Opaque<Item, { readonly brand: unique symbol }>()(
  S.Struct({
    ...itemIdentityFields,
    outcome: ItemOutcome,
    location: optionalSlot(Location),
    detail: optionalSlot(ItemDetail),
    ...itemAnnotationFields,
  }).pipe(
    $I.annoteSchema("Item", {
      description: "One test case, diagnostic or step with its outcome, location, detail and history slot.",
    })
  )
) {}
