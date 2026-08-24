import { PgliteTestLayer } from "@beep/pglite";
import { makeDrizzleLayer } from "@beep/postgres";
import { assert, describe, it } from "@effect/vitest";
import { Cause, Effect, Exit, Layer, Redacted } from "effect";
import * as O from "effect/Option";
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { ArticleRepository } from "../../Repository/Article.ts";
import { ClaimRepository } from "../../Repository/Claim.ts";
import { ConflictRepository } from "../../Repository/Conflict.ts";
import { AuthRouter } from "../../Runtime/AuthRouter.ts";
import { CurrentConflictActor, makeAuthMiddleware } from "../../Runtime/HttpMiddleware.ts";
import { TimelineRouter } from "../../Runtime/HttpServer.ts";
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

const InterruptedAuthDependencies = Layer.merge(InterruptedTicketService, AuthConfig);

const AnonymousAuthConfig = Layer.succeed(ConfigService, {
  ...DEFAULT_CONFIG,
  api: {
    ...DEFAULT_CONFIG.api,
    requireAuth: false,
  },
});

const DatabaseTestLayer = makeDrizzleLayer().pipe(Layer.provideMerge(PgliteTestLayer));
const RepositoryTestLayer = Layer.mergeAll(
  ArticleRepository.Default,
  ClaimRepository.Default,
  ConflictRepository.Default
).pipe(Layer.provideMerge(DatabaseTestLayer));
const TimelineTestLayer = TimelineRouter.pipe(Layer.provideMerge(RepositoryTestLayer));

describe("AuthRouter", () => {
  it("requires authentication by default", () => {
    assert.isTrue(DEFAULT_CONFIG.api.requireAuth);
  });

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

  it.layer(AnonymousAuthConfig)("with API authentication explicitly disabled", (it) => {
    it.effect(
      "does not grant system conflict authority",
      Effect.fnUntraced(function* () {
        const middleware = yield* makeAuthMiddleware;
        const request = HttpServerRequest.fromWeb(new Request("http://effect-ontology.test/health"));
        const response = yield* middleware(
          Effect.gen(function* () {
            const actor = yield* CurrentConflictActor;
            return HttpServerResponse.text(actor.principal);
          })
        ).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request));
        const principal = yield* Effect.tryPromise(() => HttpServerResponse.toWeb(response).text());

        assert.strictEqual(principal, "anonymous");
      })
    );

    it.effect(
      "rejects anonymous conflict list and transition requests",
      Effect.fnUntraced(function* () {
        const middleware = yield* makeAuthMiddleware;

        return yield* Effect.acquireUseRelease(
          Effect.sync(() =>
            HttpRouter.toWebHandler(TimelineTestLayer, {
              disableLogger: true,
              middleware,
            })
          ),
          Effect.fnUntraced(function* (webHandler) {
            const listResponse = yield* Effect.tryPromise(() =>
              webHandler.handler(
                new Request("http://effect-ontology.test/v1/timeline/conflicts?ontologyId=ontology-a")
              )
            );
            const transitionResponse = yield* Effect.tryPromise(() =>
              webHandler.handler(
                new Request(
                  "http://effect-ontology.test/v1/timeline/conflicts/00000000-0000-4000-8000-000000000001?ontologyId=ontology-a",
                  { method: "PATCH" }
                )
              )
            );

            assert.strictEqual(listResponse.status, 401);
            assert.strictEqual(transitionResponse.status, 401);
          }),
          (webHandler) => Effect.promise(webHandler.dispose)
        );
      })
    );
  });
});
