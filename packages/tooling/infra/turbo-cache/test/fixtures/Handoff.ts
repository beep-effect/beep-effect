import { CachePolicy, Principal, Team } from "@beep/infra-turbo-cache/CachePolicy";
import { handoffToken, TokenHandoffOptions } from "@beep/infra-turbo-cache/TokenHandoff";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

// Runs in its own process: the receiver echoes the token to its stdout and
// stderr, and this process must still print nothing.
const token = "test-only-handoff-secret";

const policy = CachePolicy.make({
  teams: [Team.make({ slug: "alpha", principals: [Principal.make({ name: "writer", access: "write", rotation: 1 })] })],
});

const handoff = handoffToken(
  (fqn) =>
    Effect.succeed(
      fqn === "Example"
        ? { attr: { url: "https://cache.example.test" }, status: "updated" }
        : { attr: { text: Redacted.make(token) }, resourceType: "Alchemy.Random", status: "created" }
    ),
  TokenHandoffOptions.make({
    args: ["-e", "process.stdin.on('data', chunk => { process.stdout.write(chunk); process.stderr.write(chunk); });"],
    command: process.execPath,
    policy,
    principal: "writer",
    resourceNamePrefix: "Example",
    team: "alpha",
  })
);

NodeServices.layer.pipe(
  Layer.build,
  Effect.flatMap((context) => Effect.provide(handoff, context)),
  Effect.scoped,
  NodeRuntime.runMain
);
