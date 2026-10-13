import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { vi } from "vitest"; // Vitest needs its direct import to hoist the private-schema observer.
import "../../../effected/cli/ui/internal/ink.ts";
import "../../../effected/cli/ui/internal/ScreenContext.ts";
import "../../../effected/cli/ui/internal/lazyView.ts";
import "../../../effected/cli/ui/internal/inkConsole.ts";
import "../../../effected/cli/ui/testing/CliUiTest.ts";

const { errors } = vi.hoisted(() => {
	const errors: Array<{ readonly tag: string; readonly schema: S.Top; readonly message: S.Top }> = [];
	return { errors };
});

// Observe private error schemas at definition time; the real constructor and all runtime behavior stay intact.
vi.mock("effect/Schema", (importOriginal) => Effect.runPromise(Effect.gen(function*() {
	const schema = yield* Effect.promise(() => importOriginal<typeof S>());
	return {
		...schema,
		TaggedError: <Self = never, Brand = {}>(identifier?: string) => {
			const define = schema.TaggedError<Self, Brand>(identifier);
			return <Tag extends string, const Fields extends S.Struct.Fields>(
				tag: Tag,
				fields: Fields,
				annotations?: S.Annotations.Declaration<Self, readonly [S.TaggedStruct<Tag, Fields>]>,
			) => {
				const error = define(tag, fields, annotations);
				if (schema.isSchema(error) && P.hasProperty(error, "fields") &&
					P.hasProperty(error.fields, "message") && schema.isSchema(error.fields.message)) {
					errors.push({ tag, schema: error, message: error.fields.message });
				}
				return error;
			};
		},
	};
})));

describe("bridge and test-runtime error metadata", () => {
	it.each([
		["InkNotLoaded", "ui/internal/ink", "Ink's optional peers were read before they were loaded.",
			"The required peer-loading step before reading Ink's modules."],
		["ScreenContextError", "ui/internal/ScreenContext", "A widget read its screen context outside a screen or UiProvider.",
			"The required screen or UiProvider surrounding a widget."],
		["LazyViewStateError", "ui/internal/lazyView", "A lazy view was rendered before loading or carried an invalid loader.",
			"The unloaded view or invalid loader preventing a lazy render."],
		["ConsoleTrace", "ui/internal/inkConsole", "The caller stack rendered by console.trace.",
			"The trace message used to capture the caller stack, empty before formatting."],
		["CliUiTestError", "ui/testing/CliUiTest", "Invalid test interaction with a CLI screen.",
			"The invalid test interaction or failed screen wait and its context."],
	])("%s carries its identity, domain description and message description", (tag, file, description, message) => {
		const error = errors.find((error) => error.tag === tag);
		if (error === undefined) return assert.fail(`Missing error schema: ${tag}`);
		assert.strictEqual(error.schema.ast.annotations?.identifier, `@beep/scratchpad/effected/cli/${file}/${tag}`);
		assert.isString(error.schema.ast.annotations?.title);
		assert.isNotEmpty(error.schema.ast.annotations?.title);
		assert.strictEqual(error.schema.ast.annotations?.description, description);
		assert.strictEqual(error.message.ast.annotations?.description, message);
	});
});
