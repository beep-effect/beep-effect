import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Redacted } from "effect";
import * as O from "effect/Option";
import { HttpRouter, HttpServerRequest } from "effect/unstable/http";
import { AuthRouter } from "../../Runtime/AuthRouter.ts";
import { ConfigService, DEFAULT_CONFIG } from "../../Service/Config.ts";
import { TicketService } from "../../Service/Ticket.ts";

const InterruptedTicketService = Layer.succeed(
  TicketService,
  TicketService.of({
    createTicket: Effect.fn("TicketService.createTicket")(() => Effect.interrupt),
    validateTicket: Effect.fn("TicketService.validateTicket")(() => Effect.never),
    hasTicket: Effect.fn("TicketService.hasTicket")(() => Effect.succeed(false)),
    getActiveCount: Effect.succeed(0),
    validateApiKey: Effect.fn("TicketService.validateApiKey")((apiKey) =>
      Effect.succeed(O.getOrElse(O.fromUndefinedOr(apiKey), () => "api-key"))
    ),
  })
);

const AuthConfig = Layer.succeed(ConfigService, {
  ...DEFAULT_CONFIG,
  api: {
    ...DEFAULT_CONFIG.api,
    keys: O.some(Redacted.make("api-key")),
  },
});

const InterruptedAuthDependencies = Layer.mergeAll(InterruptedTicketService, AuthConfig, BunCrypto.layer);

describe("AuthRouter", () => {
  it.layer(InterruptedAuthDependencies)("with an interrupted ticket service", (it) => {
    it.effect(
      "preserves interruption from ticket creation",
      Effect.fnUntraced(function* () {
        const exit = yield* Effect.scoped(
          Effect.gen(function* () {
            const handler = yield* HttpRouter.toHttpEffect(AuthRouter);
            const request = HttpServerRequest.fromWeb(
              new Request("http://effect-ontology.test/v1/auth/ticket", {
                method: "POST",
                headers: {
                  "content-type": "application/json",
                  "x-api-key": "api-key",
                },
                body: '{"ontologyId":"ontology"}',
              })
            );
            return yield* handler.pipe(
              Effect.provideService(HttpServerRequest.HttpServerRequest, request),
              Effect.exit
            );
          })
        );

        assert.isTrue(Exit.isFailure(exit));
        if (Exit.isFailure(exit)) {
          assert.isTrue(Cause.hasInterruptsOnly(exit.cause));
        }
      })
    );
  });
});
