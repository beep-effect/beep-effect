import * as Core from "@beep/repo-docgen/Core";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

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

    it.effect(
      "typechecks an Example section harvested from the description",
      Effect.fnUntraced(function* () {
        const outDir = `${fixturePath}.tmp-docgen`;
        const markerPath = `${outDir}/tsc-ran`;
        const exampleFilesPath = `${outDir}/example-files`;
        const removeMarker = Bun.spawn(["rm", "-f", markerPath, exampleFilesPath], {
          stderr: "pipe",
          stdout: "pipe",
        });
        yield* Effect.promise(() => removeMarker.exited);
        const prepare = Bun.spawn(["mkdir", "-p", outDir], { stderr: "pipe", stdout: "pipe" });
        yield* Effect.promise(() => prepare.exited);
        yield* Effect.forEach(
          ["seed.ts.md", "seed.tsx.md", "seed.mts.md", "seed.cts.md"],
          (file) => Effect.promise(() => Bun.write(`${outDir}/${file}`, "")),
          { concurrency: "unbounded" }
        );
        const child = Bun.spawn(["bun", docgenBinPath], {
          cwd: fixturePath,
          stderr: "pipe",
          stdout: "pipe",
        });
        const [exitCode, stdout, stderr] = yield* Effect.all(
          [
            Effect.promise(() => child.exited),
            Effect.promise(() => new Response(child.stdout).text()),
            Effect.promise(() => new Response(child.stderr).text()),
          ],
          { concurrency: "unbounded" }
        );
        yield* Effect.promise(() => Bun.file(markerPath).text());
        const exampleFiles = yield* Effect.promise(() => Bun.file(exampleFilesPath).text());
        const result = { exampleFiles, exitCode, stderr, stdout, tscRan: true };

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.exampleFiles).toContain("SectionExampleOwner-property-answer");
        expect(result.tscRan).toBe(true);
      })
    );
  }));
