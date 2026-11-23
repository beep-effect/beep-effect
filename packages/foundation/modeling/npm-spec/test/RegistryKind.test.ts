import { classifyRegistry, registryDisplayName, registryHost, registryShortLabel } from "@beep/npm-spec/RegistryKind";
import { assert, describe, it } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";

describe("classifyRegistry", () => {
  it("classifies the public npm registry, with or without a scheme or path", () => {
    assert.strictEqual(classifyRegistry("https://registry.npmjs.org"), "npm");
    assert.strictEqual(classifyRegistry("https://registry.npmjs.org/"), "npm");
    assert.strictEqual(classifyRegistry("registry.npmjs.org/"), "npm");
    assert.strictEqual(classifyRegistry("https://npmjs.org"), "npm");
  });

  it("classifies GitHub Packages and JSR", () => {
    assert.strictEqual(classifyRegistry("https://npm.pkg.github.com"), "github-packages");
    assert.strictEqual(classifyRegistry("https://jsr.io"), "jsr");
  });

  it("classifies anything else as custom", () => {
    assert.strictEqual(classifyRegistry("https://artifactory.example.com/api/npm/repo"), "custom");
    assert.strictEqual(classifyRegistry("https://verdaccio.internal:4873"), "custom");
  });

  it("treats an absent registry as npm — no registry configured means the default", () => {
    assert.strictEqual(classifyRegistry(undefined), "npm");
    assert.strictEqual(classifyRegistry(""), "npm");
  });

  it("does NOT match a lookalike domain", () => {
    assert.strictEqual(
      classifyRegistry("https://evil-npmjs.org"),
      "custom",
      'the leading dot is the guard: a bare endsWith("npmjs.org") would classify this as the public npm registry, which decides whether a token is sent and provenance is requested'
    );
    assert.strictEqual(classifyRegistry("https://notnpmjs.org/"), "custom");
    assert.strictEqual(classifyRegistry("https://npmjs.org.attacker.test"), "custom");
  });

  it("matches genuine subdomains", () => {
    assert.strictEqual(classifyRegistry("https://registry.npmjs.org"), "npm");
    assert.strictEqual(classifyRegistry("https://mirror.jsr.io"), "jsr");
  });

  it("is case-insensitive on the host", () => {
    assert.strictEqual(classifyRegistry("https://REGISTRY.NPMJS.ORG"), "npm");
  });

  it("classifies an unparseable value as custom rather than throwing", () => {
    assert.strictEqual(classifyRegistry("::::"), "custom");
  });
});

describe("registryHost", () => {
  it("answers the host, port included, because a custom registry on a port must stay distinguishable", () => {
    assert.strictEqual(registryHost("https://registry.example.test:4873/"), "registry.example.test:4873");
  });

  it.live(
    "stays linear on a pathological path, with no regex backtracking, timed live since TestClock would not measure synchronous work",
    () =>
      Effect.gen(function* () {
        const pathological = `evil.test/${Str.repeat(20000)("/")}`;
        const started = yield* Clock.currentTimeMillis;
        assert.strictEqual(registryHost(pathological), "evil.test");
        assert.isBelow(
          (yield* Clock.currentTimeMillis) - started,
          250,
          'must not backtrack: the obvious .replace(/\\/.*$/, "") is polynomial over registry strings from npmrc and package.json, and CodeQL flagged it'
        );
      })
  );

  it("strips the scheme and path from a value that does not parse as a URL", () => {
    assert.strictEqual(registryHost("registry.example.test/some/path"), "registry.example.test");
  });
});

describe("the label projections", () => {
  it("collapses the well-known registries to their short names", () => {
    assert.strictEqual(registryShortLabel("https://registry.npmjs.org"), "npm");
    assert.strictEqual(registryShortLabel("https://npm.pkg.github.com"), "github");
    assert.strictEqual(registryShortLabel("https://jsr.io"), "jsr");
  });

  it("spells the well-known registries out as display names", () => {
    assert.strictEqual(registryDisplayName("https://registry.npmjs.org"), "npm");
    assert.strictEqual(registryDisplayName("https://npm.pkg.github.com"), "GitHub Packages");
    assert.strictEqual(registryDisplayName("https://jsr.io"), "JSR");
  });

  it("falls back to the host for a custom registry — the case a lookup table cannot serve", () => {
    assert.strictEqual(registryShortLabel("https://registry.example.test"), "registry.example.test");
    assert.strictEqual(registryDisplayName("https://registry.example.test"), "registry.example.test");
  });

  it("treats an absent or empty registry as the public npm registry", () => {
    assert.strictEqual(registryDisplayName(undefined), "npm");
    assert.strictEqual(registryDisplayName(null), "npm");
    assert.strictEqual(registryDisplayName(""), "npm");
    assert.strictEqual(registryShortLabel(""), "npm");
  });

  it("does not label a look-alike host as a well-known registry", () => {
    assert.strictEqual(registryShortLabel("https://evil-npmjs.org"), "evil-npmjs.org");
    assert.strictEqual(registryDisplayName("https://evil-npmjs.org"), "evil-npmjs.org");
  });
});
