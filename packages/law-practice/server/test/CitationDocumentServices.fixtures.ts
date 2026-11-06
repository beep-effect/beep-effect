/** Explicit host-protocol fake for primitive/named-container replay only.
 * Custom host/callback coverage retains its separate stateful protocol harness.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationCleanerFailure } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import { CitationCleanerProtocols } from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import * as Effect from "effect/Effect";

const failed = Effect.fail(CitationCleanerFailure.make({ reason: "callback-failed" }));
/** Preserve the prior primitive fixture's empty host fallback without constructing
 * unused owners, builtins or a test registry. No production fallback is supplied.
 * @internal @category testing @since 0.0.0
 */
export const citationPrimitiveCleanerProtocols = CitationCleanerProtocols.of({
  hash: Effect.fn("DocumentServicesTest.hostHash")(() => failed),
  equal: Effect.fn("DocumentServicesTest.hostEqual")(() => failed),
  callable: Effect.fn("DocumentServicesTest.hostCallable")(() => Effect.succeed(false)),
  invoke: Effect.fn("DocumentServicesTest.hostInvoke")(() => failed),
  open: Effect.fn("DocumentServicesTest.hostOpen")(() => Effect.succeed({ next: Effect.succeedNone })),
});
