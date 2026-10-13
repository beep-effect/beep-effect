import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { TomlDiagnostic } from "../../effected/toml/TomlDiagnostic.ts";
it.effect("standalone CR and trailing CR advance the diagnostic line", () => Effect.sync(() => {
  for (const source of ["a\rb", "a\r"]) {
    const diagnostic = TomlDiagnostic.fromRaw(source, { code: "ExpectedKey", message: "missing", offset: 2, length: 0 });
    assert.strictEqual(diagnostic.line, 1);
    assert.strictEqual(diagnostic.character, 0);
  }
}));
