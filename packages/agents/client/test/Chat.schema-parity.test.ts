import {
  CreateThreadAtomInput,
  EditTarget,
  EditTurnRequest,
  SendTurnRequest,
  StreamingTurn,
  TurnRequest,
} from "@beep/agents-client";
import { ParagraphBlock, TextInline } from "@beep/agents-domain/values/AssistantContent";
import { Document, P, Text } from "@beep/md/Md.model";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const userDocument = (value: string): Document =>
  Document.make({ children: [P.make({ children: [Text.make({ value })] })] });

const assistantBlock = ParagraphBlock.make({
  children: [TextInline.make({ text: "Streaming response" })],
});

const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

describe("@beep/agents-client schema parity", () => {
  it("keeps client atom payload encoded shapes stable", () => {
    const workspaceId = WorkspaceIdentity.WorkspaceId.make(7);
    const threadId = WorkspaceIdentity.ThreadId.make(10);
    const turnId = WorkspaceIdentity.TurnId.make(20);
    const content = userDocument("Explain atoms");
    const encodedContent = Result.getOrThrow(S.encodeResult(Document)(content));
    const block = assistantBlock;
    const encodedBlock = Result.getOrThrow(S.encodeResult(ParagraphBlock)(block));

    const createThread = CreateThreadAtomInput.make({ workspaceId, title: "Matter intake" });
    expect(Result.getOrThrow(S.encodeResult(CreateThreadAtomInput)(createThread))).toStrictEqual({
      workspaceId: 7,
      title: "Matter intake",
    });

    const explicitStreamingTurn = StreamingTurn.make({
      threadId,
      requestId: O.none(),
      userContent: content,
      truncateFrom: O.none(),
      reconciliation: "timeline",
      blocks: [block],
    });
    const defaultedStreamingTurn = StreamingTurn.make({
      threadId,
      userContent: content,
      blocks: [block],
    });
    expect(defaultedStreamingTurn.requestId).toStrictEqual(O.none());
    expect(defaultedStreamingTurn.truncateFrom).toStrictEqual(O.none());
    expect(defaultedStreamingTurn.reconciliation).toBe("timeline");
    expect(Result.getOrThrow(S.encodeResult(StreamingTurn)(defaultedStreamingTurn))).toStrictEqual(
      Result.getOrThrow(S.encodeResult(StreamingTurn)(explicitStreamingTurn))
    );
    expect(Result.getOrThrow(S.encodeResult(StreamingTurn)(defaultedStreamingTurn))).toStrictEqual({
      threadId: 10,
      requestId: O.none(),
      userContent: encodedContent,
      truncateFrom: O.none(),
      reconciliation: "timeline",
      blocks: [encodedBlock],
    });

    // An edit target carries its thread: edit state is global while composers are
    // per-thread, so without it a thread change mid-edit submitted the old
    // thread's turn id against the new thread.
    expect(Result.getOrThrow(S.encodeResult(EditTarget)(EditTarget.make({ threadId, turnId, content })))).toStrictEqual(
      {
        threadId: 10,
        turnId: 20,
        content: encodedContent,
      }
    );

    expect(
      Result.getOrThrow(S.encodeResult(SendTurnRequest)(SendTurnRequest.make({ threadId, content })))
    ).toStrictEqual({
      _tag: "send",
      threadId: 10,
      content: encodedContent,
    });

    expect(
      Result.getOrThrow(S.encodeResult(EditTurnRequest)(EditTurnRequest.make({ threadId, turnId, content })))
    ).toStrictEqual({
      _tag: "edit",
      threadId: 10,
      turnId: 20,
      content: encodedContent,
    });
  });

  it("round-trips touched schemas with schema-derived arbitraries", () => {
    const schemas: ReadonlyArray<S.Codec<unknown>> = [
      CreateThreadAtomInput,
      StreamingTurn,
      EditTarget,
      SendTurnRequest,
      EditTurnRequest,
      TurnRequest,
    ];

    for (const schema of schemas) {
      fc.assert(
        fc.property(S.toArbitrary(schema), (value) => roundTrip(schema, value)),
        fcRuns(10)
      );
    }
  });
});
