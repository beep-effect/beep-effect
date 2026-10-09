import { LiteralKit } from "@beep/schema/LiteralKit";
import { $ScratchpadId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Str from "effect/String";
import * as Cache from "effect/Cache";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as O from "@beep/utils/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import { ExecContext, LocalExec, LocalExecError } from "./LocalExec.ts";
import { Run } from "./Run.ts";
import type { Tool } from "./Tool.ts";
import { VersionProbe } from "./Tool.ts";

const $I = $ScratchpadId.create("effected/commands/ToolDiscovery");

/** An unstubbed test-double member was exercised. */
class ToolDiscoveryUnstubbedError extends S.TaggedError<ToolDiscoveryUnstubbedError>($I`ToolDiscoveryUnstubbedError`)(
	"ToolDiscoveryUnstubbedError",
	{ message: S.String },
	$I.annote("ToolDiscoveryUnstubbedError", { description: "An unstubbed tool-discovery test-double member was exercised." }),
) {}

/** How many tools' probe evidence to remember. */
const CACHE_CAPACITY = 256;

/** First version-shaped token: `1.2.3`, `v22.1.0`, `2.3.1-beta.4`. */
const DEFAULT_VERSION_PATTERN = /(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)/;

/**
 * Where a tool was resolved from.
 *
 * **Example** (Recognize a local resolution)
 *
 * ```ts
 * import { ResolvedSource } from "@beep/scratchpad/effected/commands/ToolDiscovery";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ResolvedSource)("local")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ResolvedSource = LiteralKit(["global", "local"]).pipe($I.annoteSchema("ResolvedSource", { description: "Where a tool was resolved from." }));

/**
 * The decoded type of {@link (ResolvedSource:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ResolvedSource = typeof ResolvedSource.Type;

/**
 * A tool that was found, with everything discovery learned about it.
 *
 * **Example** (Construct a global tool result)
 *
 * ```ts
 * import { ResolvedTool } from "@beep/scratchpad/effected/commands/ToolDiscovery";
 * import * as O from "effect/Option";
 *
 * const tool = ResolvedTool.make({
 *   name: "biome", source: "global", version: O.none(),
 *   globalVersion: O.none(), localVersion: O.none(), mismatch: false,
 * });
 * console.log(tool.name) // biome
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ResolvedTool extends S.Class<ResolvedTool>($I`ResolvedTool`)({
	/** The executable name. */
	name: S.String.annotateKey({ description: "The executable name." }),
	/** Which copy this resolution selected. */
	source: ResolvedSource.annotateKey({ description: "Which copy this resolution selected." }),
	/** The selected copy's version, when one could be read. */
	version: S.Option(S.String).annotateKey({ description: "The selected copy's version, when one could be read." }),
	/** The global copy's version, when it exists and reports one. */
	globalVersion: S.Option(S.String).annotateKey({ description: "The global copy's version, when it exists and reports one." }),
	/** The project-local copy's version, when it exists and reports one. */
	localVersion: S.Option(S.String).annotateKey({ description: "The project-local copy's version, when it exists and reports one." }),
	/** Whether the two copies reported different versions. */
	mismatch: S.Boolean.annotateKey({ description: "Whether the two copies reported different versions." }),
	/** The project-local execution context, when {@link ResolvedTool.source} is `"local"`. */
	context: S.optionalKey(ExecContext).annotateKey({ description: "The project-local execution context, when ResolvedTool.source is `\"local\"`." }),
}, $I.annote("ResolvedTool", { description: "A tool that was found, with everything discovery learned about it." })) {
	/**
	 * A core `Command` that runs this tool — bare for a global resolution,
	 * launcher-prefixed and directory-scoped for a local one.
	 *
	 * **Details**
	 *
	 * Returns core's own `ChildProcess.Command`, not a wrapper: hand it to
	 * {@link Run} or to core's spawner directly, and compose it with core's
	 * combinators.
	 *
	 * **Example** (Run a Biome check with a resolved tool)
	 *
	 * ```ts
	 * import { ToolDiscovery } from "@beep/scratchpad/effected/commands/ToolDiscovery";
	 * import { Tool } from "@beep/scratchpad/effected/commands/Tool";
	 * import { Run } from "@beep/scratchpad/effected/commands/Run";
	 * import * as Effect from "effect/Effect";
	 *
	 * const program = Effect.gen(function* () {
	 *   const discovery = yield* ToolDiscovery;
	 *   const biome = yield* discovery.resolve(Tool.named("biome"));
	 *   return yield* Run.text(biome.command("check", "."));
	 * });
	 * console.log(Effect.isEffect(program)) // true
	 * ```
	 *
	 * @category commands
	 * @since 0.0.0
	 */
	command(...args: ReadonlyArray<string>): ChildProcess.Command {
		const bare = ChildProcess.make(this.name, args);
		return this.source === "local" && this.context !== undefined ? this.context.apply(bare) : bare;
	}
}

/**
 * A tool could not be found where it was required.
 *
 * **Example** (Inspect ToolNotFoundError diagnostics)
 *
 * ```ts
 * import { ToolNotFoundError } from "@beep/scratchpad/effected/commands/ToolDiscovery";
 *
 * const error = ToolNotFoundError.make({ tool: "biome", searched: ["global", "local"] });
 * console.log(error.message) // Tool not found: biome (required global and local)
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ToolNotFoundError extends S.TaggedError<ToolNotFoundError>($I`ToolNotFoundError`)("ToolNotFoundError", {
	/** The tool that was looked for. */
	tool: S.String.annotateKey({ description: "The tool that was looked for." }),
	/** The locations its `source` requirement demanded. */
	searched: S.Array(ResolvedSource).annotateKey({ description: "The locations its `source` requirement demanded." }),
}, $I.annote("ToolNotFoundError", { description: "A tool could not be found where it was required." })) {
	/**
	 * Describes the required locations where the tool was absent.
	 *
	 * **Example** (Read the ToolNotFoundError message)
	 *
	 * ```ts
	 * import { ToolNotFoundError } from "@beep/scratchpad/effected/commands/ToolDiscovery";
	 *
	 * const error = ToolNotFoundError.make({ tool: "biome", searched: ["global", "local"] });
	 * console.log(error.message) // Tool not found: biome (required global and local)
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return `Tool not found: ${this.tool} (required ${this.searched.join(" and ")})`;
	}
}

/**
 * The global and project-local copies disagree, and the tool's policy is
 * `"fail"`.
 *
 * **Example** (Inspect ToolVersionMismatchError diagnostics)
 *
 * ```ts
 * import { ToolVersionMismatchError } from "@beep/scratchpad/effected/commands/ToolDiscovery";
 *
 * const error = ToolVersionMismatchError.make({ tool: "biome", globalVersion: "1.0.0", localVersion: "2.0.0" });
 * console.log(error.message) // Version mismatch for biome: global 1.0.0 vs local 2.0.0
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ToolVersionMismatchError extends S.TaggedError<ToolVersionMismatchError>($I`ToolVersionMismatchError`)(
	"ToolVersionMismatchError",
	{
		/** The tool. */
		tool: S.String.annotateKey({ description: "The tool." }),
		/** The global copy's version. */
		globalVersion: S.String.annotateKey({ description: "The global copy's version." }),
		/** The project-local copy's version. */
		localVersion: S.String.annotateKey({ description: "The project-local copy's version." }),
	}, $I.annote("ToolVersionMismatchError", { description: "The global and project-local copies disagree, and the tool's policy is `\"fail\"`." }),
) {
	/**
	 * Describes the conflicting global and project-local versions.
	 *
	 * **Example** (Read the ToolVersionMismatchError message)
	 *
	 * ```ts
	 * import { ToolVersionMismatchError } from "@beep/scratchpad/effected/commands/ToolDiscovery";
	 *
	 * const error = ToolVersionMismatchError.make({ tool: "biome", globalVersion: "1.0.0", localVersion: "2.0.0" });
	 * console.log(error.message) // Version mismatch for biome: global 1.0.0 vs local 2.0.0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return `Version mismatch for ${this.tool}: global ${this.globalVersion} vs local ${this.localVersion}`;
	}
}

/**
 * A tool name that cannot safely be spawned was refused before any process
 * started.
 *
 * **Details**
 *
 * An empty name, or one beginning with `-`, which the operating system would
 * read as a flag rather than an executable. The refusal happens **pre-spawn**,
 * which is the point: `Tool.named("-rf")` never reaches a shell, and this
 * package never builds a shell command line in the first place.
 *
 * **Example** (Inspect ToolRefusedError diagnostics)
 *
 * ```ts
 * import { ToolRefusedError } from "@beep/scratchpad/effected/commands/ToolDiscovery";
 *
 * const error = ToolRefusedError.make({ tool: "" });
 * console.log(error.message) // Refused an empty tool name
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class ToolRefusedError extends S.TaggedError<ToolRefusedError>($I`ToolRefusedError`)("ToolRefusedError", {
	/** The refused name. */
	tool: S.String.annotateKey({ description: "The refused name." }),
}, $I.annote("ToolRefusedError", { description: "A tool name that cannot safely be spawned was refused before any process started." })) {
	/**
	 * Describes why the tool name was refused before spawning.
	 *
	 * **Example** (Read the ToolRefusedError message)
	 *
	 * ```ts
	 * import { ToolRefusedError } from "@beep/scratchpad/effected/commands/ToolDiscovery";
	 *
	 * const error = ToolRefusedError.make({ tool: "" });
	 * console.log(error.message) // Refused an empty tool name
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return this.tool === ""
			? "Refused an empty tool name"
			: `Refused the tool name "${this.tool}": a leading "-" would be read as a flag`;
	}
}

/**
 * Every way `ToolDiscovery.resolve` can fail.
 *
 * **Example** (Recognize a refused-tool failure)
 *
 * ```ts
 * import { ToolResolutionFailure, ToolRefusedError } from "@beep/scratchpad/effected/commands/ToolDiscovery";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ToolResolutionFailure)(ToolRefusedError.make({ tool: "" }))) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ToolResolutionFailure = S.Union([ToolNotFoundError, ToolVersionMismatchError, ToolRefusedError, LocalExecError]).pipe(
 $I.annoteSchema("ToolResolutionFailure", { description: "Every typed failure of tool resolution." }),
);
/**
 * The decoded union of typed tool-resolution failures.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ToolResolutionFailure = typeof ToolResolutionFailure.Type;

/** What one probe learned about one location; retains its plain-object representation. */
const Probe = S.Struct({
 found: S.Boolean.annotateKey({ description: "Whether the executable ran." }),
 version: S.Option(S.String).annotateKey({ description: "The extracted version, if available." }),
}).pipe($I.annoteSchema("Probe", { description: "Discovery evidence for one location." }));
type Probe = typeof Probe.Type;

/** Cached evidence before each call applies its own resolution policy. */
const Evidence = S.Struct({
 global: Probe.annotateKey({ description: "Global probe evidence." }),
 local: Probe.annotateKey({ description: "Project-local probe evidence." }),
 context: S.Option(ExecContext).annotateKey({ description: "The local launcher context, if available." }),
}).pipe($I.annoteSchema("Evidence", { description: "Cached discovery evidence independent of policy." }));
type Evidence = typeof Evidence.Type;

/**
 * The cache key: everything the probe outcome depends on, and nothing else.
 *
 * **Details**
 *
 * A `Schema.Class` rather than a string because the cache's `MutableHashMap`
 * keys on `Equal`/`Hash`, which schema classes implement structurally — so the
 * key can carry the probe itself instead of an encoded rendering of it, and the
 * lookup needs no side table. Policy fields are deliberately absent: they are
 * applied to the evidence per call.
 */
class EvidenceKey extends S.Class<EvidenceKey>($I`EvidenceKey`)({
	name: S.String.annotateKey({ description: "The executable being probed globally and project-locally, used to identify cached discovery evidence" }),
	probe: VersionProbe.annotateKey({ description: "How the tool is asked for its version and how its output is interpreted, distinguishing cached discovery evidence" }),
}, $I.annote("EvidenceKey", { description: "The cache key: everything the probe outcome depends on, and nothing else." })) {}

/** argv for a version probe: the flag string split on whitespace. */
const probeArgs = (probe: VersionProbe): ReadonlyArray<string> =>
	probe._tag === "VersionNone" ? ["--version"] : probe.flag.split(/\s+/).filter((part) => part.length > 0);

/** Non-throwing JSON boundary over unknown input. */
const UnknownJson = S.fromJsonString(S.Unknown);
const decodeJson = (stdout: unknown) => S.decodeUnknownOption(UnknownJson)(stdout);

/** Reads a version out of one probe's captured stdout. */
const extractVersion = (probe: VersionProbe, stdout: string): O.Option<string> => {
	if (probe._tag === "VersionNone") return O.none();
	if (probe._tag === "VersionFlag") {
		const pattern = probe.pattern === undefined ? DEFAULT_VERSION_PATTERN : new RegExp(probe.pattern);
		const match = pattern.exec(stdout);
		// Group 1 when the pattern captures, else the whole match.
		return O.fromUndefinedOr(match?.[1] ?? match?.[0]);
	}
 return A.reduce(
  Str.split(probe.path, "."),
  decodeJson(stdout),
  (current, key) => O.flatMap(current, (value) =>
   P.isObjectKeyword(value) && !P.isFunction(value) && P.hasProperty(value, key)
    ? O.some(value[key]) : O.none()),
 ).pipe(O.filter(P.isString));
};

/**
 * Runs one location's probe.
 *
 * **Details**
 *
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
 * @category type-level
 * @since 0.0.0
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
		Effect.fnUntraced(function* (key: EvidenceKey) {
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
					globalVersion: O.getOrThrow(evidence.global.version),
					localVersion: O.getOrThrow(evidence.local.version),
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
			...O.getSomesStruct({ context: O.fromUndefinedOr(context) }),
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
		ToolDiscoveryUnstubbedError.make({
			message: `ToolDiscovery.makeTest: ${method}() was called but not stubbed — no honest default exists for a test double; pass a \`${method}\` override.`,
		}),
	);

/**
 * Resolves CLI tools: globally on `PATH`, or project-locally through the
 * launcher {@link LocalExec} describes.
 *
 * **Details**
 *
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
 * **Example** (Check Git availability and run its version command)
 *
 * ```ts
 * import { LocalExec } from "@beep/scratchpad/effected/commands/LocalExec";
 * import { Run } from "@beep/scratchpad/effected/commands/Run";
 * import { Tool } from "@beep/scratchpad/effected/commands/Tool";
 * import { ToolDiscovery } from "@beep/scratchpad/effected/commands/ToolDiscovery";
 * import { NodeServices } from "@effect/platform-node";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
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
 * const runnable = program.pipe(Effect.provide(AppLayer));
 * console.log(Effect.isEffect(runnable)) // true
 * ```
 *
 * @public
 * @category services
 * @since 0.0.0
 */
export class ToolDiscovery extends Context.Service<ToolDiscovery, ToolDiscoveryShape>()(
	$I`ToolDiscovery`,
) {
	/**
	 * Resolves its dependencies once at construction, so every method's `R` is `never`.
	 *
	 * **Example** (Inspect the live discovery layer)
	 *
	 * ```ts
	 * import { ToolDiscovery } from "@beep/scratchpad/effected/commands/ToolDiscovery";
	 * import * as Layer from "effect/Layer";
	 *
	 * console.log(Layer.isLayer(ToolDiscovery.layer)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layer: Layer.Layer<ToolDiscovery, never, ChildProcessSpawner.ChildProcessSpawner | LocalExec> =
		Layer.effect(this, make());

	/**
	 * An in-memory test double: stub only what the test exercises; every other
	 * member dies with a defect naming itself.
	 *
	 * **Details**
	 *
	 * No member has an honest default — a fabricated `ResolvedTool` would leak
	 * into consumer logic as fact — so an unstubbed call fails loudly rather
	 * than lying.
	 *
	 * **Example** (Stub an availability check)
	 *
	 * ```ts
	 * import { ToolDiscovery } from "@beep/scratchpad/effected/commands/ToolDiscovery";
	 * import * as Effect from "effect/Effect";
	 * import { Tool } from "@beep/scratchpad/effected/commands/Tool";
	 *
	 * const discovery = ToolDiscovery.makeTest({ isAvailable: () => Effect.succeed(true) });
	 * console.log(Effect.runSync(discovery.isAvailable(Tool.named("biome")))) // true
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	static readonly makeTest = (overrides: Partial<ToolDiscoveryShape> = {}): ToolDiscoveryShape => ({
		resolve: notStubbed("resolve"),
		isAvailable: notStubbed("isAvailable"),
		invalidate: notStubbed("invalidate"),
		invalidateAll: Effect.die(
			ToolDiscoveryUnstubbedError.make({
				message: "ToolDiscovery.makeTest: invalidateAll was used but not stubbed — pass an `invalidateAll` override.",
			}),
		),
		...overrides,
	});

	/**
	 * Provides {@link ToolDiscovery.makeTest} behind `Layer.succeed`.
	 *
	 * **Gotchas**
	 *
	 * A parameterized layer factory mints a fresh reference per call and layers
	 * memoize by reference — bind the result to a `const` rather than calling it
	 * at each composition site.
	 *
	 * **Example** (Provide a shared discovery test layer)
	 *
	 * ```ts
	 * import { ToolDiscovery } from "@beep/scratchpad/effected/commands/ToolDiscovery";
	 * import * as Effect from "effect/Effect";
	 * import { Tool } from "@beep/scratchpad/effected/commands/Tool";
	 *
	 * const testLayer = ToolDiscovery.layerTest({ isAvailable: () => Effect.succeed(true) });
	 * const program = Effect.gen(function* () {
	 *   const discovery = yield* ToolDiscovery;
	 *   return yield* discovery.isAvailable(Tool.named("biome"));
	 * }).pipe(Effect.provide(testLayer));
	 * console.log(Effect.runSync(program)) // true
	 * ```
	 *
	 * @category layers
	 * @since 0.0.0
	 */
	static readonly layerTest = (overrides: Partial<ToolDiscoveryShape> = {}): Layer.Layer<ToolDiscovery> =>
		Layer.succeed(ToolDiscovery, ToolDiscovery.makeTest(overrides));
}
