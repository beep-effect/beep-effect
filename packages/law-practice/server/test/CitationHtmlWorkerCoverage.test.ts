import { makeCitationHtmlWorker } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { CitationCleanerWork } from "@beep/law-practice-use-cases/server";

const runtime = { kind: "bun", executable: "/citation-unused-bun", workerFile: "/citation-unused.mjs", cwd: "/" };

it.layer(BunServices.layer, { excludeTestServices: true })("HTML worker construction boundaries", (it) => {
  it.effect("maps an unresolvable kernel asset URL to an invalid runtime", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      const path = yield* Path.Path;
      const urls: Array<string> = [];
      const refused = yield* makeCitationHtmlWorker(limits, runtime).pipe(
        Effect.provideService(Path.Path, {
          ...path,
          fromFileUrl: (url) =>
            Effect.sync(() => urls.push(url.pathname)).pipe(
              Effect.andThen(Effect.fail(new PlatformError.BadArgument({ module: "Path", method: "fromFileUrl" })))
            ),
        }),
        Effect.flip
      );
      expect(refused).toMatchObject({ _tag: "CitationHtmlWorkerFailure", reason: "invalid-runtime" });
      expect("cause" in refused).toBe(false);
      expect(urls).toHaveLength(1);
      expect(A.getUnsafe(urls, 0)).toMatch(/\/assets\/citation-html\/kernel\.wasm$/);
    })
  );
  it.effect("refuses lent stage capacity above the captured produced-text ceiling before spawning", () =>
    Effect.gen(function* () {
      const { limits } = yield* defaultCitationEnginePolicy;
      let spawns = 0;
      const worker = yield* makeCitationHtmlWorker({ ...limits, producedTextUtf16: 10 }, runtime).pipe(
        Effect.provideService(
          ChildProcessSpawner.ChildProcessSpawner,
          ChildProcessSpawner.make(() =>
            Effect.sync(() => {
              spawns++;
            }).pipe(Effect.andThen(Effect.die("an over-capacity stage started a child")))
          )
        )
      );
      const lent: Array<number> = [];
      const work: CitationCleanerWork = {
        nested: () => Effect.die("unused nested work"),
        reserveText: () => Effect.die("unused reservation"),
        snapshot: Effect.die("unused snapshot"),
        withTextCapacity: (produce) => {
          lent.push(11);
          return produce(11).pipe(Effect.map(({ value }) => ({ value, charges: [] })));
        },
      };
      const refused = yield* worker.stage("x", work).pipe(Effect.flip);
      expect(refused).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "clean",
        limit: "producedTextUtf16",
      });
      expect(lent).toStrictEqual([11]);
      expect(spawns).toBe(0);
    })
  );
});
