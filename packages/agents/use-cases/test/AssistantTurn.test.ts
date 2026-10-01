import { CodeBlock, HeadingBlock, ParagraphBlock, TextInline } from "@beep/agents-domain/values/AssistantContent";
import {
  AgentTurnKernel,
  AssistantTurnEvent,
  AssistantTurnHistoryItem,
  IndexedBlock,
  ProviderUsageMetadata,
  TurnHistoryItem,
  UserTurnHistoryItem,
} from "@beep/agents-use-cases/public";
import {
  FixtureTurnKernel,
  fixtureBlocksFor,
  fixtureEventsFor,
  fixtureProviderUsage,
} from "@beep/agents-use-cases/test";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const userItem = (text: string) => UserTurnHistoryItem.make({ text });
const assistantItem = (text: string) => AssistantTurnHistoryItem.make({ text });
const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"], label: string): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value), label).toBe(true);
};

describe("@beep/agents-use-cases AssistantTurn", () => {
  it("models history as a role-tagged union of user and assistant items", () => {
    const decoded = Result.getOrThrow(S.decodeResult(TurnHistoryItem)({ role: "user", text: "hello" }));
    const user = userItem("hello");
    const assistant = assistantItem("hi");

    expect(decoded).toBeInstanceOf(UserTurnHistoryItem);
    expect(user.role).toBe("user");
    expect(assistant.role).toBe("assistant");
    expect(
      TurnHistoryItem.match(decoded, {
        assistant: (item) => `assistant:${item.text}`,
        user: (item) => `user:${item.text}`,
      })
    ).toBe("user:hello");
  });

  it("keeps touched encoded shapes stable", () => {
    const block = ParagraphBlock.make({ children: [TextInline.make({ text: "Hello" })] });
    const indexed = IndexedBlock.make({ block, index: 0 });

    expect(Result.getOrThrow(S.encodeResult(TurnHistoryItem)(userItem("hello")))).toStrictEqual({
      role: "user",
      text: "hello",
    });
    expect(Result.getOrThrow(IndexedBlock.encodeResult(indexed))).toStrictEqual({
      block: {
        type: "paragraph",
        children: [{ type: "text", text: "Hello" }],
      },
      index: 0,
    });
    expect(Result.getOrThrow(ProviderUsageMetadata.encodeResult(fixtureProviderUsage))).toStrictEqual({
      inputTokens: 12,
      model: "fixture",
      outputTokens: 8,
      provider: "fixture",
      stopReason: "stop",
    });
  });

  it.effect.prop(
    "round-trips touched schemas with schema-derived arbitraries",
    { TurnHistoryItem, IndexedBlock, ProviderUsageMetadata, AssistantTurnEvent },
    (values) =>
      Effect.sync(() => {
        roundTrip(TurnHistoryItem, values.TurnHistoryItem, "TurnHistoryItem");
        roundTrip(IndexedBlock, values.IndexedBlock, "IndexedBlock");
        roundTrip(ProviderUsageMetadata, values.ProviderUsageMetadata, "ProviderUsageMetadata");
        roundTrip(AssistantTurnEvent, values.AssistantTurnEvent, "AssistantTurnEvent");
      }),
    { arbitrary: fcRuns(10) }
  );

  it.effect(
    "round-trips provider usage through its JSON-safe encoded boundary",
    Effect.fnUntraced(function* () {
      const usage = ProviderUsageMetadata.make({ ...fixtureProviderUsage, stopReason: O.none() });
      const encoded = yield* ProviderUsageMetadata.encodeEffect(usage);
      expect(encoded).toStrictEqual({
        inputTokens: 12,
        model: "fixture",
        outputTokens: 8,
        provider: "fixture",
        stopReason: null,
      });

      const JsonProviderUsage = S.fromJsonString(ProviderUsageMetadata);
      const json = yield* S.encodeEffect(JsonProviderUsage)(usage);
      const decoded = yield* S.decodeEffect(JsonProviderUsage)(json);

      expect(decoded).toStrictEqual(usage);
      assertNone(decoded.stopReason);
    })
  );

  it("derives the deterministic scripted block sequence from the last user prompt", () => {
    const blocks = fixtureBlocksFor([assistantItem("ignored"), userItem("hello world")]);

    expect(blocks).toHaveLength(4);
    expect(blocks.map((block) => block.type)).toEqual(["heading", "paragraph", "list", "code"]);

    const [heading, paragraph, list, code] = blocks;
    expect(heading).toStrictEqual(HeadingBlock.make({ level: "h2", children: [TextInline.make({ text: "Echo" })] }));
    expect(paragraph).toStrictEqual(
      ParagraphBlock.make({ children: [TextInline.make({ text: "You said: hello world" })] })
    );
    expect(list?.type).toBe("list");
    expect(code).toStrictEqual(CodeBlock.make({ language: "text", code: "hello world" }));
  });

  it("emits a single 'No input.' paragraph when there is no user prompt", () => {
    expect(fixtureBlocksFor([])).toEqual(fixtureBlocksFor([userItem("")]));

    const blocks = fixtureBlocksFor([assistantItem("only assistant")]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toStrictEqual(ParagraphBlock.make({ children: [TextInline.make({ text: "No input." })] }));
  });

  // The fixture kernel layer is provided through the @effect/vitest test
  // harness (the test entry point), not via Effect.provide in the effect body,
  // which keeps scope lifetimes correct and satisfies effect(strictEffectProvide).
  it.layer(FixtureTurnKernel)("through the fixture kernel", (it) => {
    it.effect(
      "streams the scripted sequence as indexed blocks",
      Effect.fnUntraced(function* () {
        const kernel = yield* AgentTurnKernel;
        const history = [userItem("ping")];
        const emitted = yield* Stream.runCollect(kernel.streamTurn(history));
        const expected = fixtureBlocksFor(history);

        expect(emitted.map((event) => event.type)).toEqual(["block", "block", "block", "block", "finalization"]);
        expect([...emitted]).toStrictEqual([...fixtureEventsFor(history)]);
        const events = A.fromIterable(emitted);
        const blocks = A.map(A.filter(events, AssistantTurnEvent.guards.block), (event) => event.block);
        expect(A.map(blocks, (indexed) => indexed.index)).toEqual([0, 1, 2, 3]);
        expect(A.map(blocks, (indexed) => indexed.block)).toStrictEqual([...expected]);
        assertSome(
          O.map(A.findFirst(events, AssistantTurnEvent.guards.finalization), (event) => event.usage),
          fixtureProviderUsage
        );
      })
    );
  });
});
