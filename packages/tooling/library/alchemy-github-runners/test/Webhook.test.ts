import {
  canRunJob,
  handleWebhook,
  PoolMatcher,
  selectPool,
  verifySignature,
  WebhookRequest,
  WebhookRuntimeConfig,
} from "@beep/alchemy-github-runners";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import { World, worldContext } from "./support/FakeWorld.ts";

const secret = Redacted.make("webhook-secret");

const sign = Effect.fn("sign")(function* (body: string) {
  const key = yield* Effect.promise(() =>
    crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(Redacted.value(secret)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    )
  );
  const mac = yield* Effect.promise(() => crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  return `sha256=${Hex.encode(new Uint8Array(mac))}`;
});

const heavy = PoolMatcher.make({
  pool: "heavy",
  queueUrl: "https://sqs/heavy",
  labels: ["beep-ec2-heavy"],
  labelMatch: "bidirectional",
});
const overflow = PoolMatcher.make({
  pool: "overflow",
  queueUrl: "https://sqs/overflow",
  labels: ["beep-shard-overflow"],
  labelMatch: "bidirectional",
});
const loose = PoolMatcher.make({
  pool: "loose",
  queueUrl: "https://sqs/loose",
  labels: ["linux", "x64"],
  labelMatch: "any",
});

const config = WebhookRuntimeConfig.make({
  webhookSecretParameterName: "/beep-ci/app/github_app_webhook_secret",
  repositoryAllowList: ["beep-effect/beep-effect"],
  pools: [heavy, overflow],
});

const decodeSent = S.decodeUnknownEffect(
  S.fromJsonString(S.Struct({ id: S.Int, installationId: S.Int, queueId: S.String }))
);

const encodePayload = S.encodeEffect(S.fromJsonString(S.Unknown));

const payload = (input: {
  readonly action?: string;
  readonly labels?: ReadonlyArray<string>;
  readonly repo?: string;
}) =>
  encodePayload({
    action: input.action ?? "queued",
    workflow_job: { id: 11, run_id: 5, name: "check", labels: input.labels ?? ["beep-ec2-heavy"] },
    repository: {
      name: "beep-effect",
      full_name: input.repo ?? "beep-effect/beep-effect",
      owner: { login: "beep-effect", type: "Organization" },
    },
    installation: { id: 42 },
  });

const deliver = Effect.fn("deliver")(function* (
  world: World,
  payloadOrBody: Effect.Effect<string, S.SchemaError> | string,
  headers: Record<string, string> = {}
) {
  const body = typeof payloadOrBody === "string" ? payloadOrBody : yield* payloadOrBody;
  const signature = yield* sign(body);
  return yield* handleWebhook({
    config,
    secret,
    request: WebhookRequest.make({
      headers: { "x-github-event": "workflow_job", "x-hub-signature-256": signature, ...headers },
      body,
    }),
  }).pipe(Effect.provideContext(worldContext(world)));
});

describe("verifySignature", () => {
  it.effect("accepts GitHub's HMAC-SHA256 signature over the raw body", () =>
    Effect.gen(function* () {
      const signature = yield* sign("{}");
      yield* verifySignature({ secret, body: "{}", signature: O.some(signature) });
    })
  );

  it.effect("rejects a tampered body, a wrong signature and a missing header with 401", () =>
    Effect.gen(function* () {
      const signature = yield* sign("{}");
      const tampered = yield* Effect.flip(verifySignature({ secret, body: "{ }", signature: O.some(signature) }));
      const missing = yield* Effect.flip(verifySignature({ secret, body: "{}", signature: O.none() }));
      const garbage = yield* Effect.flip(verifySignature({ secret, body: "{}", signature: O.some("sha256=00") }));
      expect([tampered.statusCode, missing.statusCode, garbage.statusCode]).toStrictEqual([401, 401, 401]);
    })
  );
});

describe("canRunJob", () => {
  it("matches bidirectionally only on equal label sets, case-insensitively", () => {
    expect(canRunJob({ jobLabels: ["BEEP-EC2-HEAVY"], poolLabels: ["beep-ec2-heavy"], mode: "bidirectional" })).toBe(
      true
    );
    expect(
      canRunJob({ jobLabels: ["beep-ec2-heavy", "x64"], poolLabels: ["beep-ec2-heavy"], mode: "bidirectional" })
    ).toBe(false);
    expect(canRunJob({ jobLabels: [], poolLabels: ["beep-ec2-heavy"], mode: "bidirectional" })).toBe(false);
  });

  it("matches all-of and any-of modes with upstream's empty-label inversion", () => {
    expect(canRunJob({ jobLabels: ["linux"], poolLabels: ["linux", "x64"], mode: "all" })).toBe(true);
    expect(canRunJob({ jobLabels: ["linux", "gpu"], poolLabels: ["linux", "x64"], mode: "all" })).toBe(false);
    expect(canRunJob({ jobLabels: ["gpu", "x64"], poolLabels: ["linux", "x64"], mode: "any" })).toBe(true);
    expect(canRunJob({ jobLabels: [], poolLabels: ["linux"], mode: "any" })).toBe(true);
  });
});

describe("selectPool", () => {
  it("routes each label to its own pool and tries strict pools before loose ones", () => {
    assertSome(
      O.map(selectPool({ pools: [heavy, overflow], jobLabels: ["beep-shard-overflow"] }), (pool) => pool.pool),
      "overflow"
    );
    assertSome(
      O.map(selectPool({ pools: [loose, heavy], jobLabels: ["beep-ec2-heavy"] }), (pool) => pool.pool),
      "heavy"
    );
    assertNone(selectPool({ pools: [heavy, overflow], jobLabels: ["ubuntu-latest"] }));
  });
});

describe("handleWebhook", () => {
  it.effect("enqueues a queued job on the matching pool's build queue", () =>
    Effect.gen(function* () {
      const world = new World();
      const response = yield* deliver(world, payload({ labels: ["beep-shard-overflow"] }));
      expect(response.statusCode).toBe(201);
      expect(A.map(world.sent, ({ queueUrl }) => queueUrl)).toStrictEqual(["https://sqs/overflow"]);
      const sent = yield* decodeSent(world.sent[0]?.body);
      expect(sent).toStrictEqual({ id: 11, installationId: 42, queueId: "https://sqs/overflow" });
    })
  );

  it.effect("answers without dispatching for other actions, unknown labels, foreign repositories and events", () =>
    Effect.gen(function* () {
      const world = new World();
      const completed = yield* deliver(world, payload({ action: "completed" }));
      const unmatched = yield* deliver(world, payload({ labels: ["ubuntu-latest"] }));
      const foreign = yield* deliver(world, payload({ repo: "someone/else" }));
      const ping = yield* deliver(world, "{}", { "x-github-event": "ping" });
      const malformed = yield* deliver(world, "not json");
      expect([
        completed.statusCode,
        unmatched.statusCode,
        foreign.statusCode,
        ping.statusCode,
        malformed.statusCode,
      ]).toStrictEqual([201, 202, 403, 202, 400]);
      expect(world.sent).toStrictEqual([]);
    })
  );

  it.effect("rejects a bad signature before reading the payload", () =>
    Effect.gen(function* () {
      const world = new World();
      const response = yield* handleWebhook({
        config,
        secret,
        request: WebhookRequest.make({
          headers: { "x-github-event": "workflow_job", "x-hub-signature-256": "sha256=deadbeef" },
          body: yield* payload({}),
        }),
      }).pipe(Effect.provideContext(worldContext(world)));
      expect(response.statusCode).toBe(401);
      expect(world.sent).toStrictEqual([]);
    })
  );
});
