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
 * **Details**
 *
 * Per the repo atom-first law the per-editor query/options/request state and the
 * combobox-ARIA root-listener registration are `@effect/atom` families keyed by
 * the `LexicalEditor` (no `useState`/`useEffect`/`useMemo`/`useRef`); the
 * menu-open booleans are written into the shared {@link menusOpenAtom}.
 *
 * @packageDocumentation \@beep/editor/chat/typeahead
 * @since 0.0.0
 */

import { $EditorId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { cn } from "@beep/ui/lib/utils";
import { A } from "@beep/utils";
import { useAtom, useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import * as Effect from "effect/Effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { $createTextNode, $getSelection, $isRangeSelection } from "lexical";
import { createPortal } from "react-dom";
import {
  anyMenuOpenAtom,
  composerRuntime,
  menusOpenAtom,
  TYPEAHEAD_MENU_ATTRIBUTE,
  typeaheadMenuMarker,
  typeaheadOptionId,
} from "./atoms.ts";
import { MentionOptions } from "./config.ts";
import type { MenuRenderFn } from "@lexical/react/LexicalTypeaheadMenuPlugin";
import type { LexicalEditor } from "lexical";
import type { CSSProperties, ReactNode, RefObject } from "react";
import type { MentionOption, MentionSource, SlashItem } from "./config.ts";

const $I = $EditorId.create("chat/typeahead");

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

/**
 * **Example** (Create a mention lookup failure)
 *
 * ```ts
 * import { MentionLookupError } from "@beep/editor/chat/typeahead"
 *
 * const error = MentionLookupError.make({
 *   reason: "source-failed",
 *   message: "Mentions are unavailable right now."
 * })
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MentionLookupError extends S.TaggedError<MentionLookupError, { readonly brand: unique symbol }>(
  $I`MentionLookupError`
)(
  "MentionLookupError",
  {
    reason: S.Literals(["source-failed", "invalid-results"]).annotateKey({
      description: "Stable reason the mention lookup failed.",
    }),
    message: S.String.annotateKey({
      description: "User-safe lookup failure message.",
    }),
    cause: S.optionalKey(
      S.Defect({ includeStack: true }).pipe(S.overrideToEquivalence(SchemaUtils.alwaysEquivalent))
    ).annotateKey({
      description: "Underlying source or schema failure retained for structured diagnostics.",
    }),
  },
  $I.annoteError<MentionLookupError>("MentionLookupError", {
    description: "Typed failure raised when a mention source rejects or returns invalid candidates.",
  })
) {}

const slashItemMatchesQuery = (item: SlashItem, q: string): boolean =>
  Str.includes(q)(Str.toLowerCase(item.label)) ||
  (item.hint !== undefined && Str.includes(q)(Str.toLowerCase(item.hint))) ||
  A.some(item.keywords ?? [], (keyword) => Str.includes(q)(Str.toLowerCase(keyword)));

const filterSlashItems = (items: ReadonlyArray<SlashItem>, query: string): ReadonlyArray<SlashItem> => {
  const q = Str.toLowerCase(Str.trim(query));
  if (q === "") return items;
  return A.filter(items, (item) => slashItemMatchesQuery(item, q));
};

const slashQueryAtom = Atom.family((_editor: LexicalEditor) => Atom.make<string>(""));

const decodeMentionOptions = S.decodeUnknownEffect(MentionOptions);
const mentionSourceFailure = (cause: unknown): MentionLookupError =>
  MentionLookupError.make({
    reason: "source-failed",
    message: "Mentions are unavailable right now.",
    cause,
  });

// Runtime-owned, per-editor lookup. Atom.fn's default latest-write-wins
// semantics interrupt the preceding request when a newer query arrives, so
// stale responses cannot cross queries or composers.
const mentionLookupFn = Atom.family((_editor: LexicalEditor) =>
  composerRuntime
    .fn<{
      readonly query: string;
      readonly source: MentionSource;
    }>()(
      Effect.fnUntraced(
        function* ({ query, source }) {
          const raw = yield* Effect.tryPromise({
            try: () => Promise.resolve(source(query)),
            catch: mentionSourceFailure,
          });
          return yield* decodeMentionOptions(raw).pipe(
            Effect.mapError((cause) =>
              MentionLookupError.make({
                reason: "invalid-results",
                message: "Mentions are unavailable right now.",
                cause,
              })
            )
          );
        },
        Effect.tapError((failure) =>
          Effect.logError("Mention lookup failed", failure.cause ?? failure).pipe(
            Effect.annotateLogs({ component: "editor", reason: failure.reason })
          )
        )
      )
    )
    .pipe(Atom.setIdleTTL(0))
);

// decision: typeahead-viewport-layout
const viewportTickAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    let frame: number | undefined = undefined;

    // decision: typeahead-viewport-layout
    const bump = (): void => {
      if (frame !== undefined) return;
      frame = globalThis.requestAnimationFrame(() => {
        frame = undefined;
        get.setSelf(get.once(viewportTickAtom(editor)) + 1);
      });
    };

    // decision: typeahead-viewport-layout
    const options = { capture: true, passive: true } as const;
    window.addEventListener("scroll", bump, options);
    window.addEventListener("resize", bump, { passive: true });
    get.addFinalizer(() => {
      if (frame !== undefined) globalThis.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", bump, options);
      window.removeEventListener("resize", bump);
    });
    return 0;
  }).pipe(Atom.setIdleTTL(0))
);

interface MenuListProps<TOption extends MenuOption> {
  readonly anchorElementRef: RefObject<HTMLElement | null>;
  readonly options: Array<TOption>;
  readonly renderItem: (option: TOption) => ReactNode;
  readonly selectedIndex: number | null;
  readonly selectOptionAndCleanUp: (option: TOption) => void;
  readonly setHighlightedIndex: (index: number) => void;
}

// decision: typeahead-viewport-layout
const MENU_MAX_HEIGHT_PX = 292;
// decision: typeahead-viewport-layout
const MENU_WIDTH_PX = 256;
const MENU_VIEWPORT_GAP_PX = 4;

/**
 * Whether the typeahead listbox should flip above the caret line: there is not
 * enough viewport space below it for the full menu, and more space above.
 *
 * **Example** (True when caret near bottom)
 *
 * ```ts import.meta.vitest name="True when caret near bottom"
 * import { shouldOpenUpward } from "@beep/editor/chat/typeahead"
 *
 * shouldOpenUpward({ caretTop: 700, caretBottom: 720, viewportHeight: 800 }) // => true
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
 * **Example** (Clamped position above caret)
 *
 * ```ts import.meta.vitest name="Clamped position above caret"
 * import { typeaheadMenuPosition } from "@beep/editor/chat/typeahead"
 *
 * const position = typeaheadMenuPosition({
 *   caret: { bottom: 720, left: 40, top: 700 },
 *   viewportHeight: 800,
 *   viewportWidth: 1280
 * })
 * position.bottom // => 104
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

// decision: typeahead-viewport-layout
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
 * Pixel length for one edge of a positioned typeahead surface.
 *
 * **Details**
 *
 * The menu's fixed coordinates ride in CSS custom properties consumed by the
 * `left-(--typeahead-left)` / `top-(--typeahead-top)` / `bottom-(--typeahead-bottom)`
 * classes. An omitted edge leaves its property unset, so that inset resolves to `auto`.
 *
 * **Example** (Edge values for a menu anchored below the caret)
 *
 * ```ts import.meta.vitest name="Inset lengths"
 * import { typeaheadInsetPx } from "@beep/editor/chat/typeahead"
 *
 * typeaheadInsetPx(124) // => "124px"
 * typeaheadInsetPx(undefined) // => undefined
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const typeaheadInsetPx = (value: number | undefined): string | undefined =>
  value === undefined ? undefined : `${value}px`;

// decision: typeahead-viewport-layout
function TypeaheadMenuList<TOption extends MenuOption>({
  anchorElementRef,
  options,
  selectedIndex,
  selectOptionAndCleanUp,
  setHighlightedIndex,
  renderItem,
}: MenuListProps<TOption>): ReactNode {
  const [editor] = useLexicalComposerContext();
  // decision: typeahead-viewport-layout
  useAtomValue(viewportTickAtom(editor));
  if (anchorElementRef.current === null || A.isReadonlyArrayEmpty(options)) {
    return null;
  }
  const caret = caretViewportRect(anchorElementRef.current);
  // decision: typeahead-viewport-layout
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
      {...typeaheadMenuMarker(editor)}
      style={
        {
          "--typeahead-left": typeaheadInsetPx(menuPosition.left),
          "--typeahead-top": typeaheadInsetPx(menuPosition.top),
          "--typeahead-bottom": typeaheadInsetPx(menuPosition.bottom),
        } as CSSProperties
      }
      className="bg-popover text-popover-foreground fixed top-(--typeahead-top) bottom-(--typeahead-bottom) left-(--typeahead-left) z-50 max-h-72 w-64 overflow-auto rounded-md border p-1 shadow-md"
    >
      {A.map(options, (option, index) => (
        <div
          key={option.key}
          // decision: typeahead-dom-ownership
          id={typeaheadOptionId(editor, index)}
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

// decision: typeahead-dom-ownership
function MentionLookupNotice({
  anchorElementRef,
  message,
}: {
  readonly anchorElementRef: RefObject<HTMLElement | null>;
  readonly message: string;
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
  const noticePosition = typeaheadMenuPosition({
    caret,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  });
  return (
    <>
      {createPortal(
        <span
          {...typeaheadMenuMarker(editor)}
          aria-disabled="true"
          aria-label={message}
          aria-selected="false"
          className="sr-only"
          role="option"
        />,
        anchorElementRef.current
      )}
      {createPortal(
        <div
          style={
            {
              "--typeahead-left": typeaheadInsetPx(noticePosition.left),
              "--typeahead-top": typeaheadInsetPx(noticePosition.top),
              "--typeahead-bottom": typeaheadInsetPx(noticePosition.bottom),
            } as CSSProperties
          }
          className="bg-popover text-muted-foreground fixed top-(--typeahead-top) bottom-(--typeahead-bottom) left-(--typeahead-left) z-50 w-64 rounded-md border p-2 text-sm shadow-md"
          role="status"
        >
          {message}
        </div>,
        anchorElementRef.current.ownerDocument.body
      )}
    </>
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
 * **Example** (SlashPlugin with default items)
 *
 * ```tsx
 * import { SlashPlugin } from "@beep/editor/chat/typeahead"
 * import { defaultChatSlashItems } from "@beep/editor/chat/slash-items"
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
      // decision: typeahead-dom-ownership
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
 * **Example** (MentionPlugin with query source)
 *
 * ```tsx
 * import { MentionPlugin } from "@beep/editor/chat/typeahead"
 * import { MentionOption } from "@beep/editor/chat/config"
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
  const lookupAtom = mentionLookupFn(editor);
  const lookupState = useAtomValue(lookupAtom);
  const lookup = useAtomSet(lookupAtom);
  const setMenus = useAtomSet(menusOpenAtom(editor));
  const triggerFn = useBasicTypeaheadTriggerMatch("@", { minLength: 0 });
  const pending = AsyncResult.isWaiting(lookupState);
  const settled = !pending;
  const options =
    settled && AsyncResult.isSuccess(lookupState)
      ? A.map(lookupState.value, (option) => new MentionMenuOption(option))
      : [];
  const failed = settled && AsyncResult.isFailure(lookupState) && !AsyncResult.isInterrupted(lookupState);

  const onQueryChange = (matching: string | null): void => {
    if (matching === null) {
      lookup(Atom.Reset);
      return;
    }
    lookup({ query: matching, source });
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
    // decision: typeahead-dom-ownership
    pending && A.isReadonlyArrayEmpty(itemProps.options) ? (
      <MentionLookupNotice anchorElementRef={anchorElementRef} message="Looking up mentions..." />
    ) : failed && A.isReadonlyArrayEmpty(itemProps.options) ? (
      <MentionLookupNotice anchorElementRef={anchorElementRef} message="Mentions are unavailable right now." />
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
        lookup(Atom.Reset);
      }}
      triggerFn={triggerFn}
      menuRenderFn={menuRenderFn}
    />
  );
}

/**
 * DOM id of the Lexical-owned typeahead listbox, scoped to one editor.
 *
 * **Example** (Id starts with typeahead-menu)
 *
 * ```ts
 * import { typeaheadMenuId } from "@beep/editor/chat/typeahead"
 * import { createEditor } from "lexical"
 *
 * console.log(typeaheadMenuId(createEditor()).startsWith("typeahead-menu-")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const typeaheadMenuId = (editor: LexicalEditor): string => `typeahead-menu-${editor.getKey()}`;

const findTypeaheadAnchor = (root: HTMLElement, editor: LexicalEditor): HTMLElement | null => {
  for (const marker of root.ownerDocument.querySelectorAll<HTMLElement>(`[${TYPEAHEAD_MENU_ATTRIBUTE}]`)) {
    if (marker.getAttribute(TYPEAHEAD_MENU_ATTRIBUTE) === editor.getKey()) {
      return marker.parentElement;
    }
  }
  return null;
};

const collapseTypeaheadAria = (root: HTMLElement): void => {
  if (root.getAttribute("aria-expanded") !== "false") root.setAttribute("aria-expanded", "false");
  root.removeAttribute("aria-controls");
  root.removeAttribute("aria-activedescendant");
};

const synchronizeTypeaheadAria = (root: HTMLElement, editor: LexicalEditor): void => {
  const anchor = findTypeaheadAnchor(root, editor);
  if (anchor === null || anchor.getAttribute("role") !== "listbox") {
    collapseTypeaheadAria(root);
    return;
  }
  const menuId = typeaheadMenuId(editor);
  if (root.getAttribute("aria-expanded") !== "true") root.setAttribute("aria-expanded", "true");
  if (anchor.id !== menuId) anchor.id = menuId;
  if (root.getAttribute("aria-controls") !== menuId) root.setAttribute("aria-controls", menuId);
  const selectedOption = anchor.querySelector<HTMLElement>('[role="option"][aria-selected="true"]');
  if (selectedOption === null) {
    root.removeAttribute("aria-activedescendant");
  } else if (root.getAttribute("aria-activedescendant") !== selectedOption.id) {
    root.setAttribute("aria-activedescendant", selectedOption.id);
  }
};

// decision: typeahead-dom-ownership
const COMBOBOX_ARIA_ATTRIBUTES: ReadonlyArray<string> = [
  "role",
  "aria-haspopup",
  "aria-autocomplete",
  "aria-expanded",
  "aria-controls",
  "aria-activedescendant",
];

const clearComboboxAria = (root: HTMLElement): void => {
  for (const attribute of COMBOBOX_ARIA_ATTRIBUTES) {
    root.removeAttribute(attribute);
  }
};

const comboboxAriaAtom = Atom.family((editor: LexicalEditor) =>
  Atom.make((get) => {
    const open = get(anyMenuOpenAtom(editor));
    let observer: MutationObserver | undefined;
    let root: HTMLElement | null = null;
    get.addFinalizer(
      editor.registerRootListener((rootElement) => {
        observer?.disconnect();
        observer = undefined;
        if (root !== null && root !== rootElement) clearComboboxAria(root);
        root = rootElement;
        if (rootElement === null) return;
        rootElement.setAttribute("role", "combobox");
        rootElement.setAttribute("aria-haspopup", "listbox");
        rootElement.setAttribute("aria-autocomplete", "list");
        if (!open) {
          collapseTypeaheadAria(rootElement);
          return;
        }

        synchronizeTypeaheadAria(rootElement, editor);
        const Observer = rootElement.ownerDocument.defaultView?.MutationObserver;
        if (Observer === undefined) return;
        observer = new Observer(() => synchronizeTypeaheadAria(rootElement, editor));
        observer.observe(rootElement.ownerDocument.body, {
          attributeFilter: [
            "aria-activedescendant",
            "aria-controls",
            "aria-expanded",
            "aria-selected",
            "id",
            "role",
            TYPEAHEAD_MENU_ATTRIBUTE,
          ],
          attributes: true,
          childList: true,
          subtree: true,
        });
      })
    );
    // decision: typeahead-dom-ownership
    get.addFinalizer(() => {
      observer?.disconnect();
      if (root !== null) clearComboboxAria(root);
    });
    return undefined;
  }).pipe(Atom.setIdleTTL(0))
);

/**
 * Marks the editor root as a WAI-ARIA combobox while slash/mention typeahead menus
 * are enabled, toggling `aria-expanded` as the menu opens/closes. The binding
 * scopes Lexical's listbox id and `aria-controls` relation to this editor while
 * preserving its `aria-activedescendant` behavior. Reads the open state from
 * the shared {@link anyMenuOpenAtom}.
 *
 * **Example** (Mount ComboboxAriaPlugin alone)
 *
 * ```tsx
 * import { ComboboxAriaPlugin } from "@beep/editor/chat/typeahead"
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
