import * as Match from "effect/Match";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { ActionOutputs } from "./ActionOutputs.ts";
import { heredocBlock, isUsableName } from "./internal/runnerFile.ts";
import { unstubbed } from "./internal/unstubbed.ts";

const $I = $ScratchpadId.create("effected/github-actions/ActionState");

/** An invalid name cannot head an action-state runner-file entry. */
export class InvalidActionStateNameError extends S.TaggedError<InvalidActionStateNameError>($I`InvalidActionStateNameError`)("InvalidActionStateNameError", {
	message: S.String,
}, $I.annote("InvalidActionStateNameError", { description: "An invalid name cannot head an action-state runner-file entry." })) {}

const Json = S.fromJsonString(S.Unknown);

/**
 * Raised when action state cannot be saved, read or decoded across the phase
 * boundary.
 *
 * @public
 */
export class ActionStateError extends S.TaggedError<ActionStateError>($I`ActionStateError`)("ActionStateError", {
	/**
	 * `missing` — no value was saved under this key in an earlier phase.
	 * `malformed` — a value is there but is not JSON, or does not satisfy the
	 * schema it was read with. `notPlainJson` — caught at SAVE time: the
	 * schema's encoded form does not survive `JSON.stringify`/`JSON.parse`, so
	 * persisting it would present one phase later as a `malformed` mystery with
	 * no pointer to the cause. `writeFailed` — the state file could not be
	 * appended to.
	 */
	reason: S.Literals(["missing", "malformed", "notPlainJson", "writeFailed"]).annotateKey({ description: "`missing` — no value was saved under this key in an earlier phase. `malformed` — a value is there but is not JSON, or does not satisfy the schema it was read with. `notPlainJson` — caught at SAVE time: the schema's encoded form does not survive `JSON.stringify`/`JSON.parse`, so persisting it would present one phase later as a `malformed` mystery with no pointer to the cause. `writeFailed` — the state file could not be appended to." }),
	/** The state key that was being saved or read. */
	key: S.String.annotateKey({ description: "The state key that was being saved or read." }),
	/** The underlying failure, preserved structurally. */
	cause: S.optionalKey(S.Defect()).annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("ActionStateError", { description: "Raised when action state cannot be saved, read or decoded across the phase boundary." })) {
	override get message(): string {
		return Match.value(this.reason).pipe(
			Match.when("missing", () => `No action state was saved under "${this.key}"`),
			Match.when("malformed", () => `Action state under "${this.key}" could not be decoded`),
			Match.when("notPlainJson", () => `The encoded form of action state under "${this.key}" is not plain JSON and would not survive the phase boundary — encode to a plain-JSON form (e.g. Schema.OptionFromNullOr rather than Schema.Option)`),
			Match.orElse(() => `Failed to persist action state under "${this.key}"`),
		);
	}
}

/**
 * The members of the {@link ActionState} service: save and read values, and
 * persist secrets, across the `pre` → `main` → `post` boundary.
 *
 * @public
 */
export interface ActionStateShape {
	/**
  * Persist a value for a later phase.
  *
  * **Gotchas**
  *
  * **The schema's ENCODED form must be plain JSON** — `GITHUB_STATE` is a
  * text file and the value crosses it as `JSON.stringify(encoded)`. A schema
  * whose encoded side is a class instance (`Schema.Option`'s is an `Option`,
  * serialized via its `toJSON` to `{"_id":"Option",…}`) writes something no
  * later phase can decode; use the plain-JSON codec instead —
  * `Schema.OptionFromNullOr` for an optional value.
  *
  * Every save proves the rule: the encoded value is round-tripped through
  * `JSON.stringify`/`JSON.parse` and re-decoded, and a value that does not
  * survive fails HERE, typed (`reason: "notPlainJson"`, naming the key) —
  * rather than one phase later as a `malformed` mystery in `post` that
  * `main` believed it saved. Action state is small by protocol, so the
  * per-save round-trip costs effectively nothing.
  */
	readonly save: <A, I>(key: string, value: A, schema: S.Codec<A, I>) => Effect.Effect<void, ActionStateError>;
	/** Read a value saved by an earlier phase. */
	readonly get: <A, I>(key: string, schema: S.Codec<A, I>) => Effect.Effect<A, ActionStateError>;
	/** Read a value that may not have been saved. */
	readonly getOptional: <A, I>(
		key: string,
		schema: S.Codec<A, I>,
	) => Effect.Effect<O.Option<A>, ActionStateError>;
	/**
  * Persist a secret, masking it in the runner log first.
  *
  * **Details**
  *
  * `GITHUB_STATE` is plaintext by GitHub's protocol — a `Redacted` cannot
  * survive that boundary by design — so masking is the only available
  * defense, and coupling it to the write is what makes it unforgettable.
  */
	readonly saveSecret: (key: string, secret: string) => Effect.Effect<void, ActionStateError>;
}

/** The runner republishes saved state as `STATE_<key>`. */
const stateVariable = (key: string): string => `STATE_${key}`;

const make = Effect.gen(function* () {
	const env = yield* ActionEnvironment;
	const fs = yield* FileSystem.FileSystem;
	const outputs = yield* ActionOutputs;

	const write = Effect.fnUntraced(function* (key: string, serialized: string) {
			const writeFailed = (cause: unknown) => ActionStateError.make({ reason: "writeFailed", key, cause });
			// The same heredoc protocol as ActionOutputs (`internal/runnerFile.ts`):
			// a key that cannot head a block would corrupt every entry after it.
			if (!isUsableName(key)) {
				return yield* writeFailed(InvalidActionStateNameError.make({ message: `"${key}" cannot name a GITHUB_STATE entry` }));
			}
			const path = yield* env.get("GITHUB_STATE").pipe(Effect.mapError(writeFailed));
			yield* fs.writeFileString(path, heredocBlock({ name: key, value: serialized }), { flag: "a" }).pipe(Effect.mapError(writeFailed));
		});

	const read = Effect.fnUntraced(function* <A, I>(key: string, schema: S.Codec<A, I>) {
			const raw = yield* env.getOptional(stateVariable(key));
			if (O.isNone(raw)) {
				return O.none<A>();
			}
			const decoded = yield* S.decodeEffect(S.fromJsonString(schema))(raw.value).pipe(
				Effect.mapError((cause) => ActionStateError.make({ reason: "malformed", key, cause })),
			);
			return O.some(decoded);
		});

	const save = Effect.fn("save")(function*<A, I>(key: string, value: A, schema: S.Codec<A, I>) {
			const encoded = yield* S.encodeUnknownEffect(schema)(value).pipe(
				Effect.mapError((cause) => ActionStateError.make({ reason: "malformed", key, cause })),
			);
			// Prove at save time that the encoded form survives the boundary it is
			// about to cross: GITHUB_STATE is text, so what `get` will see is
			// JSON.parse of this string, not `encoded` itself. A schema whose
			// encoded side is a class instance (Schema.Option) or an unstringifiable
			// value (a bigint) fails HERE, naming the key, instead of one phase
			// later as a `malformed` mystery. States are small; the round-trip is
			// noise next to the file append.
			const notPlainJson = (cause: unknown) => ActionStateError.make({ reason: "notPlainJson", key, cause });
			const serialized = yield* S.encodeEffect(Json)(encoded).pipe(Effect.mapError(notPlainJson));
			const parsed = yield* S.decodeEffect(Json)(serialized).pipe(Effect.mapError(notPlainJson));
			yield* S.decodeUnknownEffect(schema)(parsed).pipe(
				Effect.mapError((cause) => ActionStateError.make({ reason: "notPlainJson", key, cause })),
			);
			yield* write(key, serialized);
		});

	return {
		save,
		getOptional: read,
		get: <A, I>(key: string, schema: S.Codec<A, I>) =>
			Effect.flatMap(read(key, schema), (found) =>
				Effect.fromOption(found, () => ActionStateError.make({ reason: "missing", key })),
			),
		saveSecret: Effect.fnUntraced(function* (key: string, secret: string) {
			// Mask first, then persist. The ordering is the guarantee.
			yield* outputs.setSecret(secret);
			const serialized = yield* S.encodeEffect(Json)(secret).pipe(
				Effect.mapError((cause) => ActionStateError.make({ reason: "writeFailed", key, cause })),
			);
			yield* write(key, serialized);
		}),
	} satisfies ActionStateShape;
});

const dies = unstubbed("ActionState.makeTest");

/**
 * State that survives the `pre` → `main` → `post` phase boundary.
 *
 * **Details**
 *
 * Each phase of an action is a **separate process**. GitHub's protocol is a
 * write-only file (`GITHUB_STATE`) whose entries the runner republishes to the
 * next phase as `STATE_<key>` environment variables — so saving and reading go
 * through different mechanisms, which is why this is a service rather than a
 * pair of helpers. Every member fails with {@link ActionStateError}.
 *
 * **Example** (Save and retrieve a server PID across action phases)
 *
 * ```ts
 * import { ActionState } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * // in `pre`
 * const pre = Effect.gen(function* () {
 *   const state = yield* ActionState;
 *   yield* state.save("server-pid", 4242, S.Finite);
 * });
 *
 * // in `post`
 * const post = Effect.gen(function* () {
 *   const state = yield* ActionState;
 *   const pid = yield* state.get("server-pid", S.Finite);
 *   return pid;
 * });
 * ```
 *
 * @public
 */
export class ActionState extends Context.Service<ActionState, ActionStateShape>()(
	$I`ActionState`,
) {
	/**
  * The live service, writing to the runner's `GITHUB_STATE` file and reading
  * the `STATE_<key>` variables it republishes.
  *
  * **Details**
  *
  * `ActionRuntime.layer` already provides every requirement.
  */
	static readonly layer: Layer.Layer<ActionState, never, ActionEnvironment | FileSystem.FileSystem | ActionOutputs> =
		Layer.effect(this, make);

	/** A test double. Unstubbed members die rather than answering wrongly. */
	static readonly makeTest = (overrides: Partial<ActionStateShape> = {}): ActionStateShape => ({
		save: () => dies("save"),
		get: () => dies("get"),
		getOptional: () => dies("getOptional"),
		saveSecret: () => dies("saveSecret"),
		...overrides,
	});

	/** {@link ActionState.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<ActionStateShape> = {}): Layer.Layer<ActionState> =>
		Layer.succeed(ActionState, ActionState.makeTest(overrides));
}
