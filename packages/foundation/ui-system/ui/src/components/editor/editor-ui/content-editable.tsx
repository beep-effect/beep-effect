/**
 * Content-editable surface for the Lexical editor, sized to match its placeholder overlay.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $UiId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { ContentEditable as LexicalContentEditable } from "@lexical/react/LexicalContentEditable";
import * as S from "effect/Schema";
import type { JSX } from "react";

const $I = $UiId.create("components/editor/content-editable");

const DEFAULT_EDITABLE_CLASS_NAME = "relative block min-h-72 min-h-full overflow-auto px-8 py-4 focus:outline-none";

const DEFAULT_PLACEHOLDER_CLASS_NAME =
  "text-muted-foreground pointer-events-none absolute top-0 left-0 overflow-hidden px-8 py-4 text-ellipsis select-none";

const COMPACT_EDITABLE_CLASS_NAME =
  "relative block max-h-60 min-h-10 overflow-auto px-3 py-2.5 text-sm leading-6 focus:outline-none";

const COMPACT_PLACEHOLDER_CLASS_NAME =
  "text-muted-foreground pointer-events-none absolute top-0 left-0 px-3 py-2.5 text-sm leading-6 select-none";

const ContentEditableVariant = LiteralKit(["document", "compact"]).pipe(
  $I.annoteSchema("ContentEditableVariant", {
    description: "Surface sizes for the Lexical content-editable: a full document page or a compact composer line.",
  })
);

type ContentEditableVariant = typeof ContentEditableVariant.Type;

/**
 * **Example** (Configure a compact composer surface)
 *
 * ```ts
 * import { Props } from "@beep/ui/components/editor/editor-ui/content-editable"
 *
 * const props = Props.make({ placeholder: "Reply to the examiner...", ariaLabel: "Reply", variant: "compact" })
 *
 * console.log(props.variant) // => "compact"
 * console.log(props.className) // => undefined
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Props extends S.Class<Props, { readonly brand: unique symbol }>($I`Props`)(
  {
    placeholder: S.String,
    ariaLabel: S.optionalKey(S.String),
    variant: S.optionalKey(ContentEditableVariant),
    className: S.optionalKey(S.String),
    placeholderClassName: S.optionalKey(S.String),
  },
  $I.annote("Props", {
    description: "Props for the Lexical content-editable surface and its padding-aligned placeholder.",
  })
) {
  declare readonly placeholder: string;
  declare readonly ariaLabel?: string;
  declare readonly variant?: ContentEditableVariant;
  declare readonly className?: string;
  declare readonly placeholderClassName?: string;
}

/**
 * Lexical content-editable surface with a padding-aligned placeholder.
 *
 * **Details**
 *
 * `variant` picks the surface: `"document"` (the default) is a full editor page with
 * generous padding; `"compact"` is a single composer line (`text-sm`, `px-3 py-2.5`) that
 * grows to a capped height. A `className` or `placeholderClassName`, when passed, still
 * replaces the variant's classes outright.
 *
 * **Gotchas**
 *
 * The placeholder overlay shares the editable's padding so the empty-state
 * cursor aligns with the placeholder text. When a custom `className` changes
 * the editable padding, pass a matching `placeholderClassName`.
 *
 * Pass `ariaLabel` whenever the editable is exposed as a named widget — a
 * typeahead plugin promotes the root to `role="combobox"`, and a combobox with
 * only `aria-placeholder` has no accessible name.
 *
 * **Example** (With RichTextPlugin usage)
 *
 * ```tsx
 * import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
 * import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
 * import { ContentEditable } from "@beep/ui/components/editor/editor-ui/content-editable"
 *
 * export function BodyEditorPlugin() {
 *   return (
 *     <RichTextPlugin
 *       contentEditable={<ContentEditable placeholder="Start typing ..." />}
 *       ErrorBoundary={LexicalErrorBoundary}
 *     />
 *   )
 * }
 * ```
 *
 * **Example** (Compact composer surface)
 *
 * ```tsx
 * import { ContentEditable } from "@beep/ui/components/editor/editor-ui/content-editable"
 *
 * export function ComposerSurface() {
 *   return <ContentEditable variant="compact" ariaLabel="Message composer" placeholder="Message" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ContentEditable({
  ariaLabel,
  placeholder,
  variant = "document",
  className,
  placeholderClassName,
}: typeof Props.Encoded): JSX.Element {
  return (
    <LexicalContentEditable
      className={className ?? (variant === "compact" ? COMPACT_EDITABLE_CLASS_NAME : DEFAULT_EDITABLE_CLASS_NAME)}
      aria-label={ariaLabel}
      aria-placeholder={placeholder}
      placeholder={
        <div
          className={
            placeholderClassName ??
            (variant === "compact" ? COMPACT_PLACEHOLDER_CLASS_NAME : DEFAULT_PLACEHOLDER_CLASS_NAME)
          }
        >
          {placeholder}
        </div>
      }
    />
  );
}
