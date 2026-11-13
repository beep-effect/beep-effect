import * as NodeURL from "node:url";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Deferred from "effect/Deferred";
import {
  acquireRelease,
  addFinalizer,
  flip,
  fnUntraced,
  forkChild,
  gen,
  never,
  orDie,
  scoped,
  sync,
  tryPromise,
  withSpan,
} from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import {
  buildBundleConsumer,
  bundleConsumerExportName,
  importBundleConsumer,
  makeBundleImportDirectory,
} from "./bundle-build.ts";
import { compareBundleSize, formatBundleSizeLine } from "./bundle-size.ts";
import type * as Effect from "effect/Effect";

class BundleSizeTestOperationError extends S.TaggedError<
  BundleSizeTestOperationError,
  { readonly brand: unique symbol }
>()(
  "BundleSizeTestOperationError",
  { cause: S.Defect({ includeStack: true }) },
  { description: "A failed external operation in bundle-size.test.ts." }
) {}

describe("bundle size comparison", () => {
  it("passes when the current size equals the baseline", () => {
    expect(compareBundleSize(100, { baselineRawBytes: 100 }).isRegression).toBe(false);
  });

  it("passes when the current size decreases", () => {
    expect(compareBundleSize(99, { baselineRawBytes: 100 }).isRegression).toBe(false);
  });

  it("fails when the current size increases by one byte", () => {
    expect(compareBundleSize(101, { baselineRawBytes: 100 }).isRegression).toBe(true);
  });

  it("flags a collapse below the stub floor even when it is a decrease", () => {
    const comparison = compareBundleSize(30, { baselineRawBytes: 7864, minimumRawBytes: 4096 });
    expect(comparison.isRegression).toBe(false);
    expect(comparison.isCollapse).toBe(true);
  });

  it("does not flag healthy sizes above the floor", () => {
    expect(compareBundleSize(7000, { baselineRawBytes: 7864, minimumRawBytes: 4096 }).isCollapse).toBe(false);
  });
});

describe("bundle size probe", () => {
  it.effect(
    "measures the sole artifact as raw UTF-8 bytes",
    fnUntraced(function* () {
      const artifact = yield* tryPromise({
        try: buildBundleConsumer,
        catch: (cause) => BundleSizeTestOperationError.make({ cause }),
      }).pipe(withSpan("EffectDrizzle.bundle.build"));
      expect(artifact.rawBytes).toBe(new TextEncoder().encode(artifact.text).byteLength);
      expect(artifact.rawBytes).toBeGreaterThan(1000);
    })
  );
});

it.layer(NodeServices.layer)("effect-drizzle bundle import validity", (it) => {
  it.effect(
    "imports the artifact and finds the consumer export",
    fnUntraced(function* () {
      const artifact = yield* tryPromise({
        try: buildBundleConsumer,
        catch: (cause) => BundleSizeTestOperationError.make({ cause }),
      }).pipe(withSpan("EffectDrizzle.bundle.build"));
      const fs = yield* FileSystem.FileSystem;
      const scratchDirectory = yield* makeBundleImportDirectory();
      const directory = yield* fs.realPath(scratchDirectory);
      const exportNames = yield* importBundleConsumer(artifact.text, directory);
      expect(exportNames).toEqual([bundleConsumerExportName]);
    })
  );

  it.effect(
    "rejects a stub that exports a dropped binding, whatever its size",
    fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const scratchDirectory = yield* makeBundleImportDirectory();
      const directory = yield* fs.realPath(scratchDirectory);
      const stub = `export{dropped as ${bundleConsumerExportName}};${Str.repeat(8192)("/* padding */")}`;
      const failure = yield* importBundleConsumer(stub, directory).pipe(flip);
      // A native import fails to link the dangling export; Vitest's module runner
      // links it lazily and yields an undefined binding. Both are rejections.
      expect(failure._tag).toBe("BundleImportError");
      expect([
        "Bundle artifact is not an importable module",
        `Bundle artifact does not export ${bundleConsumerExportName} as a function`,
      ]).toContain(failure.message);
    })
  );

  it.effect(
    "rejects a valid module that lost the consumer export",
    fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const scratchDirectory = yield* makeBundleImportDirectory();
      const directory = yield* fs.realPath(scratchDirectory);
      const failure = yield* importBundleConsumer("export const other = () => 1;", directory).pipe(flip);
      expect(failure.message).toBe(`Bundle artifact does not export ${bundleConsumerExportName} as a function`);
    })
  );
});

// bunx's node shim injects a partial Bun global (spawn without which), so
// gate on every capability the probe-process spawn actually needs.
const hasBunSpawn = typeof Bun !== "undefined" && typeof Bun.spawn === "function" && typeof Bun.which === "function";

const acquireProbe = fnUntraced(function* (command: Array<string>) {
  return yield* acquireRelease(
    tryPromise({
      try: () => {
        const process = Bun.spawn(command, {
          cwd: NodeURL.fileURLToPath(new URL("../", import.meta.url)),
          stdout: "pipe",
          stderr: "pipe",
        });
        return Promise.resolve({
          process,
          output: Tuple.make(process.exited, new Response(process.stdout).text(), new Response(process.stderr).text()),
        });
      },
      catch: (cause) => BundleSizeTestOperationError.make({ cause }),
    }).pipe(withSpan("EffectDrizzle.bundle.spawn")),
    ({ process, output }) =>
      tryPromise({
        try: () => {
          if (process.exitCode === null) process.kill("SIGKILL");
          return Promise.allSettled(output);
        },
        catch: (cause) => BundleSizeTestOperationError.make({ cause }),
      }).pipe(withSpan("EffectDrizzle.bundle.cleanup"), orDie)
  );
});

describe.runIf(hasBunSpawn)("bundle size probe process", () => {
  it.effect(
    "exits nonzero for an injected one-byte regression without mutating the baseline",
    fnUntraced(function* () {
      const baselineFile = Bun.file(new URL("./bundle-size.baseline.json", import.meta.url));
      const baselineBefore = yield* tryPromise({
        try: () => baselineFile.bytes(),
        catch: (cause) => BundleSizeTestOperationError.make({ cause }),
      });
      yield* addFinalizer(() =>
        gen(function* () {
          const baselineAfter = yield* tryPromise({
            try: () => baselineFile.bytes(),
            catch: (cause) => BundleSizeTestOperationError.make({ cause }),
          });
          expect(baselineAfter).toEqual(baselineBefore);
        }).pipe(orDie)
      );
      const artifact = yield* tryPromise({
        try: buildBundleConsumer,
        catch: (cause) => BundleSizeTestOperationError.make({ cause }),
      }).pipe(withSpan("EffectDrizzle.bundle.build"));
      const baselineRawBytes = artifact.rawBytes - 1;
      const probe = yield* acquireProbe([
        Bun.which("bun") ?? "bun",
        NodeURL.fileURLToPath(new URL("./bundle-size.probe.ts", import.meta.url)),
        `--test-baseline-raw-bytes=${baselineRawBytes}`,
      ]);
      const [exitCode, stdout, stderr] = yield* tryPromise({
        try: () => Promise.all(probe.output),
        catch: (cause) => BundleSizeTestOperationError.make({ cause }),
      }).pipe(withSpan("EffectDrizzle.bundle.drain"));
      yield* sync(() => {
        expect(exitCode).not.toBe(0);
        const lines = Str.split("\n")(stdout);
        expect(lines[0]).toBe(formatBundleSizeLine(artifact.rawBytes, baselineRawBytes));
        expect(`${stdout}${stderr}`).toContain("Bundle raw byte size exceeds the committed baseline");
      }).pipe(withSpan("EffectDrizzle.bundle.exit"));
    })
  );
  it.effect(
    "terminates and drains an acquired probe when its scope is interrupted",
    fnUntraced(function* () {
      const acquired = yield* Deferred.make<Effect.Success<ReturnType<typeof acquireProbe>>>();
      const fiber = yield* scoped(
        gen(function* () {
          const probe = yield* acquireProbe([
            Bun.which("bun") ?? "bun",
            "--eval",
            "process.stdout.write('ready'); process.stderr.write('waiting'); setInterval(() => {}, 1000)",
          ]);
          yield* Deferred.succeed(acquired, probe);
          return yield* never;
        })
      ).pipe(forkChild);
      const probe = yield* Deferred.await(acquired);
      yield* addFinalizer(() =>
        tryPromise({
          try: () => {
            if (probe.process.exitCode === null) probe.process.kill("SIGKILL");
            return Promise.allSettled(probe.output);
          },
          catch: (cause) => BundleSizeTestOperationError.make({ cause }),
        }).pipe(orDie)
      );
      expect(probe.process.exitCode).toBeNull();
      yield* Fiber.interrupt(fiber);
      const interrupted = yield* Fiber.await(fiber);
      interrupted.pipe(Exit.hasInterrupts, assertTrue);
      expect(probe.process.signalCode).toBe("SIGKILL");
      const [exitCode, stdout, stderr] = yield* tryPromise({
        try: () => Promise.all(probe.output),
        catch: (cause) => BundleSizeTestOperationError.make({ cause }),
      }).pipe(withSpan("EffectDrizzle.bundle.drain"));
      expect(exitCode).not.toBe(0);
      expect(stdout).toBeTypeOf("string");
      expect(stderr).toBeTypeOf("string");
    })
  );
});
