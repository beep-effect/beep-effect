import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Toml, TomlParseError } from "../../effected/toml/Toml.ts";
import { TomlDiagnostic } from "../../effected/toml/TomlDiagnostic.ts";
it.effect("empty and plural failures render diagnostic counts", () => Effect.sync(() => {
  assert.strictEqual(TomlParseError.make({ diagnostics: [] }).message, "TOML parse failed with 0 errors");
  const diagnostic = TomlDiagnostic.make({ code: "ExpectedKey", message: "missing key", offset: 3, length: 1, line: 2, character: 4 });
  assert.strictEqual(TomlParseError.make({ diagnostics: [diagnostic, diagnostic] }).message, "TOML parse failed with 2 errors: ExpectedKey at 3:5 missing key");
  assert.strictEqual(Object.getPrototypeOf(Reflect.construct(Toml, [])), Toml.prototype);
}));
