import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TextInputState } from "../../../effected/cli/ui/TextInput.ts";

it.effect.prop("TextInputState round-trips its raw editing payload", [Arbitrary.schema(TextInputState)], ([state]) =>
	Effect.gen(function* () {
		const encoded = yield* S.encodeEffect(TextInputState)(state);
		assert.deepStrictEqual(yield* S.decodeEffect(TextInputState)(encoded), state);
	}), { arbitrary: fcRuns(100) });
