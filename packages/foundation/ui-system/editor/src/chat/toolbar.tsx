/**
 * The fixed formatting toolbar mounted above the editable surface: text marks
 * (bold/italic/underline/strikethrough/inline-code), list blocks (bulleted/
 * numbered/check), quote, and code block. Button pressed-state mirrors the
 * current selection so the bar stays in sync as the caret moves.
 *
 * Per the repo atom-first law the selection-mirroring registration is a
 * per-editor `@effect/atom` binding ({@link toolbarSelectionAtom}) rather than a
 * `useState` + `useEffect` pair: the read fn registers the Lexical update +
 * selection-change listeners (torn down via the atom finalizer) and pushes the
 * derived selection snapshot with `get.setSelf`.
 *
 * @packageDocumentation \@beep/editor/chat/toolbar
 * @since 0.0.0
 */

import { $EditorId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { Button } from "@beep/ui/components/button";
import { Separator } from "@beep/ui/components/separator";
import { Toggle } from "@beep/ui/components/toggle";
import { cn } from "@beep/ui/lib/utils";
import { useAtomValue } from "@effect/atom-react";
import { $createCodeNode, $isCodeNode } from "@lexical/code";
import {
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
} from "@lexical/list";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createQuoteNode, $isHeadingNode, $isQuoteNode } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";
import { $isTableCellNode } from "@lexical/table";
import { CodeIcon } from "@phosphor-icons/react/Code";
import { CodeBlockIcon } from "@phosphor-icons/react/CodeBlock";
import { ListBulletsIcon } from "@phosphor-icons/react/ListBullets";
import { ListChecksIcon } from "@phosphor-icons/react/ListChecks";
import { ListNumbersIcon } from "@phosphor-icons/react/ListNumbers";
import { QuotesIcon } from "@phosphor-icons/react/Quotes";
import { TextBIcon } from "@phosphor-icons/react/TextB";
import { TextItalicIcon } from "@phosphor-icons/react/TextItalic";
import { TextStrikethroughIcon } from "@phosphor-icons/react/TextStrikethrough";
import { TextUnderlineIcon } from "@phosphor-icons/react/TextUnderline";
import { Match } from "effect";
import { Atom } from "effect/unstable/reactivity";
import {
  $createParagraphNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from "lexical";
import type { ElementNode, LexicalEditor, LexicalNode, TextFormatType } from "lexical";
import type { JSX, ReactNode } from "react";

const $I = $EditorId.create("chat/toolbar");

/**
 * Schema for the block families represented by the fixed toolbar.
 *
 * **Example** (Check code block type)
 *
 * ```ts import.meta.vitest name="Check code block type"
 * import { BlockType } from "@beep/editor/chat/toolbar"
 *
 * BlockType.is.code("code") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BlockType = LiteralKit([
  "paragraph",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "quote",
  "code",
  "bullet",
  "number",
  "check",
]).pipe(
  $I.annoteSchema("BlockType", {
    description: "The type of block that is currently selected.",
  })
);

/**
 * Block family represented by the fixed toolbar.
 *
 * **Example** (Assign selected block type)
 *
 * ```ts import.meta.vitest name="Assign selected block type"
 * import type { BlockType } from "@beep/editor/chat/toolbar"
 *
 * const selectedBlock: BlockType = "code"
 * selectedBlock // => "code"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BlockType = typeof BlockType.Type;

interface SelectionState {
  readonly blockType: BlockType;
  readonly bold: boolean;
  readonly code: boolean;
  readonly italic: boolean;
  readonly strikethrough: boolean;
  readonly underline: boolean;
}

const INITIAL_STATE: SelectionState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  blockType: "paragraph",
};

// Maps a Lexical list type onto the toolbar's {@link BlockType}. Shared by the
// direct-list and ancestor-list branches so the mapping lives in one place.
const blockTypeFromListType = (listType: "number" | "bullet" | "check"): BlockType =>
  listType === "number" ? "number" : listType === "check" ? "check" : "bullet";

const blockTypeFromNode = Match.type<LexicalNode>().pipe(
  Match.when($isListNode, (node) => blockTypeFromListType(node.getListType())),
  Match.when($isHeadingNode, (node) => node.getTag()),
  Match.when($isQuoteNode, BlockType.thunk.quote),
  Match.when($isCodeNode, BlockType.thunk.code),
  // A table cell is the local block boundary. Do not climb to the table's
  // top-level node: classify the nearest supported block inside this cell.
  Match.when($isTableCellNode, BlockType.thunk.paragraph),
  Match.orElse(() => undefined)
);

// The block type of the current selection, read from live editor state. Must run
// inside a Lexical lexical-scope (`editorState.read` or `editor.update`), where
// the `$`-prefixed helpers are valid.
//
// Block toggles must resolve this here rather than from the React snapshot in
// {@link toolbarSelectionAtom}: the snapshot lags the editor by a render, so two
// quick presses both saw the pre-toggle type and *created* a second block
// instead of toggling back — nesting a code block inside a quote while both
// buttons still reported unpressed.
/**
 * Classifies the nearest supported block ancestor of the live range
 * selection, stopping at a table-cell boundary.
 *
 * **Details**
 *
 * Must run inside a Lexical read/update scope. Exported so custom toolbars and
 * selection-focused tests share the exact same classification semantics.
 *
 * **Example** (Read selection block type)
 *
 * ```ts
 * import { $selectionBlockType } from "@beep/editor/chat/toolbar"
 * import { createEditor } from "lexical"
 *
 * const editor = createEditor()
 * console.log(editor.getEditorState().read($selectionBlockType)) // "paragraph"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const $selectionBlockType = (): BlockType => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return "paragraph";
  let node: LexicalNode | null = selection.anchor.getNode();

  while (node !== null && node.getKey() !== "root") {
    const blockType = blockTypeFromNode(node);
    if (blockType !== undefined) return blockType;
    node = node.getParent();
  }
  return "paragraph";
};

// Reads the current selection's marks + block type. Must run inside an
// editorState.read (a Lexical lexical-scope), where the `$`-prefixed helpers are
// valid.
const computeSelectionState = (): SelectionState => {
  const selection = $getSelection();
  if (!$isRangeSelection(selection)) return INITIAL_STATE;
  return {
    bold: selection.hasFormat("bold"),
    italic: selection.hasFormat("italic"),
    underline: selection.hasFormat("underline"),
    strikethrough: selection.hasFormat("strikethrough"),
    code: selection.hasFormat("code"),
    blockType: $selectionBlockType(),
  };
};

/**
 * Per-editor selection snapshot mirrored from the current Lexical selection. The
 * read fn registers the update + selection-change listeners (torn down via the
 * atom finalizer) and pushes new snapshots with `get.setSelf`.
 *
 * **Example** (Read the initial snapshot for a headless editor)
 *
 * ```ts
 * import { toolbarSelectionAtom } from "@beep/editor/chat/toolbar"
 * import { createHeadlessEditor } from "@lexical/headless"
 * import { AtomRegistry } from "effect/unstable/reactivity"
 *
 * const editor = createHeadlessEditor({ namespace: "example" })
 * const registry = AtomRegistry.make()
 * console.log(registry.get(toolbarSelectionAtom(editor)).blockType) // "paragraph"
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const toolbarSelectionAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    get.addFinalizer(
      editor.registerUpdateListener(({ editorState }) => get.setSelf(editorState.read(computeSelectionState)))
    );
    get.addFinalizer(
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          get.setSelf(editor.getEditorState().read(computeSelectionState));
          return false;
        },
        COMMAND_PRIORITY_LOW
      )
    );
    return editor.getEditorState().read(computeSelectionState);
  })
);

// Keep the editor selection alive: a toolbar press must not blur the editor
// before the format/command dispatch runs.
const preventBlur = (event: { preventDefault: () => void }): void => event.preventDefault();

interface ToolbarToggleProps {
  readonly children: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
  readonly pressed: boolean;
}

// Toggleable text marks (bold/italic/underline/strikethrough/inline-code). The
// canonical `Toggle` surfaces an unmistakable pressed state via `data-[pressed]`
// (accent fill + foreground) in both light and dark themes. We drive `pressed`
// straight from the selection atom and dispatch on press, so the Lexical command
// — not the toggle's internal state — remains the source of truth.
function ToolbarToggle({ pressed, label, onClick, children }: ToolbarToggleProps): JSX.Element {
  return (
    <Toggle size="sm" aria-label={label} title={label} pressed={pressed} onMouseDown={preventBlur} onClick={onClick}>
      {children}
    </Toggle>
  );
}

interface ToolbarButtonProps {
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly label: string;
  readonly onClick: () => void;
}

// One-shot / block actions (lists, quote, code block). Canonical ghost
// icon button; when the block is active we mirror the toggle's pressed
// styling so the active state reads identically across the bar.
function ToolbarButton({ active = false, label, onClick, children }: ToolbarButtonProps): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(active && "bg-accent text-accent-foreground hover:bg-accent hover:text-accent-foreground")}
      onMouseDown={preventBlur}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

function ToolbarDivider(): JSX.Element {
  return <Separator orientation="vertical" className="mx-1 h-5" />;
}

/**
 * Fixed formatting toolbar plugin. Mount inside a `LexicalComposer`.
 *
 * **Example** (Mount fixed toolbar plugin)
 *
 * ```tsx
 * import { FixedToolbarPlugin } from "@beep/editor/chat/toolbar"
 *
 * function ComposerToolbar() {
 *   return <FixedToolbarPlugin />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function FixedToolbarPlugin(): JSX.Element {
  const [editor] = useLexicalComposerContext();
  const state = useAtomValue(toolbarSelectionAtom(editor));

  const formatText = (format: TextFormatType): void => void editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);

  const setBlock = (target: BlockType, create: () => ElementNode): void =>
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        // Toggle against the live block type, never the rendered snapshot.
        $setBlocksType<ElementNode>(
          selection,
          $selectionBlockType() === target ? () => $createParagraphNode() : create
        );
      }
    });

  const toggleList = (target: BlockType, insert: typeof INSERT_UNORDERED_LIST_COMMAND): void =>
    editor.update(() => {
      if ($selectionBlockType() === target) {
        editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
      } else {
        editor.dispatchCommand(insert, undefined);
      }
    });

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="border-border flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1"
    >
      <ToolbarToggle pressed={state.bold} label="Bold" onClick={() => formatText("bold")}>
        <TextBIcon />
      </ToolbarToggle>
      <ToolbarToggle pressed={state.italic} label="Italic" onClick={() => formatText("italic")}>
        <TextItalicIcon />
      </ToolbarToggle>
      <ToolbarToggle pressed={state.underline} label="Underline" onClick={() => formatText("underline")}>
        <TextUnderlineIcon />
      </ToolbarToggle>
      <ToolbarToggle pressed={state.strikethrough} label="Strikethrough" onClick={() => formatText("strikethrough")}>
        <TextStrikethroughIcon />
      </ToolbarToggle>
      <ToolbarToggle pressed={state.code} label="Inline code" onClick={() => formatText("code")}>
        <CodeIcon />
      </ToolbarToggle>
      <ToolbarDivider />
      <ToolbarButton
        active={state.blockType === "bullet"}
        label="Bulleted list"
        onClick={() => toggleList("bullet", INSERT_UNORDERED_LIST_COMMAND)}
      >
        <ListBulletsIcon />
      </ToolbarButton>
      <ToolbarButton
        active={state.blockType === "number"}
        label="Numbered list"
        onClick={() => toggleList("number", INSERT_ORDERED_LIST_COMMAND)}
      >
        <ListNumbersIcon />
      </ToolbarButton>
      <ToolbarButton
        active={state.blockType === "check"}
        label="Check list"
        onClick={() => toggleList("check", INSERT_CHECK_LIST_COMMAND)}
      >
        <ListChecksIcon />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        active={state.blockType === "quote"}
        label="Quote"
        onClick={() => setBlock("quote", () => $createQuoteNode())}
      >
        <QuotesIcon />
      </ToolbarButton>
      <ToolbarButton
        active={state.blockType === "code"}
        label="Code block"
        onClick={() => setBlock("code", () => $createCodeNode())}
      >
        <CodeBlockIcon />
      </ToolbarButton>
    </div>
  );
}
