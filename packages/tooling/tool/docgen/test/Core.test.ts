import * as Core from "@beep/repo-docgen/Core";
import * as BunServices from "@effect/platform-bun/BunServices";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path, Stream } from "effect";
import * as ChildProcess from "effect/process/ChildProcess";

const fixturePath = new URL("./fixtures/section-example/", import.meta.url).pathname;
const docgenBinPath = new URL("../src/bin.ts", import.meta.url).pathname;

const expectFencedCode = (
  markdown: string,
  expectedExamples: ReadonlyArray<string>,
  expectedWarnings: ReadonlyArray<string>
) => expect(Core.extractFencedCode(markdown)).toEqual([expectedExamples, expectedWarnings]);

describe("Core", () =>
  void describe("[internal] extractFencedCode", () => {
    it("should extract fenced code blocks from markdown (backticks)", () =>
      expectFencedCode("a\n\n```ts\nconst a = 1\n```\n\nb", ["const a = 1"], []));

    it("should extract fenced code blocks from markdown (tildes)", () =>
      expectFencedCode("a\n\n~~~ts\nconst a = 1\n~~~~\n\nb", ["const a = 1"], []));

    it("should skip-type-checking (backticks)", () =>
      expectFencedCode("a\n\n```ts skip-type-checking a=1\nconst a = 1\n```\n\nb", [], []));

    it("should skip-type-checking (tildes)", () =>
      expectFencedCode("a\n\n~~~ts skip-type-checking a=1\nconst a = 1\n~~~~\n\nb", [], []));

    it("should handle metadata (backticks)", () =>
      expectFencedCode("a\n\n```ts a=1\nconst a = 1\n```\n\nb", ["const a = 1"], []));

    it("should handle metadata (tildes)", () =>
      expectFencedCode("a\n\n~~~ts a=1\nconst a = 1\n~~~~\n\nb", ["const a = 1"], []));

    it("should extract tsx fenced code blocks", () =>
      expectFencedCode("a\n\n```tsx\nconst view = <div />\n```\n\nb", ["const view = <div />"], []));

    it("should preserve tsx fenced code block extensions", () => {
      const [examples, warnings] = Core.extractFencedCodeBlocks("a\n\n```tsx\nconst view = <div />\n```\n\nb");

      expect(examples).toEqual([{ code: "const view = <div />", extension: ".tsx" }]);
      expect(warnings).toEqual([]);
    });

    it("should expose raw info strings and exact source offsets", () => {
      const source = "before\n```typescript import.meta.vitest name='sample'\nconst value = 1\n```\nafter";
      const [details, warnings] = Core.extractFencedCodeBlockDetails(source);
      const detail = details[0];

      expect(warnings).toEqual([]);
      expect(detail).toBeDefined();
      if (detail === undefined) return;
      expect(detail.infoString).toBe("typescript import.meta.vitest name='sample'");
      expect(source.slice(detail.infoStart, detail.infoEnd)).toBe(detail.infoString);
      expect(source.slice(detail.codeStart, detail.codeEnd)).toBe("const value = 1\n");
      expect(source.slice(detail.fenceStart, detail.fenceEnd)).toBe(
        "```typescript import.meta.vitest name='sample'\nconst value = 1\n```"
      );
      expect(detail.extension).toBe(".ts");
    });

    it("should preserve compatibility output beside detailed extraction", () => {
      const source = "~~~tsx custom=value\nconst view = <div />\n~~~";
      const [blocks] = Core.extractFencedCodeBlocks(source);
      const [details] = Core.extractFencedCodeBlockDetails(source);

      expect(blocks).toEqual([{ code: "const view = <div />", extension: ".tsx" }]);
      expect(details.map(({ code, extension }) => ({ code, extension }))).toEqual(blocks);
      expect(details[0]?.infoString).toBe("tsx custom=value");
    });

    it("should skip-type-checking for tsx fenced code blocks", () =>
      expectFencedCode("a\n\n```tsx skip-type-checking\nconst view = <div />\n```\n\nb", [], []));

    it("should handle non closing fences (backticks)", () =>
      expectFencedCode(
        "a\n\n```ts\nconst a = 1",
        ["const a = 1"],
        ["Code block does not have a matching closing fence:\na\n\n```ts\nconst a = 1"]
      ));

    it("should handle non closing fences (tildes)", () =>
      expectFencedCode(
        "a\n\n~~~ts\nconst a = 1",
        ["const a = 1"],
        ["Code block does not have a matching closing fence:\na\n\n~~~ts\nconst a = 1"]
      ));

    it.layer(BunServices.layer)("native compiler", (it) => {
      it.effect(
        "typechecks an Example section harvested from the description",
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const completed = yield* Effect.scoped(
            Effect.gen(function* () {
              const fixture = yield* fs.makeTempDirectoryScoped({
                directory: path.resolve(fixturePath, ".."),
                prefix: ".section-example-",
              });
              yield* Effect.forEach(
                ["src", "package.json", "docgen.json", "tsc-wrapper.sh"],
                (entry) => fs.copy(path.join(fixturePath, entry), path.join(fixture, entry)),
                { concurrency: "unbounded" }
              );
              const outDir = path.join(fixture, ".tmp-docgen");
              const markerPath = path.join(outDir, "tsc-ran");
              const exampleFilesPath = path.join(outDir, "example-files");
              yield* fs.makeDirectory(outDir, { recursive: true });
              yield* Effect.forEach(
                ["seed.ts.md", "seed.tsx.md", "seed.mts.md", "seed.cts.md"],
                (file) => fs.writeFileString(path.join(outDir, file), ""),
                { concurrency: "unbounded" }
              );
              const child = yield* ChildProcess.make("bun", [docgenBinPath], {
                cwd: fixture,
                stdin: "ignore",
                stderr: "pipe",
                stdout: "pipe",
              });
              const [exitCode, stdout, stderr] = yield* Effect.all(
                [
                  child.exitCode,
                  child.stdout.pipe(
                    Stream.decodeText(),
                    Stream.runFold(
                      () => "",
                      (text, chunk) => text + chunk
                    )
                  ),
                  child.stderr.pipe(
                    Stream.decodeText(),
                    Stream.runFold(
                      () => "",
                      (text, chunk) => text + chunk
                    )
                  ),
                ],
                { concurrency: "unbounded" }
              );
              expect(exitCode, stderr).toBe(0);
              yield* fs.readFileString(markerPath);
              const exampleFiles = yield* fs.readFileString(exampleFilesPath);
              const result = { exampleFiles, exitCode, stderr, stdout, tscRan: true };

              expect(result.exitCode, result.stderr).toBe(0);
              expect(result.exampleFiles).toContain("SectionExampleOwner-property-answer");
              expect(result.tscRan).toBe(true);
              return { fixture, child };
            })
          );
          expect(yield* fs.exists(completed.fixture)).toBe(false);
          expect(yield* completed.child.isRunning).toBe(false);
        })
      );
    });
  }));
