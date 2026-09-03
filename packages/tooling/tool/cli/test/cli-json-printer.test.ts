import {
  CommandJsonOutput,
  DEFAULT_JSON_FORMATTING_OPTIONS,
  DEFAULT_JSON_PRETTY_MAX_LENGTH,
  formatDurationSeconds,
  logTaggedSummary,
  makeTaggedLogger,
  printCommandJson,
  renderPrettyCommandJson,
} from "@beep/repo-cli/test/Cli";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { vi } from "vitest";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const collectLines = <A, E>(
  effect: Effect.Effect<A, E, TestConsole.TestConsole>
): Effect.Effect<ReadonlyArray<unknown>, E> =>
  Effect.gen(function* () {
    yield* effect;
    return yield* TestConsole.logLines;
  }).pipe(provideScopedLayer(TestConsole.layer));

describe("internal/cli/Json renderPrettyCommandJson", () => {
  it("pretty-formats a compact JSON payload with a trailing newline", () => {
    const rendered = renderPrettyCommandJson(`{"ok":true}`);
    expect(rendered).toBe(`{\n  "ok": true\n}\n`);
  });

  it("uses the default two-space formatting options", () => {
    expect(DEFAULT_JSON_FORMATTING_OPTIONS.tabSize).toBe(2);
    expect(DEFAULT_JSON_FORMATTING_OPTIONS.insertSpaces).toBe(true);
    const rendered = renderPrettyCommandJson(`{"nested":{"a":1}}`);
    expect(rendered).toBe(`{\n  "nested": {\n    "a": 1\n  }\n}\n`);
  });

  it("skips reformatting and appends a newline when the payload exceeds maxLength", () => {
    const encoded = `{"ok":true}`;
    const capped = renderPrettyCommandJson(encoded, { maxLength: 1 });
    expect(capped).toBe(`${encoded}\n`);
  });

  it("formats normally when the payload is within maxLength", () => {
    const encoded = `{"ok":true}`;
    const rendered = renderPrettyCommandJson(encoded, { maxLength: DEFAULT_JSON_PRETTY_MAX_LENGTH });
    expect(rendered).toBe(`{\n  "ok": true\n}\n`);
  });

  it("treats the boundary length as within the cap (strictly-greater comparison)", () => {
    const encoded = `{"ok":true}`;
    const rendered = renderPrettyCommandJson(encoded, { maxLength: encoded.length });
    expect(rendered).toBe(`{\n  "ok": true\n}\n`);
  });

  it("exposes the shared 500k pretty-render cap constant", () => {
    expect(DEFAULT_JSON_PRETTY_MAX_LENGTH).toBe(500_000);
  });
});

describe("internal/cli/Json printCommandJson", () => {
  it.effect(
    "routes output through an injected writer",
    Effect.fnUntraced(function* () {
      const chunks: Array<string> = [];

      yield* printCommandJson({ ok: true }).pipe(
        Effect.provideService(CommandJsonOutput, (text) =>
          Effect.sync(() => {
            chunks.push(text);
          })
        )
      );

      expect(chunks).toEqual(['{"ok":true}\n']);
    })
  );

  it("emits payloads larger than 64 KiB intact in bounded stdout writes", () => {
    const payload = { value: "x".repeat(70_000) };
    const moduleUrl = new URL("../src/internal/cli/Json.ts", import.meta.url).href;
    const program = [
      `import { printCommandJson } from ${JSON.stringify(moduleUrl)};`,
      'import { Effect } from "effect";',
      "const rawWrite = process.stdout.write.bind(process.stdout);",
      "process.stdout.write = (chunk, ...args) => {",
      '  const bytes = typeof chunk === "string" ? new TextEncoder().encode(chunk) : chunk;',
      '  if (bytes.byteLength > 8_192) throw new Error("oversized stdout write");',
      "  return rawWrite(bytes, ...args);",
      "};",
      'await Effect.runPromise(printCommandJson({ value: "x".repeat(70_000) }));',
    ].join("\n");
    const result = Bun.spawnSync(["bun", "--eval", program], {
      stderr: "pipe",
      stdout: "pipe",
    });
    const output = result.stdout.toString();

    expect(result.exitCode).toBe(0);
    expect(result.stdout.byteLength).toBeGreaterThan(65_536);
    expect(output).toBe(`${JSON.stringify(payload)}\n`);
  });

  it.effect(
    "writes the default output sink in bounded UTF-8 chunks",
    Effect.fnUntraced(function* () {
      const chunks: Array<Uint8Array> = [];
      const stdoutWrite = vi.spyOn(process.stdout, "write").mockImplementation(((
        chunk: Uint8Array,
        callback?: () => void
      ) => {
        chunks.push(chunk);
        callback?.();
        return true;
      }) as typeof process.stdout.write);

      try {
        const output = yield* CommandJsonOutput;
        yield* output("");
        yield* output("x".repeat(20_000));

        expect(chunks.map((chunk) => chunk.byteLength)).toEqual([8_192, 8_192, 3_616]);
        expect(Buffer.concat(chunks).toString()).toBe("x".repeat(20_000));
      } finally {
        stdoutWrite.mockRestore();
      }
    })
  );
});

describe("internal/cli/Printer formatDurationSeconds", () => {
  it("renders two-decimal seconds (data-first)", () => {
    expect(formatDurationSeconds(1234, 2)).toBe("1.23s");
  });

  it("renders one-decimal seconds (data-first)", () => {
    expect(formatDurationSeconds(1234, 1)).toBe("1.2s");
  });

  it("renders whole seconds at zero precision (data-first)", () => {
    expect(formatDurationSeconds(1500, 0)).toBe("2s");
  });

  it("renders zero (data-first)", () => {
    expect(formatDurationSeconds(0, 2)).toBe("0.00s");
  });

  it("builds a data-last renderer from precision alone", () => {
    const toTwoDecimals = formatDurationSeconds(2);
    const toOneDecimal = formatDurationSeconds(1);
    expect(toTwoDecimals(1234)).toBe("1.23s");
    expect(toOneDecimal(1234)).toBe("1.2s");
  });

  it("agrees between data-first and data-last arities", () => {
    expect(formatDurationSeconds(2)(1234)).toBe(formatDurationSeconds(1234, 2));
  });
});

describe("internal/cli/Printer tagged logging", () => {
  it.effect(
    "prefixes messages with the tag",
    Effect.fnUntraced(function* () {
      const lines = yield* collectLines(
        Effect.gen(function* () {
          const log = makeTaggedLogger("ci");
          yield* log("done");
        })
      );
      expect(lines).toEqual(["[ci] done"]);
    })
  );

  it.effect(
    "logs record entries as [tag] key=value in insertion order",
    Effect.fnUntraced(function* () {
      const lines = yield* collectLines(logTaggedSummary("schema-first", { live_entries: 3, missing_entries: 0 }));
      expect(lines).toEqual(["[schema-first] live_entries=3", "[schema-first] missing_entries=0"]);
    })
  );
});
