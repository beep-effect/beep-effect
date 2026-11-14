/**
 * Cost Explorer cost-allocation-tag activation as an Alchemy resource.
 *
 * @packageDocumentation
 * @category resources
 * @since 0.0.0
 */

import { $AlchemyAwsExtrasId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as ce from "@distilled.cloud/aws/cost-explorer";
import { isResolved } from "alchemy/Diff";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { CostAllocationTagUpdateFailed } from "./Errors.ts";
import { decodeProps } from "./internal/decodeProps.ts";
import type { ExtrasResource } from "./internal/ExtrasResource.ts";
import type { Providers } from "./Providers.ts";

const $I = $AlchemyAwsExtrasId.create("CostAllocationTag");

/**
 * Resource type string registered by {@link CostAllocationTag}.
 *
 * **Example** (Read the registered type)
 *
 * ```ts
 * import { CostAllocationTagType } from "@beep/alchemy-aws-extras/CostAllocationTag"
 *
 * console.log(CostAllocationTagType) // "BeepAWS.CostExplorer.CostAllocationTag"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CostAllocationTagType = "BeepAWS.CostExplorer.CostAllocationTag" as const;

/**
 * Activation status of a cost allocation tag.
 *
 * **Example** (Read the active status literal)
 *
 * ```ts
 * import { CostAllocationTagStatus } from "@beep/alchemy-aws-extras/CostAllocationTag"
 *
 * console.log(CostAllocationTagStatus.Enum.Active) // "Active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CostAllocationTagStatus = LiteralKit(["Active", "Inactive"]).pipe(
  $I.annoteSchema("CostAllocationTagStatus", {
    description: "Whether billing reports group cost by a tag key.",
  })
);

/**
 * Decoded cost-allocation-tag status.
 *
 * @category models
 * @since 0.0.0
 */
export type CostAllocationTagStatus = typeof CostAllocationTagStatus.Type;

/**
 * Props of a {@link CostAllocationTag}.
 *
 * **Details**
 *
 * `tagKey` is the identity: changing it replaces the resource. `status`
 * defaults to `"Active"`.
 *
 * **Example** (Decode tag props)
 *
 * ```ts
 * import { CostAllocationTagProps } from "@beep/alchemy-aws-extras/CostAllocationTag"
 * import * as S from "effect/Schema"
 *
 * const props = S.decodeUnknownSync(CostAllocationTagProps)({ tagKey: "Project" })
 * console.log(props.tagKey) // "Project"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CostAllocationTagProps extends S.Opaque<CostAllocationTagProps, { readonly brand: unique symbol }>()(
  S.Struct({
    tagKey: S.NonEmptyString,
    status: S.optionalKey(CostAllocationTagStatus),
  }).pipe(
    $I.annoteSchema("CostAllocationTagProps", {
      description: "Desired activation of one cost allocation tag key in the deploying account.",
    })
  )
) {}

/**
 * Companion types for {@link CostAllocationTagProps}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CostAllocationTagProps {
  /**
   * The plain, unbranded shape callers pass and attributes report.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CostAllocationTagProps.Encoded;
}

/**
 * Attributes Cost Explorer reports for a cost allocation tag.
 *
 * **Example** (Decode observed attributes)
 *
 * ```ts
 * import { CostAllocationTagAttributes } from "@beep/alchemy-aws-extras/CostAllocationTag"
 * import * as S from "effect/Schema"
 *
 * const attrs = S.decodeUnknownSync(CostAllocationTagAttributes)({
 *   tagKey: "Project",
 *   status: "Active",
 *   type: "UserDefined"
 * })
 * console.log(attrs.type) // "UserDefined"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CostAllocationTagAttributes extends S.Opaque<
  CostAllocationTagAttributes,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    tagKey: S.String,
    status: CostAllocationTagStatus,
    type: S.String,
  }).pipe(
    $I.annoteSchema("CostAllocationTagAttributes", {
      description: "Observed state of one cost allocation tag key.",
    })
  )
) {}

/**
 * Companion types for {@link CostAllocationTagAttributes}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CostAllocationTagAttributes {
  /**
   * The plain, unbranded shape callers pass and attributes report.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CostAllocationTagAttributes.Encoded;
}

/**
 * Alchemy resource contract for {@link CostAllocationTag}.
 *
 * @category resources
 * @since 0.0.0
 */
export type CostAllocationTag = Resource<
  typeof CostAllocationTagType,
  CostAllocationTagProps.Encoded,
  CostAllocationTagAttributes.Encoded,
  never,
  Providers
>;

const CostAllocationTagResource = Resource<CostAllocationTag>(CostAllocationTagType, {
  defaultRemovalPolicy: "retain",
});

/**
 * Activates (or deactivates) one cost allocation tag key for the account.
 *
 * **Details**
 *
 * The tag key is an account setting, not a named object: `read` reports the
 * live status as plain attributes, so an existing key adopts silently. The
 * default removal policy is `retain`, so destroying the stack leaves the key's
 * status untouched; under an explicit `destroy` policy, delete sets it
 * `Inactive`.
 *
 * **Gotchas**
 *
 * Billing must have ingested a key before it can be activated. Cost Explorer
 * reports that per key in the update response, and the provider fails with
 * {@link CostAllocationTagUpdateFailed}.
 *
 * **Example** (Activate the project tag)
 *
 * ```ts
 * import { CostAllocationTag } from "@beep/alchemy-aws-extras/CostAllocationTag"
 *
 * const tag = CostAllocationTag("ProjectTag", { tagKey: "Project" })
 * console.log(typeof tag) // "object"
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export const CostAllocationTag: ExtrasResource<CostAllocationTag> = CostAllocationTagResource;

const toAttributes = (tag: ce.CostAllocationTag): CostAllocationTagAttributes.Encoded => ({
  tagKey: tag.TagKey,
  status: tag.Status === "Active" ? "Active" : "Inactive",
  type: tag.Type,
});

const findTag = Effect.fn("CostAllocationTag.findTag")(function* (tagKey: string) {
  const response = yield* ce.listCostAllocationTags({ TagKeys: [tagKey] });
  return pipe(
    response.CostAllocationTags ?? [],
    A.findFirst((tag) => tag.TagKey === tagKey),
    O.map(toAttributes),
    O.getOrUndefined
  );
});

const setStatus = Effect.fn("CostAllocationTag.setStatus")(function* (tagKey: string, status: CostAllocationTagStatus) {
  const response = yield* ce.updateCostAllocationTagsStatus({
    CostAllocationTagsStatus: [{ TagKey: tagKey, Status: status }],
  });
  const failure = A.findFirst(response.Errors ?? [], (error) => error.TagKey === tagKey);
  if (O.isSome(failure)) {
    return yield* CostAllocationTagUpdateFailed.make({
      tagKey,
      code: failure.value.Code ?? "Unknown",
      message: failure.value.Message ?? "UpdateCostAllocationTagsStatus rejected the tag key",
    });
  }
});

/**
 * Provider layer for {@link CostAllocationTag}.
 *
 * **Example** (Register the provider)
 *
 * ```ts
 * import { CostAllocationTagProvider } from "@beep/alchemy-aws-extras/CostAllocationTag"
 *
 * const layer = CostAllocationTagProvider
 * console.log(typeof layer) // "object"
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const CostAllocationTagProvider = Provider.succeed(CostAllocationTagResource, {
  stables: ["tagKey", "type"],
  list: () =>
    ce.listCostAllocationTags.pages({ Type: "UserDefined" }).pipe(
      Stream.runCollect,
      Effect.map((pages) =>
        A.flatMap(A.fromIterable(pages), (page) => A.map(page.CostAllocationTags ?? [], toAttributes))
      )
    ),
  read: Effect.fn("CostAllocationTag.read")(function* ({ olds, output }) {
    const tagKey = output?.tagKey ?? olds?.tagKey;
    return tagKey === undefined ? undefined : yield* findTag(tagKey);
  }),
  diff: Effect.fn("CostAllocationTag.diff")(function* ({ olds, news }) {
    if (isResolved(news) && olds !== undefined && news !== undefined && olds.tagKey !== news.tagKey) {
      return { action: "replace" } as const;
    }
    return undefined;
  }),
  reconcile: Effect.fn("CostAllocationTag.reconcile")(function* ({ news, session }) {
    const props = yield* decodeProps({ resourceType: CostAllocationTagType, schema: CostAllocationTagProps })(news);
    const desired = props.status ?? "Active";
    const observed = yield* findTag(props.tagKey);
    if (observed?.status !== desired) {
      yield* setStatus(props.tagKey, desired);
    }
    yield* session.note(`${props.tagKey}=${desired}`);
    const settled = yield* findTag(props.tagKey);
    return settled ?? { tagKey: props.tagKey, status: desired, type: "UserDefined" };
  }),
  delete: Effect.fn("CostAllocationTag.delete")(function* ({ output }) {
    yield* setStatus(output.tagKey, "Inactive");
  }),
});
