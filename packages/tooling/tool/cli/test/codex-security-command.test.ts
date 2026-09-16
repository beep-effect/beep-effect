import { assertPrivateOutputDirectory, resolveScanTarget, SecurityScanOptions } from "@beep/repo-cli/test/Codex";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, FileSystem, Path } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { NodeTestLayer } from "./support/CommandTest.ts";

const decodeOptions = S.decodeOption(SecurityScanOptions);
const baseOptions = { outputDir: "/private/scan", maxCost: 5, timeoutMinutes: 30 };

/** A canonical temp "repository" holding one real subdirectory. */
const repoFixture = Effect.fn("SecurityCommandTest.repo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repo = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
  yield* fs.makeDirectory(path.join(repo, "src"));
  return repo;
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })("security scan command guards", (it) => {
  it.effect(
    "refuses absolute and traversing --path targets at the schema boundary",
    Effect.fnUntraced(function* () {
      assertNone(decodeOptions({ ...baseOptions, target: "/etc" }));
      assertNone(decodeOptions({ ...baseOptions, target: "../sibling" }));
      assertSome(
        decodeOptions({ ...baseOptions, target: "packages/tooling" }),
        SecurityScanOptions.make({ ...baseOptions, target: O.some("packages/tooling") })
      );
    })
  );

  it.effect(
    "accepts a real subdirectory and refuses a symlink that escapes the repository",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* repoFixture();
      const outside = yield* fs.makeTempDirectoryScoped();
      yield* fs.symlink(outside, path.join(repo, "escape"));
      expect(yield* resolveScanTarget(repo, "src")).toBe("src");
      const escaped = yield* resolveScanTarget(repo, "escape").pipe(Effect.result);
      expect(escaped._tag).toBe("Failure");
      const missing = yield* resolveScanTarget(repo, "does-not-exist").pipe(Effect.result);
      expect(missing._tag).toBe("Failure");
    })
  );

  it.effect(
    "accepts an untouched private output directory and refuses one swapped for a link into the repository",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* repoFixture();
      const outputDir = yield* fs.realPath(yield* fs.makeTempDirectoryScoped());
      yield* assertPrivateOutputDirectory(repo, outputDir);
      yield* fs.remove(outputDir, { recursive: true });
      yield* fs.symlink(path.join(repo, "src"), outputDir);
      const swapped = yield* assertPrivateOutputDirectory(repo, outputDir).pipe(Effect.result);
      expect(swapped._tag).toBe("Failure");
      if (swapped._tag === "Failure") expect(swapped.failure.message).toContain("replaced or linked");
    })
  );
});
