// @effect-diagnostics strictEffectProvide:skip-file
import { assert, describe, it } from "@effect/vitest";
import { LocalExec } from "../../effected/commands/index.ts";
import type { MemoryFileSystemFaults, MemoryFileSystemHandle, MemoryFileSystemSeed } from "../../effected/memfs/index.ts";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as PlatformError from "effect/PlatformError";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { NpmExecutor } from "../../effected/npm/NpmExecutor.ts";
import { PackagePublish, PackedTarball } from "../../effected/npm/PackagePublish.ts";
import { PublishError } from "../../effected/npm/PublishError.ts";
import { basicCredentialFromPair, InvalidBasicAuthUsernameError } from "../../effected/npm/RegistryCredential.ts";
import type { ScriptResult } from "./publish-fixtures.ts";
import { fakeCrypto, scripted } from "./publish-fixtures.ts";

const WireCause = S.Struct({ name: S.String, message: S.String, stack: S.String });

const HOME = "/home/runner";
const NPMRC = `${HOME}/.npmrc`;
const TOKEN = Redacted.make("s3cr3t-token");
const TOKEN_CREDENTIAL = { kind: "token", token: TOKEN } as const;

/** One packed tarball, as both npm majors describe it. */
const packEntry = {
	id: "pkg@1.1.0",
	name: "pkg",
	version: "1.1.0",
	filename: "pkg-1.1.0.tgz",
	integrity: "sha512-abc123==",
	size: 2048,
	unpackedSize: 8192,
	entryCount: 12,
};

/** `npm pack --json` output as npm 11 emits it: an array of one entry. */
const packJson = JSON.stringify([packEntry]);

/**
 * `npm pack --json` output as npm 12 emits it: an object keyed by package
 * name — verified against `npm@12.0.2`'s `lib/commands/pack.js`, which hands
 * `logTar` the tarball's `name` as the key where 11 handed it the index.
 */
const packJsonNpm12 = JSON.stringify({ [packEntry.name]: packEntry });

interface Harness {
	readonly run: <A, E>(program: Effect.Effect<A, E, PackagePublish>) => Effect.Effect<A, E>;
	readonly spawner: ReturnType<typeof scripted>;
	readonly fs: MemoryFileSystemHandle;
}

const harness = (options?: {
	readonly script?: (command: string, args: ReadonlyArray<string>) => ScriptResult;
	readonly local?: Layer.Layer<LocalExec>;
	readonly files?: MemoryFileSystemSeed;
	readonly faults?: MemoryFileSystemFaults;
}): Harness => {
	const spawner = scripted(options?.script ?? (() => ({ stdout: packJson, exit: 0 })));
	// The runner's home directory exists, as it does on a real runner: a write
	// into a missing directory fails honestly on memfs, as it would on disk.
	const fs = MemoryFileSystem.makeSync(
		{ [HOME]: MemoryFileSystem.directory(), ...options?.files },
		options?.faults === undefined ? undefined : { faults: options.faults },
	);
	const layer = PackagePublish.layer.pipe(
		Layer.provide(Layer.mergeAll(spawner.layer, fs.layer, fakeCrypto, options?.local ?? LocalExec.layerNone)),
	);
	return { run: (program) => Effect.provide(program, layer), spawner, fs };
};

/** The written npmrc — asserting it exists rather than reading absence as `""`. */
const npmrcOf = (h: Harness): string => {
	const text = h.fs.volume.text(NPMRC);
	assert.isDefined(text, "setupAuth wrote no npmrc");
	return text;
};

const publisher = Effect.service(PackagePublish);

describe("NpmExecutor", () => {
	it.effect("ambient runs the runner's own npm", () =>
		Effect.gen(function* () {
			const command = yield* NpmExecutor.ambient.command(["publish"]);
			assert.strictEqual(command.command, "npm");
			assert.deepStrictEqual([...command.args], ["publish"]);
		}).pipe(Effect.provide(LocalExec.layerNone)),
	);

	it.effect("dlx runs a PINNED npm through the launcher — the OIDC path", () =>
		// `pnpm dlx npm@11 publish` fetches a fresh npm rather than the runner's
		// bundled one, which is what trusted publishing needs (npm >= 11.5.1;
		// GitHub runners ship 10.x).
		Effect.gen(function* () {
			const command = yield* NpmExecutor.dlx("npm@11").command(["publish"]);
			assert.deepStrictEqual([command.command, ...command.args], ["pnpm", "dlx", "npm@11", "publish"]);
		}).pipe(Effect.provide(LocalExec.layerFor("pnpm"))),
	);

	it.effect("withCacheDir splices --cache into an ambient invocation", () =>
		// GitHub's macOS runner images ship a partially root-owned
		// ~/.npm/_cacache and npm hard-fails EACCES before doing any work, so
		// every pack/publish there dies until the cache is redirected.
		Effect.gen(function* () {
			const command = yield* NpmExecutor.ambient.withCacheDir("/tmp/npm-cache").command(["pack", "--json"]);
			assert.deepStrictEqual([...command.args], ["pack", "--json", "--cache", "/tmp/npm-cache"]);
		}).pipe(Effect.provide(LocalExec.layerNone)),
	);

	it.effect("splices into the dlx form too, AFTER the spec", () =>
		// The flags belong to npm, not to the launcher: `pnpm dlx npm@11 pack
		// --cache X`, never `pnpm dlx --cache X npm@11 pack`.
		Effect.gen(function* () {
			const command = yield* NpmExecutor.dlx("npm@11").withCacheDir("/tmp/c").command(["pack"]);
			assert.deepStrictEqual(
				[command.command, ...command.args],
				["pnpm", "dlx", "npm@11", "pack", "--cache", "/tmp/c"],
			);
		}).pipe(Effect.provide(LocalExec.layerFor("pnpm"))),
	);

	it.effect("appends extraArgs after the cache redirect", () =>
		Effect.gen(function* () {
			const command = yield* NpmExecutor.ambient
				.withCacheDir("/tmp/c")
				.withExtraArgs(["--loglevel", "warn"])
				.command(["view", "pkg"]);
			assert.deepStrictEqual([...command.args], ["view", "pkg", "--cache", "/tmp/c", "--loglevel", "warn"]);
		}).pipe(Effect.provide(LocalExec.layerNone)),
	);

	it.effect("keeps the pin when copied, so a redirect cannot silently drop dlx", () =>
		// A copy that lost `spec` would degrade a pinned npm to the ambient one —
		// the exact OIDC failure the pin exists to avoid, reintroduced by an
		// unrelated cache option.
		Effect.gen(function* () {
			const command = yield* NpmExecutor.dlx("npm@11").withExtraArgs(["--ignore-scripts"]).command(["pack"]);
			assert.deepStrictEqual([command.command, ...command.args], ["pnpm", "dlx", "npm@11", "pack", "--ignore-scripts"]);
		}).pipe(Effect.provide(LocalExec.layerFor("pnpm"))),
	);

	it.effect("adds nothing when neither option is set", () =>
		Effect.gen(function* () {
			const command = yield* NpmExecutor.ambient.command(["publish"]);
			assert.deepStrictEqual([...command.args], ["publish"]);
		}).pipe(Effect.provide(LocalExec.layerNone)),
	);

	it.effect("dlx without a local launcher fails typed rather than silently running ambient npm", () =>
		// Degrading to the bundled npm here would reintroduce the exact bug the
		// dlx dispatch exists to work around, and it would do it invisibly.
		Effect.gen(function* () {
			const error = yield* Effect.flip(NpmExecutor.dlx("npm@11").command(["publish"]));
			assert.instanceOf(error, PublishError);
			assert.strictEqual(error.kind, "executor");
		}).pipe(Effect.provide(LocalExec.layerNone)),
	);
});

describe("PackagePublish.setupAuth", () => {
	it.effect("writes the auth token to the npmrc, never to argv", () =>
		Effect.gen(function* () {
			const h = harness();
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.setupAuth({ registry: "https://registry.npmjs.org", credential: TOKEN_CREDENTIAL, npmrcPath: NPMRC }),
				),
			);
			const written = npmrcOf(h);
			assert.include(written, "s3cr3t-token");
			assert.lengthOf(h.spawner.spawns, 0, "setupAuth must not spawn anything — the token stays off the process table");
		}),
	);

	it.effect("nerf-darts the registry key WITH a trailing slash", () =>
		// npm matches `//host/path/:_authToken`. Without the trailing slash the
		// key is never matched and the publish goes out unauthenticated — a v3
		// bug fix that must not regress.
		Effect.gen(function* () {
			const h = harness();
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.setupAuth({ registry: "https://npm.pkg.github.com", credential: TOKEN_CREDENTIAL, npmrcPath: NPMRC }),
				),
			);
			assert.include(npmrcOf(h), "//npm.pkg.github.com/:_authToken=");
		}),
	);

	it.effect("strips a scheme and preserves a registry path", () =>
		Effect.gen(function* () {
			const h = harness();
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.setupAuth({
						registry: "https://example.com/artifactory/api/npm/repo",
						credential: TOKEN_CREDENTIAL,
						npmrcPath: NPMRC,
					}),
				),
			);
			assert.include(npmrcOf(h), "//example.com/artifactory/api/npm/repo/:_authToken=");
		}),
	);

	it.effect("appends to an existing npmrc rather than clobbering it", () =>
		Effect.gen(function* () {
			const h = harness({ files: { [NPMRC]: "registry=https://registry.npmjs.org\n" } });
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.setupAuth({ registry: "https://registry.npmjs.org", credential: TOKEN_CREDENTIAL, npmrcPath: NPMRC }),
				),
			);
			const written = npmrcOf(h);
			assert.include(written, "registry=https://registry.npmjs.org");
			assert.include(written, "_authToken=");
		}),
	);

	it.effect("writes a fresh npmrc when none exists (NotFound is the only read failure treated as empty)", () =>
		Effect.gen(function* () {
			const h = harness();
			assert.isUndefined(h.fs.volume.text(NPMRC));
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.setupAuth({ registry: "https://registry.npmjs.org", credential: TOKEN_CREDENTIAL, npmrcPath: NPMRC }),
				),
			);
			assert.include(npmrcOf(h), "_authToken=");
		}),
	);

	it.effect("fails kind auth and leaves an unreadable npmrc untouched (PermissionDenied)", () =>
		Effect.gen(function* () {
			const prior = "registry=https://registry.npmjs.org\n//other.example/:_authToken=keep-me\n";
			const h = harness({
				files: { [NPMRC]: prior },
				faults: {
					readFile: (path) =>
						Effect.fail(
							PlatformError.systemError({
								_tag: "PermissionDenied",
								module: "FileSystem",
								method: "readFile",
								pathOrDescriptor: path,
							}),
						),
				},
			});
			const exit = yield* Effect.exit(
				h.run(
					Effect.flatMap(publisher, (p) =>
						p.setupAuth({ registry: "https://registry.npmjs.org", credential: TOKEN_CREDENTIAL, npmrcPath: NPMRC }),
					),
				),
			);
			assert.isTrue(Exit.isFailure(exit));
			const error = Exit.isFailure(exit) ? Exit.findErrorOption(exit) : undefined;
			assert.isTrue(error !== undefined && error._tag === "Some");
			if (error !== undefined && error._tag === "Some") {
				assert.instanceOf(error.value, PublishError);
				assert.isTrue(S.is(PublishError)(error.value));
				assert.strictEqual(error.value.kind, "auth");
			}
			assert.strictEqual(h.fs.volume.text(NPMRC), prior);
		}),
	);

	it.effect("fails kind auth when the npmrc path is a directory (BadResource)", () =>
		Effect.gen(function* () {
			const h = harness({ files: { [NPMRC]: MemoryFileSystem.directory() } });
			const exit = yield* Effect.exit(
				h.run(
					Effect.flatMap(publisher, (p) =>
						p.setupAuth({ registry: "https://registry.npmjs.org", credential: TOKEN_CREDENTIAL, npmrcPath: NPMRC }),
					),
				),
			);
			assert.isTrue(Exit.isFailure(exit));
			const error = Exit.isFailure(exit) ? Exit.findErrorOption(exit) : undefined;
			assert.isTrue(error !== undefined && error._tag === "Some");
			if (error !== undefined && error._tag === "Some") {
				assert.isTrue(S.is(PublishError)(error.value));
				assert.strictEqual(error.value.kind, "auth");
				// Only the READ failure names the npmrc; a failed write carries no subject.
				assert.strictEqual(error.value.subject, NPMRC);
			}
		}),
	);
});

describe("PackagePublish.pack", () => {
	it.effect("parses npm pack --json into a PackedTarball", () =>
		Effect.gen(function* () {
			const h = harness({ files: { "/repo/pkg/pkg-1.1.0.tgz": "bytes" } });
			const packed = yield* h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg")));
			assert.instanceOf(packed, PackedTarball);
			assert.strictEqual(packed.name, "pkg");
			assert.strictEqual(packed.version, "1.1.0");
			assert.strictEqual(packed.integrity, "sha512-abc123==");
			assert.strictEqual(packed.packedSize, 2048);
			assert.strictEqual(packed.unpackedSize, 8192);
			assert.strictEqual(packed.fileCount, 12);
			assert.include(packed.tarballPath, "pkg-1.1.0.tgz");
		}),
	);

	it.effect("parses npm 12's name-keyed pack --json to the same PackedTarball", () =>
		// The 12.0.0 breaking change: `pack --json` and `publish --json` share
		// one shape, an object keyed by package name. Both majors are in the
		// support window, so the keyed form decodes to the identical record.
		Effect.gen(function* () {
			const h = harness({
				script: () => ({ stdout: packJsonNpm12, exit: 0 }),
				files: { "/repo/pkg/pkg-1.1.0.tgz": "bytes" },
			});
			const packed = yield* h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg")));
			assert.strictEqual(packed.name, "pkg");
			assert.strictEqual(packed.version, "1.1.0");
			assert.strictEqual(packed.integrity, "sha512-abc123==");
			assert.strictEqual(packed.packedSize, 2048);
			assert.strictEqual(packed.fileCount, 12);
			assert.include(packed.tarballPath, "pkg-1.1.0.tgz");
		}),
	);

	it.effect("a keyed object whose entry is malformed still fails with kind 'output'", () =>
		// The keyed branch is not a lenient catch-all: an entry missing its
		// filename is rejected the same way the array form rejects it.
		Effect.gen(function* () {
			const { filename: _dropped, ...noFilename } = packEntry;
			const h = harness({ script: () => ({ stdout: JSON.stringify({ pkg: noFilename }), exit: 0 }) });
			const error = yield* Effect.flip(h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg"))));
			assert.strictEqual(error.kind, "output");
		}),
	);

	it.effect("an empty keyed object fails with kind 'output', like an empty array", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stdout: "{}", exit: 0 }) });
			const error = yield* Effect.flip(h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg"))));
			assert.strictEqual(error.kind, "output");
		}),
	);

	it.effect("runs npm pack in the package directory", () =>
		Effect.gen(function* () {
			const h = harness({ files: { "/repo/pkg/pkg-1.1.0.tgz": "bytes" } });
			yield* h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg")));
			assert.strictEqual(h.spawner.spawns[0]?.cwd, "/repo/pkg");
			assert.deepStrictEqual([...(h.spawner.spawns[0]?.args ?? [])], ["pack", "--json"]);
		}),
	);

	it.effect("computes a sha256 over the tarball BYTES, distinct from the integrity", () =>
		// The registry's `integrity` (sha512 SRI, base64) and the attestation
		// subject digest (sha256, hex) are different algorithms in different
		// encodings; conflating them is a silent attestation failure.
		Effect.gen(function* () {
			const h = harness({ files: { "/repo/pkg/pkg-1.1.0.tgz": "tarball-bytes" } });
			const packed = yield* h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg")));
			assert.strictEqual(packed.sha256Hex, "0dab", "the fake digest of a 13-byte body, hex-encoded");
			assert.notStrictEqual(packed.sha256Hex, packed.integrity);
		}),
	);

	it.effect("a non-zero npm pack fails typed with kind 'pack'", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stderr: "npm error code EJSONPARSE", exit: 1 }) });
			const error = yield* Effect.flip(h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg"))));
			assert.instanceOf(error, PublishError);
			assert.strictEqual(error.kind, "pack");
		}),
	);

	it.effect("unreadable pack output fails with kind 'output', not 'pack'", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stdout: "not json", exit: 0 }) });
			const error = yield* Effect.flip(h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg"))));
			assert.strictEqual(error.kind, "output");
		}),
	);

	it.effect("an unreadable tarball fails with kind 'digest' — npm SUCCEEDED", () =>
		// Reporting this as "npm pack failed" would send a reader to npm's output
		// looking for an error npm never produced. The tarball is deliberately
		// not seeded here.
		Effect.gen(function* () {
			const h = harness();
			const error = yield* Effect.flip(h.run(Effect.flatMap(publisher, (p) => p.pack("/repo/pkg"))));
			assert.strictEqual(error.kind, "digest");
			assert.include(error.message, "could not be read for hashing");
		}),
	);
});

describe("PackagePublish.publishTarball", () => {
	const publishArgs = (h: Harness) => [...(h.spawner.spawns[0]?.args ?? [])];

	it.effect("uploads the named tarball to the named registry", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stdout: "+ pkg@1.1.0", exit: 0 }) });
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.publishTarball("/tmp/pkg-1.1.0.tgz", { registry: "https://registry.npmjs.org" }),
				),
			);
			const args = publishArgs(h);
			assert.include(args, "publish");
			assert.include(args, "/tmp/pkg-1.1.0.tgz");
			assert.include(args, "--registry");
			assert.include(args, "https://registry.npmjs.org");
		}),
	);

	it.effect("passes tag, access and provenance only when asked", () =>
		Effect.gen(function* () {
			const plain = harness({ script: () => ({ stdout: "ok", exit: 0 }) });
			yield* plain.run(
				Effect.flatMap(publisher, (p) => p.publishTarball("/tmp/t.tgz", { registry: "https://r.example" })),
			);
			assert.notInclude(publishArgs(plain), "--provenance");
			assert.notInclude(publishArgs(plain), "--tag");

			const full = harness({ script: () => ({ stdout: "ok", exit: 0 }) });
			yield* full.run(
				Effect.flatMap(publisher, (p) =>
					p.publishTarball("/tmp/t.tgz", {
						// The public registry, because `--provenance` is npm-only —
						// see the pair of provenance tests below.
						registry: "https://registry.npmjs.org",
						tag: "next",
						access: "public",
						provenance: true,
					}),
				),
			);
			const args = publishArgs(full);
			assert.include(args, "--provenance");
			assert.deepStrictEqual(args.slice(args.indexOf("--tag"), args.indexOf("--tag") + 2), ["--tag", "next"]);
			assert.deepStrictEqual(args.slice(args.indexOf("--access"), args.indexOf("--access") + 2), [
				"--access",
				"public",
			]);
		}),
	);

	it.effect("drops --provenance for a NON-npm registry rather than failing the publish", () =>
		// npm rejects `--provenance` against GitHub Packages. A release publishing
		// to three registries should not lose two of them to one flag.
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stdout: "ok", exit: 0 }) });
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.publishTarball("/tmp/t.tgz", { registry: "https://npm.pkg.github.com", provenance: true }),
				),
			);
			assert.notInclude(publishArgs(h), "--provenance");
		}),
	);

	it.effect("keeps --provenance for the public npm registry", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stdout: "ok", exit: 0 }) });
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.publishTarball("/tmp/t.tgz", { registry: "https://registry.npmjs.org", provenance: true }),
				),
			);
			assert.include(publishArgs(h), "--provenance");
		}),
	);

	it.effect("captures npm's provenance URL when it prints one", () =>
		Effect.gen(function* () {
			const h = harness({
				script: () => ({
					stdout:
						"npm notice Provenance statement published to transparency log: https://search.sigstore.dev/?logIndex=42\n",
					exit: 0,
				}),
			});
			const outcome = yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.publishTarball("/tmp/t.tgz", { registry: "https://r.example", provenance: true }),
				),
			);
			assert.strictEqual(outcome.provenanceUrl, "https://search.sigstore.dev/?logIndex=42");
		}),
	);

	it.effect("reports no provenance URL when npm printed none", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stdout: "+ pkg@1.1.0", exit: 0 }) });
			const outcome = yield* h.run(
				Effect.flatMap(publisher, (p) => p.publishTarball("/tmp/t.tgz", { registry: "https://r.example" })),
			);
			assert.isUndefined(outcome.provenanceUrl);
		}),
	);

	it.effect("tokenAuth strips the OIDC environment so npm uses the configured _authToken", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stdout: "ok", exit: 0 }) });
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.publishTarball("/tmp/t.tgz", { registry: "https://r.example", tokenAuth: true }),
				),
			);
			const env = h.spawner.spawns[0]?.env ?? {};
			assert.strictEqual(env.ACTIONS_ID_TOKEN_REQUEST_URL, "");
			assert.strictEqual(env.ACTIONS_ID_TOKEN_REQUEST_TOKEN, "");
			// The override must EXTEND the parent environment, not replace it — a
			// hermetic env has no PATH, so npm itself would fail to resolve.
			assert.strictEqual(h.spawner.spawns[0]?.extendEnv, true);
		}),
	);

	it.effect("a failed publish fails typed with kind 'publish' and the exit code", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stderr: "npm error 403 Forbidden", exit: 1 }) });
			const error = yield* Effect.flip(
				h.run(Effect.flatMap(publisher, (p) => p.publishTarball("/tmp/t.tgz", { registry: "https://r.example" }))),
			);
			assert.strictEqual(error.kind, "publish");
			assert.strictEqual(error.exitCode, 1);
			assert.include(error.message, "403");
		}),
	);
});

describe("PackagePublish.dryRun", () => {
	it.effect("a clean dry run reports ok with the sizing", () =>
		Effect.gen(function* () {
			const h = harness();
			const outcome = yield* h.run(Effect.flatMap(publisher, (p) => p.dryRun("/repo/pkg")));
			assert.isTrue(outcome.ok);
			assert.strictEqual(outcome.packedSize, 2048);
			assert.strictEqual(outcome.fileCount, 12);
		}),
	);

	it.effect("reads the sizing from npm 12's keyed shape too", () =>
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stdout: packJsonNpm12, exit: 0 }) });
			const outcome = yield* h.run(Effect.flatMap(publisher, (p) => p.dryRun("/repo/pkg")));
			assert.isTrue(outcome.ok);
			assert.strictEqual(outcome.packedSize, 2048);
			assert.strictEqual(outcome.unpackedSize, 8192);
			assert.strictEqual(outcome.fileCount, 12);
		}),
	);

	it.effect("a FAILED dry run is a result, not an error", () =>
		// A package that cannot pack is a valid answer to "would this publish?".
		// The error channel is reserved for a structural failure.
		Effect.gen(function* () {
			const h = harness({ script: () => ({ stderr: "npm error Invalid files glob", exit: 1 }) });
			const outcome = yield* h.run(Effect.flatMap(publisher, (p) => p.dryRun("/repo/pkg")));
			assert.isFalse(outcome.ok);
			assert.include(outcome.output, "Invalid files glob");
		}),
	);

	it.effect("passes --dry-run", () =>
		Effect.gen(function* () {
			const h = harness();
			yield* h.run(Effect.flatMap(publisher, (p) => p.dryRun("/repo/pkg")));
			assert.include([...(h.spawner.spawns[0]?.args ?? [])], "--dry-run");
		}),
	);
});

describe("PackagePublish test double", () => {
	it.effect("layerTest answers a stubbed member", () =>
		Effect.gen(function* () {
			const p = yield* PackagePublish;
			const outcome = yield* p.dryRun("/repo/pkg");
			assert.isTrue(outcome.ok);
		}).pipe(
			Effect.provide(
				PackagePublish.layerTest({
					dryRun: () => Effect.succeed({ ok: true, output: "stubbed" }),
				}),
			),
		),
	);

	it.effect("an unstubbed member dies loudly", () =>
		Effect.gen(function* () {
			const p = yield* PackagePublish;
			const exit = yield* Effect.exit(p.pack("/repo/pkg"));
			if (!Exit.isFailure(exit)) assert.fail("expected a defect from an unstubbed member");
			assert.isTrue(exit.cause.reasons.some((reason) => reason._tag === "Die"));
		}).pipe(Effect.provide(PackagePublish.layerTest())),
	);
});

describe("PackagePublish.setupAuth with basic auth", () => {
	it.effect("writes _auth rather than _authToken, carrying the blob verbatim", () =>
		// npm reads BOTH keys per registry (npm-registry-fetch's `hasAuth` checks
		// `_authToken` then `_auth`) and assigns the `_auth` value straight to an
		// `Authorization: Basic` header with no decode. So the blob must land
		// untouched — re-encoding it here would authenticate as nobody.
		Effect.gen(function* () {
			const h = harness();
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.setupAuth({
						registry: "https://registry.example.test",
						credential: { kind: "basic", encoded: Redacted.make("dXNlcjpwYXNz") },
						npmrcPath: NPMRC,
					}),
				),
			);
			const written = npmrcOf(h);
			assert.include(written, "//registry.example.test/:_auth=dXNlcjpwYXNz");
			assert.notInclude(written, "_authToken");
			assert.lengthOf(h.spawner.spawns, 0, "the credential stays off the process table");
		}),
	);

	it.effect("nerf-darts the basic key with a trailing slash, same as the token key", () =>
		Effect.gen(function* () {
			const h = harness();
			yield* h.run(
				Effect.flatMap(publisher, (p) =>
					p.setupAuth({
						registry: "https://example.com/artifactory/api/npm/repo",
						credential: { kind: "basic", encoded: Redacted.make("YWJj") },
						npmrcPath: NPMRC,
					}),
				),
			);
			assert.include(npmrcOf(h), "//example.com/artifactory/api/npm/repo/:_auth=YWJj");
		}),
	);
});

describe("basicCredentialFromPair", () => {
	it.effect("encodes the pair the way npm's own username/_password path does", () => Effect.gen(function* () {
		const credential = yield* basicCredentialFromPair("user", Redacted.make("pass"));
		assert.strictEqual(credential.kind, "basic");
		// base64("user:pass"), computed independently.
		assert.strictEqual(Redacted.value(credential.encoded), "dXNlcjpwYXNz");
	}));

	it.effect("refuses a colon in the username rather than minting a mis-split credential", () => Effect.gen(function* () {
		// The separator is positional and unescapable: "a:b" + ":" + "c" re-splits
		// on the server as user "a", password "b:c".
		const error = yield* Effect.flip(basicCredentialFromPair("a:b", Redacted.make("c")));
		assert.instanceOf(error, InvalidBasicAuthUsernameError);
	}));

	it.effect("keeps the encoded credential out of any loggable value", () => Effect.gen(function* () {
		const credential = yield* basicCredentialFromPair("user", Redacted.make("pass"));
		assert.notInclude(String(credential.encoded), "dXNlcjpwYXNz");
	}));
});


describe("PublishError encoding", () => {
	it.effect("preserves the originating cause stack", () => Effect.gen(function* () {
		const cause = new Error("publish encode probe");
		const encoded = yield* S.encodeEffect(PublishError)(PublishError.make({ kind: "digest", subject: "pkg.tgz", cause }));
		const wireCause = yield* S.decodeUnknownEffect(WireCause)(encoded.cause);
		assert.strictEqual(wireCause.name, cause.name);
		assert.strictEqual(wireCause.message, cause.message);
		assert.strictEqual(wireCause.stack, cause.stack);
	}));
});
