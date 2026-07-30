/**
 * Public response for querying a batch workflow.
 *
 * @remarks
 * Response variants are discriminated by `_tag`; suspension-only metadata is
 * unavailable on active and missing responses. Optional suspension context is
 * normalized to `Option`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";
import { BatchId } from "../Identity.ts";
import { BatchState } from "../Model/BatchWorkflow.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Schema/BatchStatusResponse");

const BatchStatusResponseDefinition = S.TaggedUnion({
  Active: {
    value: S.Struct({
      state: BatchState.annotateKey({
        description: "Current validated workflow state for the active batch.",
      }),
    }),
  },
  Suspended: {
    value: S.Struct({
      batchId: BatchId.annotateKey({
        description: "Identifier of the suspended batch.",
      }),
      cause: S.OptionFromOptionalKey(S.NonEmptyString).pipe(
        SchemaUtils.withNoneDefault,
        S.annotateKey({
          description: "Optional human-readable reason the workflow was suspended.",
        })
      ),
      lastKnownState: S.OptionFromOptionalKey(BatchState).pipe(
        SchemaUtils.withNoneDefault,
        S.annotateKey({
          description: "Optional last durable state observed before suspension.",
        })
      ),
      canResume: S.Boolean.annotateKey({
        description: "Whether the workflow coordinator currently permits resumption.",
      }),
    }),
  },
  NotFound: {
    value: S.Struct({
      batchId: BatchId.annotateKey({
        description: "Identifier for which no batch workflow was found.",
      }),
    }),
  },
});

/**
 * Result of querying a batch workflow by identifier.
 *
 * @remarks
 * Nested `value` objects make variant ownership explicit: active responses own
 * workflow state, suspended responses own recovery context, and missing
 * responses own only the requested identifier.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BatchStatusResponse } from "@effect-ontology/Schema/BatchStatusResponse.ts"
 *
 * const response = S.decodeUnknownSync(BatchStatusResponse)({
 *   _tag: "NotFound",
 *   value: { batchId: "batch-abc123def456" }
 * })
 * console.log(response._tag) // "NotFound"
 * ```
 *
 * @invariant Every response is exactly one of Active, Suspended, or NotFound,
 * with no cross-variant optional-field bag.
 * @category responses
 * @since 0.0.0
 */
export const BatchStatusResponse = BatchStatusResponseDefinition.pipe(
  $I.annoteSchema("BatchStatusResponse", {
    description: "Discriminated batch query response with variant-owned state, suspension, or missing data.",
    toArbitrary: () => () => S.toArbitrary(BatchStatusResponseDefinition),
  })
);

/**
 * Runtime value decoded by {@link BatchStatusResponse}.
 *
 * @example
 * ```ts
 * import type { BatchStatusResponse } from "@effect-ontology/Schema/BatchStatusResponse.ts"
 *
 * const tag = (response: BatchStatusResponse) => response._tag
 * console.log(typeof tag) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchStatusResponse = typeof BatchStatusResponse.Type;
