import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { TabsAction } from "../../../effected/cli/ui/Tabs.ts";

it.effect.prop("TabsAction round-trips literals and plain jump payloads", [Arbitrary.schema(TabsAction)], ([action]) =>
	Effect.gen(function* () {
		const encoded = yield* S.encodeEffect(TabsAction)(action);
		assert.deepStrictEqual(yield* S.decodeEffect(TabsAction)(encoded), action);
	}), { arbitrary: fcRuns(100) });
