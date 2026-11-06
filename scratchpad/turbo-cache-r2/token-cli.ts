#!/usr/bin/env node
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Alchemist from "alchemy/Alchemist";

import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as R from "effect/Record";
import { deployedCacheState } from "./read-state.js";
import { stateReadFailure } from "./token-failure.js";
import { handoffToken, TokenHandoffError } from "./token.js";

const Flags = S.Struct({
  "--prefix": S.NonEmptyString,
  "--stack": S.NonEmptyString,
  "--stage": S.NonEmptyString,
  "--state-store": S.NonEmptyString,
  "--team": S.NonEmptyString,
  "--teams": S.NonEmptyString,
});

const main = Effect.gen(function* tokenMain() {
  const args = process.argv.slice(2);
  const separator = args.indexOf("--");
  const flags = args.slice(0, separator);
  const command = args[separator + 1];
  const names = R.keys(Flags.fields);
  if (
    separator !== 12 ||
    command === undefined ||
    A.some(names, (name) => !A.some(flags, (flag, index) => index % 2 === 0 && flag === name))
  ) {
    return yield* TokenHandoffError.make({
      message:
        "The token handoff arguments are invalid. Stack identity and receiver must be explicit. Fix: pass --stack, --stage, --state-store, --prefix, --teams, --team, then -- <command> [args].",
    });
  }
  const parsed = yield* S.decodeUnknownEffect(Flags)(
    R.fromEntries(A.map(names, (name) => [name, flags[flags.indexOf(name) + 1]])),
  ).pipe(
    Effect.mapError(
      () =>
        TokenHandoffError.make({
          message:
            "The token handoff configuration is incomplete. Every identity flag needs a value. Fix: supply each flag exactly once.",
        }),
    ),
  );

  const store = yield* deployedCacheState(parsed["--state-store"]).pipe(
    Effect.catchCause((cause) => cause.pipe(stateReadFailure, Effect.fail)),
  );
  const values = yield* handoffToken(
    (fqn) =>
      store
        .get({ fqn, stack: parsed["--stack"], stage: parsed["--stage"] })
        .pipe(Effect.catchCause((cause) => cause.pipe(stateReadFailure, Effect.fail))),
    {
      args: args.slice(separator + 2),
      command,
      resourceNamePrefix: parsed["--prefix"],
      team: parsed["--team"],
      teams: Str.split(parsed["--teams"], ","),
    },
  );
  yield* Console.log(`TURBO_API=${values.TURBO_API}\nTURBO_TEAM=${values.TURBO_TEAM}`);
  return values;
});

// The entry point owns one scope: Alchemist services and the deployed state
// layer built inside `main` share it, so the store outlives every read.
Alchemist.layer().pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(main, context)),
  Effect.scoped,
  NodeRuntime.runMain,
);
