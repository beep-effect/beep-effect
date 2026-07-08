/**
 * Graphiti proxy runtime.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as BunHttpClient from "@effect/platform-bun/BunHttpClient";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { Console, Deferred, Effect, Fiber, Layer, Ref } from "effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import { loadGraphitiProxyConfig } from "./ProxyConfig.js";
import { makeGraphitiDependencyHealthService } from "./ProxyDependencyHealth.js";
import { makeGraphitiProxyForwarderService } from "./ProxyForwarder.js";
import { makeGraphitiProxyQueueService } from "./ProxyQueue.js";
import { proxyHealthResponse } from "./ProxyResponses.js";
import { ProxyHealthPayload } from "./ProxySchemas.js";
import {
  GraphitiDependencyHealthService,
  GraphitiProxyForwarderService,
  GraphitiProxyQueueService,
} from "./ProxyServices.js";
import type { DependencyHealthSnapshot } from "./ProxySchemas.js";

const toHealthStatus = (snapshot: DependencyHealthSnapshot): "ok" | "degraded" =>
  snapshot.status === "ok" ? "ok" : "degraded";

/**
 * Run the graphiti queue proxy runtime with graceful shutdown.
 *
 * @example
 * ```ts
 * console.log("runGraphitiProxy")
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const runGraphitiProxy = Effect.scoped(
  Effect.gen(function* () {
    const config = yield* loadGraphitiProxyConfig;
    const dependencyHealthService = yield* makeGraphitiDependencyHealthService(config);
    const forwarderService = makeGraphitiProxyForwarderService(config);
    const httpClientContext = yield* Layer.build(BunHttpClient.layer);
    const queueService = yield* makeGraphitiProxyQueueService(config, forwarderService).pipe(
      Effect.provide(httpClientContext)
    );

    const logger = {
      info: (message: string) => Console.log(`[graphiti-proxy] ${message}`),
      error: (message: string) => Console.error(`[graphiti-proxy:error] ${message}`),
      debug: (message: string) =>
        Console.log(`[graphiti-proxy:debug] ${message}`).pipe(
          Effect.when(Effect.succeed(config.verbose)),
          Effect.asVoid
        ),
    };

    const healthHandler = Effect.gen(function* () {
      const queueStats = yield* queueService.snapshot;
      const dependencySnapshot = yield* dependencyHealthService.snapshot;
      const status = toHealthStatus(dependencySnapshot);
      const statusCode = status === "ok" ? 200 : 503;

      return proxyHealthResponse(
        ProxyHealthPayload.make({
          status,
          active: queueStats.active,
          queued: queueStats.queued,
          peakQueueDepth: queueStats.peakQueueDepth,
          processed: queueStats.processed,
          failed: queueStats.failed,
          rejected: queueStats.rejected,
          concurrency: queueStats.concurrency,
          maxQueue: queueStats.maxQueue,
          upstream: queueStats.upstream,
          dependencies: dependencySnapshot.details,
        }),
        statusCode
      );
    });

    const routesLayer = HttpRouter.use(
      Effect.fn(function* (router) {
        yield* router.add("GET", "/healthz", healthHandler);
        yield* router.add("GET", "/metrics", healthHandler);
        yield* router.add("*", "*", (request) => queueService.enqueue(request));
      })
    );

    const serverLayer = HttpRouter.serve(routesLayer, {
      disableLogger: true,
      disableListenLog: true,
    }).pipe(
      Layer.provideMerge(
        BunHttpServer.layer({
          hostname: config.listenHost,
          idleTimeout: config.serverIdleTimeoutSeconds,
          port: config.listenPort,
        })
      ),
      Layer.provideMerge(BunHttpClient.layer),
      Layer.provideMerge(Layer.succeed(GraphitiDependencyHealthService)(dependencyHealthService)),
      Layer.provideMerge(Layer.succeed(GraphitiProxyForwarderService)(forwarderService)),
      Layer.provideMerge(Layer.succeed(GraphitiProxyQueueService)(queueService))
    );

    const shutdownRequestedRef = yield* Ref.make(false);
    const shutdownDeferred = yield* Deferred.make<void>();

    const requestShutdown = Effect.gen(function* () {
      const alreadyRequested = yield* Ref.getAndSet(shutdownRequestedRef, true);
      if (alreadyRequested) {
        return;
      }

      yield* logger.info("shutdown requested; draining queue");
      yield* queueService.beginShutdown;
      const drained = yield* queueService.awaitDrain(config.shutdownDrainTimeoutMs);

      if (drained) {
        yield* logger.info("drain complete");
      } else {
        yield* logger.error(`drain timed out after ${config.shutdownDrainTimeoutMs}ms; forcing server stop`);
      }

      yield* Deferred.succeed(shutdownDeferred, undefined).pipe(Effect.ignore);
    });
    const services = yield* Effect.context<never>();
    const runRequestShutdown = Effect.runForkWith(services);

    yield* Effect.acquireRelease(
      Effect.sync(() => {
        const handleSignal = () => {
          void runRequestShutdown(requestShutdown);
        };

        process.on("SIGINT", handleSignal);
        process.on("SIGTERM", handleSignal);

        return handleSignal;
      }),
      (handleSignal) =>
        Effect.sync(() => {
          process.off("SIGINT", handleSignal);
          process.off("SIGTERM", handleSignal);
        })
    );

    const serverFiber = yield* Layer.launch(serverLayer).pipe(Effect.forkScoped);

    yield* logger.info(`listening on http://${config.listenHost}:${config.listenPort}`);
    yield* logger.info(`forwarding to ${config.upstream}`);
    yield* logger.info(
      `queue settings concurrency=${config.concurrency} maxQueue=${config.maxQueue} timeoutMs=${config.requestTimeoutMs}`
    );
    yield* logger.info(`server idle timeout=${config.serverIdleTimeoutSeconds}s`);
    yield* logger.info(`shutdown drain timeout=${config.shutdownDrainTimeoutMs}ms`);
    yield* logger.info("health endpoints: /healthz, /metrics");
    yield* logger.debug("server launched");

    yield* Effect.raceFirst(Deferred.await(shutdownDeferred), Fiber.await(serverFiber).pipe(Effect.asVoid));

    yield* Fiber.interrupt(serverFiber);
  })
);
