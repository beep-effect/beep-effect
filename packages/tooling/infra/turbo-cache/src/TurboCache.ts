/**
 * The cache as Alchemy resources: an R2 bucket that expires artifacts, one
 * generated token per policy principal, and the Worker that serves the
 * Turborepo protocol over the bucket.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Cloudflare from "@alchemy.run/cloudflare";
import { $InfraTurboCacheId } from "@beep/identity/packages";
import { Random } from "alchemy";
import * as Namespace from "alchemy/Namespace";
import { retain } from "alchemy/RemovalPolicy";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import { dual, identity } from "effect/Function";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { bindReadWriteBucket } from "./Bucket.ts";
import { CachePolicy, tokenHolders } from "./CachePolicy.ts";
import { artifactHandler, Credential } from "./Protocol.ts";
import type { PrincipalName, TeamSlug } from "./CachePolicy.ts";

const $I = $InfraTurboCacheId.create("TurboCache");

/**
 * The stage that owns the long-lived cache. Its physical names are pinned and
 * its bucket and tokens survive a stack destroy.
 *
 * **Example** (Compare against the production stage)
 *
 * ```ts
 * import { productionStage } from "@beep/infra-turbo-cache/TurboCache"
 *
 * console.log(productionStage) // "prod"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const productionStage = "prod";

/**
 * Physical names of the `prod` resources.
 *
 * **Details**
 *
 * Alchemy otherwise derives a name from an instance id it keeps in state, so a
 * stage whose state is lost or moved mints a new bucket and a new Worker URL
 * (PR #3133). Pinned names make a `prod` deploy find these resources whatever
 * the state holds. Both are new (D12): neither the AWS cache nor the R2 pilot
 * (`beep-turbo-r2-pilot`) is touched.
 *
 * **Example** (Read the production Worker name)
 *
 * ```ts
 * import { productionNames } from "@beep/infra-turbo-cache/TurboCache"
 *
 * console.log(productionNames.worker) // "beep-turbo-cache"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const productionNames = { bucket: "beep-turbo-cache", worker: "beep-turbo-cache" } as const;

/**
 * How one cache deployment is shaped: the logical id prefix of every
 * resource (part of each state key), the policy, the days an artifact lives
 * before R2 expires it, and `main`, the `import.meta.url` of the module whose
 * default export is the Worker.
 *
 * **Example** (Refuse a zero-day retention)
 *
 * ```ts
 * import { TurboCacheOptions } from "@beep/infra-turbo-cache/TurboCache"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TurboCacheOptions.fields.retentionDays)(0)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TurboCacheOptions extends S.Opaque<TurboCacheOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    resourceNamePrefix: S.NonEmptyString,
    policy: CachePolicy,
    retentionDays: S.Int.check(S.isGreaterThanOrEqualTo(1)),
    main: S.NonEmptyString,
  }).pipe($I.annoteSchema("TurboCacheOptions", { description: "How one cache deployment is shaped." }))
) {}

type TokenHolder = {
  readonly team: TeamSlug;
  readonly principal: { readonly name: PrincipalName; readonly rotation: number };
};

/**
 * Logical id of the namespace that groups the bucket and the tokens.
 *
 * **Example** (Derive the foundation id)
 *
 * ```ts
 * import { foundationId } from "@beep/infra-turbo-cache/TurboCache"
 *
 * console.log(foundationId({ resourceNamePrefix: "TurboCache" })) // "TurboCacheFoundation"
 * ```
 *
 * @param options - Supplies the resource id prefix.
 * @returns The namespace's logical id.
 *
 * @category utilities
 * @since 0.0.0
 */
export const foundationId = (options: Pick<TurboCacheOptions, "resourceNamePrefix">): string =>
  `${options.resourceNamePrefix}Foundation`;

/**
 * Logical id of one principal's token. The rotation number is part of it, so
 * raising a principal's rotation replaces exactly that token.
 *
 * **Example** (Derive a token id)
 *
 * ```ts
 * import { tokenId } from "@beep/infra-turbo-cache/TurboCache"
 *
 * const holder = { team: "beep", principal: { name: "ci-main", rotation: 1 } }
 * console.log(tokenId({ resourceNamePrefix: "TurboCache" }, holder)) // "TurboCacheToken-beep-ci-main-r1"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const tokenId: {
  (holder: TokenHolder): (options: Pick<TurboCacheOptions, "resourceNamePrefix">) => string;
  (options: Pick<TurboCacheOptions, "resourceNamePrefix">, holder: TokenHolder): string;
} = dual(
  2,
  (options: Pick<TurboCacheOptions, "resourceNamePrefix">, { team, principal }: TokenHolder): string =>
    `${options.resourceNamePrefix}Token-${team}-${principal.name}-r${principal.rotation}`
);

/**
 * Logical id of the Worker.
 *
 * **Example** (Derive the Worker id)
 *
 * ```ts
 * import { workerId } from "@beep/infra-turbo-cache/TurboCache"
 *
 * console.log(workerId({ resourceNamePrefix: "TurboCache" })) // "TurboCache"
 * ```
 *
 * @param options - Supplies the resource id prefix.
 * @returns The Worker's logical id.
 *
 * @category utilities
 * @since 0.0.0
 */
export const workerId = (options: Pick<TurboCacheOptions, "resourceNamePrefix">): string => options.resourceNamePrefix;

/**
 * Declare the cache: bucket, tokens and Worker.
 *
 * **Details**
 *
 * The module that calls this must default-export the result and pass its own
 * `import.meta.url` as `main`: Alchemy bundles that module as the Worker and
 * runs the implementation there. Stage-dependent choices (pinned names,
 * `retain`) are made only at deploy time; the bundled runtime never reads the
 * stage.
 *
 * **Example** (Declare a cache Worker module)
 *
 * ```ts
 * import { CachePolicy } from "@beep/infra-turbo-cache/CachePolicy"
 * import { TurboCacheOptions, turboCache } from "@beep/infra-turbo-cache/TurboCache"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownSync(CachePolicy)({
 *   teams: [{ slug: "beep", principals: [{ name: "ci-main", access: "write", rotation: 1 }] }],
 * })
 *
 * export default turboCache(
 *   TurboCacheOptions.make({ main: import.meta.url, policy, resourceNamePrefix: "TurboCache", retentionDays: 7 })
 * )
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const turboCache = Effect.fn("TurboCache.turboCache")(function* (options: TurboCacheOptions) {
  const deployTime = globalThis.__ALCHEMY_RUNTIME__ !== true;
  // The bundled runtime has no `Stage` service; reading it optionally keeps
  // every stage-dependent choice a deploy-time one.
  const isProduction = Effect.serviceOption(Stage).pipe(Effect.map(O.exists((stage) => stage === productionStage)));
  const retainInProduction = deployTime ? retain(isProduction) : identity;

  const lifecycleRules = [
    {
      deleteObjectsTransition: { condition: { maxAge: options.retentionDays * 86_400, type: "Age" as const } },
      enabled: true,
      id: "expire-artifacts",
      prefix: "",
    },
  ];

  const bucket = Cloudflare.R2.Bucket(
    `${options.resourceNamePrefix}Bucket`,
    isProduction.pipe(
      Effect.map((production) => (production ? { name: productionNames.bucket, lifecycleRules } : { lifecycleRules }))
    )
  ).pipe(retainInProduction, Namespace.set(foundationId(options)));

  const implementation = Effect.gen(function* () {
    const resource = yield* bucket;
    const bind = yield* bindReadWriteBucket;
    const storage = yield* bind(resource);
    const credentials = yield* Effect.forEach(
      tokenHolders(options.policy),
      Effect.fnUntraced(function* ({ team, principal }) {
        const secret = yield* Random(tokenId(options, { team, principal })).pipe(
          retainInProduction,
          Namespace.set(foundationId(options))
        );
        // `text` resolves to the runtime accessor of the bound Worker secret.
        const token = yield* secret.text;
        return Credential.make({ team, principal: principal.name, access: principal.access, token });
      })
    );
    const handle = artifactHandler({ bucket: storage, credentials });
    return {
      fetch: Effect.gen(function* () {
        const request = yield* HttpServerRequest.HttpServerRequest;
        const web = yield* HttpServerRequest.toWeb(request);
        const response = yield* handle(web);
        return HttpServerResponse.fromWeb(response);
      }).pipe(Effect.orDie),
    };
  });

  const baseProps = {
    compatibility: { date: "2026-05-28", flags: ["nodejs_compat"] },
    dev: { port: 0 },
    main: options.main,
    // Workers Logs feed the `workers_observability_real_time_issue` alert the
    // stack wires to a notification policy (the throttle alarm's successor).
    observability: { enabled: true },
    workersDev: true,
  };

  return yield* Cloudflare.Worker(
    workerId(options),
    isProduction.pipe(
      Effect.map((production) => (production ? { ...baseProps, name: productionNames.worker } : baseProps))
    ),
    implementation
  ).pipe(retainInProduction);
});
