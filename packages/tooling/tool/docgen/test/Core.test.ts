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
        const removeMarker = Bun.spawn(["rm", "-f", markerPath], { stderr: "pipe", stdout: "pipe" });
        yield* Effect.tryPromise(() => removeMarker.exited);
        const prepare = Bun.spawn(["mkdir", "-p", outDir], { stderr: "pipe", stdout: "pipe" });
        yield* Effect.tryPromise(() => prepare.exited);
        yield* Effect.forEach(
          ["seed.ts.md", "seed.tsx.md", "seed.mts.md", "seed.cts.md"],
          (file) => Effect.tryPromise(() => Bun.write(`${outDir}/${file}`, "")),
          { concurrency: "unbounded" }
        );
        const child = Bun.spawn(["bun", docgenBinPath], {
          cwd: fixturePath,
          stderr: "pipe",
          stdout: "pipe",
        });
        const [exitCode, stdout, stderr] = yield* Effect.all(
          [
            Effect.tryPromise(() => child.exited),
            Effect.tryPromise(() => new Response(child.stdout).text()),
            Effect.tryPromise(() => new Response(child.stderr).text()),
          ],
          { concurrency: "unbounded" }
        );
        yield* Effect.tryPromise(() => Bun.file(markerPath).text());
        const result = { exitCode, stderr, stdout, tscRan: true };

        expect(result.exitCode, result.stderr).toBe(0);
        expect(result.tscRan).toBe(true);
      })
    );
  }));
