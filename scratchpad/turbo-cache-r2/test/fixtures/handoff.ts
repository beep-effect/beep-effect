import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { handoffToken } from "../../token.js";

const token = "test-only-handoff-secret";

const handoff = handoffToken(
  (fqn) =>
    Effect.succeed(
      fqn === "Example"
        ? { attr: { url: "https://cache.example.test" }, status: "updated" }
        : {
            attr: { text: Redacted.make(token) },
            resourceType: "Alchemy.Random",
            status: "created",
          },
    ),
  {
    args: [
      "-e",
      "process.stdin.on('data', chunk => { process.stdout.write(chunk); process.stderr.write(chunk); });",
    ],
    command: process.execPath,
    resourceNamePrefix: "Example",
    team: "alpha",
    teams: ["alpha"],
  },
);

NodeServices.layer.pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(handoff, context)),
  Effect.scoped,
  NodeRuntime.runMain,
);
