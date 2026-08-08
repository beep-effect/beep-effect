/**
 * Emoji picker primitive backed by `frimousse`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Button } from "@beep/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@beep/ui/components/popover";
import { make as makeScopedAtom, useAtom } from "@effect/atom-react";
import { SmileyIcon } from "@phosphor-icons/react";
import { Atom } from "effect/unstable/reactivity";
import { EmojiPicker as FrimousseEmojiPicker } from "frimousse";
import { cn } from "../lib/index.ts";
import type { Emoji, EmojiPickerRootProps } from "frimousse";
import type React from "react";

const defaultEmojibaseUrl = "/emojibase-data";

/**
 * Props for a popover emoji picker that emits the selected emoji glyph.
 *
 * **Example** (Satisfies picker props type)
 *
 * ```ts
 * import type { EmojiPickerProps } from "@beep/ui/components/emoji-picker"
 *
 * const props = {
 *   value: "\u{1F680}",
 *   onValueChange: (emoji) => emoji.codePointAt(0),
 * } satisfies EmojiPickerProps
 *
 * console.log(props.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface EmojiPickerProps
  extends Omit<EmojiPickerRootProps, "children" | "className" | "onEmojiSelect" | "value"> {
  readonly className?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly onValueChange?: ((value: string) => void) | undefined;
  readonly placeholder?: string | undefined;
  readonly value?: string | undefined;
}

interface EmojiPickerState {
  readonly open: boolean;
}

const EmojiPickerScope = makeScopedAtom(() => Atom.make<EmojiPickerState>({ open: false }));

/**
 * Popover emoji picker with self-hosted Emojibase data by default.
 *
 * **Details**
 *
 * The default `emojibaseUrl` is `/emojibase-data`; pass a custom URL when the
 * app serves the Frimousse data from another static asset path.
 *
 * **Example** (Basic reaction picker)
 *
 * ```tsx
 * import { EmojiPicker } from "@beep/ui/components/emoji-picker"
 *
 * export function ReactionPicker() {
 *   return <EmojiPicker value="\u{1F44D}" placeholder="Choose reaction" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const EmojiPicker: React.FC<EmojiPickerProps> = (props) => (
  <EmojiPickerScope.Provider>
    <EmojiPickerInner {...props} />
  </EmojiPickerScope.Provider>
);

const EmojiPickerInner: React.FC<EmojiPickerProps> = ({
  className,
  columns = 9,
  disabled = false,
  emojibaseUrl = defaultEmojibaseUrl,
  locale = "en",
  onValueChange,
  placeholder = "Select emoji",
  value = "",
  ...props
}) => {
  const [state, setState] = useAtom(EmojiPickerScope.use());
  const label = value.length > 0 ? value : placeholder;

  const handleSelect = (emoji: Emoji) => {
    onValueChange?.(emoji.emoji);
    setState({ open: false });
  };

  return (
    <Popover open={state.open} onOpenChange={(open) => setState({ open })}>
      <PopoverTrigger
        render={
          <Button type="button" variant="outline" disabled={disabled} className={cn("w-full justify-start", className)}>
            <span aria-hidden="true" className="text-lg leading-none">
              {value.length > 0 ? value : <SmileyIcon className="size-4" />}
            </span>
            <span className="truncate">{label}</span>
          </Button>
        }
      />
      <PopoverContent className="w-80 p-2">
        <FrimousseEmojiPicker.Root
          {...props}
          columns={columns}
          emojibaseUrl={emojibaseUrl}
          locale={locale}
          onEmojiSelect={handleSelect}
          className="flex flex-col gap-2"
        >
          <FrimousseEmojiPicker.Search className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-[3px]" />
          <FrimousseEmojiPicker.Viewport className="h-64">
            <FrimousseEmojiPicker.Loading className="text-muted-foreground flex h-24 items-center justify-center text-sm">
              Loading...
            </FrimousseEmojiPicker.Loading>
            <FrimousseEmojiPicker.Empty className="text-muted-foreground flex h-24 items-center justify-center text-sm">
              No emoji found.
            </FrimousseEmojiPicker.Empty>
            <FrimousseEmojiPicker.List
              components={{
                CategoryHeader: ({ category, className: categoryClassName, ...categoryProps }) => (
                  <div
                    {...categoryProps}
                    className={cn(
                      "bg-popover text-muted-foreground flex items-center px-1 py-1 text-xs font-medium",
                      categoryClassName
                    )}
                  >
                    {category.label}
                  </div>
                ),
                Emoji: ({ emoji, className: emojiClassName, ...emojiProps }) => (
                  <button
                    {...emojiProps}
                    type="button"
                    className={cn(
                      "hover:bg-muted data-[active]:bg-muted flex size-8 items-center justify-center rounded-md text-xl",
                      emojiClassName
                    )}
                  >
                    {emoji.emoji}
                  </button>
                ),
                Row: ({ className: rowClassName, ...rowProps }) => (
                  <div
                    {...rowProps}
                    className={cn("grid grid-cols-[repeat(var(--frimousse-list-columns),2rem)]", rowClassName)}
                  />
                ),
              }}
            />
          </FrimousseEmojiPicker.Viewport>
        </FrimousseEmojiPicker.Root>
      </PopoverContent>
    </Popover>
  );
};
