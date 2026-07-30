/**
 * Schema-first UI configuration for the feature-flagged {@link ChatComposer}.
 *
 * Per the repo schema-first law, the composer's config surface, slash items,
 * mention candidates, and the mention source are all modeled as `effect/Schema`:
 * {@link ComposerFeatures}, {@link SlashItem}, and {@link MentionOption} are
 * `S.Class` models (so `.make()` applies the per-field defaults declared on the
 * schema), and {@link MentionSource} is a typed function schema. Callbacks are
 * kept as typed `S.declare` functions and JSX as {@link DOMReactNode}, so the
 * app still passes plain objects/functions while the composer schematizes
 * internally. Wire/persisted/domain payloads remain in the relevant domain
 * slice, not here.
 *
 * @packageDocumentation \@beep/editor/chat/config
 * @since 0.0.0
 */

import { $EditorId } from "@beep/identity";
import { DOMReactNode } from "@beep/schema/DomReactNode";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { A, P } from "@beep/utils";
import { Effect, MutableHashSet, Result } from "effect";
import * as S from "effect/Schema";
import type { SerializedEditorState } from "@beep/lexical-schema";
import type { LexicalEditor } from "lexical";

const $I = $EditorId.create("chat/config");

/**
 * Which keystroke submits the message. `"enter"` sends on plain Enter (a modifier
 * inserts a newline); `"modifierEnter"` sends on Cmd/Ctrl+Enter (plain Enter
 * inserts a newline). Enter-to-send is always suppressed during IME composition.
 *
 * @example
 * ```ts
 * import { SendOn } from "@beep/editor/chat/config"
 *
 * console.log(SendOn.is.enter("enter")) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SendOn = LiteralKit(["enter", "modifierEnter"]).pipe(
  $I.annoteSchema("SendOn", {
    description: "Which keystroke submits the message: plain Enter or Cmd/Ctrl+Enter.",
  })
);

/**
 * The keystroke that submits the message.
 *
 * @example
 * ```ts
 * import type { SendOn } from "@beep/editor/chat/config"
 *
 * const sendOn: SendOn = "modifierEnter"
 * console.log(sendOn) // "modifierEnter"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SendOn = typeof SendOn.Type;

/**
 * Which composer plugins mount. Every flag defaults to `true` on the schema, so
 * {@link ComposerFeatures.make} with a partial input fills the omitted flags;
 * the {@link ChatComposer} passes the consumer's partial `features` object
 * straight through `ComposerFeatures.make` to resolve defaults.
 *
 * @example
 * ```ts
 * import { ComposerFeatures } from "@beep/editor/chat/config"
 *
 * const chat = ComposerFeatures.make({ toolbar: false })
 * console.log(chat.slash) // true
 * console.log(chat.sendOn) // "enter"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ComposerFeatures extends S.Class<ComposerFeatures>($I`ComposerFeatures`)(
  {
    /** Mount the fixed formatting toolbar (bold/italic/lists/quote/code). */
    toolbar: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))).annotateKey({
      description: "Mount the fixed formatting toolbar.",
    }),
    /** Mount the `/` slash command typeahead. */
    slash: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))).annotateKey({
      description: "Mount the slash command typeahead.",
    }),
    /** Mount the `@` mention typeahead. */
    mentions: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))).annotateKey({
      description: "Mount the mention typeahead.",
    }),
    /** Mount the attachment capture surface (drag-drop + picker + chips). */
    attachments: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))).annotateKey({
      description: "Mount the attachment capture surface.",
    }),
    /** Show the live character count in the footer. */
    characterCount: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true))).annotateKey({
      description: "Show the live character count in the footer.",
    }),
    /** Which keystroke submits the message. @defaultValue "enter" */
    sendOn: SendOn.pipe(S.withConstructorDefault(Effect.succeed("enter" as const))).annotateKey({
      description: "Which keystroke submits the message.",
    }),
  },
  $I.annote("ComposerFeatures", {
    description:
      "Which composer plugins mount and which keystroke sends; every field defaults to its chat-surface default.",
  })
) {}

/**
 * Typed callback applied to the editor when a slash/mention option is selected.
 *
 * @example
 * ```ts
 * import type { EditorEffect } from "@beep/editor/chat/config"
 *
 * const focusEditor: EditorEffect = (editor) => {
 *   editor.focus()
 * }
 *
 * const callbackArity = focusEditor.length
 * console.log(callbackArity) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EditorEffect = (editor: LexicalEditor) => void;

const isEditorEffect = (u: unknown): u is EditorEffect => P.isFunction(u);

const EditorEffectSchema = S.declare<EditorEffect>(isEditorEffect).pipe(
  $I.annoteSchema("EditorEffect", {
    description: "A side effect applied to the LexicalEditor when an option is selected.",
  })
);

/**
 * A single `/` command. The foundation owns the menu mechanism; the app injects
 * the items via {@link SlashItem.make}. `onSelect` runs after the typed `/query`
 * text has been removed and receives the editor so the item can mutate the
 * current selection (e.g. set a heading or insert a list).
 *
 * @example
 * ```ts
 * import { SlashItem } from "@beep/editor/chat/config"
 *
 * const item = SlashItem.make({ key: "h1", label: "Heading 1", onSelect: () => {} })
 * console.log(item.label) // "Heading 1"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class SlashItem extends S.Class<SlashItem>($I`SlashItem`)(
  {
    /** Stable identity used as the menu option key. */
    key: S.NonEmptyString.annotateKey({ description: "Stable identity used as the menu option key." }),
    /** Display label. */
    label: S.NonEmptyString.annotateKey({ description: "Display label." }),
    /** Optional right-aligned hint / shortcut keyword shown in the menu. */
    hint: S.optionalKey(S.String).annotateKey({
      description: "Optional right-aligned hint or shortcut keyword shown in the menu.",
    }),
    /** Extra search terms used for fuzzy filtering beyond the label. */
    keywords: S.Array(S.NonEmptyString).pipe(S.optionalKey).annotateKey({
      description: "Extra non-empty search terms used for fuzzy filtering beyond the label.",
    }),
    /** Optional leading icon. */
    icon: S.optionalKey(DOMReactNode).annotateKey({ description: "Optional leading icon." }),
    /** Apply the command to the editor (runs inside the menu selection flow). */
    onSelect: EditorEffectSchema.annotateKey({
      description: "Apply the command to the editor inside the menu selection flow.",
    }),
  },
  $I.annote("SlashItem", {
    description: "A single `/` command: identity, label, optional hint/keywords/icon, and an editor side effect.",
  })
) {}

const uniqueSlashItemKeys = S.makeFilter<ReadonlyArray<SlashItem>>(
  (items) => {
    const seen = MutableHashSet.empty<string>();
    return A.filterMap(items, (item, index) => {
      if (MutableHashSet.has(seen, item.key)) {
        return Result.succeed({
          path: [index, "key"],
          issue: `Duplicate slash-command key "${item.key}".`,
        });
      }
      MutableHashSet.add(seen, item.key);
      return Result.fail(undefined);
    });
  },
  {
    identifier: $I`UniqueSlashItemKeys`,
    title: "Unique slash-command keys",
    description: "Every slash command must have a unique key.",
  }
);

/**
 * Runtime schema for the complete slash-command collection accepted by
 * {@link ChatComposer}. Decoding the collection at the mount boundary prevents
 * malformed plain-object entries from reaching Lexical callbacks.
 *
 * @example
 * ```ts
 * import { SlashItem, SlashItems } from "@beep/editor/chat/config"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const items = S.decodeUnknownResult(SlashItems)([
 *   SlashItem.make({ key: "paragraph", label: "Paragraph", onSelect: () => {} }),
 * ])
 * console.log(Result.isSuccess(items)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SlashItems = S.Array(SlashItem)
  .check(uniqueSlashItemKeys)
  .pipe(
    $I.annoteSchema("SlashItems", {
      description: "The runtime-decoded slash-command collection accepted by ChatComposer.",
    })
  );

/**
 * Companion type for {@link SlashItems}.
 *
 * @example
 * ```ts
 * import type { SlashItems } from "@beep/editor/chat/config"
 *
 * const items: SlashItems = []
 * console.log(items.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SlashItems = typeof SlashItems.Type;

/**
 * A single `@` mention candidate. Mentions are ephemeral composer affordances:
 * on select they serialize to plain text (`@label`), never a persisted node.
 *
 * @example
 * ```ts
 * import { MentionOption } from "@beep/editor/chat/config"
 *
 * const option = MentionOption.make({ id: "u1", label: "Ada Lovelace" })
 * console.log(option.label) // "Ada Lovelace"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MentionOption extends S.Class<MentionOption>($I`MentionOption`)(
  {
    /** Stable identity used as the menu option key. */
    id: S.NonEmptyString.annotateKey({ description: "Stable identity used as the menu option key." }),
    /** Display label, also the inserted text (`@label`). */
    label: S.NonEmptyString.annotateKey({ description: "Display label, also the inserted mention text." }),
    /** Optional secondary line (e.g. a role or handle). */
    hint: S.optionalKey(S.String).annotateKey({ description: "Optional secondary line, such as a role or handle." }),
    /** Optional leading icon/avatar. */
    icon: S.optionalKey(DOMReactNode).annotateKey({ description: "Optional leading icon or avatar." }),
  },
  $I.annote("MentionOption", {
    description: "A single `@` mention candidate: identity, label, and optional hint/icon.",
  })
) {}

const uniqueMentionOptionIds = S.makeFilter<ReadonlyArray<MentionOption>>(
  (options) => {
    const seen = MutableHashSet.empty<string>();
    return A.filterMap(options, (option, index) => {
      if (MutableHashSet.has(seen, option.id)) {
        return Result.succeed({
          path: [index, "id"],
          issue: `Duplicate mention-option id "${option.id}".`,
        });
      }
      MutableHashSet.add(seen, option.id);
      return Result.fail(undefined);
    });
  },
  {
    identifier: $I`UniqueMentionOptionIds`,
    title: "Unique mention-option ids",
    description: "Every mention option must have a unique id.",
  }
);

/**
 * Runtime schema for a mention-source response. Sources are app-injected and
 * may cross an async boundary, so every response is decoded before its values
 * are exposed to the typeahead menu.
 *
 * @example
 * ```ts
 * import { MentionOptions } from "@beep/editor/chat/config"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const options = S.decodeUnknownResult(MentionOptions)([{ id: "ada", label: "Ada" }])
 * console.log(Result.isSuccess(options)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const MentionOptions = S.Array(MentionOption)
  .check(uniqueMentionOptionIds)
  .pipe(
    $I.annoteSchema("MentionOptions", {
      description: "The runtime-decoded mention candidates returned by an app-injected source.",
    })
  );

/**
 * Companion type for {@link MentionOptions}.
 *
 * @example
 * ```ts
 * import type { MentionOptions } from "@beep/editor/chat/config"
 *
 * const options: MentionOptions = []
 * console.log(options.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MentionOptions = typeof MentionOptions.Type;

/**
 * App-injected source of `@` mention candidates for a query. May be sync or
 * async; the composer races stale responses out by request order. Modeled as a
 * typed function schema so the composer can hold it as schema-backed config.
 *
 * @example
 * ```ts
 * import { MentionSource } from "@beep/editor/chat/config"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(MentionSource)((q: string) => [])) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type MentionSource = (query: string) => ReadonlyArray<MentionOption> | Promise<ReadonlyArray<MentionOption>>;

// Type guard backing the {@link MentionSource} schema's `S.declare`.
const isMentionSource = (u: unknown): u is MentionSource => P.isFunction(u);

/**
 * Schema for {@link MentionSource}.
 *
 * @example
 * ```ts
 * import { MentionOption, MentionSource } from "@beep/editor/chat/config"
 * import * as S from "effect/Schema"
 *
 * const source = (query: string) => [
 *   MentionOption.make({ id: query, label: `@${query}` }),
 * ]
 *
 * console.log(S.is(MentionSource)(source)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const MentionSource = S.declare<MentionSource>(isMentionSource).pipe(
  $I.annoteSchema("MentionSource", {
    description: "App-injected source of `@` mention candidates for a query.",
  })
);

/**
 * Consumer port notified after attachment files pass capture validation.
 * Promise-returning ports are awaited; rejection rolls the current batch back
 * and surfaces a typed inline failure.
 *
 * @example
 * ```ts
 * import type { AttachmentPort } from "@beep/editor/chat/config"
 *
 * const attach: AttachmentPort = async (files) => {
 *   console.log(files.length)
 * }
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type AttachmentPort = (files: ReadonlyArray<File>) => void | Promise<void>;

/**
 * Consumer port invoked with the live, schema-decoded editor state when the
 * composer dispatches a send.
 *
 * @example
 * ```ts
 * import type { SendPort } from "@beep/editor/chat/config"
 *
 * const send: SendPort = (state) => state.root.children.length > 0
 * console.log(typeof send) // "function"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export type SendPort = (state: SerializedEditorState) => boolean | void;
