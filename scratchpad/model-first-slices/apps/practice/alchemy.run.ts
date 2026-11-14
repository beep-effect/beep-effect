import * as Docker from "@alchemy.run/docker";
import * as Cluster from "@alchemy.run/effect-cluster";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import PracticeFront from "./generated/Practice.front.ts";

// The conformance stage (D37): Postgres, a swarm pool of two runners hosting every composed
// context, and one front. Deploy with `bun run deploy` (stage mfs-conformance, local state only),
// tear down with `bun run destroy`. Run the CLI on Bun: under Node it fails importing this file.
export default Alchemy.Stack(
  "Practice",
  {
    providers: Layer.mergeAll(Docker.providers(), Cluster.providers()),
    state: Alchemy.localState(),
  },
  Effect.gen(function* () {
    const front = yield* PracticeFront;
    return { front: front.name };
  }),
);
