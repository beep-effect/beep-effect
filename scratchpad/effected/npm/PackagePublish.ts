import { LocalExec, Run } from "../commands/index.ts";
import { Context, Crypto, Effect, FileSystem, Layer, Option, Redacted as Red, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { IntegrityHash } from "./IntegrityHash.ts";
import { NpmExecutor } from "./NpmExecutor.ts";
import { PublishError } from "./PublishError.ts";
import type { RegistryCredential } from "./RegistryCredential.ts";
import { classifyRegistry } from "./RegistryKind.ts";

/** npm prints its transparency-log URL on this notice line. */
const PROVENANCE_URL = /https:\/\/search\.sigstore\.dev\/\?logIndex=\d+/;

/**
 * The npm config key that carries a registry's auth token.
 *
 * @remarks
 * npm "nerf-darts" the registry: scheme stripped, **trailing slash required**.
 * `//npm.pkg.github.com/:_authToken` matches; `//npm.pkg.github.com:_authToken`
 * never does, and the publish goes out unauthenticated with no diagnostic. A
 * registry path is preserved (`//host/artifactory/api/npm/repo/:_authToken`).
 */
const authKey = (registry: string, credential: RegistryCredential): string => {
	const withoutScheme = registry.replace(/^https?:/, "");
	const withSlash = withoutScheme.endsWith("/") ? withoutScheme : `${withoutScheme}/`;
	// npm reads BOTH keys per registry, checking `_authToken` first and then
	// `_auth` (npm-registry-fetch's `hasAuth`), so the credential's own kind
	// picks the key and neither shadows the other.
	return `${withSlash}:${credential.kind === "token" ? "_authToken" : "_auth"}`;
};

/** What `npm pack --json` reports for one tarball. */
const PackJsonEntry = Schema.Struct({
	name: Schema.String,
	version: Schema.String,
	filename: Schema.String,
	integrity: Schema.optionalKey(Schema.String),
	size: Schema.optionalKey(Schema.Finite),
	unpackedSize: Schema.optionalKey(Schema.Finite),
	entryCount: Schema.optionalKey(Schema.Finite),
});

/**
 * What `npm pack --json` prints, on both supported majors: npm 11 emits an
 * array of entries, one per packed package; npm 12 emits an object keyed by
 * package name — the 12.0.0 breaking change that made `pack` and `publish`
 * share one `--json` shape (`lib/commands/pack.js` hands `logTar` the
 * tarball's `name` as the key, where 11 handed it the array index). A
 * single-package pack is one entry either way.
 */
const PackJson = Schema.Union([Schema.Array(PackJsonEntry), Schema.Record(Schema.String, PackJsonEntry)]);

/**
 * A packed tarball and the two digests that describe it.
 *
 * @public
 */
export class PackedTarball extends Schema.Class<PackedTarball>("PackedTarball")({
	/** Absolute path to the tarball on disk. */
	tarballPath: Schema.String,
	/** Package name, as npm reported it. */
	name: Schema.String,
	/** Package version, as npm reported it. */
	version: Schema.String,
	/**
	 * npm's own integrity for the tarball (`sha512-<base64>`) — the value the
	 * registry stores as `dist.integrity`, so it compares directly against
	 * `NpmRegistry.version(...)`'s `integrity`.
	 */
	integrity: Schema.optionalKey(IntegrityHash),
	/**
	 * SHA-256 of the tarball bytes, lowercase hex, no prefix.
	 *
	 * @remarks
	 * **Not interchangeable with {@link PackedTarball.integrity}**: different
	 * algorithm, different encoding. This is the digest format the GitHub
	 * attestation APIs accept as a subject; comparing the two silently fails.
	 */
	sha256Hex: Schema.String,
	/** Tarball size in bytes. */
	packedSize: Schema.optionalKey(Schema.Finite),
	/** Unpacked size in bytes. */
	unpackedSize: Schema.optionalKey(Schema.Finite),
	/** Number of files in the tarball. */
	fileCount: Schema.optionalKey(Schema.Finite),
}) {}

/**
 * What one publish produced.
 *
 * @public
 */
export interface PublishOutcome {
	/**
	 * npm's Sigstore transparency-log URL, when it published provenance.
	 * Absent for GitHub Packages, custom registries, and provenance-off runs.
	 */
	readonly provenanceUrl?: string | undefined;
}

/**
 * What a dry run reported.
 *
 * @remarks
 * `ok: false` is a **result**, not an error: "this package cannot pack" is a
 * valid answer to "would this publish?". The error channel is reserved for a
 * structural failure — npm could not be spawned, or its output was unreadable.
 * `npm pack --dry-run` never contacts a registry, so `ok: true` means the
 * package packs, **not** that a registry would accept it.
 *
 * @public
 */
export interface DryRunOutcome {
	/** Whether the package packs. `false` is an answer, not a failure. */
	readonly ok: boolean;
	/** Tarball size in bytes, when npm reported it. */
	readonly packedSize?: number | undefined;
	/** Unpacked size in bytes, when npm reported it. */
	readonly unpackedSize?: number | undefined;
	/** Number of files the tarball would contain, when npm reported it. */
	readonly fileCount?: number | undefined;
	/** npm's output, for diagnostics. */
	readonly output: string;
}

/**
 * Options shared by the packing operations.
 *
 * @public
 */
export interface PackOptions {
	/** Which npm runs the command. Defaults to {@link NpmExecutor.ambient}. */
	readonly executor?: NpmExecutor | undefined;
}

/**
 * Options for uploading a tarball.
 *
 * @public
 */
export interface PublishOptions extends PackOptions {
	/** The registry to publish to. Required — a defaulted registry is how packages land in the wrong place. */
	readonly registry: string;
	/** dist-tag to apply. */
	readonly tag?: string | undefined;
	/** Access level for a scoped package. */
	readonly access?: "public" | "restricted" | undefined;
	/** Request npm's native provenance. */
	readonly provenance?: boolean | undefined;
	/**
	 * Force classic `_authToken` auth by blanking the Actions OIDC environment.
	 *
	 * @remarks
	 * npm attempts tokenless trusted publishing whenever the OIDC variables are
	 * present and does **not** fall back to a configured `_authToken` when that
	 * attempt fails. Required for GitHub Packages, and as the bootstrap path for
	 * a package with no trusted publisher configured yet.
	 */
	readonly tokenAuth?: boolean | undefined;
}

/**
 * The {@link PackagePublish} service shape.
 *
 * @public
 */
export interface PackagePublishShape {
	/**
	 * Write a registry auth token into an npmrc.
	 *
	 * @remarks
	 * The token goes to the file, **never to argv** — redaction protects this
	 * kit's error messages, not the operating system's process table. Masking
	 * the token in a CI log is the **caller's** job; this package takes a
	 * `Redacted` and has no opinion about log output.
	 *
	 * An existing npmrc is appended to, never replaced. A missing file
	 * (`NotFound`) starts empty; any other read failure — an unreadable file, a
	 * directory at the path — fails `PublishError` with kind `"auth"` and leaves
	 * the file untouched, rather than overwriting config it could not read.
	 */
	readonly setupAuth: (options: {
		readonly registry: string;
		readonly credential: RegistryCredential;
		readonly npmrcPath: string;
	}) => Effect.Effect<void, PublishError>;
	/** `npm pack --json` — writes the tarball and reports both digests. */
	readonly pack: (packageDir: string, options?: PackOptions) => Effect.Effect<PackedTarball, PublishError>;
	/** `npm publish <tarball>` — uploads bytes packed earlier, never re-packs. */
	readonly publishTarball: (
		tarballPath: string,
		options: PublishOptions,
	) => Effect.Effect<PublishOutcome, PublishError>;
	/** `npm pack --dry-run --json` — packability and sizing only. */
	readonly dryRun: (packageDir: string, options?: PackOptions) => Effect.Effect<DryRunOutcome, PublishError>;
}

/** Builds the service over already-resolved platform services. */
const make = Effect.fnUntraced(function* () {
	const fs = yield* FileSystem.FileSystem;
	const crypto = yield* Crypto.Crypto;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const local = yield* LocalExec;

	/**
	 * Discharges the two services the command path needs, once, here.
	 *
	 * @remarks
	 * `Run.collect` requires `ChildProcessSpawner` and `NpmExecutor.command`
	 * requires `LocalExec`. Resolving both at construction is what keeps every
	 * method's `R` at `never` — the `@effected/git` shape — so a consumer wires
	 * this service once and its methods compose anywhere.
	 */
	const discharge = <A, E>(
		effect: Effect.Effect<A, E, ChildProcessSpawner.ChildProcessSpawner | LocalExec>,
	): Effect.Effect<A, E> =>
		effect.pipe(
			Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner),
			Effect.provideService(LocalExec, local),
		);

	const hex = (bytes: Uint8Array): string =>
		Array.from(bytes)
			.map((byte) => byte.toString(16).padStart(2, "0"))
			.join("");

	/** Runs an npm invocation, mapping a command failure onto `kind`. */
	const npm = (
		args: ReadonlyArray<string>,
		options: {
			readonly executor: NpmExecutor;
			readonly cwd?: string | undefined;
			readonly env?: Record<string, string> | undefined;
			readonly kind: "pack" | "publish";
			readonly subject: string;
			readonly registry?: string | undefined;
		},
	) =>
		discharge(
			options.executor.command(args).pipe(
				Effect.map((command) => {
					const withCwd = options.cwd === undefined ? command : ChildProcess.setCwd(command, options.cwd);
					// Run.extendEnv, not core setEnv: a bare setEnv spawns npm with ONLY the
					// caller's vars — no PATH, so the executable itself fails to resolve.
					return options.env === undefined ? withCwd : Run.extendEnv(withCwd, options.env);
				}),
				Effect.flatMap((command) => Run.collect(command)),
				Effect.catch((cause) =>
					Effect.fail(
						PublishError.make({
							kind: options.kind,
							subject: options.subject,
							...(options.registry === undefined ? {} : { registry: options.registry }),
							cause,
						}),
					),
				),
			),
		);

	const parsePackJson = (stdout: string, subject: string) =>
		Effect.try({
			try: () => JSON.parse(stdout) as unknown,
			catch: (cause) => PublishError.make({ kind: "output", subject, cause }),
		}).pipe(
			Effect.flatMap((parsed) =>
				Schema.decodeUnknownEffect(PackJson)(parsed).pipe(
					Effect.catch((cause) => Effect.fail(PublishError.make({ kind: "output", subject, cause }))),
				),
			),
			Effect.flatMap((decoded) => {
				// Annotated on purpose: `Array.isArray`'s `arg is any[]` cannot narrow
				// the union's `ReadonlyArray` member, so the true branch degrades to
				// `any[]` and would turn every field read off the entry into an
				// unchecked `any`.
				const entries: ReadonlyArray<typeof PackJsonEntry.Type> = Array.isArray(decoded)
					? decoded
					: Object.values(decoded);
				const entry = entries[0];
				return entry === undefined
					? Effect.fail(PublishError.make({ kind: "output", subject, output: stdout }))
					: Effect.succeed(entry);
			}),
		);

	const setupAuth = Effect.fn("PackagePublish.setupAuth")(function* (options: {
		readonly registry: string;
		readonly credential: RegistryCredential;
		readonly npmrcPath: string;
	}) {
		yield* Effect.annotateCurrentSpan({
			registry: options.registry,
			npmrc: options.npmrcPath,
			// The KIND is safe to annotate and worth annotating; the value is not.
			credential: options.credential.kind,
		});
		// Only an absent file is an empty npmrc. Any other read failure (permission
		// denied, a directory in the way) means a file exists that we cannot read;
		// treating it as empty would overwrite it and drop its prior config lines.
		const existing = yield* fs
			.readFileString(options.npmrcPath)
			.pipe(
				Effect.catch((cause) =>
					cause.reason._tag === "NotFound"
						? Effect.succeed("")
						: Effect.fail(
								PublishError.make({ kind: "auth", registry: options.registry, subject: options.npmrcPath, cause }),
							),
				),
			);
		const secret = options.credential.kind === "token" ? options.credential.token : options.credential.encoded;
		const line = `${authKey(options.registry, options.credential)}=${Red.value(secret)}`;
		const separator = existing === "" || existing.endsWith("\n") ? "" : "\n";
		yield* fs
			.writeFileString(options.npmrcPath, `${existing}${separator}${line}\n`)
			.pipe(
				Effect.catch((cause) => Effect.fail(PublishError.make({ kind: "auth", registry: options.registry, cause }))),
			);
	});

	const pack = Effect.fn("PackagePublish.pack")(function* (packageDir: string, options?: PackOptions) {
		yield* Effect.annotateCurrentSpan({ packageDir });
		const output = yield* npm(["pack", "--json"], {
			executor: options?.executor ?? NpmExecutor.ambient,
			cwd: packageDir,
			kind: "pack",
			subject: packageDir,
		});
		if (!output.succeeded) {
			return yield* PublishError.make({
					kind: "pack",
					subject: packageDir,
					exitCode: output.exitCode,
					output: output.stderr === "" ? output.stdout : output.stderr,
				});
		}
		const entry = yield* parsePackJson(output.stdout, packageDir);
		const tarballPath = `${packageDir}/${entry.filename}`;
		// The sha256 is computed from the tarball's own bytes, not from npm's
		// report: it is a different digest for a different consumer (attestation
		// subjects), and deriving it from the file is what makes it verifiable.
		const bytes = yield* fs
			.readFile(tarballPath)
			.pipe(Effect.catch((cause) => Effect.fail(PublishError.make({ kind: "digest", subject: tarballPath, cause }))));
		const digest = yield* crypto
			.digest("SHA-256", bytes)
			.pipe(Effect.catch((cause) => Effect.fail(PublishError.make({ kind: "digest", subject: tarballPath, cause }))));
		return PackedTarball.make({
			tarballPath,
			name: entry.name,
			version: entry.version,
			...integrityField(entry.integrity),
			sha256Hex: hex(digest),
			...(entry.size === undefined ? {} : { packedSize: entry.size }),
			...(entry.unpackedSize === undefined ? {} : { unpackedSize: entry.unpackedSize }),
			...(entry.entryCount === undefined ? {} : { fileCount: entry.entryCount }),
		});
	});

	const publishTarball = Effect.fn("PackagePublish.publishTarball")(function* (
		tarballPath: string,
		options: PublishOptions,
	) {
		yield* Effect.annotateCurrentSpan({ tarball: tarballPath, registry: options.registry });
		// Provenance is an npm-registry feature. Passing `--provenance` to GitHub
		// Packages or a custom registry fails the publish outright, so a caller
		// who asks for it against a non-npm target gets the publish without it
		// rather than a failed release: a release pipeline publishing to three
		// registries should not lose two of them to one flag.
		const provenance = options.provenance === true && classifyRegistry(options.registry) === "npm";
		const args = [
			"publish",
			tarballPath,
			"--registry",
			options.registry,
			...(options.tag === undefined ? [] : ["--tag", options.tag]),
			...(options.access === undefined ? [] : ["--access", options.access]),
			...(provenance ? ["--provenance"] : []),
		];
		const output = yield* npm(args, {
			executor: options.executor ?? NpmExecutor.ambient,
			kind: "publish",
			subject: tarballPath,
			registry: options.registry,
			// Blanking rather than deleting: `CommandOptions.env` is an overlay on
			// the inherited environment, so an empty value is how a variable is
			// suppressed without replacing the whole environment.
			...(options.tokenAuth === true
				? { env: { ACTIONS_ID_TOKEN_REQUEST_URL: "", ACTIONS_ID_TOKEN_REQUEST_TOKEN: "" } }
				: {}),
		});
		if (!output.succeeded) {
			return yield* PublishError.make({
					kind: "publish",
					subject: tarballPath,
					registry: options.registry,
					exitCode: output.exitCode,
					output: output.stderr === "" ? output.stdout : output.stderr,
				});
		}
		const printed = `${output.stdout}\n${output.stderr}`;
		const provenanceUrl = PROVENANCE_URL.exec(printed)?.[0];
		return {
			...(provenanceUrl === undefined ? {} : { provenanceUrl }),
		} satisfies PublishOutcome;
	});

	const dryRun = Effect.fn("PackagePublish.dryRun")(function* (packageDir: string, options?: PackOptions) {
		yield* Effect.annotateCurrentSpan({ packageDir });
		const output = yield* npm(["pack", "--dry-run", "--json"], {
			executor: options?.executor ?? NpmExecutor.ambient,
			cwd: packageDir,
			kind: "pack",
			subject: packageDir,
		});
		if (!output.succeeded) {
			// A package that will not pack is an ANSWER, not a failure.
			return {
				ok: false,
				output: output.stderr === "" ? output.stdout : output.stderr,
			} satisfies DryRunOutcome;
		}
		const entry = yield* parsePackJson(output.stdout, packageDir);
		return {
			ok: true,
			output: output.stdout,
			...(entry.size === undefined ? {} : { packedSize: entry.size }),
			...(entry.unpackedSize === undefined ? {} : { unpackedSize: entry.unpackedSize }),
			...(entry.entryCount === undefined ? {} : { fileCount: entry.entryCount }),
		} satisfies DryRunOutcome;
	});

	return { setupAuth, pack, publishTarball, dryRun } satisfies PackagePublishShape;
});

/** The `integrity` field, present only when npm's value classifies. */
const integrityField = (raw: string | undefined): { integrity?: typeof IntegrityHash.Type } =>
	raw === undefined
		? {}
		: Option.match(Schema.decodeOption(IntegrityHash)(raw), {
				onNone: () => ({}),
				onSome: (integrity) => ({ integrity }),
			});

/** The default for an unstubbed {@link PackagePublish.makeTest} member. */
const notStubbed = (method: string) => () =>
	Effect.die(
		new Error(
			`PackagePublish.makeTest: ${method}() was called but not stubbed — no honest default exists for a test double; pass a \`${method}\` override.`,
		),
	);

/**
 * Packs, dry-runs and publishes npm tarballs, and writes registry auth into an
 * npmrc, by running `npm` through `@effected/commands`.
 *
 * @remarks
 * Every invocation goes through `Run`, so a non-zero npm exit arrives as a
 * typed {@link PublishError} and npm's `--json` output is schema-decoded rather
 * than cast. The service deliberately does **not** own: log masking (the
 * caller's job, so no Actions edge lives in a publish library), the npmrc
 * location (caller-supplied — resolving `~` needs `node:os`), or a fused
 * probe-then-publish (probe with `NpmRegistry`, then call `publishTarball`
 * against an explicit registry).
 *
 * Every method's `R` is `never`: the live layer resolves its platform services
 * once at construction.
 *
 * @example
 * ```ts
 * import { PackagePublish } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const publish = yield* PackagePublish;
 *   const packed = yield* publish.pack("./packages/my-lib");
 *   return yield* publish.publishTarball(packed.tarballPath, {
 *     registry: "https://registry.npmjs.org",
 *     provenance: true,
 *   });
 * });
 * ```
 *
 * @public
 */
export class PackagePublish extends Context.Service<PackagePublish, PackagePublishShape>()(
	"@beep/scratchpad/effected/npm/PackagePublish",
) {
	/**
	 * The live service. Requires `FileSystem`, `Crypto`, `ChildProcessSpawner`
	 * and `LocalExec` (from `@effected/commands`), resolved once at construction.
	 */
	static readonly layer: Layer.Layer<
		PackagePublish,
		never,
		FileSystem.FileSystem | Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | LocalExec
	> = Layer.effect(this, make());

	/**
	 * An in-memory double: stub only what the test exercises; every other member
	 * **dies** with a defect naming itself.
	 */
	static readonly makeTest = (overrides: Partial<PackagePublishShape> = {}): PackagePublishShape => ({
		setupAuth: notStubbed("setupAuth"),
		pack: notStubbed("pack"),
		publishTarball: notStubbed("publishTarball"),
		dryRun: notStubbed("dryRun"),
		...overrides,
	});

	/**
	 * {@link PackagePublish.makeTest} behind `Layer.succeed`.
	 *
	 * @remarks
	 * A parameterized layer factory mints a fresh reference per call and layers
	 * memoize by reference — bind the result to a `const`.
	 */
	static readonly layerTest = (overrides: Partial<PackagePublishShape> = {}): Layer.Layer<PackagePublish> =>
		Layer.succeed(PackagePublish, PackagePublish.makeTest(overrides));
}
