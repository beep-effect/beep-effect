import { ChatActionError, ChatRpcs } from "@beep/agents-use-cases/public";
import { describe, expect, it } from "@effect/vitest";
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
});
