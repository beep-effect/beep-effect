import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { assert, describe, it } from "@effect/vitest";
import { ConfigProvider, Effect, Redacted } from "effect";
import { ActionOutputs, Secret } from "../../effected/github-actions/index.ts";

/** Records what was masked, so ordering can be asserted. */
const recordingOutputs = () => {
	const masked: Array<string> = [];
	const layer = ActionOutputs.layerTest({
		setSecret: (value) =>
			// `Effect.suspend` so the record happens when the effect RUNS, not when
			// it is described — an eager recorder logs calls that never happened.
			Effect.suspend(() => {
				masked.push(value);
				return Effect.void;
			}),
	});
	return { masked, layer };
};

/**
 * A `ConfigProvider` over a fixed record. `ConfigProvider.ConfigProvider` is a
 * `Context.Reference` in v4, so it is overridden with `provideService` — there
 * is no `Effect.withConfigProvider`.
 */
const withConfig = <A, E, R>(values: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
	Effect.provideService(
		effect,
		ConfigProvider.ConfigProvider,
		ConfigProvider.make((path) => {
			const value = values[path.join("_")];
			return Effect.succeed(value === undefined ? undefined : ConfigProvider.makeValue(value));
		}),
	);

describe("Secret", () => {
	describe("forChildEnv", () => {
		it.effect("returns plaintext for a child process", () => {
			const outputs = recordingOutputs();
			return Effect.gen(function* () {
				const env = yield* Secret.forChildEnv({ TOKEN: Redacted.make("s3cr3t") });
				assert.deepStrictEqual(env, { TOKEN: "s3cr3t" });
			}).pipe(Effect.provide(outputs.layer));
		});

		it.effect("masks every value it declassifies", () => {
			const outputs = recordingOutputs();
			return Effect.gen(function* () {
				const env = yield* Secret.forChildEnv({ A: Redacted.make("aaa"), B: Redacted.make("bbb") });
				assert.deepStrictEqual(outputs.masked, ["aaa", "bbb"]);
				assert.deepStrictEqual(env, { A: "aaa", B: "bbb" });
			}).pipe(Effect.provide(outputs.layer));
		});

		it.effect("masks a value before that value is in the returned record", () => {
			// The ordering is the invariant: a mask that ran after the caller
			// already held plaintext would be a mask the caller could skip.
			const seen: Array<string> = [];
			const layer = ActionOutputs.layerTest({
				setSecret: (value) =>
					Effect.suspend(() => {
						seen.push(`mask:${value}`);
						return Effect.void;
					}),
			});
			return Effect.gen(function* () {
				const env = yield* Secret.forChildEnv({ A: Redacted.make("aaa") });
				seen.push(`returned:${env.A}`);
				assert.deepStrictEqual(seen, ["mask:aaa", "returned:aaa"]);
			}).pipe(Effect.provide(layer));
		});

		it.effect("returns an empty record for no entries, masking nothing", () => {
			const outputs = recordingOutputs();
			return Effect.gen(function* () {
				assert.deepStrictEqual(yield* Secret.forChildEnv({}), {});
				assert.lengthOf(outputs.masked, 0);
			}).pipe(Effect.provide(outputs.layer));
		});
	});

	describe("forRunnerFile", () => {
		it.effect("masks then returns the plaintext", () => {
			const outputs = recordingOutputs();
			return Effect.gen(function* () {
				assert.strictEqual(yield* Secret.forRunnerFile(Redacted.make("ghs_abc")), "ghs_abc");
				assert.deepStrictEqual(outputs.masked, ["ghs_abc"]);
			}).pipe(Effect.provide(outputs.layer));
		});
	});

	describe("forProcessEnv", () => {
		it.effect("masks then returns the plaintext", () => {
			const outputs = recordingOutputs();
			return Effect.gen(function* () {
				assert.strictEqual(yield* Secret.forProcessEnv(Redacted.make("ghs_env")), "ghs_env");
				assert.deepStrictEqual(outputs.masked, ["ghs_env"]);
			}).pipe(Effect.provide(outputs.layer));
		});

		it.effect("masks before the caller holds the plaintext", () => {
			// Same ordering invariant as the other members: a mask that ran after
			// the caller already held plaintext would be a mask the caller could
			// skip on the way into `process.env`.
			const seen: Array<string> = [];
			const layer = ActionOutputs.layerTest({
				setSecret: (value) =>
					Effect.suspend(() => {
						seen.push(`mask:${value}`);
						return Effect.void;
					}),
			});
			return Effect.gen(function* () {
				const plaintext = yield* Secret.forProcessEnv(Redacted.make("bridged"));
				seen.push(`returned:${plaintext}`);
				assert.deepStrictEqual(seen, ["mask:bridged", "returned:bridged"]);
			}).pipe(Effect.provide(layer));
		});

		it.effect("behaves identically to forRunnerFile — same mechanism, distinct audit name", () => {
			const outputs = recordingOutputs();
			return Effect.gen(function* () {
				const viaRunnerFile = yield* Secret.forRunnerFile(Redacted.make("same-secret"));
				const viaProcessEnv = yield* Secret.forProcessEnv(Redacted.make("same-secret"));
				assert.strictEqual(viaProcessEnv, viaRunnerFile);
				assert.deepStrictEqual(outputs.masked, ["same-secret", "same-secret"]);
			}).pipe(Effect.provide(outputs.layer));
		});
	});

	describe("mask", () => {
		it.effect("registers the value with the log filter and resolves void", () => {
			const outputs = recordingOutputs();
			return Effect.gen(function* () {
				const result = yield* Secret.mask(Redacted.make("register-only"));
				assert.isUndefined(result);
				assert.deepStrictEqual(outputs.masked, ["register-only"]);
			}).pipe(Effect.provide(outputs.layer));
		});

		it.effect("registers through the same route as forRunnerFile — one mechanism, observed identically", () => {
			const outputs = recordingOutputs();
			return Effect.gen(function* () {
				yield* Secret.forRunnerFile(Redacted.make("same-route"));
				yield* Secret.mask(Redacted.make("same-route"));
				assert.deepStrictEqual(outputs.masked, ["same-route", "same-route"]);
			}).pipe(Effect.provide(outputs.layer));
		});

		it("never hands back plaintext — the success channel is void, by type", () => {
			// Compile-time proof, not a runtime one: were mask to return the
			// plaintext (A = string), this assignment would not typecheck, because
			// string is not assignable to void.
			const witness: (secret: Redacted.Redacted<string>) => Effect.Effect<void, never, ActionOutputs> = Secret.mask;
			assert.strictEqual(witness, Secret.mask);
		});
	});

	describe("adopt", () => {
		it.effect("re-wraps a plaintext handoff as Redacted", () =>
			withConfig(
				{ HANDOFF_TOKEN: "from-parent" },
				Effect.gen(function* () {
					const adopted = yield* Secret.adopt("HANDOFF_TOKEN");
					assert.strictEqual(Redacted.value(adopted), "from-parent");
					assert.notInclude(String(adopted), "from-parent", "a Redacted must not leak through coercion");
				}),
			),
		);

		it.effect("fails when the handoff variable is absent, rather than yielding an empty secret", () =>
			withConfig(
				{},
				Effect.gen(function* () {
					const exit = yield* Effect.exit(Secret.adopt("ABSENT_TOKEN"));
					assert.strictEqual(exit._tag, "Failure");
				}),
			),
		);
	});

	describe("the declassification invariant", () => {
		const srcRoot = fileURLToPath(new URL("../src/", import.meta.url));

		/**
		 * Strip comments before scanning.
		 *
		 * @remarks
		 * A raw text scan reads TSDoc as code: a module whose comment *explains*
		 * that it does not unwrap a secret gets reported as unwrapping one. That
		 * happened — `OidcTokenIssuer` documents the invariant it obeys and failed
		 * this test for saying so. It is the same phantom-edge problem the bundle
		 * reachability walkers hit with `@example` imports, and it has the same fix.
		 *
		 * LINE comments must be stripped FIRST, and the order is load-bearing, not
		 * stylistic: prose containing a `/*`-bearing token — a glob like `src/*`, or
		 * a scope like `@octokit/*` — opens a block comment as far as a regex is
		 * concerned. Stripping blocks first therefore deletes everything from that
		 * word to the end of the NEXT doc comment, real code included. Blocks
		 * cannot nest, so once the fake openers are gone a real `/*` inside a real
		 * block comment is harmless.
		 */
		const stripComments = (source: string): string =>
			source.replace(/(^|\n)\s*\/\/.*/g, "$1").replace(/\/\*[\s\S]*?\*\//g, "");

		const unwrappingModules = (): ReadonlyArray<string> => {
			const found: Array<string> = [];
			const walk = (dir: string) => {
				for (const entry of readdirSync(dir, { withFileTypes: true })) {
					const path = join(dir, entry.name);
					if (entry.isDirectory()) {
						walk(path);
					} else if (
						entry.name.endsWith(".ts") &&
						stripComments(readFileSync(path, "utf8")).includes("Redacted.value")
					) {
						found.push(entry.name);
					}
				}
			};
			walk(srcRoot);
			return found.sort();
		};

		it("only Secret.ts unwraps a Redacted", () => {
			// The structural half of the invariant: declassification is coupled to
			// masking, and stays coupled only because nothing else may unwrap.
			// A reintroduction elsewhere fails here rather than in review.
			assert.deepStrictEqual(unwrappingModules(), ["Secret.ts"]);
		});

		it("the guard can fail — it is asserting on a non-empty set", () => {
			// Without this control, the assertion above would pass just as well if
			// the package had stopped using Redacted entirely — or if the comment
			// stripper had blinded the scan.
			assert.isAbove(unwrappingModules().length, 0);
		});

		it("the comment stripper removes comments and only comments", () => {
			// The stripper is now load-bearing for the invariant above, so it gets its
			// own discriminating test rather than being trusted.
			assert.notInclude(stripComments("/** mentions Redacted.value in TSDoc */\nconst a = 1;"), "Redacted.value");
			assert.include(stripComments("// a note\nconst t = Redacted.value(s);"), "Redacted.value");
		});

		it("stripping order survives a `/*`-bearing token inside a LINE comment", () => {
			// A blocks-first stripper reads a line comment mentioning a glob like
			// `src/*` as a block-comment opener. It then eats everything up to the
			// NEXT `*/` — real code included — before the line-comment pass ever
			// runs. Lines must be stripped first so a fake opener like this never
			// gets the chance to swallow the `Redacted.value` call that follows it.
			const fixture = "// note: see src/* for glob patterns\nconst v = Redacted.value(s);\n/** trailing doc */\n";
			assert.include(stripComments(fixture), "Redacted.value");
		});
	});
});
