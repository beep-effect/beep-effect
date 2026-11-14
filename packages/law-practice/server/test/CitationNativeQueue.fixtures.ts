/** Real-process contention shared by lane adapter refusal tests.
 * @internal @packageDocumentation @since 0.0.0
 */

import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import type { CitationNativeProcessAdmission } from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import type { CitationNativeStart } from "@beep/law-practice-server/internal/Citation/NativeLane";
import type * as ChildProcess from "effect/process/ChildProcess";

/** Hold one actual child and one queued admission until explicit, confirmed cleanup.
 * @internal @category testing @since 0.0.0
 */
export const holdCitationNativeQueue = Effect.fn("NativeQueueTest.hold")(function* (
  admission: CitationNativeProcessAdmission["Service"],
  start: CitationNativeStart,
  command: ChildProcess.Command
) {
  const record = yield* start("markup", command);
  yield* record.child;
  const waiting = yield* admission.acquire("clean").pipe(Effect.forkScoped);
  const release = Fiber.interrupt(waiting).pipe(Effect.andThen(record.process.retire(true)));
  yield* Effect.addFinalizer(() => Effect.exit(release));
  for (let attempt = 0; attempt < 3000; attempt++) {
    if ((yield* admission.snapshot).queued === 1) break;
    yield* Effect.yieldNow;
  }
  const queued = yield* admission.snapshot;
  expect(queued.queued).toBe(1);
  return { release };
});
