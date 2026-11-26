/**
 * `beep session rehome`: move a checkout's session history to a new
 * repository partition, dry run by default.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { CheckoutRepositorySlug } from "../../internal/state/WorkstationState.ts";
import { layerSessionPresenceStoreLive } from "./Presence.service.ts";
import { layerOrchestratorRegisterLive } from "./Register.service.ts";
import { SessionRehomeRequest } from "./Rehome.schemas.ts";
import { rehomeSessionStores, renderSessionRehomeReport } from "./Rehome.service.ts";
import { layerOrchestratorRulingsLive } from "./Rulings.service.ts";
import { reportSessionFailure, sessionUsageError } from "./Session.errors.ts";
import { layerSessionLedgerLive } from "./SessionLedger.service.ts";

const decodeSlug = S.decodeUnknownResult(CheckoutRepositorySlug);

const fromFlag = Flag.String("from").pipe(
  Flag.withDescription("Repository partition the history is in now, as host/owner/name")
);
const toFlag = Flag.String("to").pipe(Flag.withDescription("Repository partition to copy it into, as host/owner/name"));
const applyFlag = Flag.Boolean("apply").pipe(
  Flag.withDefault(false),
  Flag.withDescription("Copy the rows; without it the command only reports what it would copy")
);

const repositoryFlag = (value: string, flag: string) =>
  Result.match(decodeSlug(value), {
    onFailure: () => Effect.fail(sessionUsageError(`--${flag} must be host/owner/name; got "${value}".`)),
    onSuccess: Effect.succeed,
  });

/**
 * `beep session rehome --from <host/owner/name> --to <host/owner/name> [--apply]`.
 *
 * **Example** (Read the command name)
 *
 * ```ts
 * import { sessionRehomeCommand } from "@beep/repo-cli/test/Session"
 *
 * console.log(sessionRehomeCommand.name) // "rehome"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const sessionRehomeCommand = Command.make(
  "rehome",
  { from: fromFlag, to: toFlag, apply: applyFlag },
  Effect.fn(function* ({ from, to, apply }) {
    const program = Effect.gen(function* () {
      const request = SessionRehomeRequest.make({
        from: yield* repositoryFlag(from, "from"),
        to: yield* repositoryFlag(to, "to"),
        apply,
      });
      const report = yield* rehomeSessionStores(request);
      yield* Console.log(renderSessionRehomeReport(report));
    });
    yield* reportSessionFailure(program);
  })
).pipe(
  Command.withDescription(
    "Copy the session ledger, presence, register and rulings rows of one repository partition into another"
  ),
  Command.provide(
    Layer.mergeAll(
      layerSessionLedgerLive,
      layerSessionPresenceStoreLive,
      layerOrchestratorRegisterLive,
      layerOrchestratorRulingsLive
    )
  )
);
