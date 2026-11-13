#!/usr/bin/env bun
/**
 * Issue one cache token to a receiving command, for example
 * `bun token.ts --stage prod --principal ci-pr -- gh secret set NAME`. The
 * token goes to the receiver's stdin; this command prints only `TURBO_API`
 * and `TURBO_TEAM`. Needs AWS credentials for the state store in the
 * environment (runbook: docs/runbooks/alchemy-infra.md).
 *
 * @internal
 * @since 0.0.0
 */
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Alchemist from "alchemy/Alchemist";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { state } from "./alchemy.run.ts";
import { PrincipalName, TeamSlug } from "./src/CachePolicy.ts";
import { deployedCacheState } from "./src/internal/StateReader.ts";
import { handoffToken, stateReadFailure, TokenHandoffError, TokenHandoffOptions } from "./src/TokenHandoff.ts";
import { cachePolicy, resourceNamePrefix } from "./src/Worker.ts";

const stackName = "TurboCache";

const token = Command.make(
  "token",
  {
    stage: Flag.String("stage").pipe(Flag.withDescription("Stage whose token to issue, e.g. prod or dev_$USER")),
    team: Flag.String("team").pipe(Flag.withSchema(TeamSlug), Flag.withDefault("beep")),
    principal: Flag.String("principal").pipe(
      Flag.withSchema(PrincipalName),
      Flag.withDescription("Policy principal whose token to issue, e.g. ci-main, ci-pr, dankstation")
    ),
    receiver: Argument.String("receiver").pipe(
      Argument.variadic,
      Argument.withDescription("Receiving command and its arguments, after --; it reads the token from stdin")
    ),
  },
  Effect.fn("TurboCache.tokenCli")(function* ({ stage, team, principal, receiver: raw }) {
    const receiver = A.filter(raw, P.isString);
    const command = A.head(receiver);
    if (O.isNone(command)) {
      return yield* TokenHandoffError.make({
        message: "No receiving command. Fix: pass `-- <command> [args]`; the token goes to its stdin.",
      });
    }
    const store = yield* deployedCacheState(state).pipe(Effect.catchCause(flow(stateReadFailure, Effect.fail)));
    const values = yield* handoffToken(
      (fqn) => store.get({ fqn, stack: stackName, stage }).pipe(Effect.catchCause(flow(stateReadFailure, Effect.fail))),
      TokenHandoffOptions.make({
        args: A.drop(receiver, 1),
        command: command.value,
        policy: cachePolicy,
        principal,
        resourceNamePrefix,
        team,
      })
    );
    yield* Console.log(`TURBO_API=${values.TURBO_API}\nTURBO_TEAM=${values.TURBO_TEAM}`);
  })
).pipe(Command.withDescription("Send one Turborepo cache token to a receiving command's stdin."));

// One scope owns the Alchemist services and the state layer built inside the
// command, so the store outlives every read.
Alchemist.layer().pipe(
  Layer.build,
  Effect.flatMap((context) => Command.run(token, { version: "0.0.0" }).pipe(Effect.provide(context))),
  Effect.scoped,
  NodeRuntime.runMain
);
