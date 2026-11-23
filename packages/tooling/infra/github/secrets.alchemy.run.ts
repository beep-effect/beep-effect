import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import { Stage } from "alchemy/Stage";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { state } from "./alchemy.run.ts";
import { productionSecretsConfig, productionStage } from "./src/Production.ts";
import { readOnlyGitHubProviders } from "./src/ReadOnlyProviders.ts";
import { declareSecrets } from "./src/Secrets.ts";

const providers = Layer.unwrap(
  Effect.gen(function* () {
    const stage = yield* Stage;
    return stage === productionStage ? Layer.empty : readOnlyGitHubProviders(stage);
  })
).pipe(Layer.provideMerge(GitHub.providers()));

export const program = Effect.gen(function* () {
  const stack = yield* Alchemy.Stack;
  const ci = yield* Config.option(Config.String("CI"));
  if (O.isSome(ci) && ci.value !== "") {
    return yield* Effect.die("InfraGithubSecrets deploys from a workstation under op run, never from CI.");
  }
  if (stack.stage === productionStage) {
    yield* Config.Literal("workstation", "INFRA_GITHUB_SECRETS_PLANE");
  } else {
    yield* Config.Literal("plan-only", "INFRA_GITHUB_LIVE_PREVIEW");
  }
  const entries = yield* Effect.forEach(
    productionSecretsConfig.secrets,
    Effect.fnUntraced(function* (spec) {
      const value = yield* Config.Redacted(spec.name);
      return [spec.name, value] as const;
    }),
    { concurrency: 1 }
  );
  const values = HashMap.fromIterable(entries);
  return yield* declareSecrets(productionSecretsConfig, (spec) => O.getOrThrow(HashMap.get(values, spec.name)));
}).pipe(Effect.orDie);

export default Alchemy.Stack("InfraGithubSecrets", { providers, state }, program);
