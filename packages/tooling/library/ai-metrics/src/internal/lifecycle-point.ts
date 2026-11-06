/**
 * Private schema constructor for lifecycle points with unknown source time and usage.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as O from "effect/Option";
import { NativeTraceMetadata } from "../native-trace.ts";

type LifecyclePointFields = Pick<
  NativeTraceMetadata,
  "eventId" | "namespaceId" | "routeId" | "traceId" | "spanId" | "sessionHash" | "nativeLifecycle"
>;

/**
 * Constructs a lifecycle point while fixing source time, model activity and usage as unknown.
 * Source-specific identifiers and lifecycle metadata remain supplied by the owned projector.
 *
 * **Example** (Inspect the constructor from a colocated private module)
 *
 * ```ts
 * import { makeLifecyclePoint } from "./lifecycle-point.ts"
 *
 * console.log(typeof makeLifecyclePoint)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeLifecyclePoint = (fields: LifecyclePointFields) =>
  NativeTraceMetadata.make({
    ...fields,
    parentSpanId: O.none(),
    nameHash: O.none(),
    kind: "CHAIN",
    startTimeUnixNano: O.none(),
    endTimeUnixNano: O.none(),
    durationKnown: false,
    status: "unset",
    modelHash: O.none(),
    modelName: O.none(),
    usage: { convention: "unknown", input: O.none(), output: O.none(), cacheRead: O.none(), cacheWrite: O.none() },
  });
