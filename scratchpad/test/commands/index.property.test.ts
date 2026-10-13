import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import {
  CommandFailedError,
  CommandOutput,
  CommandOutputError,
  ExecContext,
  Launcher,
  LocalExecError,
  MismatchPolicy,
  ResolvedSource,
  ResolvedTool,
  Tool,
  ToolNotFoundError,
  ToolRefusedError,
  ToolSource,
  ToolVersionMismatchError,
  VersionFlag,
  VersionJson,
  VersionNone,
  VersionProbe,
} from "../../effected/commands/index.ts";

const runs = { arbitrary: fcRuns(100) };

// Exercise the public barrel itself. Type-only exports have no runtime codec.
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  const equivalent = S.toEquivalence(schema);
  it.effect.prop(
    `${name}: the public codec preserves values and decoding encoded values never fails`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assertTrue(equivalent(decoded, value));
        assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
      }),
    runs,
  );
};

describe("commands public barrel schema property floor", () => {
  roundTrips("ExecContext", ExecContext);
  roundTrips("Launcher", Launcher);
  roundTrips("LocalExecError", LocalExecError);
  roundTrips("CommandFailedError", CommandFailedError);
  roundTrips("CommandOutput", CommandOutput);
  roundTrips("CommandOutputError", CommandOutputError);
  roundTrips("MismatchPolicy", MismatchPolicy);
  roundTrips("Tool", Tool);
  roundTrips("ToolSource", ToolSource);
  roundTrips("VersionFlag", VersionFlag);
  roundTrips("VersionJson", VersionJson);
  roundTrips("VersionNone", VersionNone);
  roundTrips("VersionProbe", VersionProbe);
  roundTrips("ResolvedSource", ResolvedSource);
  roundTrips("ResolvedTool", ResolvedTool);
  roundTrips("ToolNotFoundError", ToolNotFoundError);
  roundTrips("ToolRefusedError", ToolRefusedError);
  roundTrips("ToolVersionMismatchError", ToolVersionMismatchError);
});
