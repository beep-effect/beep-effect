import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ActionType,
  App,
  AppBaseModel,
  AppCatalogItem,
  AppCreate,
  AppReview,
  AppUpdate,
  AuthStep,
  ChatTool,
  ExternalIntegration,
  ProactiveNotification,
  UsageHistoryItem,
  UsageHistoryType,
  appReviewFromJson,
  decodeChatTool,
  filterProactiveNotificationScopes,
  getImageUrl,
  getRatingAvg,
  hasChatTools,
  isAPersona,
  reduceDict,
  toReducedDict,
  triggersOnConversationCreation,
  triggersRealtime,
  triggersRealtimeAudioBytes,
  worksExternally,
  worksWithChat,
  worksWithMemories,
} from "../../beep/App.ts";

const decodeApp = S.decodeUnknownEffect(App);

const base = {
  id: "app-1",
  name: "Notes",
  category: "productivity",
  author: "omi",
  description: "Notes",
  image: "/notes.png",
  capabilities: HashSet.empty<string>(),
};

/** Wire-side keys the port requires on decode: non-null Python defaults are construction-only here. */
const wireBase = {
  ...base,
  capabilities: [],
  private: false,
  approved: false,
  status: "approved",
  connectedAccounts: [],
  ratingCount: 0,
  enabled: false,
  triggerWorkflowMemories: true,
  installs: 0,
  reviews: [],
};

const toolBase = {
  name: "send",
  description: "Send",
  endpoint: "https://example.com/tool",
  method: "POST",
  authRequired: true,
  isMcp: false,
  transport: "streamable_http",
};

describe("App", () => {
  it("builds arbitrary values", () => {
    for (const schema of [
      AppReview,
      AuthStep,
      ActionType,
      ChatTool,
      ExternalIntegration,
      ProactiveNotification,
      AppBaseModel,
      App,
      AppCatalogItem,
      AppCreate,
      AppUpdate,
      UsageHistoryType,
      UsageHistoryItem,
    ]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });

  it("defaults a missing paid flag and keeps a present null", () => {
    const input: unknown = wireBase;
    const missing = Effect.runSync(decodeApp(input));
    assert.strictEqual(O.getOrNull(missing.isPaid), false);
    assert.strictEqual(O.getOrNull(missing.ratingAvg), 0);
    const cleared: unknown = { ...wireBase, isPaid: null, ratingAvg: null, price: null };
    const none = Effect.runSync(decodeApp(cleared));
    assert.strictEqual(O.isNone(none.isPaid), true);
    assert.strictEqual(O.isNone(none.ratingAvg), true);
    assert.strictEqual(getRatingAvg(none), null);
    assert.strictEqual(getRatingAvg(missing), "0.0");
  });

  it("reads capability and trigger branches", () => {
    const memories = App.make({ ...base, capabilities: HashSet.fromIterable(["memories"]) });
    assert.strictEqual(worksWithMemories(memories), true);
    assert.strictEqual(worksWithChat(memories), false);
    const chat = App.make({ ...base, capabilities: HashSet.fromIterable(["chat"]) });
    assert.strictEqual(worksWithChat(chat), true);
    const persona = App.make({ ...base, capabilities: HashSet.fromIterable(["persona"]) });
    assert.strictEqual(isAPersona(persona), true);
    assert.strictEqual(worksWithChat(persona), true);
    const external = App.make({
      ...base,
      capabilities: HashSet.fromIterable(["external_integration"]),
      externalIntegration: O.some(ExternalIntegration.make({ triggersOn: O.some("memory_creation") })),
    });
    assert.strictEqual(worksExternally(external), true);
    assert.strictEqual(triggersOnConversationCreation(external), true);
    assert.strictEqual(triggersRealtime(external), false);
    assert.strictEqual(triggersRealtimeAudioBytes(App.make(base)), false);
    assert.strictEqual(getImageUrl(memories), "https://raw.githubusercontent.com/BasedHardware/Omi/main/notes.png");
  });

  it("filters notification scopes and chat tools", () => {
    const empty = App.make(base);
    assert.strictEqual(filterProactiveNotificationScopes(empty, ["calendar"]).length, 0);
    assert.strictEqual(hasChatTools(empty), false);
    const scoped = App.make({
      ...base,
      proactiveNotification: O.some(ProactiveNotification.make({ scopes: HashSet.fromIterable(["calendar"]) })),
    });
    assert.deepStrictEqual(filterProactiveNotificationScopes(scoped, ["calendar", "mail"]), ["calendar"]);
    const cleared: unknown = { ...wireBase, chatTools: null };
    const none = Effect.runSync(decodeApp(cleared));
    assert.strictEqual(hasChatTools(none), false);
  });

  it("parses chat-tool parameters from a string, an object, and bad json", () => {
    const fromString = Effect.runSync(
      decodeChatTool({
        ...toolBase,
        parameters: "{\"channel\":\"general\"}",
      }),
    );
    assert.strictEqual(O.isSome(fromString.parameters), true);
    const broken = Effect.runSync(
      decodeChatTool({
        ...toolBase,
        parameters: "not-json",
      }),
    );
    assert.strictEqual(O.isNone(broken.parameters), true);
    const object = Effect.runSync(
      decodeChatTool({
        ...toolBase,
        parameters: { channel: "general" },
      }),
    );
    assert.strictEqual(O.isSome(object.parameters), true);
  });

  it("drops a non-string review response time and omits reviews from the reduced dict", () => {
    const review = Effect.runSync(
      appReviewFromJson({
        uid: "user-1",
        rated_at: "2020-01-02T03:04:05.000Z",
        score: 4,
        review: "Good",
        responded_at: 1,
      }),
    );
    assert.strictEqual(O.isNone(review.respondedAt), true);
    const reduced = Effect.runSync(toReducedDict(App.make(base)));
    assert.strictEqual(reduced.id, "app-1");
    assert.strictEqual("reviews" in reduced, false);
    const dict = reduceDict({ id: "app-1", reviews: [], email: "a@b.c" });
    assert.strictEqual(dict.id, "app-1");
    assert.strictEqual("email" in dict, false);
    const catalog = AppCatalogItem.make({ id: "app-1" });
    assert.strictEqual(catalog.category, "other");
    assert.strictEqual(O.isNone(catalog.ratingAvg), true);
  });
});
