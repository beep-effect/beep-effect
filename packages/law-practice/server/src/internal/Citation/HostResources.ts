/**
 * Captured custom-resource protocol for the source's non-prescriptive ResourceType.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import type { FullCitation } from "@beep/law-practice-domain/values";
import type * as Effect from "effect/Effect";
import type { CitationCallbackFailure } from "./CallbackResource.ts";

const $I = $LawPracticeServerId.create("internal/Citation/HostResources");
/**
 * Adapter-owned object handle. Its issuer must preserve native identity and
 * validate ownership; the numeric slot does not authenticate itself.
 * @internal
 * @category models
 * @since 0.0.0
 */
export class CitationHostResource extends S.Opaque<CitationHostResource, { readonly brand: unique symbol }>()(
  S.Struct({ slot: S.Natural }).pipe(
    $I.annoteSchema("CitationHostResource", {
      description: "Opaque per-adapter native object identity, distinct from the unified table's slot.",
    })
  )
) {}
/**
 * Ordered operands for source-equivalent rich comparison. Canonical operands
 * are queried through captured access, not snapshotted to a stale hash.
 * @internal
 * @category models
 * @since 0.0.0
 */
export const CitationHostComparisonOperand = S.TaggedUnion({
  Canonical: { slot: S.Natural },
  Host: { handle: CitationHostResource },
}).pipe(
  $I.annoteSchema("CitationHostComparisonOperand", {
    description: "Directional comparison operands; adapter owns reflected/NotImplemented semantics and raw hash calls.",
  })
);
/**
 * Schema-derived comparison operand.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationHostComparisonOperand = typeof CitationHostComparisonOperand.Type;
/**
 * Build a fresh native-object adapter per operation. All returned methods have
 * R = never. Capture/presentation must not evaluate truth/hash/equality hooks.
 * Hash returns exact normalized signed-64-bit Py_hash_t, excluding minus one.
 * Compare implements ordered rich comparison, including reflection and raw
 * __hash__ calls when one operand is a canonical Resource. No built-in numeric
 * equality assumption is made for host keys. This port is not an automatic
 * Python-object implementation or a function-valued request field.
 * @internal
 * @category services
 * @since 0.0.0
 */
export class CitationHostResourceAdapterFactory extends Context.Service<
  CitationHostResourceAdapterFactory,
  {
    readonly build: (canonical: {
      readonly hash: (slot: number) => Effect.Effect<bigint, CitationCallbackFailure>;
      readonly citation: (slot: number) => Effect.Effect<FullCitation, CitationCallbackFailure>;
    }) => Effect.Effect<
      {
        readonly capture: (input: unknown) => Effect.Effect<CitationHostResource, CitationCallbackFailure>;
        readonly presentation: (handle: CitationHostResource) => Effect.Effect<S.Json, CitationCallbackFailure>;
        readonly truthy: (handle: CitationHostResource) => Effect.Effect<boolean, CitationCallbackFailure>;
        readonly hash: (handle: CitationHostResource) => Effect.Effect<bigint, CitationCallbackFailure>;
        readonly compare: (
          left: CitationHostComparisonOperand,
          right: CitationHostComparisonOperand
        ) => Effect.Effect<boolean, CitationCallbackFailure>;
        readonly close: Effect.Effect<void>;
      },
      CitationCallbackFailure
    >;
  }
>()($I`CitationHostResourceAdapterFactory`) {}
/**
 * Captured adapter implementation derived from its service.
 * @internal
 * @category models
 * @since 0.0.0
 */
export type CitationHostResourceAdapter = Effect.Success<
  ReturnType<Context.Service.Shape<typeof CitationHostResourceAdapterFactory>["build"]>
>;
