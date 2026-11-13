/**
 * `beep session resolve` and `beep session presence`: find a key's owning
 * session and its routes, and record this session's own routes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Argument from "effect/cli/Argument";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { layerSessionPresenceStoreLive, recordPresence } from "./Presence.service.ts";
import {
  layerSessionResolver,
  renderSessionResolution,
  SessionResolveInput,
  SessionResolver,
} from "./Resolve.service.ts";
import { SessionPresenceJson, SessionResolutionJson } from "./Route.schemas.ts";
import { layerSessionRouteProbeLive } from "./RouteProbe.service.ts";
import { reportSessionFailure, SessionLedgerError, sessionUsageError } from "./Session.errors.ts";
import { layerSessionLedgerLive, sessionCheckoutFacts } from "./SessionLedger.service.ts";

const jsonFlag = Flag.Boolean("json").pipe(Flag.withDefault(false), Flag.withDescription("Emit the result as JSON"));
const keyArgument = Argument.String("key").pipe(
  Argument.withDescription("A PR number (3172 or #3172), a branch, a lane name, or a checkout path")
);

const encodeError = (what: string) => (cause: unknown) =>
  SessionLedgerError.make({ reason: "decode", message: `Failed to encode the ${what}.`, cause });

/**
 * `beep session resolve <key>`: the session that owns a PR, branch, lane or
 * checkout, each of its routes with liveness computed now, and the literal call
 * that reaches it, or the fallback steps. It sends nothing and exits zero when
 * no owner is found.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionResolveCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionResolveCommand.name) // "resolve"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionResolveCommand = Command.make(
  "resolve",
  { key: keyArgument, json: jsonFlag },
  Effect.fn(function* ({ key, json }) {
    const program = Effect.gen(function* () {
      if (Str.isEmpty(Str.trim(key))) return yield* sessionUsageError("resolve needs a PR, branch, lane or checkout.");
      const cwd = process.cwd();
      const facts = yield* sessionCheckoutFacts(cwd);
      const resolver = yield* SessionResolver;
      const resolution = yield* resolver.resolve(
        SessionResolveInput.make({ repository: facts.repository, query: key, cwd })
      );
      if (json) {
        yield* SessionResolutionJson.encode(resolution).pipe(
          Effect.mapError(encodeError("session resolution")),
          Effect.flatMap(Console.log)
        );
        return;
      }
      yield* Console.log(renderSessionResolution(resolution));
    });
    yield* reportSessionFailure(program);
  })
).pipe(
  Command.withDescription(
    "Find the session that owns a PR, branch, lane or checkout, its routes, their liveness now, and the send call"
  ),
  Command.provide(
    layerSessionResolver.pipe(
      Layer.provide(Layer.mergeAll(layerSessionLedgerLive, layerSessionPresenceStoreLive, layerSessionRouteProbeLive))
    )
  )
);

/**
 * `beep session presence`: record this session's routes from its environment
 * and print them. Session start hooks record presence on their own; this is
 * the manual path and the one a harness without hooks can call.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionPresenceCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionPresenceCommand.name) // "presence"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionPresenceCommand = Command.make(
  "presence",
  { json: jsonFlag },
  Effect.fn(function* ({ json }) {
    const program = Effect.gen(function* () {
      const facts = yield* sessionCheckoutFacts(process.cwd());
      const presence = yield* recordPresence(facts);
      if (O.isNone(presence)) {
        yield* Console.log("[session] no harness session id in this environment; nothing recorded");
        return;
      }
      if (json) {
        yield* SessionPresenceJson.encode(presence.value).pipe(
          Effect.mapError(encodeError("session presence")),
          Effect.flatMap(Console.log)
        );
        return;
      }
      yield* Console.log(
        `[session] presence for ${presence.value.harness} session ${presence.value.sessionId}: ${A.join(
          A.map(presence.value.routes, (route) => route._tag),
          ", "
        )}`
      );
    });
    yield* reportSessionFailure(program);
  })
).pipe(
  Command.withDescription("Record this session's message routes from its environment"),
  Command.provide(layerSessionPresenceStoreLive)
);
