import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { classifyRegistry, registryHost, registryShortLabel, registryDisplayName } from "../../effected/npm/RegistryKind.ts";

it.effect("handles malformed URLs through both scheme fallbacks and renders JSR short labels", () => Effect.sync(() => {
  assert.strictEqual(registryHost("https://[broken/path"), "[broken");
  assert.strictEqual(registryHost("http://[broken/path"), "[broken");
  assert.strictEqual(registryHost("[broken"), "[broken");
  assert.strictEqual(classifyRegistry("[broken"), "custom");
  assert.strictEqual(registryShortLabel("https://npm.jsr.io"), "jsr");
  assert.strictEqual(registryDisplayName(""), "npm");
  assert.strictEqual(classifyRegistry(""), "npm");
}));
