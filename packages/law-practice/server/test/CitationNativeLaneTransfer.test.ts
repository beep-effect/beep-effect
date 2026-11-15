import * as NodeURL from "node:url";
import { makeCitationHtmlWorker } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { makeCitationXmlWorker } from "@beep/law-practice-server/internal/Citation/XmlWorker";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import {
  citationNativeNodeTestPlatform,
  makeCitationBundledTestRuntime,
  makeCitationObservedSpawner,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

it.layer(process.versions.bun === undefined ? citationNativeNodeTestPlatform : citationTokenizerTestLayer, {
  excludeTestServices: true,
  timeout: "30 seconds",
})("native ownership transfer on cancellation", (it) => {
  for (const kind of ["bun", "node"] as const) {
    for (const family of ["html", "xml"] as const) {
      it.effect(`retires ${kind} ${family} interrupted exactly at successful OS spawn`, () =>
        Effect.gen(function* () {
          const { limits } = yield* defaultCitationEnginePolicy;
          const admission = yield* makeCitationNativeProcessAdmission(limits);
          const fs = yield* FileSystem.FileSystem;
          const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-transfer-" });
          const entry =
            family === "html"
              ? kind === "bun"
                ? "HtmlWorker.entry.ts"
                : "HtmlWorker.node.entry.ts"
              : kind === "bun"
                ? "XmlWorker.entry.ts"
                : "XmlWorker.node.entry.ts";
          const runtime = yield* makeCitationBundledTestRuntime(
            kind,
            NodeURL.fileURLToPath(new URL(`../src/internal/Citation/${entry}`, import.meta.url)),
            cwd
          );
          const observed = yield* makeCitationObservedSpawner();
          const spawner = ChildProcessSpawner.of({
            ...observed.spawner,
            spawn: Effect.fn("NativeTransferTest.spawn")((command) =>
              Effect.withFiber((fiber) =>
                observed.spawner.spawn(command).pipe(Effect.tap(() => Effect.sync(() => fiber.interruptUnsafe())))
              )
            ),
          });
          const services = <A, E, R>(body: Effect.Effect<A, E, R>) =>
            body.pipe(
              Effect.provideService(CitationNativeProcessAdmission, admission),
              Effect.provideService(ChildProcessSpawner, spawner)
            );
          if (family === "html") {
            const worker = yield* makeCitationHtmlWorker(limits, runtime).pipe(services);
            const outcome = yield* worker.clean("<p>Example</p>").pipe(Effect.forkChild, Effect.flatMap(Fiber.await));
            expect(Exit.hasInterrupts(outcome)).toBe(true);
            // Inspect before the installed cleaner's longer Scope closes.
            const state = yield* worker.snapshot;
            expect(state).toMatchObject({ active: 0, processes: 0, quarantined: 0 });
          } else {
            const worker = yield* makeCitationXmlWorker(limits, runtime).pipe(services);
            yield* withCitationTestInvocation(
              Effect.gen(function* () {
                const invocation = yield* CitationInvocation;
                const outcome = yield* worker
                  .balance(
                    CitationPythonUnicodeStorage.make({
                      width: 1,
                      bytes: new TextEncoder().encode("<p>Example</p>"),
                    })
                  )
                  .pipe(Effect.forkChild, Effect.flatMap(Fiber.await));
                expect(Exit.hasInterrupts(outcome)).toBe(true);
                const snapshot = yield* invocation.lane.snapshot;
                expect(snapshot).toMatchObject({ started: 1, confirmed: 1, occupied: false });
              }),
              limits
            ).pipe(services);
          }
          const counts = yield* observed.snapshot;
          expect(counts).toEqual({ spawned: 1, confirmed: 1 });
          const state = yield* admission.snapshot;
          expect(state).toMatchObject({ active: 0, queued: 0, quarantined: 0 });
        })
      );
    }
  }
});
