import * as Cloudflare from "@alchemy.run/cloudflare";
import { Random } from "alchemy";
import * as Namespace from "alchemy/Namespace";
import { retain } from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";
import { Effect } from "effect";
import { identity } from "effect/Function";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";

import type { TurboCacheOptions } from "./config.js";
import { foundationId, tokenId, workerId } from "./config.js";
import { bindReadWriteBucket } from "./bucket.js";
import { artifactHandler } from "./protocol.js";

export type { TurboCacheOptions } from "./config.js";

export const turboCache = (options: TurboCacheOptions) => {
  const retainInStage =
    globalThis.__ALCHEMY_RUNTIME__ === true
      ? identity
      : retain(
          Stage.pipe(Effect.map((stage) => (options.retainStages ?? ["prod"]).includes(stage))),
        );

  const bucket = Cloudflare.R2.Bucket(`${options.resourceNamePrefix}Bucket`, {
    lifecycleRules: [
      {
        deleteObjectsTransition: {
          condition: { maxAge: options.retentionDays * 86_400, type: "Age" },
        },
        enabled: true,
        id: "expire-artifacts",
        prefix: "",
      },
    ],
  }).pipe(retainInStage, Namespace.set(foundationId(options)));

  const implementation = Effect.gen(function* makeCache() {
    const resource = yield* bucket;
    const bind = yield* bindReadWriteBucket;
    const storage = yield* bind(resource);
    const credentials = yield* Effect.forEach(options.teams, team => Effect.gen(function* resolveCredential() {
    const secret = yield* Random(tokenId(options, team)).pipe(retainInStage, Namespace.set(foundationId(options)));
    const token = yield* secret.text;
    return { team, token };
}));
    const handle = artifactHandler({ bucket: storage, credentials });
    return {
      fetch: Effect.gen(function* fetchArtifact() {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const web = yield* HttpServerRequest.toWeb(request);
        const response = yield* handle(web).pipe(Effect.orDie);
        return HttpServerResponse.fromWeb(response);
      }).pipe(Effect.orDie),
    };
  });

  return Cloudflare.Worker(
    workerId(options),
    {
      compatibility: { date: "2026-05-28", flags: ["nodejs_compat"] },
      dev: { port: 0 },
      main: options.main,
      workersDev: true,
    },
    implementation,
  ).pipe(retainInStage);
};
