import { assert, describe, it } from "@effect/vitest";
import { Clock, Effect } from "effect";
import { classifyRegistry, registryDisplayName, registryHost, registryShortLabel } from "../../effected/npm/RegistryKind.ts";

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
		// A bare `endsWith("npmjs.org")` would classify these as the public npm
		// registry, and that classification decides whether provenance is
		// requested and which auth path runs. The leading dot is the guard.
		assert.strictEqual(classifyRegistry("https://evil-npmjs.org"), "custom");
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

	it("stays linear on a pathological path, with no regex backtracking", () => {
		// The obvious `.replace(/\/.*$/, "")` is a polynomial-backtracking regex
		// over a value this package does not control (registry strings come from
		// npmrc and package.json). CodeQL flagged it on exactly this line. The
		// scan-based form answers the same thing without the exposure.
		const pathological = `evil.test/${"/".repeat(20000)}`;
		const started = Effect.runSync(Clock.currentTimeMillis);
		assert.strictEqual(registryHost(pathological), "evil.test");
		assert.isBelow(Effect.runSync(Clock.currentTimeMillis) - started, 250, "must not backtrack");
	});

	it("strips the scheme and path from a value that does not parse as a URL", () => {
		// npm config values are written both ways, and a bare host must still
		// render as a label rather than as the raw string.
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
		// This is why the projections are functions over the registry string and
		// not a RegistryKind -> string map: "custom" has no fixed label.
		assert.strictEqual(registryShortLabel("https://registry.example.test"), "registry.example.test");
		assert.strictEqual(registryDisplayName("https://registry.example.test"), "registry.example.test");
	});

	it("treats an absent or empty registry as the public npm registry", () => {
		// Stated, rather than left to classifyRegistry("") happening to answer npm.
		assert.strictEqual(registryDisplayName(undefined), "npm");
		assert.strictEqual(registryDisplayName(null), "npm");
		assert.strictEqual(registryDisplayName(""), "npm");
		// registryShortLabel takes a plain string on purpose: its callers always
		// have a registry, so a nullish value there is a wiring mistake the
		// compile error should catch rather than a state to absorb.
		assert.strictEqual(registryShortLabel(""), "npm");
	});

	it("does not label a look-alike host as a well-known registry", () => {
		// The projections inherit classifyRegistry's leading-dot guard rather
		// than matching on their own, so a look-alike cannot borrow a trusted label.
		assert.strictEqual(registryShortLabel("https://evil-npmjs.org"), "evil-npmjs.org");
		assert.strictEqual(registryDisplayName("https://evil-npmjs.org"), "evil-npmjs.org");
	});
});
