import {
  assertPrivateOutputDirectory,
  decodeScanOptions,
  GitHubRepoSlugFromRemote,
  resolveScanTarget,
  SecurityScanOptions,
  securityRepositoryFromRemote,
} from "@beep/repo-cli/test/Codex";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { NodeTestLayer } from "./support/CommandTest.ts";

const encodeRemote = S.encodeEffect(GitHubRepoSlugFromRemote);
const decodeOptions = S.decodeOption(SecurityScanOptions);
const baseOptions = { outputDir: "/private/scan", maxCost: 5, timeoutMinutes: 30 };

/** A canonical temp "repository" holding one real subdirectory. */
const repoFixture = Effect.fn("SecurityCommandTest.repo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped();
  const repo = yield* fs.realPath(madeTempDirectoryScoped);
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
      const resolvedScanTarget = yield* resolveScanTarget(repo, "src");
      expect(resolvedScanTarget).toBe("src");
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
      const madeTempDirectoryScoped1 = yield* fs.makeTempDirectoryScoped();
      const outputDir = yield* fs.realPath(madeTempDirectoryScoped1);
      const absent = yield* assertPrivateOutputDirectory(repo, path.join(outputDir, "absent")).pipe(Effect.result);
      expect(absent._tag).toBe("Failure");
      yield* assertPrivateOutputDirectory(repo, outputDir);
      yield* fs.remove(outputDir, { recursive: true });
      yield* fs.symlink(path.join(repo, "src"), outputDir);
      const swapped = yield* assertPrivateOutputDirectory(repo, outputDir).pipe(Effect.result);
      expect(swapped._tag).toBe("Failure");
      if (swapped._tag === "Failure") expect(swapped.failure.message).toContain("replaced or linked");
    })
  );

  it.effect(
    "names the flag that failed validation",
    Effect.fnUntraced(function* () {
      const valid = { output: "/private/out", maxCost: 5, timeoutMinutes: 30, target: O.none<string>() };
      const messageOf = (values: typeof valid) =>
        Effect.map(Effect.flip(decodeScanOptions(values)), (error) => error.message);
      const messageOf2 = yield* messageOf({ ...valid, maxCost: 0 });
      expect(messageOf2).toContain("--max-cost");
      const messageOf3 = yield* messageOf({ ...valid, timeoutMinutes: 0 });
      expect(messageOf3).toContain("--timeout-minutes");
      const messageOf4 = yield* messageOf({ ...valid, target: O.some("/etc") });
      expect(messageOf4).toContain("--path");
      const messageOf5 = yield* messageOf({ ...valid, target: O.some("../sibling") });
      expect(messageOf5).toContain("--path");
      expect((yield* decodeScanOptions({ ...valid, target: O.some("packages") })).maxCost).toBe(5);
    })
  );
  it.effect("round-trips remote slugs and reports missing private output", () =>
    Effect.gen(function* () {
      const slug = yield* securityRepositoryFromRemote("git@github.com:example/project.git");
      const encodedRemote = yield* encodeRemote(slug);
      expect(encodedRemote).toBe("https://github.com/example/project.git");
      expect((yield* securityRepositoryFromRemote("https://example.com/project").pipe(Effect.flip)).message).toContain(
        "credential-free GitHub slug"
      );
      const repo = yield* repoFixture();
      expect((yield* assertPrivateOutputDirectory(repo, `${repo}/missing`).pipe(Effect.flip)).message).toContain(
        "replaced or linked"
      );
    })
  );
});

it.layer(NodeTestLayer, { timeout: "30 seconds" })("security output disappearance", (it) => {
  it.effect(
    "rejects output removed before receipt validation",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repo = yield* repoFixture();
      const error = yield* assertPrivateOutputDirectory(repo, path.join(repo, "missing")).pipe(Effect.flip);
      expect(error.message).toBe(
        "Scan output directory was replaced or linked into the repository; the scan is not usable."
      );
      const exists6 = yield* fs.exists(path.join(repo, "missing"));
      expect(exists6).toBe(false);
    })
  );
});
