/**
 * App catalog, integrations, and usage history.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as SchemaGetter from "effect/SchemaGetter";
import * as S from "effect/Schema";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Model, optionalNull, optionalText, optionalTimestamp, pg, text, userId } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/App");

const boolDefault = (column: string, value: boolean) =>
  S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.boolean(), pg.columnName(column));

const intDefault = (column: string, value: number) =>
  S.Int.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.integer(), pg.columnName(column));

const textDefault = (column: string, value: string) =>
  S.String.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.text(), pg.columnName(column));

const optionDefault = <Sch extends S.ConstraintDecoder<unknown>>(schema: Sch, fallback: () => Sch["Type"]) =>
  S.NullOr(schema).pipe(
    S.optionalKey,
    S.decodeTo(S.Option(schema), {
      decode: SchemaGetter.transformOptional((present) =>
        present.pipe(
          O.match({
            onNone: () => O.some(fallback()),
            onSome: (value) => (value === null ? O.none() : O.some(value)),
          }),
          O.some,
        ),
      ),
      encode: SchemaGetter.transformOptional((present) =>
        present.pipe(
          O.flatten,
          O.match({
            onNone: () => null,
            onSome: (value) => value,
          }),
          O.some,
        ),
      ),
    }),
    S.withConstructorDefault(Effect.sync(() => O.some(fallback()))),
  );

const optionalFlag = (column: string, value: boolean) =>
  optionDefault(S.Boolean, () => value).pipe(pg.boolean(), pg.columnName(column));

const optionalFinite = (column: string) => optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName(column));

const optionalFiniteDefault = (column: string, value: number) =>
  optionDefault(S.Finite, () => value).pipe(pg.doublePrecision(), pg.columnName(column));

const stringList = (column: string) =>
  S.String.pipe(S.Array, S.withConstructorDefault(Effect.sync(() => [])), pg.jsonb(), pg.columnName(column));

const optionalStringList = (column: string) =>
  optionDefault(S.Array(S.String), () => []).pipe(pg.jsonb(), pg.columnName(column));

const nullableStringList = (column: string) =>
  S.String.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName(column));

const jsonObject = (column: string) => optionalNull(S.JsonObject).pipe(pg.jsonb(), pg.columnName(column));

/**
 * Fields removed from list and cache projections of an app.
 *
 * **Example** (Name a removed field)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { appReduceExcludeFields } from "@beep/scratchpad/beep/App"
 *
 * console.log(HashSet.has(appReduceExcludeFields, "reviews")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const appReduceExcludeFields = HashSet.fromIterable([
  "reviews",
  "user_review",
  "persona_prompt",
  "chat_prompt",
  "memory_prompt",
  "payment_product_id",
  "payment_price_id",
  "payment_link_id",
  "twitter",
  "email",
  "money_made",
  "usage_count",
]);

/**
 * One user review of an app.
 *
 * **Example** (Decode a review)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { AppReview } from "@beep/scratchpad/beep/App"
 *
 * const review = Effect.runSync(
 *   S.decodeUnknownEffect(AppReview)({
 *     uid: "user-1",
 *     ratedAt: "2020-01-02T03:04:05.000Z",
 *     score: 5,
 *     review: "Useful",
 *   }),
 * )
 * console.log(review.score) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppReview extends Model<AppReview>("AppReview")(
  {
    uid: userId("uid"),
    ratedAt: S.DateTimeUtcFromString.pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("rated_at"),
    ),
    score: S.Finite.pipe(pg.doublePrecision(), pg.columnName("score")),
    review: text("review"),
    username: optionalText("username"),
    response: optionalText("response"),
    respondedAt: optionalTimestamp("responded_at"),
  },
  $I.annote("AppReview", { description: "A user review of an app, including an optional developer response." }),
) {}

/**
 * Encoded form of {@link AppReview}.
 *
 * @see {@link AppReview} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AppReview {
  export type Encoded = S.Codec.Encoded<typeof AppReview>;
}

/**
 * Builds a review from a stored JSON object.
 *
 * **Details**
 *
 * `ratedAt` is parsed as an ISO instant. `respondedAt` is parsed only when it
 * is a string; any other value, including null, becomes `None`.
 *
 * **Example** (Drop a non-string response time)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { appReviewFromJson } from "@beep/scratchpad/beep/App"
 *
 * const review = Effect.runSync(
 *   appReviewFromJson({
 *     uid: "user-1",
 *     rated_at: "2020-01-02T03:04:05.000Z",
 *     score: 4,
 *     review: "Good",
 *     responded_at: 1,
 *   }),
 * )
 * console.log(O.isNone(review.respondedAt)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const appReviewFromJson = Effect.fn("AppReview.fromJson")(function* (jsonData: { [key: string]: unknown }) {
  const responded = jsonData.responded_at;
  const wire: unknown = {
    uid: jsonData.uid,
    ratedAt: jsonData.rated_at,
    score: jsonData.score,
    review: jsonData.review,
    username: jsonData.username === undefined ? null : jsonData.username,
    response: jsonData.response === undefined ? null : jsonData.response,
    respondedAt: P.isString(responded) ? responded : null,
  };
  return yield* S.decodeUnknownEffect(AppReview)(wire);
});

/**
 * One external-integration auth step.
 *
 * **Example** (Name a step)
 *
 * ```ts
 * import { AuthStep } from "@beep/scratchpad/beep/App"
 *
 * const step = AuthStep.make({ name: "Connect", url: "https://example.com/oauth" })
 * console.log(step.name) // "Connect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AuthStep extends Model<AuthStep>("AuthStep")(
  {
    name: text("name"),
    url: text("url"),
  },
  $I.annote("AuthStep", { description: "Named URL the user opens to authorize an integration." }),
) {}

/**
 * Encoded form of {@link AuthStep}.
 *
 * @see {@link AuthStep} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AuthStep {
  export type Encoded = S.Codec.Encoded<typeof AuthStep>;
}

/**
 * Integration action the app may perform.
 *
 * **Details**
 *
 * `CREATE_MEMORY` is stored as `create_conversation`. That wire value is frozen.
 *
 * **Gotchas**
 *
 * Do not rename `create_conversation` to `create_memory`. It is the historical
 * conversation webhook name.
 *
 * **Example** (Read the frozen memory action)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ActionType } from "@beep/scratchpad/beep/App"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ActionType)("create_conversation"))
 * console.log(decoded) // "create_conversation"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActionType = LiteralKit([
  "create_conversation",
  "create_facts",
  "read_memories",
  "read_conversations",
  "read_tasks",
]).pipe(
  $I.annoteSchema("ActionType", {
    description: "Integration action. create_conversation is the frozen CREATE_MEMORY wire value.",
  }),
);

/**
 * Decoded integration action.
 *
 * @see {@link ActionType} for the frozen CREATE_MEMORY wire value.
 * @category type-level
 * @since 0.0.0
 */
export type ActionType = typeof ActionType.Type;

/**
 * One integration action.
 *
 * **Example** (Read memories)
 *
 * ```ts
 * import { Action } from "@beep/scratchpad/beep/App"
 *
 * const action = Action.make({ action: "read_memories" })
 * console.log(action.action) // "read_memories"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Action extends Model<Action>("Action")(
  {
    action: ActionType.pipe(pg.text(), pg.columnName("action")),
  },
  $I.annote("Action", { description: "One integration action an app may perform." }),
) {}

/**
 * Encoded form of {@link Action}.
 *
 * @see {@link Action} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Action {
  export type Encoded = S.Codec.Encoded<typeof Action>;
}

const jsonObjectFromString = S.fromJsonString(S.JsonObject);

/**
 * A tool an app exposes to chat.
 *
 * **Details**
 *
 * `method` constructs as `POST` and stays an open string. `transport` constructs
 * as `streamable_http` and stays open. `parameters` may arrive as a JSON object
 * or a JSON string. A string that is not an object becomes `None`.
 *
 * **Example** (Parse parameters from a JSON string)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { ChatTool } from "@beep/scratchpad/beep/App"
 *
 * const tool = Effect.runSync(
 *   S.decodeUnknownEffect(ChatTool)({
 *     name: "send_slack_message",
 *     description: "Send",
 *     endpoint: "https://example.com/tool",
 *     parameters: "{\"channel\":\"general\"}",
 *   }),
 * )
 * console.log(O.isSome(tool.parameters)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatTool extends Model<ChatTool>("ChatTool")(
  {
    name: text("name"),
    description: text("description"),
    endpoint: text("endpoint"),
    method: textDefault("method", "POST"),
    parameters: optionalNull(S.JsonObject).pipe(pg.jsonb(), pg.columnName("parameters")),
    authRequired: boolDefault("auth_required", true),
    statusMessage: optionalText("status_message"),
    isMcp: boolDefault("is_mcp", false),
    transport: textDefault("transport", "streamable_http"),
  },
  $I.annote("ChatTool", { description: "Chat tool an app exposes, including an optional JSON parameter schema." }),
) {}

/**
 * Encoded form of {@link ChatTool}.
 *
 * @see {@link ChatTool} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatTool {
  export type Encoded = S.Codec.Encoded<typeof ChatTool>;
}

/**
 * Decodes a chat tool, accepting `parameters` as an object or a JSON string.
 *
 * **Details**
 *
 * Firestore stored parameter schemas as JSON strings. A string that does not
 * decode as an object becomes `None`, matching the Python warning path without
 * a logger.
 *
 * **Example** (Parse parameters from a JSON string)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { decodeChatTool } from "@beep/scratchpad/beep/App"
 *
 * const tool = Effect.runSync(
 *   decodeChatTool({
 *     name: "send_slack_message",
 *     description: "Send",
 *     endpoint: "https://example.com/tool",
 *     parameters: "{\"channel\":\"general\"}",
 *   }),
 * )
 * console.log(O.isSome(tool.parameters)) // true
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeChatTool = Effect.fn("ChatTool.decode")(function* (input: unknown) {
  if (!P.isObject(input) || A.isArray(input) || !P.isString(input.parameters)) {
    return yield* S.decodeUnknownEffect(ChatTool)(input);
  }
  const parsed = yield* Effect.result(S.decodeEffect(jsonObjectFromString)(input.parameters));
  const wire: unknown = { ...input, parameters: Result.isSuccess(parsed) ? parsed.success : null };
  return yield* S.decodeUnknownEffect(ChatTool)(wire);
});

/**
 * External integration configuration for an app.
 *
 * **Details**
 *
 * `triggersOn` is an open string. App helpers compare it with `memory_creation`,
 * `transcript_processed`, and `audio_bytes`. `chatMessagesTarget` is `main` or
 * `app` and constructs as `app`. `authSteps` and `actions` admit null; a missing
 * key constructs as an empty list.
 *
 * **Gotchas**
 *
 * A present null on `authSteps` or `actions` stays `None`. It is not replaced
 * by the empty list. The empty list is only the missing-key default.
 *
 * **Example** (Default chat messages to the app target)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ExternalIntegration } from "@beep/scratchpad/beep/App"
 *
 * const integration = ExternalIntegration.make({})
 * console.log(integration.chatMessagesTarget) // "app"
 * console.log(O.isSome(integration.authSteps) && integration.authSteps.value.length === 0) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExternalIntegration extends Model<ExternalIntegration>("ExternalIntegration")(
  {
    triggersOn: optionalText("triggers_on"),
    webhookUrl: optionalText("webhook_url"),
    setupCompletedUrl: optionalText("setup_completed_url"),
    setupInstructionsFilePath: optionalText("setup_instructions_file_path"),
    isInstructionsUrl: boolDefault("is_instructions_url", true),
    authSteps: AuthStep.pipe(
      S.Array,
      S.withConstructorDefault(Effect.sync(() => [])),
      pg.jsonb(),
      pg.columnName("auth_steps"),
    ),
    appHomeUrl: optionalText("app_home_url"),
    actions: Action.pipe(
      S.Array,
      S.withConstructorDefault(Effect.sync(() => [])),
      pg.jsonb(),
      pg.columnName("actions"),
    ),
    chatToolsManifestUrl: optionalText("chat_tools_manifest_url"),
    chatMessagesEnabled: boolDefault("chat_messages_enabled", false),
    chatMessagesTarget: LiteralKit(["main", "app"]).pipe(
      S.withConstructorDefault(Effect.succeed<"main" | "app">("app")),
      pg.text(),
      pg.columnName("chat_messages_target"),
    ),
    chatMessagesNotify: boolDefault("chat_messages_notify", false),
    mcpServerUrl: optionalText("mcp_server_url"),
    mcpOauthTokens: jsonObject("mcp_oauth_tokens"),
  },
  $I.annote("ExternalIntegration", {
    description: "Webhook, auth, chat, and MCP configuration for an app integration.",
  }),
) {}

/**
 * Encoded form of {@link ExternalIntegration}.
 *
 * @see {@link ExternalIntegration} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExternalIntegration {
  export type Encoded = S.Codec.Encoded<typeof ExternalIntegration>;
}

/**
 * Scopes a proactive notification may include.
 *
 * **Example** (One scope)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { ProactiveNotification } from "@beep/scratchpad/beep/App"
 *
 * const note = ProactiveNotification.make({ scopes: HashSet.fromIterable(["calendar"]) })
 * console.log(HashSet.has(note.scopes, "calendar")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProactiveNotification extends Model<ProactiveNotification>("ProactiveNotification")(
  {
    scopes: S.HashSet(S.String).pipe(pg.jsonb(), pg.columnName("scopes")),
  },
  $I.annote("ProactiveNotification", { description: "Scopes a proactive notification is allowed to include." }),
) {}

/**
 * Encoded form of {@link ProactiveNotification}.
 *
 * @see {@link ProactiveNotification} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProactiveNotification {
  export type Encoded = S.Codec.Encoded<typeof ProactiveNotification>;
}

/**
 * API key metadata stored for an app.
 *
 * **Example** (Decode a key label)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ApiKey } from "@beep/scratchpad/beep/App"
 *
 * const key = Effect.runSync(S.decodeUnknownEffect(ApiKey)({ id: "key-1", hashed: "abc", label: "dev" }))
 * console.log(key.label) // "dev"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiKey extends Model<ApiKey>("ApiKey")(
  {
    id: text("id"),
    hashed: text("hashed"),
    label: text("label"),
    createdAt: optionalTimestamp("created_at"),
  },
  $I.annote("ApiKey", { description: "Hashed API key metadata for an app." }),
) {}

/**
 * Encoded form of {@link ApiKey}.
 *
 * @see {@link ApiKey} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ApiKey {
  export type Encoded = S.Codec.Encoded<typeof ApiKey>;
}

const baseFields = {
  id: text("id"),
  name: text("name"),
  uid: optionalText("uid"),
  private: boolDefault("private", false),
  approved: boolDefault("approved", false),
  status: textDefault("status", "approved"),
  category: text("category"),
  author: text("author"),
  description: text("description"),
  image: text("image"),
  capabilities: S.HashSet(S.String).pipe(pg.jsonb(), pg.columnName("capabilities")),
  username: optionalText("username"),
  connectedAccounts: stringList("connected_accounts"),
  externalIntegration: optionalNull(ExternalIntegration).pipe(pg.jsonb(), pg.columnName("external_integration")),
  ratingAvg: optionalFiniteDefault("rating_avg", 0),
  ratingCount: intDefault("rating_count", 0),
  enabled: boolDefault("enabled", false),
  triggerWorkflowMemories: boolDefault("trigger_workflow_memories", true),
  installs: intDefault("installs", 0),
  score: optionalFinite("score"),
  proactiveNotification: optionalNull(ProactiveNotification).pipe(pg.jsonb(), pg.columnName("proactive_notification")),
  createdAt: optionalTimestamp("created_at"),
  isPaid: optionalFlag("is_paid", false),
  price: optionalFiniteDefault("price", 0),
  paymentPlan: optionalText("payment_plan"),
  paymentLink: optionalText("payment_link"),
  isUserPaid: optionalFlag("is_user_paid", false),
  thumbnails: optionalStringList("thumbnails"),
  thumbnailUrls: optionalStringList("thumbnail_urls"),
  isInfluencer: optionalFlag("is_influencer", false),
  isPopular: optionalFlag("is_popular", false),
  official: optionalFlag("official", false),
  chatTools: ChatTool.pipe(
    S.Array,
    S.withConstructorDefault(Effect.sync(() => [])),
    pg.jsonb(),
    pg.columnName("chat_tools"),
  ),
  sourceCodeUrl: optionalText("source_code_url"),
  disabled: optionalFlag("disabled", false),
  disabledReason: optionalText("disabled_reason"),
  disabledAt: optionalText("disabled_at"),
  disabledError: optionalText("disabled_error"),
};

/**
 * List-view app. Large detail fields live on {@link App}.
 *
 * **Details**
 *
 * `capabilities` is a set of open strings. Methods compare them with
 * `memories`, `chat`, `persona`, and `external_integration`. Nullable flags
 * such as `isPaid` still admit null. A missing key decodes as the non-null
 * default. `status` is an open string and constructs as `approved`.
 *
 * **Gotchas**
 *
 * `ratingAvg` constructs as `Some(0)` when omitted and stays `None` when the
 * JSON value is null. The same rule applies to `price` and the boolean flags
 * that Python typed as optional with a non-null default. `disabledAt` is a
 * string, not a datetime.
 *
 * **Example** (Default the rating)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { AppBaseModel } from "@beep/scratchpad/beep/App"
 *
 * const app = AppBaseModel.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.fromIterable(["memories"]),
 * })
 * console.log(O.getOrNull(app.ratingAvg)) // 0
 * console.log(app.status) // "approved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppBaseModel extends Model<AppBaseModel>("AppBaseModel")(
  baseFields,
  $I.annote("AppBaseModel", { description: "List-view app fields shared with the full app document." }),
) {}

/**
 * Encoded form of {@link AppBaseModel}.
 *
 * @see {@link AppBaseModel} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AppBaseModel {
  export type Encoded = S.Codec.Encoded<typeof AppBaseModel>;
}

/**
 * Full app document, including prompts, reviews, and payment identifiers.
 *
 * **Example** (Add a prompt)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { App } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.fromIterable(["chat"]),
 *   chatPrompt: O.some("Be brief"),
 * })
 * console.log(O.getOrNull(app.chatPrompt)) // "Be brief"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class App extends Model<App>("App")(
  {
    ...baseFields,
    email: optionalText("email"),
    memoryPrompt: optionalText("memory_prompt"),
    chatPrompt: optionalText("chat_prompt"),
    personaPrompt: optionalText("persona_prompt"),
    twitter: jsonObject("twitter"),
    reviews: S.Array(AppReview).pipe(
      S.withConstructorDefault(Effect.sync(() => [])),
      pg.jsonb(),
      pg.columnName("reviews"),
    ),
    userReview: optionalNull(AppReview).pipe(pg.jsonb(), pg.columnName("user_review")),
    moneyMade: optionalFinite("money_made"),
    usageCount: optionalNull(S.Int).pipe(pg.integer(), pg.columnName("usage_count")),
    paymentProductId: optionalText("payment_product_id"),
    paymentPriceId: optionalText("payment_price_id"),
    paymentLinkId: optionalText("payment_link_id"),
  },
  $I.annote("App", { description: "Full app document, including prompts, reviews, and payment identifiers." }),
) {}

/**
 * Encoded form of {@link App}.
 *
 * @see {@link App} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace App {
  export type Encoded = S.Codec.Encoded<typeof App>;
}

/**
 * One-decimal rating text, or null when the rating is absent.
 *
 * **Example** (Format zero)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, getRatingAvg } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.empty(),
 * })
 * console.log(getRatingAvg(app)) // "0.0"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getRatingAvg = (app: App): string | null =>
  O.match(app.ratingAvg, { onNone: () => null, onSome: (value) => value.toFixed(1) });

/**
 * Whether the capability set contains `capability`.
 *
 * **Example** (Find memories)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, hasCapability } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.fromIterable(["memories"]),
 * })
 * console.log(hasCapability(app, "memories")) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- The app and the capability name are co-primary inputs.
export const hasCapability = (app: App, capability: string): boolean => HashSet.has(app.capabilities, capability);

/**
 * Whether the app works with memories.
 *
 * **Example** (Memories capability)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, worksWithMemories } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.fromIterable(["memories"]),
 * })
 * console.log(worksWithMemories(app)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const worksWithMemories = (app: App): boolean => hasCapability(app, "memories");

/**
 * Whether the app works with chat or is a persona.
 *
 * **Example** (Chat capability)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, worksWithChat } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.fromIterable(["chat"]),
 * })
 * console.log(worksWithChat(app)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const worksWithChat = (app: App): boolean => hasCapability(app, "chat") || hasCapability(app, "persona");

/**
 * Whether the app is a persona.
 *
 * **Example** (Persona capability)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, isAPersona } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.fromIterable(["persona"]),
 * })
 * console.log(isAPersona(app)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isAPersona = (app: App): boolean => hasCapability(app, "persona");

/**
 * Whether the app has the external integration capability.
 *
 * **Example** (External capability)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, worksExternally } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.fromIterable(["external_integration"]),
 * })
 * console.log(worksExternally(app)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const worksExternally = (app: App): boolean => hasCapability(app, "external_integration");

const triggersOn = (app: App, value: string): boolean =>
  worksExternally(app) &&
  O.match(app.externalIntegration, {
    onNone: () => false,
    onSome: (integration) =>
      O.match(integration.triggersOn, { onNone: () => false, onSome: (trigger) => trigger === value }),
  });

/**
 * Whether the app triggers when a conversation memory is created.
 *
 * **Details**
 *
 * Requires the external integration capability and `triggersOn === memory_creation`.
 * That comparison string is open; it is not a schema union.
 *
 * **Example** (Memory-creation trigger)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { App, ExternalIntegration, triggersOnConversationCreation } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.fromIterable(["external_integration"]),
 *   externalIntegration: O.some(ExternalIntegration.make({ triggersOn: O.some("memory_creation") })),
 * })
 * console.log(triggersOnConversationCreation(app)) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const triggersOnConversationCreation = (app: App): boolean => triggersOn(app, "memory_creation");

/**
 * Whether the app triggers when a transcript is processed.
 *
 * **Example** (Transcript trigger)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, triggersRealtime } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.empty(),
 * })
 * console.log(triggersRealtime(app)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const triggersRealtime = (app: App): boolean => triggersOn(app, "transcript_processed");

/**
 * Whether the app triggers on raw audio bytes.
 *
 * **Example** (No audio trigger)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, triggersRealtimeAudioBytes } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.empty(),
 * })
 * console.log(triggersRealtimeAudioBytes(app)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const triggersRealtimeAudioBytes = (app: App): boolean => triggersOn(app, "audio_bytes");

/**
 * Notification scopes that are both requested and allowed.
 *
 * **Example** (Drop an unknown scope)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import * as O from "effect/Option"
 * import { App, ProactiveNotification, filterProactiveNotificationScopes } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.empty(),
 *   proactiveNotification: O.some(ProactiveNotification.make({ scopes: HashSet.fromIterable(["calendar"]) })),
 * })
 * console.log(filterProactiveNotificationScopes(app, ["calendar", "mail"])) // ["calendar"]
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
// @effect-diagnostics-next-line missingPipeableSignature:off -- The app and the requested scopes are co-primary inputs.
export const filterProactiveNotificationScopes = (app: App, params: ReadonlyArray<string>): ReadonlyArray<string> =>
  O.match(app.proactiveNotification, {
    onNone: () => [],
    onSome: (note) => A.filter(params, (param) => HashSet.has(note.scopes, param)),
  });

/**
 * Public image URL for an app path.
 *
 * **Details**
 *
 * Prefixes the Omi repository raw URL. This does not fetch the image.
 *
 * **Example** (Prefix an image path)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, getImageUrl } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.empty(),
 * })
 * console.log(getImageUrl(app)) // "https://raw.githubusercontent.com/BasedHardware/Omi/main/notes.png"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const getImageUrl = (app: App): string =>
  `https://raw.githubusercontent.com/BasedHardware/Omi/main${app.image}`;

/**
 * Whether the app has at least one chat tool.
 *
 * **Example** (Empty tools are absent)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { App, hasChatTools } from "@beep/scratchpad/beep/App"
 *
 * const app = App.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.empty(),
 * })
 * console.log(hasChatTools(app)) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const hasChatTools = (app: App): boolean => O.isSome(app.chatTools) && app.chatTools.value.length > 0;

const isoOrNull = (value: O.Option<DateTime.Utc>): string | null =>
  O.match(value, { onNone: () => null, onSome: (instant) => DateTime.formatIso(instant) });

/**
 * List-view JSON for an app, without the large detail fields.
 *
 * **Details**
 *
 * Keys use the Python field names. Reviews, prompts, payment ids, twitter,
 * email, money made, and usage count are omitted. Nested values are encoded.
 * Datetimes are ISO strings. Capability and scope sets are arrays.
 *
 * **Example** (Omit reviews)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import { App, toReducedDict } from "@beep/scratchpad/beep/App"
 *
 * const dict = Effect.runSync(
 *   toReducedDict(
 *     App.make({
 *       id: "app-1",
 *       name: "Notes",
 *       category: "productivity",
 *       author: "omi",
 *       description: "Notes",
 *       image: "/notes.png",
 *       capabilities: HashSet.empty(),
 *     }),
 *   ),
 * )
 * console.log(dict.id) // "app-1"
 * console.log("reviews" in dict) // false
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const toReducedDict = Effect.fn("App.toReducedDict")(function* (app: App) {
  return {
    id: app.id,
    name: app.name,
    uid: O.getOrNull(app.uid),
    private: app.private,
    approved: app.approved,
    status: app.status,
    category: app.category,
    author: app.author,
    description: app.description,
    image: app.image,
    capabilities: A.fromIterable(app.capabilities),
    username: O.getOrNull(app.username),
    connected_accounts: app.connectedAccounts,
    external_integration: O.isNone(app.externalIntegration)
      ? null
      : yield* S.encodeEffect(ExternalIntegration)(app.externalIntegration.value),
    rating_avg: O.getOrNull(app.ratingAvg),
    rating_count: app.ratingCount,
    enabled: app.enabled,
    trigger_workflow_memories: app.triggerWorkflowMemories,
    installs: app.installs,
    score: O.getOrNull(app.score),
    proactive_notification: O.isNone(app.proactiveNotification)
      ? null
      : { scopes: A.fromIterable(app.proactiveNotification.value.scopes) },
    created_at: isoOrNull(app.createdAt),
    is_paid: O.getOrNull(app.isPaid),
    price: O.getOrNull(app.price),
    payment_plan: O.getOrNull(app.paymentPlan),
    payment_link: O.getOrNull(app.paymentLink),
    is_user_paid: O.getOrNull(app.isUserPaid),
    thumbnails: O.getOrNull(app.thumbnails),
    thumbnail_urls: O.getOrNull(app.thumbnailUrls),
    is_influencer: O.getOrNull(app.isInfluencer),
    is_popular: O.getOrNull(app.isPopular),
    official: O.getOrNull(app.official),
    chat_tools: O.isNone(app.chatTools) ? null : yield* S.encodeEffect(S.Array(ChatTool))(app.chatTools.value),
    source_code_url: O.getOrNull(app.sourceCodeUrl),
    disabled: O.getOrNull(app.disabled),
    disabled_reason: O.getOrNull(app.disabledReason),
    disabled_at: O.getOrNull(app.disabledAt),
    disabled_error: O.getOrNull(app.disabledError),
  };
});

/**
 * Drops list-view exclude keys from a raw app dict.
 *
 * **Details**
 *
 * Use this before caching a dict. For an {@link App} value, use {@link toReducedDict}.
 *
 * **Example** (Drop reviews)
 *
 * ```ts
 * import { reduceDict } from "@beep/scratchpad/beep/App"
 *
 * const reduced = reduceDict({ id: "app-1", reviews: [], email: "a@b.c" })
 * console.log(reduced.id) // "app-1"
 * console.log("reviews" in reduced) // false
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const reduceDict = <A>(appDict: Readonly<Record<string, A>>): Record<string, A> =>
  R.filter(appDict, (_value, key) => !HashSet.has(appReduceExcludeFields, key));

/**
 * Desktop catalog row. This is not a subclass of {@link AppBaseModel}.
 *
 * **Details**
 *
 * `capabilities` is a list here and a set on the full app. `name`, `description`,
 * `image`, and `author` construct as empty strings. `category` constructs as
 * `other`. `ratingAvg` and `price` are none when omitted, unlike the full app.
 *
 * **Example** (Empty catalog defaults)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AppCatalogItem } from "@beep/scratchpad/beep/App"
 *
 * const item = AppCatalogItem.make({ id: "app-1" })
 * console.log(item.category) // "other"
 * console.log(O.isNone(item.ratingAvg)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppCatalogItem extends Model<AppCatalogItem>("AppCatalogItem")(
  {
    id: text("id"),
    name: textDefault("name", ""),
    description: textDefault("description", ""),
    image: textDefault("image", ""),
    category: textDefault("category", "other"),
    author: textDefault("author", ""),
    capabilities: stringList("capabilities"),
    approved: boolDefault("approved", false),
    status: textDefault("status", "approved"),
    private: boolDefault("private", false),
    installs: intDefault("installs", 0),
    ratingAvg: optionalFinite("rating_avg"),
    ratingCount: intDefault("rating_count", 0),
    externalIntegration: optionalNull(ExternalIntegration).pipe(pg.jsonb(), pg.columnName("external_integration")),
    isPaid: optionalFlag("is_paid", false),
    price: optionalFinite("price"),
    enabled: boolDefault("enabled", false),
  },
  $I.annote("AppCatalogItem", { description: "Desktop catalog row for app list and search views." }),
) {}

/**
 * Encoded form of {@link AppCatalogItem}.
 *
 * @see {@link AppCatalogItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AppCatalogItem {
  export type Encoded = S.Codec.Encoded<typeof AppCatalogItem>;
}

/**
 * Fields accepted when creating an app.
 *
 * **Example** (Create with an empty capability set)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { AppCreate } from "@beep/scratchpad/beep/App"
 *
 * const created = AppCreate.make({
 *   id: "app-1",
 *   name: "Notes",
 *   category: "productivity",
 *   author: "omi",
 *   description: "Notes",
 *   image: "/notes.png",
 *   capabilities: HashSet.empty(),
 * })
 * console.log(created.approved) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppCreate extends Model<AppCreate>("AppCreate")(
  {
    id: text("id"),
    name: text("name"),
    uid: optionalText("uid"),
    private: boolDefault("private", false),
    approved: boolDefault("approved", false),
    status: textDefault("status", "approved"),
    category: text("category"),
    email: optionalText("email"),
    author: text("author"),
    description: text("description"),
    image: text("image"),
    capabilities: S.HashSet(S.String).pipe(pg.jsonb(), pg.columnName("capabilities")),
    memoryPrompt: optionalText("memory_prompt"),
    chatPrompt: optionalText("chat_prompt"),
    personaPrompt: optionalText("persona_prompt"),
    username: optionalText("username"),
    connectedAccounts: stringList("connected_accounts"),
    twitter: jsonObject("twitter"),
    externalIntegration: optionalNull(ExternalIntegration).pipe(pg.jsonb(), pg.columnName("external_integration")),
    proactiveNotification: optionalNull(ProactiveNotification).pipe(pg.jsonb(), pg.columnName("proactive_notification")),
    createdAt: optionalTimestamp("created_at"),
    isPaid: optionalFlag("is_paid", false),
    price: optionalFiniteDefault("price", 0),
    paymentPlan: optionalText("payment_plan"),
    thumbnails: optionalStringList("thumbnails"),
    chatTools: ChatTool.pipe(
    S.Array,
    S.withConstructorDefault(Effect.sync(() => [])),
    pg.jsonb(),
    pg.columnName("chat_tools"),
  ),
    sourceCodeUrl: optionalText("source_code_url"),
  },
  $I.annote("AppCreate", { description: "Fields accepted when creating an app." }),
) {}

/**
 * Encoded form of {@link AppCreate}.
 *
 * @see {@link AppCreate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AppCreate {
  export type Encoded = S.Codec.Encoded<typeof AppCreate>;
}

/**
 * Patch for an app. `id` is required and every other field may be null.
 *
 * **Example** (Rename an app)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { AppUpdate } from "@beep/scratchpad/beep/App"
 *
 * const patch = AppUpdate.make({ id: "app-1", name: O.some("Notes 2") })
 * console.log(O.getOrNull(patch.name)) // "Notes 2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AppUpdate extends Model<AppUpdate>("AppUpdate")(
  {
    id: text("id"),
    name: optionalText("name"),
    uid: optionalText("uid"),
    private: optionalNull(S.Boolean).pipe(pg.boolean(), pg.columnName("private")),
    category: optionalText("category"),
    email: optionalText("email"),
    author: optionalText("author"),
    description: optionalText("description"),
    image: optionalText("image"),
    capabilities: S.String.pipe(S.HashSet, optionalNull, pg.jsonb(), pg.columnName("capabilities")),
    memoryPrompt: optionalText("memory_prompt"),
    chatPrompt: optionalText("chat_prompt"),
    personaPrompt: optionalText("persona_prompt"),
    username: optionalText("username"),
    connectedAccounts: nullableStringList("connected_accounts"),
    twitter: jsonObject("twitter"),
    externalIntegration: optionalNull(ExternalIntegration).pipe(pg.jsonb(), pg.columnName("external_integration")),
    proactiveNotification: optionalNull(ProactiveNotification).pipe(pg.jsonb(), pg.columnName("proactive_notification")),
    createdAt: optionalTimestamp("created_at"),
    isPaid: optionalNull(S.Boolean).pipe(pg.boolean(), pg.columnName("is_paid")),
    price: optionalFinite("price"),
    paymentPlan: optionalText("payment_plan"),
    thumbnails: nullableStringList("thumbnails"),
    chatTools: ChatTool.pipe(S.Array, optionalNull, pg.jsonb(), pg.columnName("chat_tools")),
    updatedAt: optionalTimestamp("updated_at"),
    sourceCodeUrl: optionalText("source_code_url"),
    disabled: optionalNull(S.Boolean).pipe(pg.boolean(), pg.columnName("disabled")),
    disabledReason: optionalText("disabled_reason"),
  },
  $I.annote("AppUpdate", { description: "App patch. The id is required and the other fields are optional." }),
) {}

/**
 * Encoded form of {@link AppUpdate}.
 *
 * @see {@link AppUpdate} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace AppUpdate {
  export type Encoded = S.Codec.Encoded<typeof AppUpdate>;
}

/**
 * Why a usage-history row was recorded.
 *
 * **Example** (Decode a chat message)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { UsageHistoryType } from "@beep/scratchpad/beep/App"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(UsageHistoryType)("chat_message_sent"))
 * console.log(decoded) // "chat_message_sent"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UsageHistoryType = LiteralKit([
  "memory_created_external_integration",
  "transcript_processed_external_integration",
  "memory_created_prompt",
  "chat_message_sent",
]).pipe(
  $I.annoteSchema("UsageHistoryType", { description: "Why a usage-history row was recorded." }),
);

/**
 * Decoded usage-history type.
 *
 * @see {@link UsageHistoryType} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type UsageHistoryType = typeof UsageHistoryType.Type;

/**
 * One usage-history row.
 *
 * **Example** (Record a chat message)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import { UsageHistoryItem } from "@beep/scratchpad/beep/App"
 *
 * const item = UsageHistoryItem.make({
 *   uid: "user-1",
 *   timestamp: DateTime.makeUnsafe("2020-01-02T03:04:05.000Z"),
 *   type: "chat_message_sent",
 * })
 * console.log(item.type) // "chat_message_sent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UsageHistoryItem extends Model<UsageHistoryItem>("UsageHistoryItem")(
  {
    uid: userId("uid"),
    memoryId: optionalText("memory_id"),
    timestamp: S.DateTimeUtcFromString.pipe(
      pg.timestamp({ mode: "string", withTimezone: true }),
      pg.columnName("timestamp"),
    ),
    type: UsageHistoryType.pipe(pg.text(), pg.columnName("type")),
  },
  $I.annote("UsageHistoryItem", { description: "One recorded use of an app." }),
) {}

/**
 * Encoded form of {@link UsageHistoryItem}.
 *
 * @see {@link UsageHistoryItem} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UsageHistoryItem {
  export type Encoded = S.Codec.Encoded<typeof UsageHistoryItem>;
}
