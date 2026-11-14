/**
 * Live write rehearsal for the Vercel writes the `OipWeb` stack makes (goals/infra-alchemy-rebuild
 * P4, decision `2026-11-14-first-armed-oipweb-deploy-failed-on-a-sensitive-variable-edit`). Test-only,
 * personal stages only: a scratch project `oip-web-rehearsal-<stage>` and three variables shaped like
 * the stack's (an `encrypted` literal, a `sensitive` `valueFrom` secret, and a `plain` literal); the
 * plain and sensitive variables' targets switch to include `preview` with
 * `OIP_WEB_REHEARSAL_PLAIN_PREVIEW` and `OIP_WEB_REHEARSAL_SENSITIVE_PREVIEW`. With `OIP_WEB_REHEARSAL_ADOPT=true` every object is adopted, so a re-deploy
 * after `alchemy state delete OipWebRehearsal/<stage> -r` takes the live stages' path: the project
 * adopted, each variable planned `create` and edited in place. Runbook: docs/runbooks/alchemy-infra.md,
 * "Live write rehearsal".
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as AWS from "@alchemy.run/aws";
import * as Vercel from "@beep/alchemy-vercel";
import * as Alchemy from "alchemy";
import { adopt } from "alchemy/AdoptPolicy";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LiveStage, vercelTeamId } from "../../stack/OipWebConfig.ts";
import { oipWebProviders } from "../../stack/OipWebStack.ts";

const state = AWS.state({
  backend: "s3",
  encryption: { sseAlgorithm: "aws:kms", bucketKeyEnabled: true, blockedEncryptionTypes: ["SSE-C"] },
});

/**
 * The `OipWebRehearsal` stack: never `prod` or `staging`, never an oip.law object.
 *
 * **Example** (Run the rehearsal's first deploy)
 *
 * ```ts
 * import OipWebRehearsal from "./rehearsal.alchemy.run.ts"
 * import * as Effect from "effect/Effect"
 *
 * // bunx alchemy deploy test/live/rehearsal.alchemy.run.ts --stage "dev_$USER" --yes
 * console.log(Effect.isEffect(OipWebRehearsal)) // true
 * ```
 *
 * @category resources
 * @since 0.0.0
 */
export default Alchemy.Stack(
  "OipWebRehearsal",
  { providers: oipWebProviders, state },
  Effect.gen(function* () {
    const stack = yield* Alchemy.Stack;
    if (S.is(LiveStage)(stack.stage)) {
      return yield* Effect.die(`the rehearsal refuses the live stage ${stack.stage}`);
    }
    const adoptExisting = yield* Config.Boolean("OIP_WEB_REHEARSAL_ADOPT").pipe(Config.withDefault(false));
    const adopted = adopt(adoptExisting);
    const plainOnPreview = yield* Config.Boolean("OIP_WEB_REHEARSAL_PLAIN_PREVIEW").pipe(Config.withDefault(false));
    const secretOnPreview = yield* Config.Boolean("OIP_WEB_REHEARSAL_SENSITIVE_PREVIEW").pipe(
      Config.withDefault(false)
    );

    const project = yield* Vercel.Project("Project", {
      name: `oip-web-rehearsal-${Str.replaceAll("_", "-")(Str.toLowerCase(stack.stage))}`,
      teamId: vercelTeamId,
    }).pipe(adopted);
    yield* Vercel.EnvVar("EnvEncrypted", {
      project: project.projectId,
      teamId: vercelTeamId,
      key: "REHEARSAL_ENCRYPTED",
      value: Redacted.make("0"),
      targets: ["production", "preview"],
      type: "encrypted",
    }).pipe(adopted);
    yield* Vercel.EnvVar("EnvSensitive", {
      project: project.projectId,
      teamId: vercelTeamId,
      key: "REHEARSAL_SENSITIVE",
      valueFrom: { config: "OIP_WEB_REHEARSAL_SECRET" },
      targets: secretOnPreview ? ["production", "preview"] : ["production"],
      type: "sensitive",
    }).pipe(adopted);
    yield* Vercel.EnvVar("EnvPlain", {
      project: project.projectId,
      teamId: vercelTeamId,
      key: "REHEARSAL_PLAIN",
      value: Redacted.make("1"),
      targets: plainOnPreview ? ["production", "preview"] : ["production"],
      type: "plain",
    }).pipe(adopted);
    return { projectId: project.projectId };
  })
);
