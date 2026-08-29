/**
 * Canonical source-text page with an exact UTF-16 anchor highlight.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { ScrollArea } from "@beep/ui/components/scroll-area";
import { cn } from "@beep/ui/lib/utils";
import { Number as N } from "effect";
import * as Str from "effect/String";
import type * as React from "react";

/**
 * Props for {@link VerifiedSourceTextViewer}.
 *
 * **Details**
 *
 * Offsets are absolute, half-open UTF-16 code-unit positions in the canonical
 * extracted source. `pageText` begins at `pageStartOffset`.
 *
 * **Example** (Highlight agreement in excerpt)
 *
 * ```tsx
 * import { VerifiedSourceTextViewer } from "@beep/ui/components/verified-source-text-viewer"
 *
 * export function SourceExcerpt() {
 *   return (
 *     <VerifiedSourceTextViewer
 *       pageText="The agreement expires Friday."
 *       pageStartOffset={0}
 *       anchorStartOffset={4}
 *       anchorEndOffset={13}
 *     />
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export interface VerifiedSourceTextViewerProps extends Omit<React.ComponentProps<"section">, "children"> {
  readonly accessibleLabel?: string | undefined;
  readonly anchorEndOffset: number;
  readonly anchorStartOffset: number;
  readonly autoScrollToAnchor?: boolean | undefined;
  readonly pageStartOffset: number;
  readonly pageText: string;
}

const scrollAnchorIntoView = (node: HTMLElement | null): void => {
  node?.scrollIntoView({ block: "center", inline: "nearest" });
};

/**
 * Render one canonical source-text page and mark the exact portion intersecting
 * the verified anchor.
 *
 * **Details**
 *
 * The component never normalizes or searches the text. It slices the supplied
 * page using JavaScript's native UTF-16 indexing semantics, preserving the
 * server-verified `source.slice(start, end) === quote` contract.
 *
 * **Example** (Paged source with highlight)
 *
 * ```tsx
 * import { VerifiedSourceTextViewer } from "@beep/ui/components/verified-source-text-viewer"
 *
 * export function PagedSource() {
 *   return (
 *     <VerifiedSourceTextViewer
 *       className="h-80"
 *       pageText="First page of canonical text"
 *       pageStartOffset={0}
 *       anchorStartOffset={6}
 *       anchorEndOffset={10}
 *     />
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function VerifiedSourceTextViewer({
  accessibleLabel = "Verified canonical source text",
  anchorEndOffset,
  anchorStartOffset,
  autoScrollToAnchor = true,
  className,
  pageStartOffset,
  pageText,
  ...props
}: VerifiedSourceTextViewerProps) {
  const pageEndOffset = N.sum(pageStartOffset, Str.length(pageText));
  const intersectionStart = N.max(anchorStartOffset, pageStartOffset);
  const intersectionEnd = N.min(anchorEndOffset, pageEndOffset);
  const hasVisibleAnchor = N.isLessThan(intersectionStart, intersectionEnd);
  const relativeStart = N.subtract(intersectionStart, pageStartOffset);
  const relativeEnd = N.subtract(intersectionEnd, pageStartOffset);

  return (
    <section
      aria-label={accessibleLabel}
      className={cn("min-h-0 overflow-hidden rounded-lg border bg-muted/20", className)}
      data-anchor-visible={hasVisibleAnchor}
      data-slot="verified-source-text-viewer"
      {...props}
    >
      <ScrollArea className="size-full">
        <pre className="min-w-full p-4 font-mono text-xs leading-6 whitespace-pre-wrap break-words">
          {hasVisibleAnchor ? (
            <>
              {Str.slice(0, relativeStart)(pageText)}
              <mark
                className="box-decoration-clone rounded-xs bg-amber-300 px-0.5 text-amber-950 ring-1 ring-amber-500/50 dark:bg-amber-400"
                data-slot="verified-source-anchor"
                ref={autoScrollToAnchor ? scrollAnchorIntoView : undefined}
              >
                {Str.slice(relativeStart, relativeEnd)(pageText)}
              </mark>
              {Str.slice(relativeEnd)(pageText)}
            </>
          ) : (
            pageText
          )}
        </pre>
      </ScrollArea>
    </section>
  );
}
