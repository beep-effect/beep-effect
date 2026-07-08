import {
  DEFAULT_JSON_FORMATTING_OPTIONS,
  DEFAULT_JSON_PRETTY_MAX_LENGTH,
  formatDurationSeconds,
  logTaggedSummary,
  makeTaggedLogger,
  renderPrettyCommandJson,
} from "@beep/repo-cli/test/Cli";
import { Effect } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { describe, expect, it } from "vitest";

const runWithConsole = <A, E>(effect: Effect.Effect<A, E, TestConsole.TestConsole>): Promise<ReadonlyArray<unknown>> =>
  Effect.runPromise(
    Effect.gen(function* () {
      yield* effect;
      return yield* TestConsole.logLines;
    }).pipe(Effect.provide(TestConsole.layer))
  );

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
  it("prefixes messages with the tag", async () => {
    const lines = await runWithConsole(
      Effect.gen(function* () {
        const log = makeTaggedLogger("ci");
        yield* log("done");
      })
    );
    expect(lines).toEqual(["[ci] done"]);
  });

  it("logs record entries as [tag] key=value in insertion order", async () => {
    const lines = await runWithConsole(logTaggedSummary("schema-first", { live_entries: 3, missing_entries: 0 }));
    expect(lines).toEqual(["[schema-first] live_entries=3", "[schema-first] missing_entries=0"]);
  });
});
