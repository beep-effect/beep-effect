/**
 * Hex color picker primitive backed by `react-colorful` and `@beep/schema/Color`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import * as Color from "@beep/schema/Color";
import { Button } from "@beep/ui/components/button";
import { Input } from "@beep/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@beep/ui/components/popover";
import { make as makeScopedAtom, useAtom } from "@effect/atom-react";
import { flow } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { HexColorPicker } from "react-colorful";
import { cn } from "../lib/index.ts";
import type React from "react";

const defaultColorValue = "#000000";

// Unary by contract: `S.decodeUnknownOption` also accepts a trailing
// `ParseOptions`, which would make the exported symbol a 2-arity function with no
// decidable data-last dispatch (its first parameter is `unknown`, so no predicate
// can tell a boundary value from an options bag). Narrowing the exported type to
// the single-argument form keeps every caller working and leaves `ParseOptions`
// reachable through `S.decodeUnknownOption(Color.NormalizeHexColor)` directly.
/**
 * Normalizes a boundary hex color into canonical `#rrggbb` form.
 *
 * @example
 * ```tsx
 * import * as O from "effect/Option"
 * import { normalizeHexColorInput } from "@beep/ui/components/color-picker"
 *
 * console.log(O.getOrUndefined(normalizeHexColorInput("#3bf")))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const normalizeHexColorInput: (input: unknown) => O.Option<Color.NormalizeHexColor> = S.decodeUnknownOption(
  Color.NormalizeHexColor
);

const normalizeHexColorInputOrUndefined = flow(normalizeHexColorInput, O.getOrUndefined);

/**
 * Props for a hex color input that can run controlled or uncontrolled.
 *
 * @example
 * ```tsx
 * import type { ColorPickerProps } from "@beep/ui/components/color-picker"
 *
 * const props = {
 *   name: "accentColor",
 *   value: "#0ea5e9",
 *   onValueChange: (value) => value.toUpperCase(),
 * } satisfies ColorPickerProps
 *
 * console.log(props.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ColorPickerProps extends Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> {
  readonly defaultValue?: string | undefined;
  readonly disabled?: boolean | undefined;
  readonly id?: string | undefined;
  readonly name?: string | undefined;
  readonly onBlur?: React.FocusEventHandler<HTMLInputElement> | undefined;
  readonly onValueChange?: ((value: string) => void) | undefined;
  readonly placeholder?: string | undefined;
  readonly value?: string | undefined;
}

interface ColorPickerState {
  readonly draftValue: string;
  readonly open: boolean;
}

const ColorPickerScope = makeScopedAtom((defaultValue: string) =>
  Atom.make<ColorPickerState>({
    draftValue: normalizeHexColorInputOrUndefined(defaultValue) ?? defaultColorValue,
    open: false,
  })
);

/**
 * Popover hex color picker with a text input fallback.
 *
 * @remarks
 * Pass `value` with `onValueChange` for controlled usage. Without `value`,
 * `defaultValue` seeds the scoped picker state.
 *
 * @example
 * ```tsx
 * import { ColorPicker } from "@beep/ui/components/color-picker"
 *
 * export function AccentColorField() {
 *   return <ColorPicker name="accentColor" defaultValue="#0ea5e9" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const ColorPicker: React.FC<ColorPickerProps> = (props) => (
  <ColorPickerScope.Provider value={props.defaultValue ?? props.value ?? defaultColorValue}>
    <ColorPickerInner {...props} />
  </ColorPickerScope.Provider>
);

const ColorPickerInner: React.FC<ColorPickerProps> = ({
  className,
  defaultValue,
  disabled = false,
  id,
  name,
  onBlur,
  onValueChange,
  placeholder = "#000000",
  value,
  ...props
}) => {
  const [state, setState] = useAtom(ColorPickerScope.use());
  const controlled = P.isString(value);
  const normalizedValue = controlled ? normalizeHexColorInputOrUndefined(value) : undefined;
  const color = normalizedValue ?? state.draftValue;

  const commitColor = (nextValue: string) => {
    const normalized = normalizeHexColorInputOrUndefined(nextValue);
    setState((current) => ({ ...current, draftValue: normalized ?? nextValue }));
    if (normalized !== undefined) {
      onValueChange?.(normalized);
    }
  };

  return (
    <div className={cn("flex w-full flex-col gap-2", className)} {...props}>
      <div className="flex items-center gap-2">
        <Popover open={state.open} onOpenChange={(open) => setState((current) => ({ ...current, open }))}>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                disabled={disabled}
                aria-label="Choose color"
                className="p-1"
              >
                <span className="size-5 rounded-sm border" style={{ backgroundColor: color }} />
              </Button>
            }
          />
          <PopoverContent className="w-auto p-3 [&_.react-colorful]:h-44 [&_.react-colorful]:w-56">
            <HexColorPicker color={color} onChange={commitColor} />
          </PopoverContent>
        </Popover>
        <Input
          id={id}
          name={name}
          disabled={disabled}
          value={color}
          placeholder={placeholder}
          onBlur={onBlur}
          onChange={(event) => commitColor(event.target.value)}
        />
      </div>
    </div>
  );
};
