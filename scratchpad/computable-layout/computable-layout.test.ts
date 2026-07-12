// Layout-as-unit-tests: the browser measured once (oracle, checked into
// fixture.json); this test reproduces the browser's own wrap counts with
// pure arithmetic — no DOM, no jsdom, no canvas, no screenshots.
import { describe, expect, test } from "bun:test";
import fixture from "./fixture.json";
import { decodeFontMetricsSnapshot, encodeFontMetricsSnapshot } from "./FontMetrics.schema.ts";
import { layoutLineCount } from "./layout.ts";

const metrics = { words: fixture.words, spaceWidth: fixture.spaceWidth };

describe("computable layout reproduces the DOM oracle", () => {
  for (const [width, domLines] of Object.entries(fixture.domLineCounts)) {
    test(`${width}px → ${domLines} lines (Chrome-measured ground truth)`, () => {
      expect(layoutLineCount(fixture.sentence, metrics, Number(width))).toBe(domLines);
    });
  }

  test("height is lineCount × lineHeight — the virtualization primitive", () => {
    const lines = layoutLineCount(fixture.sentence, metrics, 320);
    expect(lines * fixture.lineHeight).toBe(40);
  });

  test("pure: same inputs, same output, any environment", () => {
    const a = layoutLineCount(fixture.sentence, metrics, 200);
    const b = layoutLineCount(fixture.sentence, metrics, 200);
    expect(a).toBe(b);
    expect(a).toBe(3);
  });
});

describe("the metrics cache is a schema value (shippable sight)", () => {
  test("fixture decodes through FontMetricsSnapshot", () => {
    const snapshot = decodeFontMetricsSnapshot(fixture);
    expect(snapshot.engine).toBe("Chrome/150.0.0.0");
    expect(snapshot.words["dragon"]).toBeCloseTo(49.8203125);
  });

  test("typed value drives pure layout to the oracle's answer", () => {
    const snapshot = decodeFontMetricsSnapshot(fixture);
    const typed = { words: snapshot.words, spaceWidth: snapshot.spaceWidth };
    expect(layoutLineCount(snapshot.sentence, typed, 320)).toBe(snapshot.domLineCounts["320"]);
  });

  test("round-trips: decode ∘ encode is identity on the wire format", () => {
    const snapshot = decodeFontMetricsSnapshot(fixture);
    expect(encodeFontMetricsSnapshot(snapshot)).toEqual(fixture);
  });
});
