import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import { flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "@beep/utils/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as A from "effect/Array";
import type { HttpClientError } from "effect/http";
import { HttpClient } from "effect/http";
import { IntegrityHash } from "./IntegrityHash.ts";
import { RegistryCredential } from "./RegistryCredential.ts";
import { classifyRegistry } from "./RegistryKind.ts";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/npm/NpmRegistry");

/**
 * The public npm registry, used when a read names no other.
 *
 * @public
 */
export const DEFAULT_REGISTRY = "https://registry.npmjs.org";

/**
 * Which registry to read from, and how to authenticate.
 *
 * @remarks
 * **Per call, never baked into the layer.** A publish flow probes two
 * registries for one package inside a single program, so a layer-scoped
 * registry cannot express what consumers actually do — and a test double
 * keyed without the registry could not express it either.
 *
 * @public
 */
export const RegistryTarget = S.Struct({
	/** Registry base URL. Defaults to {@link DEFAULT_REGISTRY}. */
	registry: S.optional(S.String).annotateKey({ description: "Registry base URL; omission selects the public npm registry." }),
	/**
	 * Superseded by {@link RegistryTarget.credential}.
	 *
	 * @deprecated Use `credential: { kind: "token", token }`. This field is
	 * typed `never` **as a tripwire, not as an alias**:
	 * removing it outright would be a SILENT break rather than a loud one.
	 * Callers commonly pass it through a conditional spread —
	 * `...(token !== null ? { token } : {})` — and a spread of a no-longer-known
	 * property is not an excess-property error, so the field would simply vanish
	 * and an authenticated probe would become an anonymous one. Against a private
	 * registry that answers 401, `NpmRegistry.version` reads that as "not
	 * published", and a publish flow acting on it republishes a version that
	 * already exists. Typed `never`, the same spread fails to compile.
	 */
	token: S.optionalKey(S.Never).annotateKey({ description: "Removed token option; use a token credential instead." }),
	/**
	 * How to authenticate, for a registry that requires auth to read.
	 *
	 * @remarks
	 * The same union `PackagePublish.setupAuth` writes into an npmrc, so the
	 * read probe and the publish cannot disagree about the scheme for one
	 * registry — a bearer probe against a basic-auth registry answers 401 and
	 * reads as "not published".
	 */
	credential: S.optional(RegistryCredential).annotateKey({ description: "The redacted credential for this registry read." }),
}).annotate($I.annote("RegistryTarget", { description: "A structural per-call registry and credential boundary." }));
export interface RegistryTarget extends S.Schema.Type<typeof RegistryTarget> {
	/** @deprecated Use credential. Retained explicitly for the source-level tripwire contract. */
	readonly token?: never;
}

/**
 * One published version of one package, on one registry.
 *
 * @public
 */
export class PublishedVersion extends S.Class<PublishedVersion>($I`PublishedVersion`)({
	/** The package name as the registry reports it. */
	name: S.String.annotateKey({ description: "The package name as the registry reports it." }),
	/** The version as the registry reports it. */
	version: S.String.annotateKey({ description: "The version as the registry reports it." }),
	/** The published integrity, when the registry recorded one. */
	integrity: S.optionalKey(IntegrityHash).annotateKey({ description: "The published integrity, when the registry recorded one." }),
	/** The tarball URL, when the registry recorded one. */
	tarball: S.optionalKey(S.String).annotateKey({ description: "The tarball URL, when the registry recorded one." }),
}, $I.annote("PublishedVersion", { description: "One published version of one package, on one registry." })) {}

/**
 * When one version of a package was published.
 *
 * @remarks
 * A class rather than a bare `version → timestamp` record because the
 * registry's `time` object mixes per-version entries with two non-version keys
 * (`created`, `modified`), and every consumer that reads it raw has to
 * re-derive that exclusion.
 *
 * @public
 */
export class PublishTime extends S.Class<PublishTime>($I`PublishTime`)({
	/** The version this timestamp belongs to. */
	version: S.String.annotateKey({ description: "The version this timestamp belongs to." }),
	/** When it was published. */
	publishedAt: S.DateTimeUtc.annotateKey({ description: "When it was published." }),
}, $I.annote("PublishTime", { description: "When one version of a package was published." })) {}

const RegistryReadFailureKind = LiteralKit(["transport", "status", "decode"]).annotate(
	$I.annote("RegistryReadFailureKind", { description: "The supported RegistryReadError cases." }),
);

const RegistryReadErrorPayload = S.Struct({
	/** Why the read failed. */
	kind: RegistryReadFailureKind.annotateKey({ description: "Why the read failed." }),
	/** The package that was being read. */
	package: S.String.annotateKey({ description: "The package that was being read." }),
	/** The registry that was being read from. */
	registry: S.String.annotateKey({ description: "The registry that was being read from." }),
	/** The HTTP status, for `kind: "status"`. */
	status: S.optionalKey(S.Finite).annotateKey({ description: "The HTTP status, for `kind: \"status\"`." }),
	/** The underlying failure. */
	cause: S.optionalKey(S.Defect({ includeStack: true })).annotateKey({ description: "The underlying failure." }),
}).annotate(
	$I.annote("RegistryReadErrorPayload", { description: "The compatible public RegistryReadError payload." }),
);

const RegistryReadFailure = RegistryReadFailureKind.mapMembers(([transport, status, decode]) => [
	S.Struct({
		kind: transport.annotateKey({ description: "The request produced no response." }),
		package: RegistryReadErrorPayload.fields.package,
		registry: RegistryReadErrorPayload.fields.registry,
		cause: RegistryReadErrorPayload.fields.cause,
	}).annotate($I.annote("RegistryTransportFailure", { description: "The request produced no response." })),
	S.Struct({
		kind: status.annotateKey({ description: "The registry returned an unsuccessful status." }),
		package: RegistryReadErrorPayload.fields.package,
		registry: RegistryReadErrorPayload.fields.registry,
		status: RegistryReadErrorPayload.fields.status,
	}).annotate($I.annote("RegistryStatusFailure", { description: "The registry returned an unsuccessful status." })),
	S.Struct({
		kind: decode.annotateKey({ description: "The registry body could not be decoded." }),
		package: RegistryReadErrorPayload.fields.package,
		registry: RegistryReadErrorPayload.fields.registry,
		cause: RegistryReadErrorPayload.fields.cause,
	}).annotate($I.annote("RegistryDecodeFailure", { description: "The registry body could not be decoded." })),
] as const).pipe(
	S.annotate($I.annote("RegistryReadFailure", { description: "Validated case-specific RegistryReadError payloads." })),
	S.toTaggedUnion("kind"),
);

const RegistryReadFailureFromPayload = RegistryReadErrorPayload.pipe(
	S.toType,
	S.decodeTo(RegistryReadFailure.pipe(S.toType)),
	S.annotate($I.annote("RegistryReadFailureFromPayload", { description: "Project the compatible payload into a validated case without encoding its cause." })),
);

const registryReadFailure = flow(S.decodeUnknownResult(RegistryReadFailureFromPayload), Result.getOrThrow);

/**
 * A registry read failed.
 *
 * @remarks
 * `kind` is the routing surface: `"transport"` (the request never produced a
 * response), `"status"` (the registry answered, unsuccessfully — `status`
 * carries the code), `"decode"` (the body was not what the registry protocol
 * says it is). **A 404 is not here**: an absent package or version is
 * `Option.none()`, extending the `None`-is-success convention this package's
 * resolver contracts already use.
 *
 * @public
 */
export class RegistryReadError extends S.TaggedError<RegistryReadError>($I`RegistryReadError`)("RegistryReadError", RegistryReadErrorPayload, $I.annote("RegistryReadError", { description: "A registry read failed." })) {
	override get message(): string {
		const failure = registryReadFailure(this);
		const where = `${failure.package} on ${failure.registry}`;
		return RegistryReadFailure.match(failure, {
			transport: () => `Could not reach the registry for ${where}`,
			status: (detail) => `Registry read for ${where} failed with status ${detail.status ?? "unknown"}`,
			decode: () => `Registry read for ${where} returned an unreadable body`,
		});
	}
}

/**
 * The `Authorization` header for a credential, or none at all.
 *
 * @remarks
 * The scheme follows the credential's kind rather than being fixed, matching
 * what npm sends for the same npmrc entry: a `_authToken` goes out as `Bearer`
 * and an `_auth` blob as `Basic`, used verbatim with no re-encoding.
 */
const authorizationHeader = (credential: RegistryCredential | undefined): Record<string, string> => {
	if (credential === undefined) return {};
	return credential.kind === "token"
		? { authorization: `Bearer ${Redacted.value(credential.token)}` }
		: { authorization: `Basic ${Redacted.value(credential.encoded)}` };
};

/** The version-manifest fields this package reads. Unknown keys are ignored. */
const VersionManifest = S.Struct({
	name: S.String,
	version: S.String,
	dist: S.optionalKey(
		S.Struct({
			integrity: S.optionalKey(S.String),
			tarball: S.optionalKey(S.String),
		}),
	),
});

/** The packument fields this package reads. Unknown keys are ignored. */
const Packument = S.Struct({
	"dist-tags": S.optionalKey(S.Record(S.String, S.String)),
	versions: S.optionalKey(S.Record(S.String, S.Unknown)),
	time: S.optionalKey(S.Record(S.String, S.String)),
});

/** The two `time` keys that are not versions. */
const NON_VERSION_TIME_KEYS = HashSet.make("created", "modified");

/**
 * The `integrity` field for a `PublishedVersion`, present only when the raw
 * value is a valid integrity hash.
 *
 * @remarks
 * Validated through the brand's own schema rather than cast: a registry that
 * serves an integrity this package cannot classify yields *no* integrity, not
 * a lie and not a failed read. Returns a spreadable object so the caller never
 * passes an explicit `undefined` to an `optionalKey` field (which v4
 * constructors reject).
 */
const integrityField = (raw: string | undefined): { integrity?: typeof IntegrityHash.Type } =>
	O.getSomesStruct({ integrity: O.flatMap(O.fromUndefinedOr(raw), S.decodeOption(IntegrityHash)) });

/** `https://host` + `/@scope%2Fname` — the slash in a scoped name must be encoded. */
const packageUrl = (registry: string, name: string, version?: string): string => {
	const base = Str.endsWith("/")(registry) ? Str.slice(0, -1)(registry) : registry;
	const encoded = encodeURIComponent(name);
	return version === undefined ? `${base}/${encoded}` : `${base}/${encoded}/${encodeURIComponent(version)}`;
};

/**
 * The {@link NpmRegistry} service shape.
 *
 * @public
 */
export interface NpmRegistryShape {
	/**
	 * One published version, or `None` when that version is not on that registry.
	 *
	 * @remarks
	 * A `github-packages` target is read through the packument (GitHub Packages
	 * answers the per-version endpoint with 405 regardless of credentials); any
	 * other registry answering 405 on the per-version path is retried the same
	 * way.
	 */
	readonly version: (
		name: string,
		version: string,
		target?: RegistryTarget,
	) => Effect.Effect<O.Option<PublishedVersion>, RegistryReadError>;
	/** Every published version. Empty when the package is not on that registry. */
	readonly versions: (name: string, target?: RegistryTarget) => Effect.Effect<ReadonlyArray<string>, RegistryReadError>;
	/** The dist-tag map (`latest`, `next`, …). Empty when the package is absent. */
	readonly distTags: (
		name: string,
		target?: RegistryTarget,
	) => Effect.Effect<Record<string, string>, RegistryReadError>;
	/** Per-version publish timestamps, from the packument's `time` map (without its `created` / `modified` keys). */
	readonly publishTimes: (
		name: string,
		target?: RegistryTarget,
	) => Effect.Effect<ReadonlyArray<PublishTime>, RegistryReadError>;
}

/** Builds the service over an already-resolved `HttpClient`. */
const make = Effect.fnUntraced(function* () {
	const client = yield* HttpClient.HttpClient;

	/**
	 * Fetches and decodes one registry document, mapping absence to `None`.
	 *
	 * @remarks
	 * The 404-is-absence rule is applied on the **status**, structurally, rather
	 * than by matching the wording of a CLI's stderr.
	 */
	const read = <A, I>(
		schema: S.Codec<A, I>,
		url: string,
		name: string,
		registry: string,
		target: RegistryTarget | undefined,
	): Effect.Effect<O.Option<A>, RegistryReadError> =>
		client
			.get(url, {
				headers: authorizationHeader(target?.credential),
			})
			.pipe(
				Effect.mapError((cause: HttpClientError.HttpClientError) =>
					RegistryReadError.make({ kind: "transport", package: name, registry, cause }),
				),
				Effect.flatMap((response) => {
					if (response.status === 404) return Effect.succeed(O.none<A>());
					if (response.status < 200 || response.status >= 300) {
						return Effect.fail(
							RegistryReadError.make({ kind: "status", package: name, registry, status: response.status }),
						);
					}
					return response.json.pipe(
						Effect.flatMap((body) => S.decodeUnknownEffect(schema)(body)),
						Effect.asSome,
						Effect.mapError((cause) =>
							RegistryReadError.make({ kind: "decode", package: name, registry, cause }),
						),
					);
				}),
			);

	const packument = (name: string, target: RegistryTarget | undefined) => {
		const registry = target?.registry ?? DEFAULT_REGISTRY;
		return read(Packument, packageUrl(registry, name), name, registry, target);
	};

	/**
	 * Resolves one version by reading the whole packument and selecting it.
	 *
	 * @remarks
	 * The read path for registries that do not implement the per-version
	 * endpoint — GitHub Packages answers it with 405 regardless of credentials,
	 * so `version` routes here up front for that kind, and falls back here on a
	 * 405 from any other registry.
	 */
	const versionFromPackument = (
		name: string,
		versionNumber: string,
		registry: string,
		target: RegistryTarget | undefined,
	): Effect.Effect<O.Option<typeof VersionManifest.Type>, RegistryReadError> =>
		read(Packument, packageUrl(registry, name), name, registry, target).pipe(
			Effect.flatMap((document) => {
				if (O.isNone(document)) return Effect.succeed(O.none<typeof VersionManifest.Type>());
				const published = document.value.versions;
				// `hasOwn` rather than a bare index: the version number is caller
				// input, and a key like `constructor` must not read the prototype.
				if (published === undefined || !R.has(published, versionNumber)) {
					return Effect.succeed(O.none<typeof VersionManifest.Type>());
				}
				return S.decodeUnknownEffect(VersionManifest)(published[versionNumber]).pipe(
					Effect.asSome,
					Effect.mapError((cause) =>
						RegistryReadError.make({ kind: "decode", package: name, registry, cause }),
					),
				);
			}),
		);

	const version = Effect.fn("NpmRegistry.version")(function* (
		name: string,
		versionNumber: string,
		target?: RegistryTarget,
	) {
		const registry = target?.registry ?? DEFAULT_REGISTRY;
		yield* Effect.annotateCurrentSpan({ package: name, version: versionNumber, registry });
		const manifest = yield* classifyRegistry(registry) === "github-packages"
			? versionFromPackument(name, versionNumber, registry, target)
			: read(VersionManifest, packageUrl(registry, name, versionNumber), name, registry, target).pipe(
					Effect.catchIf(
						(error) => {
							const failure = registryReadFailure(error);
							return RegistryReadFailure.guards.status(failure) && failure.status === 405;
						},
						() => versionFromPackument(name, versionNumber, registry, target),
					),
				);
		return O.map(manifest, (found) =>
			PublishedVersion.make({
				name: found.name,
				version: found.version,
				...integrityField(found.dist?.integrity),
				...O.getSomesStruct({ tarball: O.fromUndefinedOr(found.dist?.tarball) }),
			}),
		);
	});

	const versions = Effect.fn("NpmRegistry.versions")(function* (name: string, target?: RegistryTarget) {
		yield* Effect.annotateCurrentSpan({ package: name, registry: target?.registry ?? DEFAULT_REGISTRY });
		const document = yield* packument(name, target);
		return O.match(document, {
			onNone: (): ReadonlyArray<string> => [],
			onSome: (found) => R.keys(found.versions ?? {}),
		});
	});

	const distTags = Effect.fn("NpmRegistry.distTags")(function* (name: string, target?: RegistryTarget) {
		yield* Effect.annotateCurrentSpan({ package: name, registry: target?.registry ?? DEFAULT_REGISTRY });
		const document = yield* packument(name, target);
		return O.getOrElse(O.map(document, (found) => ({ ...(found["dist-tags"] ?? {}) })), () => ({}));
	});

	const publishTimes = Effect.fn("NpmRegistry.publishTimes")(function* (name: string, target?: RegistryTarget) {
		yield* Effect.annotateCurrentSpan({ package: name, registry: target?.registry ?? DEFAULT_REGISTRY });
		const document = yield* packument(name, target);
		return O.match(document, {
			onNone: (): ReadonlyArray<PublishTime> => [],
			onSome: (found) => {
				const entries: Array<PublishTime> = [];
				for (const [key, value] of R.toEntries(found.time ?? {})) {
					if (HashSet.has(NON_VERSION_TIME_KEYS, key)) continue;
					// An unparseable timestamp drops the entry rather than failing the
					// read: the caller's question is "when were these published", and
					// one malformed row is not a reason to answer nothing.
					const parsed = DateTime.make(value);
					if (O.isNone(parsed)) continue;
					entries.push(PublishTime.make({ version: key, publishedAt: parsed.value }));
				}
				return entries;
			},
		});
	});

	return { version, versions, distTags, publishTimes } satisfies NpmRegistryShape;
});

class UnstubbedRegistryMethodError extends S.TaggedError<UnstubbedRegistryMethodError>($I`UnstubbedRegistryMethodError`)(
	"UnstubbedRegistryMethodError",
	{ message: S.String },
	$I.annote("UnstubbedRegistryMethodError", { description: "An unstubbed registry test-double method was invoked." }),
) {}

/** The default for an unstubbed {@link NpmRegistry.makeTest} member. */
const notStubbed = (method: string) => () =>
	Effect.die(
		UnstubbedRegistryMethodError.make({
			message: `NpmRegistry.makeTest: ${method}() was called but not stubbed — no honest default exists for a test double; pass a \`${method}\` override, or use NpmRegistry.layerSeeded.`,
		}),
	);

/**
 * One seeded version's registry-visible facts.
 *
 * @public
 */
export const SeededVersion = S.Struct({
	/** Published integrity, if any. */
	integrity: S.optional(S.String).annotateKey({ description: "Published integrity, if any." }),
	/** Tarball URL, if any. */
	tarball: S.optional(S.String).annotateKey({ description: "Published tarball URL, if any." }),
	/** Publish timestamp as an ISO-8601 string, if any. */
	publishedAt: S.optional(S.String).annotateKey({ description: "ISO-8601 publish timestamp, if any." }),
}).annotate($I.annote("SeededVersion", { description: "Structural registry-visible facts for a seeded version." }));
export type SeededVersion = typeof SeededVersion.Type;

/**
 * A whole fake registry world, keyed the way real reads are.
 *
 * @remarks
 * `registries[registry][name][version]` — all three axes, so one seed can serve
 * two versions of one package and two registries for one version (a mixed
 * publish/recover run). Registry keys are matched exactly against
 * `RegistryTarget.registry`; a read with no registry uses {@link DEFAULT_REGISTRY}.
 *
 * @public
 */
export const RegistrySeed = S.Struct({
	/** registry → package → version → facts. */
	registries: S.Record(S.String, S.Record(S.String, S.Record(S.String, SeededVersion))).annotateKey({ description: "Registry to package to version to seeded facts." }),
	/** package → dist-tag map, when a test asserts on tags. */
	distTags: S.optional(S.Record(S.String, S.Record(S.String, S.String))).annotateKey({ description: "Package to dist-tag map, when seeded." }),
}).annotate($I.annote("RegistrySeed", { description: "A structural fake registry world retaining every dictionary axis." }));
export type RegistrySeed = typeof RegistrySeed.Type;

/**
 * Reads package metadata from an npm-protocol registry over core `HttpClient`:
 * one version, every version, dist-tags and per-version publish times.
 *
 * @remarks
 * No `npm view` subprocess is involved. The registry is a **per-call**
 * argument, a 404 is `Option.none()` (or an empty collection) rather than an
 * error, and `integrity` is typed as this package's own {@link IntegrityHash}
 * rather than a bare string. Failures are {@link RegistryReadError}. The live
 * {@link NpmRegistry.layer} requires `HttpClient`; tests use
 * {@link NpmRegistry.layerSeeded} or {@link NpmRegistry.layerTest}.
 *
 * @example
 * ```ts
 * import { NpmRegistry } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as O from "effect/Option";
 * import { FetchHttpClient } from "effect/http";
 *
 * const program = Effect.gen(function* () {
 *   const registry = yield* NpmRegistry;
 *   const found = yield* registry.version("effect", "4.0.0");
 *   return O.map(found, (published) => published.tarball);
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(NpmRegistry.layer), Effect.provide(FetchHttpClient.layer)));
 * ```
 *
 * @public
 */
export class NpmRegistry extends Context.Service<NpmRegistry, NpmRegistryShape>()($I`NpmRegistry`) {
	/** The live service. Resolves `HttpClient` once at construction, so every method's `R` is `never`. */
	static readonly layer: Layer.Layer<NpmRegistry, never, HttpClient.HttpClient> = Layer.effect(this, make());

	/**
	 * An in-memory double: stub only the members the test exercises; every other
	 * member **dies** with a defect naming itself.
	 *
	 * @remarks
	 * No member has an honest default — a fabricated version list or integrity
	 * would leak into consumer logic as fact. For a test that wants a working
	 * registry rather than a stub, use {@link NpmRegistry.layerSeeded}.
	 */
	static readonly makeTest = (overrides: Partial<NpmRegistryShape> = {}): NpmRegistryShape => ({
		version: notStubbed("version"),
		versions: notStubbed("versions"),
		distTags: notStubbed("distTags"),
		publishTimes: notStubbed("publishTimes"),
		...overrides,
	});

	/**
	 * {@link NpmRegistry.makeTest} behind `Layer.succeed`.
	 *
	 * @remarks
	 * A parameterized layer factory mints a fresh reference per call and layers
	 * memoize by reference — bind the result to a `const` rather than calling it
	 * at each composition site.
	 */
	static readonly layerTest = (overrides: Partial<NpmRegistryShape> = {}): Layer.Layer<NpmRegistry> =>
		Layer.succeed(NpmRegistry, NpmRegistry.makeTest(overrides));

	/** A fully-working in-memory double over a {@link RegistrySeed}. */
	static readonly makeSeeded = (seed: RegistrySeed): NpmRegistryShape => {
		const at = (target: RegistryTarget | undefined): Record<string, Record<string, SeededVersion>> =>
			seed.registries[target?.registry ?? DEFAULT_REGISTRY] ?? {};
		return {
			version: (name, version, target) => {
				const found = at(target)[name]?.[version];
				return Effect.succeed(
					found === undefined
						? O.none()
						: O.some(
								PublishedVersion.make({
									name,
									version,
									...integrityField(found.integrity),
									...O.getSomesStruct({ tarball: O.fromUndefinedOr(found.tarball) }),
								}),
							),
				);
			},
			versions: (name, target) => Effect.succeed(R.keys(at(target)[name] ?? {})),
			distTags: (name) => Effect.succeed({ ...(seed.distTags?.[name] ?? {}) }),
			publishTimes: (name, target) =>
				Effect.succeed(
					A.flatMap(R.toEntries(at(target)[name] ?? {}), ([version, facts]) => {
						if (facts.publishedAt === undefined) return [];
						const parsed = DateTime.make(facts.publishedAt);
						return O.isNone(parsed) ? [] : [PublishTime.make({ version, publishedAt: parsed.value })];
					}),
				),
		};
	};

	/** {@link NpmRegistry.makeSeeded} behind `Layer.succeed`. */
	static readonly layerSeeded = (seed: RegistrySeed): Layer.Layer<NpmRegistry> =>
		Layer.succeed(NpmRegistry, NpmRegistry.makeSeeded(seed));
}
