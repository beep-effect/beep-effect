import { Context, Effect, FileSystem, Layer, Option, Schema } from "effect";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { ActionOutputs } from "./ActionOutputs.ts";
import { heredocBlock, isUsableName } from "./internal/runnerFile.ts";
import { unstubbed } from "./internal/unstubbed.ts";

/**
 * Raised when action state cannot be saved, read or decoded across the phase
 * boundary.
 *
 * @public
 */
export class ActionStateError extends Schema.TaggedError<ActionStateError>()("ActionStateError", {
	/**
	 * `missing` — no value was saved under this key in an earlier phase.
	 * `malformed` — a value is there but is not JSON, or does not satisfy the
	 * schema it was read with. `notPlainJson` — caught at SAVE time: the
	 * schema's encoded form does not survive `JSON.stringify`/`JSON.parse`, so
	 * persisting it would present one phase later as a `malformed` mystery with
	 * no pointer to the cause. `writeFailed` — the state file could not be
	 * appended to.
	 */
	reason: Schema.Literals(["missing", "malformed", "notPlainJson", "writeFailed"]),
	/** The state key that was being saved or read. */
	key: Schema.String,
	/** The underlying failure, preserved structurally. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
	override get message(): string {
		switch (this.reason) {
			case "missing":
				return `No action state was saved under "${this.key}"`;
			case "malformed":
				return `Action state under "${this.key}" could not be decoded`;
			case "notPlainJson":
				return `The encoded form of action state under "${this.key}" is not plain JSON and would not survive the phase boundary — encode to a plain-JSON form (e.g. Schema.OptionFromNullOr rather than Schema.Option)`;
			default:
				return `Failed to persist action state under "${this.key}"`;
		}
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
	 * @remarks
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
	readonly save: <A, I>(key: string, value: A, schema: Schema.Codec<A, I>) => Effect.Effect<void, ActionStateError>;
	/** Read a value saved by an earlier phase. */
	readonly get: <A, I>(key: string, schema: Schema.Codec<A, I>) => Effect.Effect<A, ActionStateError>;
	/** Read a value that may not have been saved. */
	readonly getOptional: <A, I>(
		key: string,
		schema: Schema.Codec<A, I>,
	) => Effect.Effect<Option.Option<A>, ActionStateError>;
	/**
	 * Persist a secret, masking it in the runner log first.
	 *
	 * @remarks
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

	const write = (key: string, serialized: string): Effect.Effect<void, ActionStateError> =>
		Effect.gen(function* () {
			const writeFailed = (cause: unknown) => ActionStateError.make({ reason: "writeFailed", key, cause });
			// The same heredoc protocol as ActionOutputs (`internal/runnerFile.ts`):
			// a key that cannot head a block would corrupt every entry after it.
			if (!isUsableName(key)) {
				return yield* writeFailed(new Error(`"${key}" cannot name a GITHUB_STATE entry`));
			}
			const path = yield* env.get("GITHUB_STATE").pipe(Effect.mapError(writeFailed));
			yield* fs.writeFileString(path, heredocBlock(key, serialized), { flag: "a" }).pipe(Effect.mapError(writeFailed));
		});

	const read = <A, I>(key: string, schema: Schema.Codec<A, I>): Effect.Effect<Option.Option<A>, ActionStateError> =>
		Effect.gen(function* () {
			const raw = yield* env.getOptional(stateVariable(key));
			if (Option.isNone(raw)) {
				return Option.none<A>();
			}
			const decoded = yield* Schema.decodeEffect(Schema.fromJsonString(schema))(raw.value).pipe(
				Effect.mapError((cause) => ActionStateError.make({ reason: "malformed", key, cause })),
			);
			return Option.some(decoded);
		});

	const save = <A, I>(key: string, value: A, schema: Schema.Codec<A, I>) =>
		Effect.gen(function* () {
			const encoded = yield* Schema.encodeUnknownEffect(schema)(value).pipe(
				Effect.mapError((cause) => ActionStateError.make({ reason: "malformed", key, cause })),
			);
			// Prove at save time that the encoded form survives the boundary it is
			// about to cross: GITHUB_STATE is text, so what `get` will see is
			// JSON.parse of this string, not `encoded` itself. A schema whose
			// encoded side is a class instance (Schema.Option) or an unstringifiable
			// value (a bigint) fails HERE, naming the key, instead of one phase
			// later as a `malformed` mystery. States are small; the round-trip is
			// noise next to the file append.
			const { parsed, serialized } = yield* Effect.try({
				try: () => {
					const serialized = JSON.stringify(encoded);
					return { parsed: JSON.parse(serialized) as unknown, serialized };
				},
				catch: (cause) => ActionStateError.make({ reason: "notPlainJson", key, cause }),
			});
			yield* Schema.decodeUnknownEffect(schema)(parsed).pipe(
				Effect.mapError((cause) => ActionStateError.make({ reason: "notPlainJson", key, cause })),
			);
			yield* write(key, serialized);
		});

	return {
		save,
		getOptional: read,
		get: <A, I>(key: string, schema: Schema.Codec<A, I>) =>
			Effect.flatMap(read(key, schema), (found) =>
				Option.isSome(found)
					? Effect.succeed(found.value)
					: Effect.fail(ActionStateError.make({ reason: "missing", key })),
			),
		saveSecret: (key: string, secret: string) =>
			// Mask first, then persist. The ordering is the guarantee.
			Effect.flatMap(outputs.setSecret(secret), () => write(key, JSON.stringify(secret))),
	} satisfies ActionStateShape;
});

const dies = unstubbed("ActionState.makeTest");

/**
 * State that survives the `pre` → `main` → `post` phase boundary.
 *
 * @remarks
 * Each phase of an action is a **separate process**. GitHub's protocol is a
 * write-only file (`GITHUB_STATE`) whose entries the runner republishes to the
 * next phase as `STATE_<key>` environment variables — so saving and reading go
 * through different mechanisms, which is why this is a service rather than a
 * pair of helpers. Every member fails with {@link ActionStateError}.
 *
 * @example
 * ```ts
 * import { ActionState } from "./index.ts";
 * import { Effect, Schema } from "effect";
 *
 * // in `pre`
 * const pre = Effect.gen(function* () {
 *   const state = yield* ActionState;
 *   yield* state.save("server-pid", 4242, Schema.Finite);
 * });
 *
 * // in `post`
 * const post = Effect.gen(function* () {
 *   const state = yield* ActionState;
 *   const pid = yield* state.get("server-pid", Schema.Finite);
 *   return pid;
 * });
 * ```
 *
 * @public
 */
export class ActionState extends Context.Service<ActionState, ActionStateShape>()(
	"@beep/scratchpad/effected/github-actions/ActionState",
) {
	/**
	 * The live service, writing to the runner's `GITHUB_STATE` file and reading
	 * the `STATE_<key>` variables it republishes.
	 *
	 * @remarks
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
