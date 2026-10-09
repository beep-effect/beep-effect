import { $ScratchpadId } from "@beep/identity/packages";
import { CommandNeutralizer, WorkflowCommand } from "../github-commands/index.ts";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { heredocBlock, isUsableName } from "./internal/runnerFile.ts";
import { unstubbed } from "./internal/unstubbed.ts";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/github-actions/ActionOutputs");

/**
 * Raised when an action cannot publish an output.
 *
 * @public
 */
export class RunnerFileUnavailableError extends S.TaggedError<RunnerFileUnavailableError>($I`RunnerFileUnavailableError`)(
	"RunnerFileUnavailableError",
	{
		/** The runner file involved, by environment variable name. */
		file: S.String.annotateKey({ description: "The runner file involved, by environment variable name." }),
		/** The underlying failure, preserved structurally. */
		cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
	}, $I.annote("RunnerFileUnavailableError", { description: "Raised when an action cannot publish an output." }),
) {
	override get message(): string {
		return `Runner file "${this.file}" is not available; is this running on a GitHub runner?`;
	}
}

/**
 * Raised when a runner file exists but could not be appended to.
 *
 * @public
 */
export class RunnerFileWriteError extends S.TaggedError<RunnerFileWriteError>($I`RunnerFileWriteError`)("RunnerFileWriteError", {
	/** The runner file involved, by environment variable name. */
	file: S.String.annotateKey({ description: "The runner file involved, by environment variable name." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("RunnerFileWriteError", { description: "Raised when a runner file exists but could not be appended to." })) {
	override get message(): string {
		return `Failed to write to runner file "${this.file}"`;
	}
}

/**
 * Raised when a name would corrupt the runner file's block structure.
 *
 * @public
 */
export class InvalidOutputNameError extends S.TaggedError<InvalidOutputNameError>($I`InvalidOutputNameError`)("InvalidOutputNameError", {
	/** The offending name. */
	name: S.String.annotateKey({ description: "The offending name." }),
	/** The runner file involved, by environment variable name. */
	file: S.optionalKey(S.String).annotateKey({ description: "The runner file involved, by environment variable name." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("InvalidOutputNameError", { description: "Raised when a name would corrupt the runner file's block structure." })) {
	override get message(): string {
		return `"${this.name}" is not a usable output name`;
	}
}

/**
 * Raised when a value did not satisfy its schema.
 *
 * @public
 */
export class OutputEncodeError extends S.TaggedError<OutputEncodeError>($I`OutputEncodeError`)("OutputEncodeError", {
	/** The output or variable name whose value would not encode. */
	name: S.String.annotateKey({ description: "The output or variable name whose value would not encode." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("OutputEncodeError", { description: "Raised when a value did not satisfy its schema." })) {
	override get message(): string {
		return `Failed to encode the value for "${this.name}"`;
	}
}

/**
 * Raised when an output member was called under
 * {@link ActionOutputs.layerDetached}.
 *
 * @public
 */
export class DetachedOutputError extends S.TaggedError<DetachedOutputError>($I`DetachedOutputError`)("DetachedOutputError", {
	/** The runner file involved, by environment variable name. */
	file: S.String.annotateKey({ description: "The runner file involved, by environment variable name." }),
	/** The output or variable name, when one is involved. */
	name: S.optionalKey(S.String).annotateKey({ description: "The output or variable name, when one is involved." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("DetachedOutputError", { description: "Raised when an output member was called under ActionOutputs.layerDetached." })) {
	override get message(): string {
		return `Runner file "${this.file}" cannot be reached from a detached worker — it configures the parent job's later steps, and a worker has none and may outlive the job. Publish this from the parent process instead.`;
	}
}

/**
 * Anything that can go wrong publishing an output, variable or summary.
 *
 * @remarks
 * **One class per failure, rather than one class with a `reason` field.** The
 * runner file is required on the members that name one and the output name on
 * the members that name one, so a value short a field is a compile error rather
 * than a message reading `"undefined"`.
 *
 * @public
 */
export type ActionOutputError =
	| RunnerFileUnavailableError
	| RunnerFileWriteError
	| InvalidOutputNameError
	| OutputEncodeError
	| DetachedOutputError;

/**
 * The runner file each member appends to — spelled once, so the real layer,
 * the detached layer and the recording double cannot disagree about which
 * file a member's failure names.
 */
const RUNNER_FILE = {
	set: "GITHUB_OUTPUT",
	setJson: "GITHUB_OUTPUT",
	exportVariable: "GITHUB_ENV",
	summary: "GITHUB_STEP_SUMMARY",
	addPath: "GITHUB_PATH",
} as const;

/**
 * Run `effect` only if `name` can head a heredoc block; otherwise fail typed,
 * naming the file. The one name check every construction of the service
 * applies before a named write.
 */
const withUsableName = <A, E, R>(
	file: string,
	name: string,
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E | InvalidOutputNameError, R> =>
	isUsableName(name) ? effect : Effect.fail(InvalidOutputNameError.make({ file, name }));

/**
 * The JSON text `setJson` publishes for `value`: encoded through `schema`,
 * then stringified. The one step of `setJson` that can fail, shared by the
 * real layer and both test doubles so that none of them can skip it.
 */
const encodeJson = <A, I>(
	name: string,
	value: A,
	schema: S.Codec<A, I>,
): Effect.Effect<string, OutputEncodeError> =>
	S.encodeUnknownEffect(S.fromJsonString(schema))(value).pipe(
		Effect.mapError((cause) => OutputEncodeError.make({ name, cause })),
	);

/**
 * One call an {@link ActionOutputs.recording} double observed.
 *
 * @remarks
 * `value` is always the string the runner would have seen: for `setJson` that
 * is the **encoded** JSON text, after the same schema encode the real layer
 * performs, so a test asserting on it reads exactly what a later step's
 * `steps.<id>.outputs.<name>` expression would. `name` is present for the
 * members that take one (`set`, `setJson`, `exportVariable`) and absent
 * otherwise.
 *
 * @public
 */
export class RecordedOutput extends S.Class<RecordedOutput>($I`RecordedOutput`)({
	/** Which {@link ActionOutputsShape} member was called. */
	member: S.Literals(["set", "setJson", "summary", "exportVariable", "addPath", "setFailed", "setSecret"]).annotateKey({ description: "Which ActionOutputsShape member was called." }),
	/** The output or variable name, for the members that take one. */
	name: S.optionalKey(S.String).annotateKey({ description: "The output or variable name, for the members that take one." }),
	/** What was published — value, message, path, content or secret — as the runner would have read it. */
	value: S.String.annotateKey({ description: "What was published — value, message, path, content or secret — as the runner would have read it." }),
}, $I.annote("RecordedOutput", { description: "One call an ActionOutputs.recording double observed." })) {}

/**
 * The member names a {@link RecordedOutput} can carry.
 *
 * @public
 */
export type RecordedOutputMember = RecordedOutput["member"];

/**
 * What {@link ActionOutputs.recording} returns: the layer to provide and the
 * journal it fills.
 *
 * @public
 */
export interface RecordingOutputs {
	/** An {@link ActionOutputs} whose every member records into this journal. */
	readonly layer: Layer.Layer<ActionOutputs>;
	/** A snapshot of every recorded call so far, in call order. */
	readonly entries: () => ReadonlyArray<RecordedOutput>;
}

/**
 * The members of the {@link ActionOutputs} service: step outputs, exported
 * variables, `PATH` additions, the job summary, masking and failure
 * annotations.
 *
 * @public
 */
export interface ActionOutputsShape {
	/** Publish a step output. */
	readonly set: (name: string, value: string) => Effect.Effect<void, ActionOutputError>;
	/** Publish a step output as JSON, encoded through a schema. */
	readonly setJson: <A, I>(
		name: string,
		value: A,
		schema: S.Codec<A, I>,
	) => Effect.Effect<void, ActionOutputError>;
	/** Append to the job summary. */
	readonly summary: (content: string) => Effect.Effect<void, ActionOutputError>;
	/** Export an environment variable to **subsequent** steps. */
	readonly exportVariable: (name: string, value: string) => Effect.Effect<void, ActionOutputError>;
	/**
	 * Prepend a directory to `PATH` for **subsequent** steps.
	 *
	 * @remarks
	 * This appends to the `GITHUB_PATH` runner file and does **nothing else** —
	 * unlike `@actions/core`, it does NOT mutate the live `process.env.PATH` of
	 * the current process. A same-process probe of a tool that was just added
	 * (`pnpm --version`, a shim, a binary) will not find it by name; probe by
	 * absolute path instead. The runner applies the addition when the next step
	 * starts, exactly as it does for {@link ActionOutputsShape.exportVariable}.
	 */
	readonly addPath: (path: string) => Effect.Effect<void, ActionOutputError>;
	/** Emit an error annotation. Does not itself set the exit code. */
	readonly setFailed: (message: string) => Effect.Effect<void>;
	/** Register a value for redaction in the runner log. */
	readonly setSecret: (value: string) => Effect.Effect<void>;
}

const make = Effect.gen(function* () {
	const env = yield* ActionEnvironment;
	const fs = yield* FileSystem.FileSystem;

	const append = Effect.fnUntraced(function* (file: string, content: string) {
			const path = yield* env.get(file).pipe(Effect.mapError(() => RunnerFileUnavailableError.make({ file })));
			yield* fs
				.writeFileString(path, content, { flag: "a" })
				.pipe(Effect.mapError((cause) => RunnerFileWriteError.make({ file, cause })));
		});

	const appendBlock = (file: string, name: string, value: string): Effect.Effect<void, ActionOutputError> =>
		withUsableName(file, name, append(file, heredocBlock({ name, value })));

	const set = (name: string, value: string) => appendBlock(RUNNER_FILE.set, name, value);

	return {
		set,
		setJson: <A, I>(name: string, value: A, schema: S.Codec<A, I>) =>
			encodeJson(name, value, schema).pipe(Effect.flatMap((json) => set(name, json))),
		summary: (content: string) => append(RUNNER_FILE.summary, content),
		exportVariable: (name: string, value: string) => appendBlock(RUNNER_FILE.exportVariable, name, value),
		addPath: (path: string) => append(RUNNER_FILE.addPath, `${path}\n`),
		setFailed: (message: string) => Console.log(WorkflowCommand.error(message)),
		setSecret: (value: string) => Console.log(WorkflowCommand.addMask(value)),
	} satisfies ActionOutputsShape;
});

const dies = unstubbed("ActionOutputs.makeTest");

/**
 * Everything an action publishes: step outputs, exported variables, `PATH`
 * additions, the job summary, log masking and failure annotations.
 *
 * @remarks
 * Outputs and variables go to the runner's **files** (`GITHUB_OUTPUT` and
 * friends); masking and annotations go to stdout as workflow commands, through
 * core `Console` so a test can observe them without a runner.
 *
 * `setFailed` emits the annotation but does **not** set the process exit code
 * — that is `Action.run`'s job, so that an action which reports a failure and
 * then recovers is not silently doomed by a side effect it cannot undo.
 *
 * Members that write a runner file fail with {@link ActionOutputError}.
 *
 * @example
 * ```ts
 * import { ActionOutputs } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const program = Effect.gen(function* () {
 *   const outputs = yield* ActionOutputs;
 *   yield* outputs.set("version", "1.2.3");
 *   yield* outputs.setJson("packages", ["a", "b"], S.Array(S.String));
 * });
 * ```
 *
 * @public
 */
export class ActionOutputs extends Context.Service<ActionOutputs, ActionOutputsShape>()(
	$I`ActionOutputs`,
) {
	/**
	 * The live service, appending to the runner's `GITHUB_OUTPUT`, `GITHUB_ENV`,
	 * `GITHUB_PATH` and `GITHUB_STEP_SUMMARY` files.
	 *
	 * @remarks
	 * `ActionRuntime.layer` already provides every requirement.
	 */
	static readonly layer: Layer.Layer<ActionOutputs, never, ActionEnvironment | FileSystem.FileSystem> = Layer.effect(
		this,
		make,
	);

	/**
	 * The outputs surface that is correct inside a **detached worker**.
	 *
	 * @remarks
	 * The masking model assumes the runner parses stdout. A detached worker's
	 * stdout is a **log file no runner parses**, so under the real layer
	 * `setSecret` emits `::add-mask::<plaintext>` into that file — a command
	 * that is simultaneously **inert** (nothing reads it, so nothing is masked)
	 * and a **secret leak** (the plaintext is now sitting verbatim in a log).
	 * This layer is the worker-side guard; the parent-side rule is that every
	 * secret a worker will hold is masked **before** the spawn, by
	 * `Secret.forChildEnv` under the real layer.
	 *
	 * The layer needs no environment and no filesystem — its `R` is `never` —
	 * so a worker composing it structurally *cannot* write a runner file.
	 * Per-member behavior:
	 *
	 * - **`setSecret` — silent no-op.** The value must not be written
	 *   *anywhere*: there is no runner on this channel to hand it to, and any
	 *   spelling of it in the log IS the leak. Masking is the parent's job,
	 *   before the worker exists.
	 * - **`set`, `setJson`, `exportVariable`, `addPath`, `summary` — fail
	 *   typed** with {@link DetachedOutputError}, naming the file. Each writes a runner
	 *   file that configures the parent job's *later steps* — `GITHUB_OUTPUT`,
	 *   `GITHUB_ENV`, `GITHUB_PATH` — or is collected when the step completes
	 *   (`GITHUB_STEP_SUMMARY`). A detached worker has no later steps, may
	 *   outlive the job entirely, and even an inherited file path would be
	 *   read at a moment unrelated to the write — so a worker calling one of
	 *   these is a program error worth surfacing, not a write to degrade
	 *   silently.
	 * - **`setFailed` — degrades to a plain log line** (`Console.error`,
	 *   without the `::error::` syntax nothing here would parse). Unlike the
	 *   file members it is log-like: "record that something failed" still
	 *   means something in a worker's log, and its signature carries no error
	 *   channel to fail through.
	 */
	static readonly layerDetached: Layer.Layer<ActionOutputs> = Layer.succeed(this, {
		set: (name) => Effect.fail(DetachedOutputError.make({ file: RUNNER_FILE.set, name })),
		setJson: (name) => Effect.fail(DetachedOutputError.make({ file: RUNNER_FILE.setJson, name })),
		summary: () => Effect.fail(DetachedOutputError.make({ file: RUNNER_FILE.summary })),
		exportVariable: (name) => Effect.fail(DetachedOutputError.make({ file: RUNNER_FILE.exportVariable, name })),
		addPath: () => Effect.fail(DetachedOutputError.make({ file: RUNNER_FILE.addPath })),
		setFailed: (message) => Console.error(CommandNeutralizer.text(message)),
		setSecret: () => Effect.void,
	} satisfies ActionOutputsShape);

	/**
	 * A test double. Unstubbed members die rather than silently succeeding.
	 *
	 * @remarks
	 * **`setJson` always encodes first.** The value is encoded through its
	 * schema exactly as the real layer does — failing typed with
	 * {@link OutputEncodeError} — and only then is a supplied `setJson`
	 * override called, with the original `(name, value, schema)`. An override
	 * that accepts `schema` and ignores it therefore **cannot disable
	 * output-schema checking**: a value/schema drift is a typed failure under
	 * this double whether or not the override looks at the schema. Without an
	 * override, a valid value still dies unimplemented as every other unstubbed
	 * member does. Most tests want neither: reach for
	 * {@link ActionOutputs.recording} instead.
	 */
	static readonly makeTest = (overrides: Partial<ActionOutputsShape> = {}): ActionOutputsShape => {
		const setJson: ActionOutputsShape["setJson"] = overrides.setJson ?? (() => dies("setJson"));
		return {
			set: () => dies("set"),
			summary: () => dies("summary"),
			exportVariable: () => dies("exportVariable"),
			addPath: () => dies("addPath"),
			setFailed: () => dies("setFailed"),
			setSecret: () => dies("setSecret"),
			...overrides,
			setJson: <A, I>(name: string, value: A, schema: S.Codec<A, I>) =>
				encodeJson(name, value, schema).pipe(Effect.flatMap(() => setJson(name, value, schema))),
		};
	};

	/** {@link ActionOutputs.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<ActionOutputsShape> = {}): Layer.Layer<ActionOutputs> =>
		Layer.succeed(ActionOutputs, ActionOutputs.makeTest(overrides));

	/**
	 * A recording double: every member appends a {@link RecordedOutput} to a
	 * journal the test reads back, in call order.
	 *
	 * @remarks
	 * This is the double most tests of an action want — "what did it publish?"
	 * — shipped so that nobody hand-writes a `setJson` override that drops the
	 * schema encode (a trap `makeTest` closes too). `setJson` encodes
	 * through its schema exactly as the real layer does, failing typed with
	 * {@link OutputEncodeError} and recording nothing on a drift, and records
	 * the **encoded JSON text** — what the runner would have read — not the
	 * decoded value. `set`, `exportVariable` and `setJson` refuse an unusable
	 * name with {@link InvalidOutputNameError}, as the real layer does, rather
	 * than recording it.
	 *
	 * `setSecret` records the secret's **plaintext** under
	 * `member: "setSecret"`. That is deliberate for a recording double: the
	 * journal never leaves the test, and a test asserting that a value *was*
	 * masked needs to see which one. Do not hand this journal to anything that
	 * logs.
	 *
	 * Each call returns a fresh, independent journal — there is no state shared
	 * between two `recording()` calls.
	 */
	static readonly recording = (): RecordingOutputs => {
		const entries: Array<RecordedOutput> = [];
		const record = (member: RecordedOutputMember, value: string, name?: string): Effect.Effect<void> =>
			Effect.sync(() => {
				entries.push(RecordedOutput.make({ member, value, ...O.getSomesStruct({ name: O.fromUndefinedOr(name) }) }));
			});
		const layer = Layer.succeed(ActionOutputs, {
			set: (name, value) => withUsableName(RUNNER_FILE.set, name, record("set", value, name)),
			setJson: <A, I>(name: string, value: A, schema: S.Codec<A, I>) =>
				withUsableName(
					RUNNER_FILE.setJson,
					name,
					encodeJson(name, value, schema).pipe(Effect.flatMap((json) => record("setJson", json, name))),
				),
			summary: (content) => record("summary", content),
			exportVariable: (name, value) =>
				withUsableName(RUNNER_FILE.exportVariable, name, record("exportVariable", value, name)),
			addPath: (path) => record("addPath", path),
			setFailed: (message) => record("setFailed", message),
			setSecret: (value) => record("setSecret", value),
		} satisfies ActionOutputsShape);
		return { layer, entries: () => entries.slice() };
	};
}
