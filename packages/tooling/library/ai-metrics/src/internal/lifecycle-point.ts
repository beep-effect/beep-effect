/** Shared schema constructor for point observations with unknown source time and usage. */
import * as O from "effect/Option";
import { NativeTraceMetadata } from "../native-trace.ts";

type LifecyclePointFields = Pick<
  NativeTraceMetadata,
  "eventId" | "namespaceId" | "routeId" | "traceId" | "spanId" | "sessionHash" | "nativeLifecycle"
>;

/** Preserve the common lifecycle evidence constraints at both native source boundaries. */
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
