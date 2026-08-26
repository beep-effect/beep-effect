/**
 * Lexical runtime bindings for resolved capability profiles.
 *
 * @packageDocumentation \@beep/editor/capability/runtime
 * @since 0.0.0
 */
"use client";

import { A, dual, O, Str } from "@beep/utils";
import { useAtomMount } from "@effect/atom-react";
import { $createCodeNode, CodeNode } from "@lexical/code";
import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from "@lexical/link";
import {
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListItemNode,
  ListNode,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import {
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  CHECK_LIST,
  CODE,
  HEADING,
  HIGHLIGHT,
  INLINE_CODE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  LINK,
  ORDERED_LIST,
  QUOTE,
  STRIKETHROUGH,
  UNORDERED_LIST,
} from "@lexical/markdown";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { $createHeadingNode, $createQuoteNode, HeadingNode, QuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { Data, Equal } from "effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { Atom } from "effect/unstable/reactivity";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  KEY_DOWN_COMMAND,
  LineBreakNode,
  ParagraphNode,
  REDO_COMMAND,
  TabNode,
  TextNode,
  UNDO_COMMAND,
} from "lexical";
import { ArtifactRefNode } from "../artifact-ref-node.tsx";
import { $selectionBlockType } from "../chat/toolbar.tsx";
import { YouTubeNode } from "../youtube-node.tsx";
import { KeyChord, Platform as PlatformSchema } from "./schemas.ts";
import type { Transformer } from "@lexical/markdown";
import type { ElementNode, Klass, LexicalEditor, LexicalNode, TextFormatType } from "lexical";
import type { JSX } from "react";
import type { CommandId, NodeRegistrationKey, Platform, ResolvedEditorProfile, TransformerKey } from "./schemas.ts";

/** Runtime node constructors keyed by catalog registration name.
 *
 * **Example** (Read the paragraph registration)
 * ```ts import.meta.vitest name="Read the paragraph registration"
 * import { nodeRegistrations } from "@beep/editor/capability/runtime"
 * nodeRegistrations.ParagraphNode.name // => "ParagraphNode"
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const nodeRegistrations: Record<NodeRegistrationKey, Klass<LexicalNode>> = {
  TextNode,
  TabNode,
  LineBreakNode,
  ParagraphNode,
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  CodeNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  YouTubeNode,
  ArtifactRefNode,
};

/** Projects node constructors in resolved registration order.
 *
 * **Example** (Project readable nodes)
 * ```ts import.meta.vitest name="Project readable nodes"
 * import { resolvedNodes } from "@beep/editor/capability/runtime"
 * typeof resolvedNodes // => "function"
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const resolvedNodes = (resolved: ResolvedEditorProfile): ReadonlyArray<Klass<LexicalNode>> =>
  A.map(resolved.registrations.nodes, (key) => nodeRegistrations[key]);

/** Markdown transformers keyed by catalog registration name.
 *
 * **Example** (Read heading transformer)
 * ```ts import.meta.vitest name="Read heading transformer"
 * import { transformerRegistrations } from "@beep/editor/capability/runtime"
 * transformerRegistrations.HEADING.type // => "element"
 * ```
 * @category configuration
 * @since 0.0.0
 */
export const transformerRegistrations: Record<TransformerKey, Transformer> = {
  HEADING,
  QUOTE,
  CODE,
  UNORDERED_LIST,
  ORDERED_LIST,
  CHECK_LIST,
  INLINE_CODE,
  BOLD_STAR,
  BOLD_UNDERSCORE,
  BOLD_ITALIC_STAR,
  BOLD_ITALIC_UNDERSCORE,
  ITALIC_STAR,
  ITALIC_UNDERSCORE,
  HIGHLIGHT,
  STRIKETHROUGH,
  LINK,
};

/** Projects Markdown transformers in resolved registration order.
 *
 * **Example** (Project transformers)
 * ```ts import.meta.vitest name="Project transformers"
 * import { resolvedTransformers } from "@beep/editor/capability/runtime"
 * typeof resolvedTransformers // => "function"
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const resolvedTransformers = (resolved: ResolvedEditorProfile): ReadonlyArray<Transformer> =>
  A.map(resolved.registrations.transformers, (key) => transformerRegistrations[key]);

const format =
  (value: TextFormatType) =>
  (editor: LexicalEditor): void => {
    void editor.dispatchCommand(FORMAT_TEXT_COMMAND, value);
  };
const setBlock =
  (make: () => ElementNode) =>
  (editor: LexicalEditor): void =>
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) $setBlocksType(selection, make);
    });
const toggleList =
  (target: "bullet" | "number" | "check", command: typeof INSERT_UNORDERED_LIST_COMMAND) =>
  (editor: LexicalEditor): void =>
    editor.update(() => {
      void editor.dispatchCommand($selectionBlockType() === target ? REMOVE_LIST_COMMAND : command, undefined);
    });
const clearFormatting = (editor: LexicalEditor): void =>
  editor.update(() => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    // `extract` splits the boundary text nodes so only the selected range
    // loses its formatting.
    A.forEach(selection.extract(), (node) => {
      if ($isTextNode(node)) node.setFormat(0).setStyle("");
    });
  });
const toggleLink = (editor: LexicalEditor): void => {
  const linked = editor.getEditorState().read(() => {
    const selection = $getSelection();
    return $isRangeSelection(selection) && A.some(selection.getNodes(), (node) => $isLinkNode(node.getParent()));
  });
  void editor.dispatchCommand(TOGGLE_LINK_COMMAND, linked ? null : "https://");
};

/** Executable Lexical handlers keyed by resolved command id.
 *
 * **Example** (Inspect the bold handler)
 * ```ts import.meta.vitest name="Inspect the bold handler"
 * import { commandHandlers } from "@beep/editor/capability/runtime"
 * typeof commandHandlers["format.bold"] // => "function"
 * ```
 * @category commands
 * @since 0.0.0
 */
export const commandHandlers: Readonly<Record<string, (editor: LexicalEditor) => void>> = {
  "format.bold": format("bold"),
  "format.italic": format("italic"),
  "format.strikethrough": format("strikethrough"),
  "format.inline-code": format("code"),
  "format.underline": format("underline"),
  "format.subscript": format("subscript"),
  "format.superscript": format("superscript"),
  "format.lowercase": format("lowercase"),
  "format.uppercase": format("uppercase"),
  "format.capitalize": format("capitalize"),
  "format.clear": clearFormatting,
  "format.link": toggleLink,
  "block.paragraph": setBlock($createParagraphNode),
  "block.heading-1": setBlock(() => $createHeadingNode("h1")),
  "block.heading-2": setBlock(() => $createHeadingNode("h2")),
  "block.heading-3": setBlock(() => $createHeadingNode("h3")),
  "block.quote": setBlock($createQuoteNode),
  "block.code": setBlock($createCodeNode),
  "block.numbered-list": toggleList("number", INSERT_ORDERED_LIST_COMMAND),
  "block.bullet-list": toggleList("bullet", INSERT_UNORDERED_LIST_COMMAND),
  "block.check-list": toggleList("check", INSERT_CHECK_LIST_COMMAND),
  "history.undo": (editor) => void editor.dispatchCommand(UNDO_COMMAND, undefined),
  "history.redo": (editor) => void editor.dispatchCommand(REDO_COMMAND, undefined),
};

/** Runs a catalog command when a runtime handler exists.
 *
 * **Example** (Reference command runner)
 * ```ts import.meta.vitest name="Reference command runner"
 * import { runCommand } from "@beep/editor/capability/runtime"
 * typeof runCommand // => "function"
 * ```
 * @category commands
 * @since 0.0.0
 */
export const runCommand: {
  (commandId: CommandId): (editor: LexicalEditor) => void;
  (editor: LexicalEditor, commandId: CommandId): void;
} = dual(2, (editor: LexicalEditor, commandId: CommandId): void => {
  O.match(R.get(commandHandlers, commandId), { onNone: () => undefined, onSome: (handler) => handler(editor) });
});

/** Converts a keyboard event into the canonical chord vocabulary.
 *
 * **Example** (Read a Ctrl+B event)
 * ```ts
 * import * as O from "effect/Option"
 * import { chordFromKeyboardEvent } from "@beep/editor/capability/runtime"
 * const chord = chordFromKeyboardEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true }), "windows-linux")
 * console.log(O.isSome(chord)) // true
 * ```
 * @category combinators
 * @since 0.0.0
 */
export const chordFromKeyboardEvent: {
  (platform: Platform): (event: KeyboardEvent) => O.Option<KeyChord>;
  (event: KeyboardEvent, platform: Platform): O.Option<KeyChord>;
} = dual(2, (event: KeyboardEvent, platform: Platform): O.Option<KeyChord> => {
  // AltGr reports ctrlKey + altKey on Windows/Linux layouts; it is typing a
  // layout character, never a Ctrl+Alt chord.
  if (event.getModifierState("AltGraph")) return O.none();
  const digit = Str.startsWith("Digit")(event.code) ? Str.slice(5)(event.code) : "";
  const key = digit === "" ? Str.toLowerCase(event.key) : digit;
  if (key === "" || key === "control" || key === "meta" || key === "alt" || key === "shift") return O.none();
  const modifiers = A.filter(
    ["control", "meta", "alt", "shift"] as const,
    (modifier) =>
      (modifier === "control" && event.ctrlKey) ||
      (modifier === "meta" && event.metaKey) ||
      (modifier === "alt" && event.altKey) ||
      (modifier === "shift" && event.shiftKey)
  );
  return O.some(KeyChord.make({ modifiers, key: PlatformSchema.is.apple(platform) && key === "os" ? "meta" : key }));
});

/** Detects the host keyboard platform without failing during SSR.
 *
 * **Example** (Detect platform)
 * ```ts
 * import { detectPlatform } from "@beep/editor/capability/runtime"
 * console.log(detectPlatform() === "apple" || detectPlatform() === "windows-linux") // true
 * ```
 * @category utilities
 * @since 0.0.0
 */
export const detectPlatform = (): Platform => {
  const browserNavigator = globalThis.navigator;
  if (P.isUndefined(browserNavigator)) return "windows-linux";
  const identity = `${browserNavigator.platform} ${browserNavigator.userAgent}`;
  return Str.includes("Mac")(identity) || Str.includes("iPhone")(identity) || Str.includes("iPad")(identity)
    ? "apple"
    : "windows-linux";
};

/** Mounts the resolved non-projection Lexical plugin set.
 *
 * **Example** (Declare extensions)
 * ```tsx
 * import { ResolvedExtensions } from "@beep/editor/capability/runtime"
 * console.log(typeof ResolvedExtensions) // "function"
 * ```
 * @category components
 * @since 0.0.0
 */
export function ResolvedExtensions({ resolved }: { readonly resolved: ResolvedEditorProfile }): JSX.Element {
  const has = (key: ResolvedEditorProfile["registrations"]["extensions"][number]): boolean =>
    A.contains(resolved.registrations.extensions, key);
  return (
    <>
      {has("HistoryPlugin") ? <HistoryPlugin /> : undefined}
      {has("ListPlugin") ? <ListPlugin /> : undefined}
      {has("CheckListPlugin") ? <CheckListPlugin /> : undefined}
      {has("LinkPlugin") ? <LinkPlugin /> : undefined}
      {has("MarkdownShortcutPlugin") ? (
        <MarkdownShortcutPlugin transformers={[...resolvedTransformers(resolved)]} />
      ) : undefined}
    </>
  );
}

/** Owns resolved and guarded chords at high Lexical command priority.
 *
 * **Details**
 *
 * The plugin mounts only when the resolved profile enables
 * `extension.shortcut-help` (the atlas identity of the Playground's
 * `ShortcutsPlugin`, which owns keyboard chords there too). Without it the
 * profile keeps Lexical's native chords — the compatibility profile relies on
 * that to stay byte-identical for existing `EditorComposer` consumers. A
 * profile that overrides or unbinds commands must therefore enable
 * `extension.shortcut-help`; the resolver's `guardedChords` then swallow both
 * disabled capabilities' chords and any replaced defaults.
 *
 * **Example** (Reference keybinding plugin)
 * ```tsx
 * import { KeybindingPlugin } from "@beep/editor/capability/runtime"
 * console.log(typeof KeybindingPlugin) // "function"
 * ```
 * @category components
 * @since 0.0.0
 */
export function KeybindingPlugin({
  resolved,
  platform,
}: {
  readonly resolved: ResolvedEditorProfile;
  readonly platform: Platform;
}): JSX.Element | undefined {
  const [editor] = useLexicalComposerContext();
  const registration = keybindingRegistrationAtom(new KeybindingKey({ editor, resolved, platform }));
  useAtomMount(registration);
  return undefined;
}

// Structural family key: the editor by reference, the mount-immutable resolved
// profile by value, the platform by value — a re-render reuses the same atom
// instead of re-registering the keydown handler.
class KeybindingKey extends Data.Class<{
  readonly editor: LexicalEditor;
  readonly resolved: ResolvedEditorProfile;
  readonly platform: Platform;
}> {}

const keybindingRegistrationAtom = Atom.family((key: KeybindingKey) =>
  Atom.make((get) => {
    const { editor, resolved, platform } = key;
    if (!A.contains(resolved.registrations.extensions, "ShortcutHelpProjection")) return undefined;
    get.addFinalizer(
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) =>
          O.match(chordFromKeyboardEvent(event, platform), {
            onNone: () => false,
            onSome: (chord) => {
              const command = A.findFirst(resolved.commands, (candidate) =>
                A.some(
                  candidate.keybindings,
                  (binding) => Equal.equals(binding.platform, platform) && Equal.equals(binding.chord, chord)
                )
              );
              if (O.isSome(command)) {
                event.preventDefault();
                runCommand(editor, command.value.id);
                return true;
              }
              const guarded = A.some(
                resolved.guardedChords,
                (binding) => Equal.equals(binding.platform, platform) && Equal.equals(binding.chord, chord)
              );
              if (guarded) event.preventDefault();
              return guarded;
            },
          }),
        COMMAND_PRIORITY_HIGH
      )
    );
    return undefined;
  }).pipe(Atom.setIdleTTL(0))
);
