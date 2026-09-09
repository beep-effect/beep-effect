import { fileURLToPath } from "node:url";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Stream } from "effect";
import * as A from "effect/Array";
import { ChildProcess } from "effect/unstable/process";

const helpers = fileURLToPath(new URL("../../../../../.claude/helpers/", import.meta.url));

const makeFixture = Effect.fn("GraftHooksTest.makeFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "graft-hooks-test-" });
  const bin = path.join(root, "bin");
  const pkg = path.join(root, "installed-graft");
  const project = path.join(root, "project");
  yield* fs.makeDirectory(bin);
  yield* fs.makeDirectory(path.join(pkg, "dist", "claude"), { recursive: true });
  yield* fs.makeDirectory(path.join(project, "dist", "claude"), { recursive: true });
  yield* fs.writeFileString(
    path.join(pkg, "package.json"),
    '{"name":"@nanonets/graft","version":"0.16.0","type":"module","bin":{"graft":"dist/cli.js"}}\n'
  );
  yield* fs.writeFileString(path.join(pkg, "dist", "cli.js"), "// executable fixture\n");
  yield* fs.symlink(path.join(pkg, "dist", "cli.js"), path.join(bin, "graft"));
  yield* Effect.forEach(
    ["hooks.js", "statusline.js"],
    (name) =>
      Effect.all([
        fs.writeFileString(
          path.join(pkg, "dist", "claude", name),
          'export const main = (event) => console.log("trusted:" + (event ?? "statusline"));\n'
        ),
        fs.writeFileString(
          path.join(project, "dist", "claude", name),
          'export const main = () => console.log("project-code-executed");\n'
        ),
      ]),
    { discard: true }
  );
  return { root, bin, pkg, project };
});

const runNode = Effect.fn("GraftHooksTest.runNode")(function* (
  cwd: string,
  searchPath: string,
  args: ReadonlyArray<string>
) {
  const handle = yield* ChildProcess.make(process.execPath, [...args], {
    cwd,
    env: { PATH: searchPath, CLAUDE_PROJECT_DIR: cwd },
    extendEnv: false,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  );
  expect(exitCode).toBe(0);
  expect(stderr).toBe("");
  return stdout;
});

describe("Graft hook installation trust", () => {
  it.effect("runs both shims from the trusted PATH installation and forwards the hook event", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture();
      expect(yield* runNode(fixture.project, fixture.bin, [`${helpers}graft-hooks.cjs`, "session-start"])).toBe(
        "trusted:session-start\n"
      );
      expect(yield* runNode(fixture.project, fixture.bin, [`${helpers}graft-statusline.cjs`])).toBe(
        "trusted:statusline\n"
      );
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("does not execute project fallback modules when Graft is absent from PATH", () =>
    Effect.gen(function* () {
      const fixture = yield* makeFixture();
      for (const shim of ["graft-hooks.cjs", "graft-statusline.cjs"]) {
        expect(yield* runNode(fixture.project, fixture.project, [`${helpers}${shim}`])).toBe("");
      }
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("rejects writable installation ancestors and module links outside the package", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeFixture();
      yield* fs.chmod(fixture.pkg, 0o777);
      for (const shim of ["graft-hooks.cjs", "graft-statusline.cjs"]) {
        expect(yield* runNode(fixture.project, fixture.bin, [`${helpers}${shim}`])).toBe("");
      }
      yield* fs.chmod(fixture.pkg, 0o755);
      for (const name of ["hooks.js", "statusline.js"]) {
        const modulePath = path.join(fixture.pkg, "dist", "claude", name);
        yield* fs.remove(modulePath);
        yield* fs.symlink(path.join(fixture.project, "dist", "claude", name), modulePath);
      }
      for (const shim of ["graft-hooks.cjs", "graft-statusline.cjs"]) {
        expect(yield* runNode(fixture.project, fixture.bin, [`${helpers}${shim}`])).toBe("");
      }
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );

  it.effect("rejects a foreign-owned installation even when its package metadata claims a newer version", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeFixture();
      yield* fs.writeFileString(
        path.join(fixture.pkg, "package.json"),
        '{"name":"@nanonets/graft","version":"999.0.0","type":"module","bin":{"graft":"dist/cli.js"}}\n'
      );
      // Substitute only ownership metadata in an isolated child; no privileged
      // account changes are needed to exercise the cross-account rejection.
      const program = A.join(
        [
          'const fs = require("node:fs");',
          "const original = fs.statSync;",
          "fs.statSync = (p) => {",
          "  const stat = original(p);",
          "  if (p === process.argv[1]) stat.uid = process.geteuid() + 1;",
          "  return stat;",
          "};",
          "const loader = require(process.argv[2]);",
          'console.log(loader.resolveEntry("hooks.js"));',
          'console.log(loader.resolveEntry("statusline.js"));',
        ],
        "\n"
      );
      expect(
        yield* runNode(fixture.project, fixture.bin, ["-e", program, fixture.pkg, `${helpers}graft-loader.cjs`])
      ).toBe("null\nnull\n");
    }).pipe(Effect.scoped, Effect.provide(NodeServices.layer))
  );
});
