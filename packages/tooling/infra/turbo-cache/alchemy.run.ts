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
 *
 * **Details**
 *
 * Every `prod` deploy runs in CI under the `alchemy-turbo-cache-prod`
 * concurrency group, with the S3 store's stage lease as the second guard; a
 * local `prod` plan or deploy fails with a ConfigError on `CI`.
 * `TURBO_CACHE_ALERT_EMAIL` (comma separated; in CI the `turbo-cache-prod`
 * environment secret) adds a notification policy that mails Cloudflare's
 * Workers Observability real-time issue when the Worker errors. It succeeds
 * the AWS cache's Lambda throttle alarm (D7): a Worker has no reserved
 * concurrency to exhaust, so an erroring Worker is the failure that turns into
 * silent cache misses. Unset, the stack declares no notification policy.
 */
export const program = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  if (stack.stage === productionStage) {
    yield* Config.Literal("true", "CI");
  }
  const worker = yield* CacheWorker;

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
