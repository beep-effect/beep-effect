/**
 * `/` slash and `@` mention typeahead menus, both built on Lexical's official
 * {@link LexicalTypeaheadMenuPlugin} (the canonical trigger-character primitive
 * that underlies both). The shared {@link LexicalMenu} delegate already supplies
 * the WAI-ARIA combobox keyboard contract (Down/Up/Enter/Escape with focus
 * staying in the editor and the active option tracked via `aria-activedescendant`
 * on the editor root). Each rendered option carries `role="option"` and the
 * `typeahead-item-${index}` id the delegate points `aria-activedescendant` at.
 * {@link ComboboxAriaPlugin} completes the pattern by marking the editor root as
 * `role="combobox"`.
 *
 * Per the repo atom-first law the per-editor query/options/request state and the
 * combobox-ARIA root-listener registration are `@effect/atom` families keyed by
 * the `LexicalEditor` (no `useState`/`useEffect`/`useMemo`/`useRef`); the
 * menu-open booleans are written into the shared {@link menusOpenAtom}.
 *
 * @packageDocumentation \@beep/editor/chat/typeahead
 * @since 0.0.0
 */

import { cn } from "@beep/ui/lib/utils";
import { A } from "@beep/utils";
import { RegistryContext, useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { Atom } from "effect/unstable/reactivity";
import { $createTextNode, $getSelection, $isRangeSelection } from "lexical";
import { useContext } from "react";
import { createPortal } from "react-dom";
import { anyMenuOpenAtom, menusOpenAtom, TYPEAHEAD_MENU_ATTRIBUTE } from "./atoms.ts";
import type { MenuRenderFn } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import type { LexicalEditor } from "lexical";
import type { ReactNode, RefObject } from "react";
import type { MentionOption, MentionSource, SlashItem } from "./config.ts";

class SlashMenuOption extends MenuOption {
  readonly item: SlashItem;
  constructor(item: SlashItem) {
    super(item.key);
    this.item = item;
  }
}

class MentionMenuOption extends MenuOption {
  readonly option: MentionOption;
  constructor(option: MentionOption) {
    super(option.id);
    this.option = option;
  }
}

// Whether a slash item matches the (already trimmed + lowercased) query across
// its label, hint, or keywords. Extracted so the filter predicate reads as one
// named match rather than an inline conditional chain.
const slashItemMatchesQuery = (item: SlashItem, q: string): boolean =>
  item.label.toLowerCase().includes(q) ||
  (item.hint?.toLowerCase().includes(q) ?? false) ||
  A.some(item.keywords ?? [], (keyword) => keyword.toLowerCase().includes(q));

const filterSlashItems = (items: ReadonlyArray<SlashItem>, query: string): ReadonlyArray<SlashItem> => {
  const q = query.trim().toLowerCase();
  if (q === "") return items;
  return A.filter(items, (item) => slashItemMatchesQuery(item, q));
};

// Per-editor `/` query text. Writable; the typeahead writes the live query.
const slashQueryAtom = Atom.family((_editor: LexicalEditor) => Atom.make<string>(""));

// Per-editor `@` mention options resolved from the app source.
const mentionOptionsAtom = Atom.family((_editor: LexicalEditor) => Atom.make<ReadonlyArray<MentionMenuOption>>([]));

// Per-editor monotonic mention-request id, so stale async responses are dropped.
const mentionRequestIdAtom = Atom.family((_editor: LexicalEditor) => Atom.make<number>(0));

// Whether the latest `@` lookup failed. A rejected source must not be
// indistinguishable from "no matches": the menu renders an unavailable row.
const mentionFailedAtom = Atom.family((_editor: LexicalEditor) => Atom.make<boolean>(false));

// Bumped whenever the viewport moves under an open menu. `TypeaheadMenuList`
// reads it so the fixed-position listbox is recomputed on scroll/resize instead
// of detaching from the caret; listeners live only while a menu is mounted.
const viewportTickAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    const bump = (): void => get.setSelf(get.once(viewportTickAtom(editor)) + 1);
    // Capture-phase scroll so movement of any ancestor pane counts, not just window.
    window.addEventListener("scroll", bump, true);
    window.addEventListener("resize", bump);
    get.addFinalizer(() => {
      window.removeEventListener("scroll", bump, true);
      window.removeEventListener("resize", bump);
    });
    return 0;
  })
);

interface MenuListProps<TOption extends MenuOption> {
  readonly anchorElementRef: RefObject<HTMLElement | null>;
  readonly options: Array<TOption>;
  readonly renderItem: (option: TOption) => ReactNode;
  readonly selectedIndex: number | null;
  readonly selectOptionAndCleanUp: (option: TOption) => void;
  readonly setHighlightedIndex: (index: number) => void;
}

// max-h-72 (288px) plus the 4px gap between the caret line and the listbox.
const MENU_MAX_HEIGHT_PX = 292;
// w-64, used to clamp the menu inside the viewport horizontally.
const MENU_WIDTH_PX = 256;
const MENU_VIEWPORT_GAP_PX = 4;

/**
 * Whether the typeahead listbox should flip above the caret line: there is not
 * enough viewport space below it for the full menu, and more space above.
 *
 * @example
 * ```ts
 * import { shouldOpenUpward } from "@beep/editor/chat"
 *
 * console.log(shouldOpenUpward({ caretTop: 700, caretBottom: 720, viewportHeight: 800 })) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const shouldOpenUpward = ({
  caretBottom,
  caretTop,
  viewportHeight,
}: {
  readonly caretBottom: number;
  readonly caretTop: number;
  readonly viewportHeight: number;
}): boolean => {
  const spaceBelow = viewportHeight - caretBottom;
  return spaceBelow < MENU_MAX_HEIGHT_PX && caretTop > spaceBelow;
};

/**
 * Fixed viewport coordinates for the typeahead listbox: below the caret when it
 * fits, above it otherwise, clamped horizontally to the viewport.
 *
 * @example
 * ```ts
 * import { typeaheadMenuPosition } from "@beep/editor/chat"
 *
 * const position = typeaheadMenuPosition({
 *   caret: { bottom: 720, left: 40, top: 700 },
 *   viewportHeight: 800,
 *   viewportWidth: 1280
 * })
 * console.log(position.bottom) // 104
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const typeaheadMenuPosition = ({
  caret,
  viewportHeight,
  viewportWidth,
}: {
  readonly caret: { readonly bottom: number; readonly left: number; readonly top: number };
  readonly viewportHeight: number;
  readonly viewportWidth: number;
}): { readonly left: number; readonly top?: number; readonly bottom?: number } => {
  const left = Math.max(
    MENU_VIEWPORT_GAP_PX,
    Math.min(caret.left, viewportWidth - MENU_WIDTH_PX - MENU_VIEWPORT_GAP_PX)
  );
  return shouldOpenUpward({ caretBottom: caret.bottom, caretTop: caret.top, viewportHeight })
    ? { left, bottom: viewportHeight - caret.top + MENU_VIEWPORT_GAP_PX }
    : { left, top: caret.bottom + MENU_VIEWPORT_GAP_PX };
};

// Viewport rect of the caret line the menu anchors to. The live DOM selection is
// measured first because Lexical positions the anchor element in an effect after
// this render; the anchor rect is only a fallback (e.g. collapsed selection with
// no client rect).
//
// `undefined` means the caret cannot be located at all — the selection has moved
// away from this trigger and the anchor is degenerate. A menu that renders anyway
// strands itself at the viewport origin on top of the live menu, so callers must
// render nothing instead.
const caretViewportRect = (
  anchor: HTMLElement
): { readonly bottom: number; readonly left: number; readonly top: number } | undefined => {
  const selection = window.getSelection();
  const rect =
    selection !== null && selection.rangeCount > 0 ? selection.getRangeAt(0).getBoundingClientRect() : undefined;
  if (rect !== undefined && (rect.top !== 0 || rect.bottom !== 0)) {
    return rect;
  }
  const anchorRect = anchor.getBoundingClientRect();
  return anchorRect.top !== 0 || anchorRect.bottom !== 0 ? anchorRect : undefined;
};

/**
 * Renders the open typeahead as a `listbox` portal pinned to the viewport at
 * the caret: below the caret line when there is room, flipped above it
 * otherwise. `position: fixed` keeps the menu inside the view box, so a
 * composer at the bottom of the screen never grows the page scroll area.
 * Each row is a `role="option"` with the `typeahead-item-${index}` id the
 * Lexical menu delegate references through `aria-activedescendant`, and registers
 * its element via `option.setRefElement` so scroll-into-view works. `mousedown`
 * is prevented so clicking an option never steals focus from the editor.
 */
function TypeaheadMenuList<TOption extends MenuOption>({
  anchorElementRef,
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
  renderItem,
}: MenuListProps<TOption>): ReactNode {
  const [editor] = useLexicalComposerContext();
  // Subscribing re-renders (and so repositions) the fixed listbox whenever the
  // viewport moves; mounting here scopes the listeners to an open menu.
  useAtomValue(viewportTickAtom(editor));
  if (anchorElementRef.current === null || A.isReadonlyArrayEmpty(options)) {
    return null;
  }
  const caret = caretViewportRect(anchorElementRef.current);
  // No locatable caret means this menu's trigger is gone even though Lexical
  // still holds a resolution for it. Rendering would strand the listbox at the
  // viewport origin over the menu the user is actually using.
  if (caret === undefined) {
    return null;
  }
  const menuPosition = typeaheadMenuPosition({
    caret,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  });
  return createPortal(
    <div
      {...{ [TYPEAHEAD_MENU_ATTRIBUTE]: "" }}
      style={menuPosition}
      className="bg-popover text-popover-foreground fixed z-50 max-h-72 w-64 overflow-auto rounded-md border p-1 shadow-md"
    >
      {A.map(options, (option, index) => (
        <div
          key={option.key}
          id={`typeahead-item-${index}`}
          role="option"
          aria-selected={selectedIndex === index}
          ref={(element) => option.setRefElement(element)}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none",
            selectedIndex === index ? "bg-accent text-accent-foreground" : "text-foreground"
          )}
          onMouseEnter={() => setHighlightedIndex(index)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => selectOptionAndCleanUp(option)}
        >
          {renderItem(option)}
        </div>
      ))}
    </div>,
    anchorElementRef.current
  );
}

// Rendered in place of the mention options when the app-injected source rejects,
// so a service outage reads as an outage rather than "no matches".
function MentionUnavailableNotice({
  anchorElementRef,
}: {
  readonly anchorElementRef: RefObject<HTMLElement | null>;
}): ReactNode {
  const [editor] = useLexicalComposerContext();
  useAtomValue(viewportTickAtom(editor));
  if (anchorElementRef.current === null) {
    return null;
  }
  const caret = caretViewportRect(anchorElementRef.current);
  if (caret === undefined) {
    return null;
  }
  return createPortal(
    <div
      style={typeaheadMenuPosition({
        caret,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      })}
      className="bg-popover text-muted-foreground fixed z-50 w-64 rounded-md border p-2 text-sm shadow-md"
      role="status"
    >
      Mentions are unavailable right now.
    </div>,
    anchorElementRef.current
  );
}

interface SlashPluginProps {
  readonly items: ReadonlyArray<SlashItem>;
}

/**
 * The `/` command typeahead. Items are app-injected; on select the typed
 * `/query` text is removed and the item mutates the current selection. Tracks
 * its open state in the shared {@link menusOpenAtom}.
 *
 * @example
 * ```tsx
 * import { SlashPlugin, defaultChatSlashItems } from "@beep/editor/chat"
 *
 * function SlashCommands() {
 *   return <SlashPlugin items={defaultChatSlashItems} />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function SlashPlugin({ items }: SlashPluginProps): ReactNode {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useAtom(slashQueryAtom(editor));
  const setMenus = useAtomSet(menusOpenAtom(editor));
  const triggerFn = useBasicTypeaheadTriggerMatch("/", { minLength: 0 });

  const options = A.map(filterSlashItems(items, query), (item) => new SlashMenuOption(item));

  const onSelectOption = (
    selectedOption: SlashMenuOption,
    nodeToRemove: ReturnType<typeof $createTextNode> | null,
    closeMenu: () => void
  ): void => {
    editor.update(() => nodeToRemove?.remove());
    selectedOption.item.onSelect(editor);
    closeMenu();
  };

  const menuRenderFn: MenuRenderFn<SlashMenuOption> = (anchorElementRef, itemProps) => (
    <TypeaheadMenuList
      anchorElementRef={anchorElementRef}
      options={itemProps.options}
      selectedIndex={itemProps.selectedIndex}
      selectOptionAndCleanUp={itemProps.selectOptionAndCleanUp}
      setHighlightedIndex={itemProps.setHighlightedIndex}
      renderItem={(option) => (
        <>
          {option.item.icon}
          <span className="flex-1 truncate">{option.item.label}</span>
          {option.item.hint !== undefined ? (
            <span className="text-muted-foreground text-xs">{option.item.hint}</span>
          ) : null}
        </>
      )}
    />
  );

  return (
    <LexicalTypeaheadMenuPlugin<SlashMenuOption>
      options={options}
      onQueryChange={(matching) => setQuery(matching ?? "")}
      onSelectOption={onSelectOption}
      // Opening is exclusive: only one typeahead may hold the combobox at a
      // time, so a menu that never fired `onClose` cannot keep `aria-expanded`
      // true (or gate Enter) behind the menu the user is actually using.
      onOpen={() => setMenus({ slash: true, mention: false })}
      onClose={() => {
        setMenus((s) => ({ ...s, slash: false }));
        setQuery("");
      }}
      triggerFn={triggerFn}
      menuRenderFn={menuRenderFn}
    />
  );
}

interface MentionPluginProps {
  readonly source: MentionSource;
}

/**
 * The `@` mention typeahead. Candidates come from an app-injected source; on
 * select the mention is inserted as ephemeral plain text (`@label`), never a
 * persisted node, so the emitted state stays within the v1 schema vocabulary.
 * Tracks its open state in the shared {@link menusOpenAtom}.
 *
 * @example
 * ```tsx
 * import { MentionOption, MentionPlugin } from "@beep/editor/chat"
 *
 * function PeopleMentions() {
 *   return (
 *     <MentionPlugin
 *       source={(query) => [MentionOption.make({ id: query, label: query })]}
 *     />
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function MentionPlugin({ source }: MentionPluginProps): ReactNode {
  const [editor] = useLexicalComposerContext();
  const registry = useContext(RegistryContext);
  const options = useAtomValue(mentionOptionsAtom(editor));
  const setOptions = useAtomSet(mentionOptionsAtom(editor));
  const setRequestId = useAtomSet(mentionRequestIdAtom(editor));
  const setMenus = useAtomSet(menusOpenAtom(editor));
  const failed = useAtomValue(mentionFailedAtom(editor));
  const setFailed = useAtomSet(mentionFailedAtom(editor));
  const triggerFn = useBasicTypeaheadTriggerMatch("@", { minLength: 0 });

  const onQueryChange = (matching: string | null): void => {
    // Allocate the next request id off the latest committed value (read via the
    // registry) so rapid keystrokes never reuse an id (replaces the original
    // `useRef` counter). Neither the allocation nor the staleness check is a side
    // effect inside an atom updater.
    const id = registry.get(mentionRequestIdAtom(editor)) + 1;
    setRequestId(id);
    const isLatest = (): boolean => id === registry.get(mentionRequestIdAtom(editor));
    // Invoke `source` *inside* the chain so a synchronous throw rejects the
    // promise (and hits `.catch`) instead of escaping the interaction path.
    Promise.resolve()
      .then(() => source(matching ?? ""))
      .then((results) => {
        // Drop a stale response: only the most-recent request wins.
        if (isLatest()) {
          setFailed(false);
          setOptions(A.map(results, (option) => new MentionMenuOption(option)));
        }
      })
      .catch(() => {
        // A failed lookup is not "no matches": clearing the list silently would
        // make a source outage indistinguishable from an empty result set.
        if (isLatest()) {
          setFailed(true);
          setOptions([]);
        }
      });
  };

  const onSelectOption = (
    selectedOption: MentionMenuOption,
    nodeToReplace: ReturnType<typeof $createTextNode> | null,
    closeMenu: () => void
  ): void => {
    editor.update(() => {
      const textNode = $createTextNode(`@${selectedOption.option.label} `);
      if (nodeToReplace !== null) {
        nodeToReplace.replace(textNode);
      } else {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) selection.insertNodes([textNode]);
      }
      textNode.selectEnd();
    });
    closeMenu();
  };

  const menuRenderFn: MenuRenderFn<MentionMenuOption> = (anchorElementRef, itemProps) =>
    // A failed lookup still renders the portal, so the outage is visible where
    // the results would have been instead of collapsing into an empty menu.
    failed && A.isReadonlyArrayEmpty(itemProps.options) ? (
      <MentionUnavailableNotice anchorElementRef={anchorElementRef} />
    ) : (
      <TypeaheadMenuList
        anchorElementRef={anchorElementRef}
        options={itemProps.options}
        selectedIndex={itemProps.selectedIndex}
        selectOptionAndCleanUp={itemProps.selectOptionAndCleanUp}
        setHighlightedIndex={itemProps.setHighlightedIndex}
        renderItem={(option) => (
          <>
            {option.option.icon}
            <span className="flex flex-1 flex-col">
              <span className="truncate">{option.option.label}</span>
              {option.option.hint !== undefined ? (
                <span className="text-muted-foreground text-xs">{option.option.hint}</span>
              ) : null}
            </span>
          </>
        )}
      />
    );

  return (
    <LexicalTypeaheadMenuPlugin<MentionMenuOption>
      options={[...options]}
      onQueryChange={onQueryChange}
      onSelectOption={onSelectOption}
      onOpen={() => setMenus({ slash: false, mention: true })}
      onClose={() => {
        setMenus((s) => ({ ...s, mention: false }));
        setFailed(false);
        setOptions([]);
      }}
      triggerFn={triggerFn}
      menuRenderFn={menuRenderFn}
    />
  );
}

// Per-editor combobox-ARIA root-listener registration. Subscribes to
// anyMenuOpenAtom so it re-registers (re-applies aria-expanded) whenever the
// open state changes; torn down via the atom finalizer.
const COMBOBOX_ARIA_ATTRIBUTES = ["role", "aria-haspopup", "aria-autocomplete", "aria-expanded"] as const;

const comboboxAriaAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    const open = get(anyMenuOpenAtom(editor));
    get.addFinalizer(
      editor.registerRootListener((rootElement) => {
        if (rootElement === null) return;
        rootElement.setAttribute("role", "combobox");
        rootElement.setAttribute("aria-haspopup", "listbox");
        rootElement.setAttribute("aria-autocomplete", "list");
        rootElement.setAttribute("aria-expanded", open ? "true" : "false");
      })
    );
    // Unregistering the root listener leaves the attributes painted on a root
    // that outlives this plugin — an editor advertised as an expanded combobox
    // with no popup. Strip what we applied when the binding goes away.
    get.addFinalizer(() => {
      const rootElement = editor.getRootElement();
      if (rootElement === null) return;
      for (const attribute of COMBOBOX_ARIA_ATTRIBUTES) {
        rootElement.removeAttribute(attribute);
      }
    });
    return undefined;
  })
);

/**
 * Marks the editor root as a WAI-ARIA combobox while slash/mention typeahead menus
 * are enabled, toggling `aria-expanded` as the menu opens/closes. The Lexical
 * menu delegate already adds `aria-controls` and `aria-activedescendant`; this
 * completes the combobox pattern (`role`, `aria-haspopup`, `aria-autocomplete`).
 * Reads the open state from the shared {@link anyMenuOpenAtom}.
 *
 * @example
 * ```tsx
 * import { ComboboxAriaPlugin } from "@beep/editor/chat"
 *
 * function TypeaheadAccessibility() {
 *   return <ComboboxAriaPlugin />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ComboboxAriaPlugin(): null {
  const [editor] = useLexicalComposerContext();
  useAtomMount(comboboxAriaAtom(editor));
  return null;
}
