/**
 * Date picker primitive: a single-date picker composed from `Popover` and `Calendar`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Button } from "@beep/ui/components/button";
import { Calendar } from "@beep/ui/components/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@beep/ui/components/popover";
import { cn } from "@beep/ui/lib/utils";
import { make as makeScopedAtom, useAtom } from "@effect/atom-react";
import { CalendarBlankIcon } from "@phosphor-icons/react";
import * as P from "effect/Predicate";
import { Atom } from "effect/unstable/reactivity";

const DATE_FORMAT = {
  year: "numeric",
  month: "long",
  day: "numeric",
} as const satisfies Intl.DateTimeFormatOptions;

interface DatePickerProps {
  readonly className?: string | undefined;
  readonly defaultValue?: Date | undefined;
  readonly disabled?: boolean | undefined;
  readonly onValueChange?: ((date: Date | undefined) => void) | undefined;
  readonly placeholder?: string | undefined;
  readonly value?: Date | undefined;
}

type DatePickerState = {
  readonly internalValue: Date | undefined;
  readonly open: boolean;
};

const DatePickerScope = makeScopedAtom((defaultValue: Date | undefined) =>
  Atom.make<DatePickerState>({
    internalValue: defaultValue,
    open: false,
  })
);

/**
 * A single-date picker composed from {@link Popover} and {@link Calendar}. Supports
 * both controlled (`value` + `onValueChange`) and uncontrolled (`defaultValue`) usage.
 *
 * @example
 * ```tsx
 * import { DatePicker } from "@beep/ui/components/date-picker"
 *
 * console.log(DatePicker)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function DatePicker(props: DatePickerProps) {
  return (
    <DatePickerScope.Provider value={props.defaultValue}>
      <DatePickerInner {...props} />
    </DatePickerScope.Provider>
  );
}

function DatePickerInner(props: DatePickerProps) {
  const { value, onValueChange, placeholder = "Pick a date", disabled = false, className } = props;
  const [state, setState] = useAtom(DatePickerScope.use());
  // Detect controlledness by prop presence so a parent that starts controlled
  // with `value={undefined}` (and any later reset to `undefined`) is honored.
  const isControlled = P.hasProperty(props, "value");
  const selected = isControlled ? value : state.internalValue;

  const handleSelect = (date: Date | undefined) => {
    if (!isControlled) {
      setState((current) => ({ ...current, internalValue: date }));
    }
    onValueChange?.(date);
    setState((current) => ({ ...current, open: false }));
  };

  return (
    <Popover open={state.open} onOpenChange={(open) => setState((current) => ({ ...current, open }))}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            disabled={disabled}
            data-empty={selected === undefined}
            className={cn(
              "w-56 justify-start text-left font-normal data-[empty=true]:text-muted-foreground",
              className
            )}
          >
            <CalendarBlankIcon />
            {selected === undefined ? <span>{placeholder}</span> : selected.toLocaleDateString(undefined, DATE_FORMAT)}
          </Button>
        }
      />
      <PopoverContent className="w-auto p-0">
        <Calendar mode="single" selected={selected} onSelect={handleSelect} />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Date picker component export.
 *
 * @example
 * ```tsx
 * import { DatePicker } from "@beep/ui/components/date-picker"
 *
 * console.log(DatePicker)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export { DatePicker };
