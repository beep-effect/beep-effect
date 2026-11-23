import * as GitHub from "@alchemy.run/github";
import * as Alchemy from "alchemy";
import { Stage } from "alchemy/Stage";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { state } from "./alchemy.run.ts";
import { productionStage } from "./src/Production.ts";
import { readOnlyGitHubProviders } from "./src/ReadOnlyProviders.ts";
import { secretsProgram } from "./src/Secrets.ts";

const providers = Layer.unwrap(
  Effect.gen(function* () {
    const stage = yield* Stage;
    return stage === productionStage ? Layer.empty : readOnlyGitHubProviders(stage);
  })
).pipe(Layer.provideMerge(GitHub.providers()));

export default Alchemy.Stack("InfraGithubSecrets", { providers, state }, secretsProgram);
