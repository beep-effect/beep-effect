/**
 * The review hub in process: the real HTTP server on an ephemeral loopback
 * port, the JSONL stores in a temporary directory, and the kit's MCP client.
 * Every login, item, option and batch here is synthetic.
 */

import { QuestionOption } from "@beep/law-practice-domain/values/Question";
import { ReviewItem } from "@beep/law-practice-domain/values/ReviewItem";
import { makeReviewFilesLayer, ReviewFilesConfig } from "@beep/law-practice-server/ReviewFiles";
import { OpenItems, ReviewHubToolError } from "@beep/law-practice-use-cases/ReviewHub";
import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore";
import { connect, JsonRpcMessage, layerProtocolHttp, McpHttpProtocolOptions, postJsonRpc } from "@beep/mcp-kit/client";
import { it } from "@beep/test-runner";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import { TextContent } from "effect/ai/McpSchema";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeReviewHubLayer, TAILSCALE_LOGIN_HEADER } from "@/runtime/Layer";
import { Platform } from "./Hub.fixture.ts";
import type { CallToolResult } from "effect/ai/McpSchema";

const API_TOKEN = Redacted.make("synthetic-test-token-with-32-characters");
const ATTORNEY = "attorney@example.test";

// The hub on 127.0.0.1 at an ephemeral port, over stores in a fresh temporary directory.
const HubTest = Layer.unwrap(
  Effect.gen(function* () {
    const dataDirectory = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "review-hub-" });
    return HttpRouter.serve(makeReviewHubLayer([ATTORNEY], API_TOKEN), {
      disableListenLog: true,
      disableLogger: true,
    }).pipe(
      Layer.provideMerge(makeReviewFilesLayer(ReviewFilesConfig.make({ dataDirectory }))),
      Layer.provideMerge(BunHttpServer.layer({ hostname: "127.0.0.1", port: 0 }))
    );
  })
).pipe(Layer.provideMerge(Layer.merge(FetchHttpClient.layer, Platform)));

const endpoint = Effect.map(HttpServer.HttpServer, (server) =>
  Match.value(server.address).pipe(
    Match.tag("InetAddressV4", "InetAddressV6", ({ port }) => `http://127.0.0.1:${port}/mcp`),
    Match.orElse(() => "http://127.0.0.1:0/mcp")
  )
);

const connectAs = Effect.fnUntraced(function* (login: string) {
  const options = McpHttpProtocolOptions.make({
    url: yield* endpoint,
    headers: { [TAILSCALE_LOGIN_HEADER]: login, authorization: `Bearer ${Redacted.value(API_TOKEN)}` },
  });
  const build1 = yield* Layer.build(layerProtocolHttp(options));
  return yield* connect.pipe(Effect.provideContext(build1));
});

const decodeOpenItems = S.decodeUnknownEffect(OpenItems);
const decodeToolError = S.decodeUnknownEffect(S.fromJsonString(ReviewHubToolError));

// A failed call's code, read from the JSON of its one text part.
const codeOf = (result: CallToolResult) =>
  Effect.map(
    Effect.flatMap(Effect.fromOption(A.findFirst(result.content, S.is(TextContent))), ({ text }) =>
      decodeToolError(text)
    ),
    ({ code }) => (result.isError === true ? code : "not-an-error")
  );

const question = ReviewItem.cases.question.make({
  itemId: "question:review-hub-1",
  text: "Is the synthetic reply due on December 1?",
  sourceRefs: [],
  facts: [],
  options: [
    QuestionOption.make({ optionId: "due-december-1", label: "Yes, December 1" }),
    QuestionOption.make({ optionId: "not-a-deadline", label: "It is not a deadline" }),
  ],
});

describe("@beep/practice-review-hub", () => {
  it.layer(HubTest, { timeout: "20 seconds" })("in process", (it) => {
    it.effect("answers 403 to a request without a login and to an unknown login", () =>
      Effect.gen(function* () {
        const url = yield* endpoint;
        const message = JsonRpcMessage.make({ id: 1, method: "tools/list", params: {} });
        const missing = yield* postJsonRpc(url, message, {});
        const stranger = yield* postJsonRpc(url, message, { [TAILSCALE_LOGIN_HEADER]: "stranger@example.test" });

        const forged = yield* postJsonRpc(url, message, { [TAILSCALE_LOGIN_HEADER]: ATTORNEY });
        const wrongToken = yield* postJsonRpc(url, message, {
          [TAILSCALE_LOGIN_HEADER]: ATTORNEY,
          authorization: "Bearer wrong-token",
        });
        const sameLengthWrongToken = yield* postJsonRpc(url, message, {
          [TAILSCALE_LOGIN_HEADER]: ATTORNEY,
          authorization: "Bearer synthetic-test-token-with-32-characterx",
        });
        const oversizedToken = yield* postJsonRpc(url, message, {
          [TAILSCALE_LOGIN_HEADER]: ATTORNEY,
          authorization: `Bearer ${Str.repeat(1_025)("x")}`,
        });
        const credentialOnly = yield* postJsonRpc(url, message, {
          authorization: `Bearer ${Redacted.value(API_TOKEN)}`,
        });
        const wrongLogin = yield* postJsonRpc(url, message, {
          [TAILSCALE_LOGIN_HEADER]: "stranger@example.test",
          authorization: `Bearer ${Redacted.value(API_TOKEN)}`,
        });
        expect([
          missing.status,
          stranger.status,
          forged.status,
          wrongToken.status,
          sameLengthWrongToken.status,
          oversizedToken.status,
          credentialOnly.status,
          wrongLogin.status,
        ]).toStrictEqual([403, 403, 403, 403, 403, 403, 403, 403]);
      })
    );

    it.effect("lists both kinds, closes them on a verdict and an answer, and returns the failure codes", () =>
      Effect.gen(function* () {
        const finding = ReviewItem.cases["kg-answer"].make({
          itemId: "kg-answer:review-hub-1",
          text: "The synthetic matter has one pending reply.",
          sourceRefs: [],
        });
        yield* (yield* ReviewItemStore).upsert([finding, question]);
        const { rpc } = yield* connectAs(ATTORNEY);
        const call = (name: string, args: Readonly<Record<string, unknown>>) =>
          rpc["tools/call"]({ name, arguments: args });
        const openItems = Effect.flatMap(call("review_open_items", { today: "2026-10-14" }), (result) =>
          Effect.map(decodeOpenItems(result.structuredContent), ({ items }) => A.map(items, ({ kind }) => kind))
        );

        const tools = yield* rpc["tools/list"]({});
        const before = yield* openItems;
        yield* call("review_record_verdict", {
          itemId: "kg-answer:review-hub-1",
          batchId: "sitting-1",
          verdict: "right",
        });
        const answered = yield* call("review_record_answer", {
          itemId: "question:review-hub-1",
          answer: { state: "decided", itemId: "question:review-hub-1", optionId: "due-december-1" },
        });
        const after = yield* openItems;
        const lock = yield* call("review_lock_batch", { batchId: "sitting-1" });
        const locked = yield* call("review_record_verdict", {
          itemId: "kg-answer:review-hub-1",
          batchId: "sitting-1",
          verdict: "wrong",
        });
        const unknownOption = yield* call("review_record_answer", {
          itemId: "question:review-hub-1",
          answer: { state: "decided", itemId: "question:review-hub-1", optionId: "due-january-5" },
        });

        expect(
          A.map(tools.tools, ({ annotations, name }) => [
            name,
            O.getOrUndefined(O.flatMapNullishOr(O.fromUndefinedOr(annotations), ({ readOnlyHint }) => readOnlyHint)),
          ])
        ).toStrictEqual([
          ["review_open_items", true],
          ["review_record_verdict", false],
          ["review_lock_batch", false],
          ["review_record_answer", false],
        ]);
        expect(before).toStrictEqual(["kg-answer", "question"]);
        expect([answered.isError, lock.isError]).toStrictEqual([false, false]);
        expect(after).toStrictEqual([]);
        const all2 = yield* Effect.all([codeOf(locked), codeOf(unknownOption)]);
        expect(all2).toStrictEqual(["locked", "unknown-option"]);
      })
    );
  });
});
