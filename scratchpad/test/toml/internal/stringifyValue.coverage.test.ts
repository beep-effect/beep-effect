import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { renderInlineValue, stringifyValue } from "../../../effected/toml/internal/stringifyValue.ts";

const unsupported = (message: string) => message;

describe("stringifyValue defensive values", () => {
  it.effect("names prototype-less class instances with the object fallback", () => Effect.sync(() => {
    const prototype = Object.create(null);
    const instance: unknown = Object.create(prototype);
    assert.throws(() => renderInlineValue(instance), unsupported("unsupported object value at (root)"));
  }));

  it.effect("adds a decimal point to large integral floats without an exponent", () => Effect.sync(() => {
    assert.strictEqual(stringifyValue({ large: 2 ** 63 }, "\n"), "large = 9223372036854776000.0\n");
  }));

  it.effect("rejects a table getter that becomes scalar during emission", () => Effect.sync(() => {
    let reads = 0;
    const value = { get child() { reads += 1; return reads === 1 ? {} : null; } };
    assert.throws(() => stringifyValue(value, "\n"), unsupported("unsupported null value at child"));
  }));

  it.effect("rejects array-table getters that stop being arrays or contain scalars", () => Effect.sync(() => {
    for (const replacement of [null, [1]]) {
      let reads = 0;
      const value = { get rows() { reads += 1; return reads === 1 ? [{}] : replacement; } };
      assert.throws(() => stringifyValue(value, "\n"), unsupported(`unsupported ${replacement === null ? "null" : "Array"} value at rows`));
    }
  }));

  it.effect("rejects sparse arrays classified as arrays of tables", () => Effect.sync(() => {
    const rows = new Array<Record<string, unknown>>(1);
    assert.throws(() => stringifyValue({ rows }, "\n"), /missing array-table element/);
  }));
});
