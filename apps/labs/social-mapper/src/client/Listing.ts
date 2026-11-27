/**
 * A kept listing as the window shows it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import { Entry, Inventory, Standing } from "@/core/inventory";
import { CollectionLocatorFromUrl, PostLocatorFromUrl } from "@/core/locator";
import type { MapFailure } from "@/core/locator";

const $I = $SocialMapperId.create("client/Listing");

/**
 * @category models
 * @since 0.0.0
 */
export class Row extends S.Opaque<Row, { readonly brand: unique symbol }>()(
  S.Struct({
    address: S.String.pipe(S.annotateKey({ description: "The post's address on its site." })),
    entry: Entry,
  }).pipe($I.annoteSchema("Row", { description: "One post of a listing, with the address a user can open." }))
) {}

/**
 * @category models
 * @since 0.0.0
 */
export class Listing extends S.Opaque<Listing, { readonly brand: unique symbol }>()(
  S.Struct({
    address: S.String.pipe(S.annotateKey({ description: "The listing's address on its site." })),
    inventory: Inventory,
    rows: S.Array(Row),
  }).pipe($I.annoteSchema("Listing", { description: "A kept listing, with the addresses a user can open." }))
) {
  static readonly of = Effect.fn("Listing.of")(function* (inventory: Inventory) {
    const address = yield* S.encodeEffect(CollectionLocatorFromUrl)(inventory.source);
    const rows = yield* Effect.forEach(
      inventory.entries,
      (entry) =>
        Effect.map(S.encodeEffect(PostLocatorFromUrl)(entry.item.source), (post) => Row.make({ address: post, entry })),
      { concurrency: 1 }
    );
    return Listing.make({ address, inventory, rows });
  });

  static readonly saved = ({ inventory }: Listing): number =>
    Num.sumAll(A.map(inventory.entries, ({ files }) => A.length(files)));

  static readonly owed = ({ inventory }: Listing): number => Num.sumAll(A.map(inventory.entries, Entry.pending));
}

/**
 * @category models
 * @since 0.0.0
 */
export const Tone = LiteralKit(["default", "secondary", "destructive", "outline"]).pipe(
  $I.annoteSchema("Tone", { description: "How loudly a status is shown." })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Tone = typeof Tone.Type;

/**
 * @category models
 * @since 0.0.0
 */
export class Status extends S.Opaque<Status, { readonly brand: unique symbol }>()(
  S.Struct({ label: S.String, tone: Tone }).pipe(
    $I.annoteSchema("Status", { description: "A listing's standing in words a user reads." })
  )
) {}

/**
 * Says why a run failed in words a user can act on.
 *
 * **Example** (Explain a refused sign-in)
 *
 * ```ts
 * import { reason } from "@/client/Listing"
 * import { AuthRequired } from "@/core/locator"
 *
 * reason(AuthRequired.make({ platform: "onlyfans" })) // => "Sign in to onlyfans, then map again"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const reason = Match.type<MapFailure>().pipe(
  Match.tagsExhaustive({
    AuthRequired: ({ platform }) => `Sign in to ${platform}, then map again`,
    RateLimited: ({ platform }) => `${platform} asked for a pause`,
    Unavailable: ({ reason: why }) => `The listing is ${why}`,
    MapperFailed: ({ detail }) => detail,
  })
);

/**
 * Words a listing's standing for the window.
 *
 * **Example** (Word a listing that was never mapped)
 *
 * ```ts
 * import { status } from "@/client/Listing"
 * import { Standing } from "@/core/inventory"
 *
 * status(Standing.cases.unmapped.make({})).label // => "Not mapped"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const status = Standing.match({
  unmapped: () => Status.make({ label: "Not mapped", tone: "outline" }),
  mapping: ({ placed }) => Status.make({ label: `Mapping, ${placed} new`, tone: "default" }),
  complete: () => Status.make({ label: "Complete", tone: "secondary" }),
  partial: ({ halt }) => Status.make({ label: `Partial (${halt})`, tone: "outline" }),
  failed: ({ failure }) => Status.make({ label: reason(failure), tone: "destructive" }),
});
