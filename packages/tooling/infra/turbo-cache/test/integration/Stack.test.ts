import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Test from "@alchemy.run/test/Vitest";
import { expect } from "@effect/vitest";
import { inMemoryState } from "alchemy/State";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import { program } from "../../alchemy.run.ts";
import type * as Core from "@alchemy.run/test/Core";
import type { Input } from "alchemy/Input";
import type { StackServices } from "alchemy/Stack";

/** The failures Alchemy declares for a stack deployment. */
type DeployError = Effect.Error<Core.DeployResult<unknown>>;

/**
 * `ScratchStack.deploy` erases its error channel to `any`; this restates the
 * deployment failures plus the program's own, so no erased channel reaches
 * the test.
 */
type ScratchDeploy = <A, E, R>(
  definition: Effect.Effect<A, E, R>
) => Effect.Effect<Input.Resolve<A>, DeployError | E, Exclude<R, StackServices>>;

const deployerOf = (stack: Test.ScratchStack): ScratchDeploy => stack.deploy;

// The real stack, deployed through local providers (workerd and a local R2
// bucket) into in-memory state: no credentials, no cloud account.
const { test } = Test.make({
  dev: true,
  providers: Cloudflare.providers(),
  sidecar: false,
  stage: `turbo_cache_stack_${process.pid}`,
  state: inMemoryState(),
});

test.provider(
  "the TurboCache stack deploys the cache Worker for the beep team and refuses anonymous requests",
  (stack) =>
    Effect.gen(function* () {
      const output = yield* deployerOf(stack)(program);
      expect(output.teams).toEqual(["beep"]);
      const origin = new URL(output.url);

      const status = yield* HttpClient.execute(
        HttpClientRequest.get(new URL("/v8/artifacts/status?slug=beep", origin))
      );
      expect(status.status).toBe(401);
      const unknown = yield* HttpClient.execute(HttpClientRequest.get(new URL("/", origin)));
      expect(unknown.status).toBe(404);
    }),
  { timeout: 180_000 }
);
