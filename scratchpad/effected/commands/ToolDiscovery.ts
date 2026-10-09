import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import type { LocalExecError } from "./LocalExec.ts";
import { ExecContext, LocalExec } from "./LocalExec.ts";
import { Run } from "./Run.ts";
import type { Tool } from "./Tool.ts";
import { VersionProbe } from "./Tool.ts";

/** How many tools' probe evidence to remember. */
const CACHE_CAPACITY = 256;

/** First version-shaped token: `1.2.3`, `v22.1.0`, `2.3.1-beta.4`. */
const DEFAULT_VERSION_PATTERN = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

/**
 * Where a tool was resolved from.
 *
 * @public
 */
export const ResolvedSource = S.Literals(["global", "local"]);

/**
 * The decoded type of {@link (ResolvedSource:variable)}.
 *
 * @public
 */
export type ResolvedSource = typeof ResolvedSource.Type;

/**
 * A tool that was found, with everything discovery learned about it.
 *
 * @public
 */
export class ResolvedTool extends S.Class<ResolvedTool>("ResolvedTool")({
	/** The executable name. */
	name: S.String,
	/** Which copy this resolution selected. */
	source: ResolvedSource,
	/** The selected copy's version, when one could be read. */
	version: S.Option(S.String),
	/** The global copy's version, when it exists and reports one. */
	globalVersion: S.Option(S.String),
	/** The project-local copy's version, when it exists and reports one. */
	localVersion: S.Option(S.String),
	/** Whether the two copies reported different versions. */
	mismatch: S.Boolean,
	/** The project-local execution context, when {@link ResolvedTool.source} is `"local"`. */
	context: S.optionalKey(ExecContext),
}) {
	/**
	 * A core `Command` that runs this tool — bare for a global resolution,
	 * launcher-prefixed and directory-scoped for a local one.
	 *
	 * @remarks
	 * Returns core's own `ChildProcess.Command`, not a wrapper: hand it to
	 * {@link Run} or to core's spawner directly, and compose it with core's
	 * combinators.
	 *
	 * @example
	 * ```ts
	 * const biome = yield* discovery.resolve(Tool.named("biome"));
	 * yield* Run.text(biome.command("check", "."));
	 * ```
	 */
	command(...args: ReadonlyArray<string>): ChildProcess.Command {
		const bare = ChildProcess.make(this.name, args);
		return this.source === "local" && this.context !== undefined ? this.context.apply(bare) : bare;
	}
}

/**
 * A tool could not be found where it was required.
 *
 * @public
 */
export class ToolNotFoundError extends S.TaggedError<ToolNotFoundError>()("ToolNotFoundError", {
	/** The tool that was looked for. */
	tool: S.String,
	/** The locations its `source` requirement demanded. */
	searched: S.Array(ResolvedSource),
}) {
	override get message(): string {
		return `Tool not found: ${this.tool} (required ${this.searched.join(" and ")})`;
	}
}

/**
 * The global and project-local copies disagree, and the tool's policy is
 * `"fail"`.
 *
 * @public
 */
export class ToolVersionMismatchError extends S.TaggedError<ToolVersionMismatchError>()(
	"ToolVersionMismatchError",
	{
		/** The tool. */
		tool: S.String,
		/** The global copy's version. */
		globalVersion: S.String,
		/** The project-local copy's version. */
		localVersion: S.String,
	},
) {
	override get message(): string {
		return `Version mismatch for ${this.tool}: global ${this.globalVersion} vs local ${this.localVersion}`;
	}
}

/**
 * A tool name that cannot safely be spawned was refused before any process
 * started.
 *
 * @remarks
 * An empty name, or one beginning with `-`, which the operating system would
 * read as a flag rather than an executable. The refusal happens **pre-spawn**,
 * which is the point: `Tool.named("-rf")` never reaches a shell, and this
 * package never builds a shell command line in the first place.
 *
 * @public
 */
export class ToolRefusedError extends S.TaggedError<ToolRefusedError>()("ToolRefusedError", {
	/** The refused name. */
	tool: S.String,
}) {
	override get message(): string {
		return this.tool === ""
			? "Refused an empty tool name"
			: `Refused the tool name "${this.tool}": a leading "-" would be read as a flag`;
	}
}

/**
 * Every way `ToolDiscovery.resolve` can fail.
 *
 * @public
 */
export type ToolResolutionFailure = ToolNotFoundError | ToolVersionMismatchError | ToolRefusedError | LocalExecError;

/** What one probe learned about one location. */
interface Probe {
	readonly found: boolean;
	readonly version: O.Option<string>;
}

/** What probing learned about a tool. Cached; policy is applied to it per call. */
interface Evidence {
	readonly global: Probe;
	readonly local: Probe;
	readonly context: O.Option<ExecContext>;
}

/**
 * The cache key: everything the probe outcome depends on, and nothing else.
 *
 * @remarks
 * A `Schema.Class` rather than a string because the cache's `MutableHashMap`
 * keys on `Equal`/`Hash`, which schema classes implement structurally — so the
 * key can carry the probe itself instead of an encoded rendering of it, and the
 * lookup needs no side table. Policy fields are deliberately absent: they are
 * applied to the evidence per call.
 */
class EvidenceKey extends S.Class<EvidenceKey>("EvidenceKey")({
	name: S.String,
	probe: VersionProbe,
}) {}

/** argv for a version probe: the flag string split on whitespace. */
const probeArgs = (probe: VersionProbe): ReadonlyArray<string> =>
	probe._tag === "VersionNone" ? ["--version"] : probe.flag.split(/\s+/).filter((part) => part.length > 0);

/** Reads a version out of one probe's captured stdout. */
const extractVersion = (probe: VersionProbe, stdout: string): O.Option<string> => {
	if (probe._tag === "VersionNone") return O.none();
	if (probe._tag === "VersionFlag") {
		const pattern = probe.pattern === undefined ? DEFAULT_VERSION_PATTERN : new RegExp(probe.pattern);
		const match = pattern.exec(stdout);
		// Group 1 when the pattern captures, else the whole match.
		return O.fromUndefinedOr(match?.[1] ?? match?.[0]);
	}
	try {
		let current: unknown = JSON.parse(stdout);
		for (const key of probe.path.split(".")) {
			if (current === null || typeof current !== "object" || !P.hasProperty(current, key)) return O.none();
			current = current[key];
		}
		return typeof current === "string" ? O.some(current) : O.none();
	} catch {
		return O.none();
	}
};

/**
 * Runs one location's probe.
 *
 * @remarks
 * Presence is decided by whether the process **ran**, never by its exit code:
 * a tool whose `--version` exits non-zero still exists. Absence is a spawn
 * failure, which is why `Run.collect`'s typed failure is the signal here and
 * no shell (`command -v`) is involved, so a tool name is never interpolated
 * into a command line.
 */
const probeLocation = (
	command: ChildProcess.Command,
	probe: VersionProbe,
): Effect.Effect<Probe, never, ChildProcessSpawner.ChildProcessSpawner> =>
	Run.collect(command).pipe(
		Effect.map((output) => ({ found: true, version: extractVersion(probe, output.stdout) })),
		Effect.orElseSucceed(() => ({ found: false, version: O.none<string>() })),
	);

/**
 * The {@link ToolDiscovery} service shape.
 *
 * @public
 */
export interface ToolDiscoveryShape {
	/** Resolve a tool against its source requirement and mismatch policy. */
	readonly resolve: (tool: Tool) => Effect.Effect<ResolvedTool, ToolResolutionFailure>;
	/** Whether a tool resolves. Never fails. */
	readonly isAvailable: (tool: Tool) => Effect.Effect<boolean>;
	/** Forget one tool's probe evidence. */
	readonly invalidate: (tool: Tool) => Effect.Effect<void>;
	/** Forget every tool's probe evidence. */
	readonly invalidateAll: Effect.Effect<void>;
}

/** Builds the service over an already-resolved spawner and local-exec context. */
const make = Effect.fnUntraced(function* () {
	const local = yield* LocalExec;
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

	// Cache the EVIDENCE, not the answer: `source` and `onMismatch` are applied
	// per call, so a second Tool with different constraints gets the right answer
	// without a second probe.
	//
	// The key is (name, version probe) — exactly what the evidence depends on —
	// as a `Schema.Class`, whose structural `Equal`/`Hash` the cache's
	// `MutableHashMap` uses, nested union members included. Two tools differing
	// only in policy share one probe; two differing in how they ask for a
	// version do not — pinned by "the cache stores EVIDENCE, so a second Tool
	// with different constraints is answered correctly".
	//
	// `timeToLive` is not decoration: with a fixed TTL, core `Cache` memoizes a
	// FAILED lookup for the entry's lifetime, so one
	// transient probe failure would mark a tool permanently absent.
	const cache = yield* Cache.makeWith(
		(key: EvidenceKey) =>
			Effect.gen(function* () {
				const context = yield* local.context;
				const args = probeArgs(key.probe);
				const globalProbe = yield* probeLocation(ChildProcess.make(key.name, args), key.probe);
				const localProbe = O.isNone(context)
					? { found: false, version: O.none<string>() }
					: yield* probeLocation(context.value.apply(ChildProcess.make(key.name, args)), key.probe);
				return { global: globalProbe, local: localProbe, context } satisfies Evidence;
			}),
		{
			capacity: CACHE_CAPACITY,
			// Only a POSITIVE result is worth remembering. Two distinct traps sit
			// behind this line, and a naive `isSuccess ? infinity : zero` catches
			// only the first:
			//
			// 1. A failed lookup (the LocalExec mechanism erroring) is memoized for
			//    the entry's whole TTL by default, so a transient failure would
			//    stick for the process lifetime.
			// 2. "Not found" is a SUCCESSFUL lookup carrying negative evidence. Left
			//    memoized, a tool installed mid-process (an action that provisions a
			//    runtime and then uses it) stays absent forever, with nothing to
			//    suggest why — pinned by "ABSENCE is not memoized — a tool installed
			//    mid-process is found".
			//
			// A tool that exists does not stop existing; a tool that does not exist
			// very often starts to.
			timeToLive: (exit) =>
				Exit.isSuccess(exit) && (exit.value.global.found || exit.value.local.found) ? Duration.infinity : Duration.zero,
		},
	).pipe(Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, spawner));

	const evidenceFor = (tool: Tool): Effect.Effect<Evidence, LocalExecError> =>
		Cache.get(cache, EvidenceKey.make({ name: tool.name, probe: tool.version }));

	const resolve = Effect.fn("ToolDiscovery.resolve")(function* (tool: Tool) {
		yield* Effect.annotateCurrentSpan({ tool: tool.name, source: tool.source });
		// Pre-spawn guard: argv position zero is not a place to accept a flag.
		if (tool.name === "" || tool.name.startsWith("-")) {
			return yield* ToolRefusedError.make({ tool: tool.name });
		}

		const evidence = yield* evidenceFor(tool);
		const required: ReadonlyArray<ResolvedSource> =
			tool.source === "any" ? ["global", "local"] : tool.source === "both" ? ["global", "local"] : [tool.source];

		const satisfied =
			tool.source === "any"
				? evidence.global.found || evidence.local.found
				: tool.source === "both"
					? evidence.global.found && evidence.local.found
					: tool.source === "global"
						? evidence.global.found
						: evidence.local.found;

		if (!satisfied) {
			return yield* ToolNotFoundError.make({ tool: tool.name, searched: required });
		}

		const bothFound = evidence.global.found && evidence.local.found;
		const mismatch =
			bothFound &&
			O.isSome(evidence.global.version) &&
			O.isSome(evidence.local.version) &&
			evidence.global.version.value !== evidence.local.version.value;

		if (mismatch && tool.onMismatch === "fail") {
			return yield* ToolVersionMismatchError.make({
					tool: tool.name,
					globalVersion: O.getOrElse(evidence.global.version, () => ""),
					localVersion: O.getOrElse(evidence.local.version, () => ""),
				});
		}

		// Which copy to run: an explicit source requirement decides; otherwise the
		// mismatch policy decides when both exist; otherwise whichever exists,
		// preferring local.
		const selected: ResolvedSource =
			tool.source === "global"
				? "global"
				: tool.source === "local"
					? "local"
					: mismatch && tool.onMismatch === "preferGlobal"
						? "global"
						: evidence.local.found
							? "local"
							: "global";

		const context = selected === "local" ? O.getOrUndefined(evidence.context) : undefined;
		return ResolvedTool.make({
			name: tool.name,
			source: selected,
			version: selected === "local" ? evidence.local.version : evidence.global.version,
			globalVersion: evidence.global.version,
			localVersion: evidence.local.version,
			mismatch,
			...(context === undefined ? {} : { context }),
		});
	});

	const isAvailable = Effect.fn("ToolDiscovery.isAvailable")(function* (tool: Tool) {
		return yield* resolve(tool).pipe(
			Effect.map(() => true),
			Effect.orElseSucceed(() => false),
		);
	});

	return {
		resolve,
		isAvailable,
		invalidate: (tool: Tool) => Cache.invalidate(cache, EvidenceKey.make({ name: tool.name, probe: tool.version })),
		invalidateAll: Cache.invalidateAll(cache),
	} satisfies ToolDiscoveryShape;
});

/** The default for an unstubbed {@link ToolDiscovery.makeTest} member. */
const notStubbed = (method: string) => () =>
	Effect.die(
		new Error(
			`ToolDiscovery.makeTest: ${method}() was called but not stubbed — no honest default exists for a test double; pass a \`${method}\` override.`,
		),
	);

/**
 * Resolves CLI tools: globally on `PATH`, or project-locally through the
 * launcher {@link LocalExec} describes.
 *
 * @remarks
 * Presence is proven by **running** the tool, never by a shell `command -v` and
 * never by a filesystem scan: a spawn that completes proves existence whatever
 * the exit code, and a spawn failure proves absence. That is one probe per
 * location, it needs no shell (so a tool name is never interpolated into a
 * command line), and it behaves the same on Windows.
 *
 * Discovery caches what probing learned (presence and versions), not the
 * answer: each call applies its own `Tool.source` and `Tool.onMismatch` to the
 * cached evidence. Only a tool that was found is remembered, so one installed
 * mid-process is picked up on the next call; call `invalidate` to force a
 * re-probe of a tool that changed.
 *
 * @example
 * ```ts
 * import { LocalExec, Run, Tool, ToolDiscovery } from "./index.ts";
 * import { NodeServices } from "@effect/platform-node";
 * import { Effect, Layer } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const discovery = yield* ToolDiscovery;
 *   if (yield* discovery.isAvailable(Tool.named("git"))) {
 *     const git = yield* discovery.resolve(Tool.named("git"));
 *     return yield* Run.text(git.command("--version"));
 *   }
 *   return "no git";
 * });
 *
 * const AppLayer = ToolDiscovery.layer.pipe(
 *   Layer.provide(LocalExec.layerNone),
 *   Layer.provide(NodeServices.layer),
 * );
 *
 * Effect.runPromise(program.pipe(Effect.provide(AppLayer)));
 * ```
 *
 * @public
 */
export class ToolDiscovery extends Context.Service<ToolDiscovery, ToolDiscoveryShape>()(
	"@beep/scratchpad/effected/commands/ToolDiscovery",
) {
	/** Resolves its dependencies once at construction, so every method's `R` is `never`. */
	static readonly layer: Layer.Layer<ToolDiscovery, never, ChildProcessSpawner.ChildProcessSpawner | LocalExec> =
		Layer.effect(this, make());

	/**
	 * An in-memory test double: stub only what the test exercises; every other
	 * member dies with a defect naming itself.
	 *
	 * @remarks
	 * No member has an honest default — a fabricated `ResolvedTool` would leak
	 * into consumer logic as fact — so an unstubbed call fails loudly rather
	 * than lying.
	 */
	static readonly makeTest = (overrides: Partial<ToolDiscoveryShape> = {}): ToolDiscoveryShape => ({
		resolve: notStubbed("resolve"),
		isAvailable: notStubbed("isAvailable"),
		invalidate: notStubbed("invalidate"),
		invalidateAll: Effect.die(
			new Error("ToolDiscovery.makeTest: invalidateAll was used but not stubbed — pass an `invalidateAll` override."),
		),
		...overrides,
	});

	/**
	 * {@link ToolDiscovery.makeTest} behind `Layer.succeed`.
	 *
	 * @remarks
	 * A parameterized layer factory mints a fresh reference per call and layers
	 * memoize by reference — bind the result to a `const` rather than calling it
	 * at each composition site.
	 */
	static readonly layerTest = (overrides: Partial<ToolDiscoveryShape> = {}): Layer.Layer<ToolDiscovery> =>
		Layer.succeed(ToolDiscovery, ToolDiscovery.makeTest(overrides));
}
