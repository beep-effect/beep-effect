import { ChatActionError, ChatRpcs, SendMessageRpc } from "@beep/agents-use-cases/public";
import { A, Document, P, RawHtml, Text } from "@beep/md/Md.model";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";
import * as RpcSchema from "effect/unstable/rpc/RpcSchema";

const tags = [
  "ListThreads",
  "CreateThread",
  "GetTimeline",
  "GetTurnRequestStatus",
  "SendMessage",
  "EditMessage",
] as const;

const streaming = new Set(["SendMessage", "EditMessage"]);

describe("@beep/agents-use-cases Chat", () => {
  it("exposes exactly the six chat rpcs", () => {
    expect([...ChatRpcs.requests.keys()].sort()).toEqual([...tags].sort());
  });

  it("flags only SendMessage and EditMessage as streaming", () => {
    for (const tag of tags) {
      const rpc = ChatRpcs.requests.get(tag);
      expect(rpc, `missing rpc ${tag}`).toBeDefined();
      // streaming rpcs wrap their success schema in an RpcSchema.Stream
      expect(RpcSchema.isStreamSchema(rpc!.successSchema), `stream flag for ${tag}`).toBe(streaming.has(tag));
    }
  });

  it("carries the client-safe ChatActionError", () => {
    const error = ChatActionError.make({ message: "thread not found" });
    expect(error._tag).toBe("ChatActionError");
    expect(error.message).toBe("thread not found");
  });

  it("rejects every unsafe user-content class at the send RPC schema boundary", () => {
    const hostileDocuments = [
      Document.make({
        children: [P.make({ children: [RawHtml.make({ value: "<script>alert(1)</script>" })] })],
      }),
      Document.make({
        children: [
          P.make({
            children: [A.make({ href: "http://example.com", children: [Text.make({ value: "insecure" })] })],
          }),
        ],
      }),
      Document.make({
        children: [P.make({ children: [Text.make({ value: "NUL\u0000text" })] })],
      }),
    ];

    const decodeSendMessageRpcPayload = S.decodeResult(SendMessageRpc.payloadSchema);
    for (const content of hostileDocuments) {
      const encodedContent = Result.getOrThrow(Document.encodeResult(content));
      expect(
        Result.isFailure(
          decodeSendMessageRpcPayload({
            threadId: WorkspaceIdentity.ThreadId.make(1),
            content: encodedContent,
            requestId: "hostile-remote-payload",
          })
        )
      ).toBe(true);
    }
  });
});
