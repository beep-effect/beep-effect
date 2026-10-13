import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { describe, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Audience, AudienceKind } from "../../effected/env/Audience.ts";
import { EnvOverride } from "../../effected/env/EnvOverride.ts";

const runs = { arbitrary: fcRuns(100) };
const accepts = { human: ["pretty", "silent"], agent: ["json", "silent"], ci: ["silent"] } as const;

describe("EnvOverride accepted literal fidelity", () => {
  it.effect.prop("case folding returns the canonical literal and rereading is stable",
    [Arbitrary.schema(AudienceKind), Arbitrary.schema(S.Boolean)],
    ([kind, uppercase]) => Effect.gen(function* () {
      for (const literal of accepts[kind]) {
        const value = uppercase ? Str.toUpperCase(literal) : literal;
        const first = yield* EnvOverride.readResult({ envVar: "MODE", accepts, source: { MODE: value } });
        assertSome(first.accepted, literal);
        assertNone(first.rejected);
        const second = yield* EnvOverride.readResult({ envVar: "MODE", accepts, source: { MODE: literal } });
        assertSome(second.accepted, literal);
        assertNone(second.rejected);
      }
    }).pipe(Effect.provideService(Audience, { kind, source: "override" })), runs);
});
