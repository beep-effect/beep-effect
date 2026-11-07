import { collectMarkdownFences } from "@beep/repo-cli/commands/Laws";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Str from "effect/String";

it.layer(BunServices.layer)("Documented protocol error boundary", (it) => {
  it.effect(
    "rejects a newly unhandled action error in the actual documentation fence",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const sourcePath = "standards/architecture/09-errors-across-boundaries.md";
      const markdown = yield* fs.readFileString(path.join(repoRoot, sourcePath));
      const fences = A.filter(collectMarkdownFences(sourcePath, markdown), (fence) =>
        Str.includes("const handler = Effect.fn")(fence.body)
      );
      expect(fences).toHaveLength(1);
      const fence = A.getUnsafe(fences, 0);
      const expanded = pipe(
        fence.body,
        Str.replace(
          "declare const service:",
          'class UntranslatedActionError extends S.TaggedError<UntranslatedActionError, { readonly brand: unique symbol }>()("UntranslatedActionError", {}) {}\ndeclare const service:'
        ),
        Str.replace("MembershipRevocationFailed> };", "MembershipRevocationFailed | UntranslatedActionError> };")
      );
      expect(Str.includes("MembershipRevocationFailed | UntranslatedActionError>")(expanded)).toBe(true);
      const openControl = Str.replace(": Effect.fn.Return<void | typeof ProblemDetail.Type>", "")(expanded);
      const scratchRoot = path.join(repoRoot, ".beep");
      yield* fs.makeDirectory(scratchRoot, { recursive: true });
      const fixture = yield* fs.makeTempDirectoryScoped({
        directory: scratchRoot,
        prefix: "knowledge-error-boundary-",
      });
      const config = A.join(
        [
          "{",
          '  "compilerOptions": {',
          '    "strict": true,',
          '    "skipLibCheck": true,',
          '    "noEmit": true,',
          '    "target": "ESNext",',
          '    "module": "Preserve",',
          '    "moduleResolution": "Bundler",',
          '    "types": []',
          "  },",
          '  "files": ["example.ts"]',
          "}",
        ],
        "\n"
      );
      yield* Effect.forEach(
        [
          { name: "current", body: fence.body, expectedExit: 0 },
          { name: "expanded-open-control", body: openControl, expectedExit: 0 },
          { name: "expanded-closed", body: expanded, expectedExit: 2 },
        ],
        Effect.fnUntraced(function* (testCase) {
          const folder = path.join(fixture, testCase.name);
          yield* fs.makeDirectory(folder, { recursive: true });
          yield* fs.writeFileString(path.join(folder, "example.ts"), testCase.body);
          const configPath = path.join(folder, "tsconfig.json");
          yield* fs.writeFileString(configPath, config);
          const actualConfigPath = yield* fs.realPath(configPath);
          const child = yield* ChildProcess.make(
            path.join(repoRoot, "node_modules", ".bin", "tsrs"),
            ["--project", actualConfigPath, "--pretty", "false"],
            { cwd: repoRoot, stdin: "ignore", stdout: "inherit", stderr: "inherit" }
          );
          const exitCode = yield* child.exitCode;
          expect(exitCode, `${sourcePath}:${fence.line} ${testCase.name}`).toBe(testCase.expectedExit);
        }),
        { discard: true, concurrency: 1 }
      );
    })
  );

  it.effect(
    "executes the recovery log in the actual error-pattern fence",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const sourcePath = ".patterns/error-handling.md";
      const markdown = yield* fs.readFileString(path.join(repoRoot, sourcePath));
      const fences = A.filter(collectMarkdownFences(sourcePath, markdown), (fence) =>
        Str.includes("const handleSpecificErrors =")(fence.body)
      );
      expect(fences).toHaveLength(1);
      const fence = A.getUnsafe(fences, 0);
      const stubbed = Str.replace(
        /^declare (const complexOperation:.*);$/m,
        '$1 = () => Effect.fail({ _tag: "ValidationError", field: "fixture" });'
      )(fence.body);
      expect(Str.includes('field: "fixture"')(stubbed)).toBe(true);
      const scratchRoot = path.join(repoRoot, ".beep");
      yield* fs.makeDirectory(scratchRoot, { recursive: true });
      const fixture = yield* fs.makeTempDirectoryScoped({
        directory: scratchRoot,
        prefix: "knowledge-error-log-",
      });
      const programPath = path.join(fixture, "recovery-log.ts");
      yield* fs.writeFileString(
        programPath,
        A.join(
          [
            stubbed,
            'import * as A from "effect/Array";',
            'import { assert } from "@effect/vitest";',
            "let captured: ReadonlyArray<ReadonlyArray<unknown>> = [];",
            "const localConsole: Console.Console = { ...console, log: (...args) => { captured = A.append(captured, args); } };",
            'const value = Effect.runSync(handleSpecificErrors("local-stub").pipe(Effect.provideService(Console.Console, localConsole)));',
            'assert.strictEqual(value, "default value");',
            'assert.deepEqual(captured, [["Validation failed for field: fixture"]]);',
          ],
          "\n"
        )
      );
      const executablePath = yield* fs.realPath(programPath);
      const child = yield* ChildProcess.make("bun", [executablePath], {
        cwd: repoRoot,
        stdin: "ignore",
        stdout: "inherit",
        stderr: "inherit",
      });
      const exitCode = yield* child.exitCode;
      expect(exitCode, `${sourcePath}:${fence.line}`).toBe(0);
    })
  );
});
