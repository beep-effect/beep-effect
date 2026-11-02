/** Independent exit observations for hosted native citation qualification.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("test/CitationNativeSpawner");
const MissingProcess = S.Struct({ code: S.tag("ESRCH") }).pipe(
  $I.annoteSchema("MissingProcess", {
    description: "Only the operating system's no-such-process result confirms an absent child PID.",
  })
);
/** @internal @category models @since 0.0.0 */
export class CitationNativeExitCounts extends S.Opaque<CitationNativeExitCounts, { readonly brand: unique symbol }>()(
  S.Struct({ spawned: S.Natural, confirmed: S.Natural }).pipe(
    $I.annoteSchema("CitationNativeExitCounts", {
      description: "Actual child births and independently confirmed PID exits for one qualification lifetime.",
    })
  )
) {}
/** Wrap the real process capability; count each child once only after both the
 * supervisor's stopped observation and an independent operating-system probe.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationObservedSpawner = Effect.fn("NativeSourceTest.makeSpawner")(function* () {
  const real = yield* ChildProcessSpawner;
  let spawned = 0;
  let confirmed = 0;
  const spawner = ChildProcessSpawner.of({
    ...real,
    spawn: Effect.fn("NativeSourceTest.spawn")((command) =>
      real.spawn(command).pipe(
        Effect.map((handle) => {
          spawned++;
          let seen = false;
          return {
            ...handle,
            isRunning: handle.isRunning.pipe(
              Effect.tap((running) =>
                Effect.sync(() => {
                  if (!running && !seen) {
                    assertFailure(
                      Result.try({ try: () => process.kill(handle.pid, 0), catch: S.is(MissingProcess) }),
                      true
                    );
                    seen = true;
                    confirmed++;
                  }
                })
              )
            ),
          };
        })
      )
    ),
  });
  return { spawner, snapshot: Effect.sync(() => CitationNativeExitCounts.make({ spawned, confirmed })) };
});
