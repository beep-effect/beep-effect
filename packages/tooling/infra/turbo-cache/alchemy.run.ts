import * as AWS from "@alchemy.run/aws";
import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { productionStage } from "./src/TurboCache.ts";
import CacheWorker, { cachePolicy } from "./src/Worker.ts";

/**
 * The shared Alchemy state store (goals/infra-alchemy-rebuild, D6 and D17):
 * one account-regional S3 bucket, `alchemy-state-<accountId>-<region>-an`,
 * SSE-KMS with the AWS-managed S3 key, bucket keys on, customer-provided keys
 * blocked. Account, region and credentials come from the process
 * environment: exported from aws-vault on a workstation, set by the GitHub
 * OIDC state role in CI. Runbook: docs/runbooks/alchemy-infra.md.
 */
export const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * Recipients of the Worker error alert, comma separated. Unset means no
 * notification policy, the same opt-in the AWS cache's throttle alarm had.
 * In CI it is the `turbo-cache-prod` environment secret
 * `TURBO_CACHE_ALERT_EMAIL`.
 */
const alertRecipients = Config.String("TURBO_CACHE_ALERT_EMAIL").pipe(
  Config.option,
  Config.map((value) =>
    O.match(value, {
      onNone: A.empty<string>,
      onSome: (raw) => A.filter(A.map(Str.split(raw, ","), Str.trim), Str.isNonEmpty),
    })
  )
);

/**
 * The stack's program, exported so tests deploy it into in-memory state.
 */
export const program = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  // Every `prod` deploy runs in CI under the `alchemy-turbo-cache-prod`
  // concurrency group; the S3 store's stage lease is the second guard. A
  // local `prod` plan/deploy fails here with a ConfigError on `CI`.
  if (stack.stage === productionStage) {
    yield* Config.Literal("true", "CI");
  }
  const worker = yield* CacheWorker;

  // The successor of the AWS cache's Lambda throttle alarm (D7): Workers have
  // no reserved concurrency to exhaust, so the failure that turns into silent
  // cache misses is the Worker erroring. Cloudflare's Workers Observability
  // raises a real-time issue for that; this policy mails it.
  const recipients = yield* alertRecipients;
  if (A.isReadonlyArrayNonEmpty(recipients)) {
    yield* Cloudflare.Alerting.NotificationPolicy("TurboCacheErrors", {
      alertType: "workers_observability_real_time_issue",
      description: "The Turborepo cache Worker is failing requests; CI and workstations fall back to local cache.",
      mechanisms: { email: A.map(recipients, (id) => ({ id })) },
    });
  }

  return {
    url: worker.url.as<string>(),
    teams: A.map(cachePolicy.teams, ({ slug }) => slug),
  };
});

export default Alchemy.Stack(
  "TurboCache",
  {
    providers: Cloudflare.providers(),
    state,
  },
  program
);
