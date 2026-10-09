import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Result from "effect/Result";

const Json = S.fromJsonString(S.Unknown);

/**
 * Raised when the runner environment does not say what an action needs.
 *
 * @remarks
 * Two reasons, and the distinction is actionable: `missing` means the variable
 * is absent or empty (the workflow did not grant something, or the action is
 * running outside Actions); `malformed` means it is present but unusable (a
 * non-numeric run id, an unparseable event payload). The first is usually a
 * workflow fix, the second usually a bug report.
 *
 * @public
 */
export class ActionEnvironmentError extends S.TaggedError<ActionEnvironmentError>()("ActionEnvironmentError", {
	/** `missing` — absent or empty; `malformed` — present but unusable. */
	reason: S.Literals(["missing", "malformed"]),
	/** The environment variable involved. */
	name: S.String,
	/** What was wrong, when the reason is `malformed`. */
	detail: S.optionalKey(S.String),
}) {
	override get message(): string {
		return this.reason === "missing"
			? `Required environment variable "${this.name}" is not set`
			: `Environment variable "${this.name}" is malformed${this.detail === undefined ? "" : `: ${this.detail}`}`;
	}
}

/**
 * The workflow's GitHub context, projected from the `GITHUB_*` variables.
 *
 * @public
 */
export class GitHubContext extends S.Class<GitHubContext>("GitHubContext")({
	/** `owner/repo`. */
	repository: S.String,
	/** The repository owner's login. */
	repositoryOwner: S.String,
	/** The full ref, e.g. `refs/heads/main`. */
	ref: S.String,
	/** The short ref, e.g. `main`. */
	refName: S.String,
	/**
	 * The source branch of the pull request, when the event has one.
	 *
	 * @remarks
	 * `GITHUB_HEAD_REF` is only set for `pull_request` events — and on every
	 * other event the runner does not merely omit it, it may write the **empty
	 * string**, which a raw `process.env` read happily reports as present. That
	 * trap is encoded in the type: absent and `""` both decode to
	 * `Option.none()`, so a consumer cannot build a cache key segment out of an
	 * empty branch name by accident. For "the branch a human means", use
	 * {@link GitHubContext.branch}, which owns the fallback to `refName`.
	 *
	 * The encoded form is `string | null` rather than a serialized `Option`, so
	 * an encoded context stays plain JSON.
	 */
	headRef: S.OptionFromNullOr(S.String),
	/** The commit SHA that triggered the workflow. */
	sha: S.String,
	/** The workflow's name. */
	workflow: S.String,
	/** The current job's id. */
	job: S.String,
	/** The run's unique number, decoded from `GITHUB_RUN_ID`. */
	runId: S.Finite,
	/** The attempt number of this run, starting at 1. */
	runAttempt: S.Finite,
	/** The name of the event that triggered the workflow, e.g. `push`. */
	eventName: S.String,
	/** The login of the user that triggered the run. */
	actor: S.String,
	/** The GitHub server URL, e.g. `https://github.com`. */
	serverUrl: S.String,
	/** The REST API URL, e.g. `https://api.github.com`. */
	apiUrl: S.String,
	/** The GraphQL API URL. */
	graphqlUrl: S.String,
	/** The default working directory on the runner for steps. */
	workspace: S.String,
}) {
	/**
	 * The branch a human means: `headRef` when present (a pull request, where
	 * `refName` is the useless `123/merge`), otherwise `refName`.
	 *
	 * @remarks
	 * This is the universal branch-scoped-cache-key fallback chain, written
	 * once. On a `push` or any other non-PR event `headRef` is `Option.none()`
	 * — including when the runner wrote it as the empty string — so the answer
	 * is the short ref. Note that on a tag push `refName` names the tag, not a
	 * branch; a consumer that must distinguish still has the full `ref`.
	 */
	get branch(): string {
		return O.getOrElse(this.headRef, () => this.refName);
	}
}

/**
 * The runner's own context, projected from the `RUNNER_*` variables.
 *
 * @public
 */
export class RunnerContext extends S.Class<RunnerContext>("RunnerContext")({
	/** The runner's operating system: `Linux`, `Windows` or `macOS`. */
	os: S.String,
	/** The runner's architecture, e.g. `X64` or `ARM64`. */
	arch: S.String,
	/** The runner's name. */
	name: S.String,
	/** A scratch directory emptied between jobs. */
	temp: S.String,
	/** Where `ToolInstaller` caches toolchains. */
	toolCache: S.String,
}) {}

/**
 * Environment overrides layered on top of the seeded snapshot.
 *
 * @remarks
 * A `Context.Reference` rather than a mutable global: overrides are
 * **fiber-local**, so two concurrent fibers can override the same variable
 * without seeing each other, and nothing needs restoring afterwards. This is
 * what makes {@link ActionEnvironmentShape.withEnv} parallel-safe.
 *
 * @internal
 */
const EnvOverrides = Context.Reference<Readonly<Record<string, string>>>("@effected/github-actions/EnvOverrides", {
	defaultValue: () => ({}),
});

/**
 * The members of the {@link ActionEnvironment} service: variable lookup, the
 * `GITHUB_*` and `RUNNER_*` contexts, the event payload and scoped overrides.
 *
 * @public
 */
export interface ActionEnvironmentShape {
	/** A required variable. Absent or empty fails typed. */
	readonly get: (name: string) => Effect.Effect<string, ActionEnvironmentError>;
	/** An optional variable. Empty reads as absent, as the runner treats it. */
	readonly getOptional: (name: string) => Effect.Effect<O.Option<string>>;
	/** The `GITHUB_*` context. */
	readonly github: Effect.Effect<GitHubContext, ActionEnvironmentError>;
	/** The `RUNNER_*` context. */
	readonly runner: Effect.Effect<RunnerContext, ActionEnvironmentError>;
	/** Whether the runner is in step-debug mode. */
	readonly isDebug: Effect.Effect<boolean>;
	/**
	 * The webhook event payload.
	 *
	 * @remarks
	 * `R` is `never`: the layer resolves `FileSystem` once at construction, so
	 * a caller never re-injects one to keep its own requirements clean.
	 */
	readonly payload: Effect.Effect<unknown, ActionEnvironmentError>;
	/**
	 * Run an effect with environment overrides applied.
	 *
	 * @remarks
	 * Fiber-local and parallel-safe — `process.env` is never mutated, so
	 * concurrent callers cannot corrupt each other and there is nothing to
	 * restore. Overrides **merge** with any enclosing `withEnv`.
	 *
	 * The trade, stated: a variable exported mid-run by
	 * `ActionOutputs.exportVariable` is not observed here, because the snapshot
	 * is taken once. That matches GitHub's own model, where `exportVariable`
	 * targets *subsequent* steps rather than the running one.
	 */
	readonly withEnv: <A, E, R>(
		overrides: Readonly<Record<string, string>>,
		effect: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E, R>;
}

const numeric = (name: string, raw: string): Effect.Effect<number, ActionEnvironmentError> => {
	const parsed = Number(raw);
	return Number.isFinite(parsed)
		? Effect.succeed(parsed)
		: Effect.fail(ActionEnvironmentError.make({ reason: "malformed", name, detail: `expected a number, got "${raw}"` }));
};

const make = (
	base: Readonly<Record<string, string>>,
): Effect.Effect<ActionEnvironmentShape, never, FileSystem.FileSystem> =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;

		const lookup = (name: string): Effect.Effect<O.Option<string>> =>
			Effect.map(EnvOverrides, (overrides) => {
				const value = overrides[name] ?? base[name];
				// The runner sets absent inputs to the empty string; treating "" as
				// present would make every unset optional input look supplied.
				return value === undefined || value === "" ? O.none() : O.some(value);
			});

		const get = (name: string): Effect.Effect<string, ActionEnvironmentError> =>
			Effect.flatMap(lookup(name), (found) =>
				Effect.fromOption(found, () => ActionEnvironmentError.make({ reason: "missing", name })),
			);

		return {
			get,
			getOptional: lookup,
			isDebug: Effect.map(lookup("RUNNER_DEBUG"), (value) => O.isSome(value) && value.value === "1"),

			github: Effect.map(
				Effect.all({
					repository: get("GITHUB_REPOSITORY"),
					repositoryOwner: get("GITHUB_REPOSITORY_OWNER"),
					ref: get("GITHUB_REF"),
					refName: get("GITHUB_REF_NAME"),
					// GITHUB_HEAD_REF is absent outside pull requests — and the runner may
					// write it as the empty string, which `lookup` already reads as absent.
					headRef: lookup("GITHUB_HEAD_REF"),
					sha: get("GITHUB_SHA"),
					workflow: get("GITHUB_WORKFLOW"),
					job: get("GITHUB_JOB"),
					runId: Effect.flatMap(get("GITHUB_RUN_ID"), (raw) => numeric("GITHUB_RUN_ID", raw)),
					runAttempt: Effect.flatMap(get("GITHUB_RUN_ATTEMPT"), (raw) => numeric("GITHUB_RUN_ATTEMPT", raw)),
					eventName: get("GITHUB_EVENT_NAME"),
					actor: get("GITHUB_ACTOR"),
					serverUrl: get("GITHUB_SERVER_URL"),
					apiUrl: get("GITHUB_API_URL"),
					graphqlUrl: get("GITHUB_GRAPHQL_URL"),
					workspace: get("GITHUB_WORKSPACE"),
				}),
				(fields) => GitHubContext.make(fields),
			),

			runner: Effect.map(
				Effect.all({
					os: get("RUNNER_OS"),
					arch: get("RUNNER_ARCH"),
					name: get("RUNNER_NAME"),
					temp: get("RUNNER_TEMP"),
					toolCache: get("RUNNER_TOOL_CACHE"),
				}),
				(fields) => RunnerContext.make(fields),
			),

			payload: Effect.gen(function* () {
				const path = yield* get("GITHUB_EVENT_PATH");
				const raw = yield* fs.readFileString(path).pipe(
					Effect.mapError(
						(cause) =>
							ActionEnvironmentError.make({
								reason: "malformed",
								name: "GITHUB_EVENT_PATH",
								detail: `could not read "${path}": ${String(cause)}`,
							}),
					),
				);
				return yield* Effect.try({
					try: () => Result.getOrThrowWith(S.decodeResult(Json)(raw), (error) => error) as unknown,
					catch: (cause) =>
						ActionEnvironmentError.make({
							reason: "malformed",
							name: "GITHUB_EVENT_PATH",
							detail: `not valid JSON: ${String(cause)}`,
						}),
				});
			}),

			withEnv: (overrides, effect) =>
				Effect.flatMap(EnvOverrides, (current) =>
					Effect.provideService(effect, EnvOverrides, { ...current, ...overrides }),
				),
		} satisfies ActionEnvironmentShape;
	});

/** The `GITHUB_*` / `RUNNER_*` block a test double seeds so suites do not restate it. */
const TEST_DEFAULTS: Readonly<Record<string, string>> = {
	GITHUB_REPOSITORY: "acme/example",
	GITHUB_REPOSITORY_OWNER: "acme",
	GITHUB_REF: "refs/heads/main",
	GITHUB_REF_NAME: "main",
	GITHUB_SHA: "0000000000000000000000000000000000000000",
	GITHUB_WORKFLOW: "test",
	GITHUB_JOB: "test",
	GITHUB_RUN_ID: "1",
	GITHUB_RUN_ATTEMPT: "1",
	GITHUB_EVENT_NAME: "push",
	GITHUB_ACTOR: "tester",
	GITHUB_SERVER_URL: "https://github.com",
	GITHUB_API_URL: "https://api.github.com",
	GITHUB_GRAPHQL_URL: "https://api.github.com/graphql",
	GITHUB_WORKSPACE: "/workspace",
	RUNNER_OS: "Linux",
	RUNNER_ARCH: "X64",
	RUNNER_NAME: "test-runner",
	RUNNER_TEMP: "/tmp",
	RUNNER_TOOL_CACHE: "/opt/hostedtoolcache",
};

/**
 * The runner environment an action is executing inside.
 *
 * @remarks
 * The single reader of `process.env` in this package. Everything else — inputs,
 * outputs, state, the token bridge — goes through a service rather than
 * reaching for a global, which is what makes them all testable without
 * mutating the test process.
 *
 * @example
 * ```ts
 * import { ActionEnvironment } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const env = yield* ActionEnvironment;
 *   const { repository, runId } = yield* env.github;
 *   return `${repository}#${runId}`;
 * });
 * ```
 *
 * @public
 */
export class ActionEnvironment extends Context.Service<ActionEnvironment, ActionEnvironmentShape>()(
	"@beep/scratchpad/effected/github-actions/ActionEnvironment",
) {
	/** Seeded from `process.env`, once, at layer construction. */
	static readonly layer: Layer.Layer<ActionEnvironment, never, FileSystem.FileSystem> = Layer.effect(
		this,
		Effect.flatMap(
			Effect.sync(() => ({ ...process.env }) as Readonly<Record<string, string>>),
			make,
		),
	);

	/**
	 * Seeded from an explicit record.
	 *
	 * @remarks
	 * A parameterized layer factory mints a fresh reference per call and layers
	 * memoize by reference — bind it to a `const` rather than calling it at each
	 * composition site.
	 */
	static readonly layerFrom = (
		env: Readonly<Record<string, string>>,
	): Layer.Layer<ActionEnvironment, never, FileSystem.FileSystem> => Layer.effect(ActionEnvironment, make(env));

	/**
	 * A test double seeded with a complete `GITHUB_*` / `RUNNER_*` block.
	 *
	 * @remarks
	 * **A recorded exception to the die-on-unstubbed rule.** Every other service
	 * in this package dies when a suite calls something it did not stub, because
	 * a plausible default hides a real gap. Here the opposite is true: the context
	 * variables have one obviously-correct shape, and requiring each suite to
	 * restate them would duplicate a byte-identical block in every suite.
	 * Overrides merge on top.
	 *
	 * The optional second argument serves {@link ActionEnvironmentShape.payload}
	 * **directly**, replacing the `GITHUB_EVENT_PATH` read rather than seeding a
	 * path and a file behind it. That is the only route to a payload through the
	 * standard double: `TEST_DEFAULTS` deliberately omits `GITHUB_EVENT_PATH`, so
	 * an unserved payload fails typed and names the variable — the die-on-
	 * unstubbed posture the rest of this package keeps.
	 *
	 * `undefined` means *not served*, so a suite cannot arrange `undefined` as
	 * the payload itself. A webhook payload is always a JSON object; the case
	 * does not arise, and reserving the sentinel keeps the argument optional.
	 *
	 * When a suite wants the **real read path** rather than a served value —
	 * exercising the actual `GITHUB_EVENT_PATH` read-and-parse — this member is
	 * the seam: it leaves `FileSystem` in `R` precisely so the suite chooses
	 * the filesystem. Compose it with `@effected/memfs`'s seeded in-memory
	 * volume rather than a hand-rolled stub: the volume honors the whole
	 * `FileSystem` contract, and an unseeded path fails typed `NotFound`
	 * instead of whatever a hand stub happens to answer.
	 *
	 * @example
	 * ```ts
	 * import { ActionEnvironment } from "./index.ts";
	 * import { MemoryFileSystem } from "../memfs/index.ts";
	 * import { Layer } from "effect";
	 *
	 * const layer = Layer.effect(
	 *   ActionEnvironment,
	 *   ActionEnvironment.makeTest({ GITHUB_EVENT_PATH: "/event.json" }),
	 * ).pipe(Layer.provide(MemoryFileSystem.layerWith({ "/event.json": JSON.stringify({ action: "opened" }) })));
	 * ```
	 */
	static readonly makeTest = (
		overrides: Readonly<Record<string, string>> = {},
		payload?: unknown,
	): Effect.Effect<ActionEnvironmentShape, never, FileSystem.FileSystem> =>
		Effect.map(make({ ...TEST_DEFAULTS, ...overrides }), (shape) =>
			payload === undefined ? shape : { ...shape, payload: Effect.succeed(payload) },
		);

	/**
	 * {@link ActionEnvironment.makeTest} behind a layer, with `FileSystem` stubbed
	 * out.
	 *
	 * @remarks
	 * The stub is why the payload has to be served here rather than through the
	 * filesystem: `make` captures the filesystem at construction, so seeding
	 * `GITHUB_EVENT_PATH` through `overrides` would send the read to a noop
	 * filesystem and fail. Pass the payload as the second argument instead —
	 * or, for a suite that wants the real read path over a full filesystem,
	 * compose {@link ActionEnvironment.makeTest} with `@effected/memfs`'s
	 * seeded volume; the recipe is on that member.
	 *
	 * @example
	 * ```ts
	 * import { ActionEnvironment } from "./index.ts";
	 *
	 * const layer = ActionEnvironment.layerTest(
	 *   { GITHUB_EVENT_NAME: "pull_request" },
	 *   { pull_request: { number: 42 } },
	 * );
	 * ```
	 */
	static readonly layerTest = (
		overrides: Readonly<Record<string, string>> = {},
		payload?: unknown,
	): Layer.Layer<ActionEnvironment> =>
		Layer.effect(ActionEnvironment, ActionEnvironment.makeTest(overrides, payload)).pipe(
			Layer.provide(FileSystem.layerNoop({})),
		);
}
