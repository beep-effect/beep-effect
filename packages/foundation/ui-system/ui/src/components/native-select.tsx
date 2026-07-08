/**
 * Native-select primitive: a styled wrapper around the native `<select>` element with a trailing caret.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cn } from "@beep/ui/lib/utils";
import { CaretDownIcon } from "@phosphor-icons/react";
import type * as React from "react";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default";
};

/**
 * A styled wrapper around the native `<select>` element with a trailing caret icon.
 *
 * @example
 * ```tsx
 * import { NativeSelect } from "@beep/ui/components/native-select"
 *
 * console.log(NativeSelect)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function NativeSelect({ className, size = "default", ...props }: NativeSelectProps) {
  return (
    <div
      className={cn("group/native-select relative w-fit has-[select:disabled]:opacity-50", className)}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:py-0.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
        {...props}
      />
      <CaretDownIcon
        className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none"
        aria-hidden="true"
        data-slot="native-select-icon"
      />
    </div>
  );
}

/**
 * An `<option>` for use within {@link NativeSelect}, themed to match the system color scheme.
 *
 * @example
 * ```tsx
 * import { NativeSelectOption } from "@beep/ui/components/native-select"
 *
 * console.log(NativeSelectOption)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function NativeSelectOption({ className, ...props }: React.ComponentProps<"option">) {
  return (
    <option data-slot="native-select-option" className={cn("bg-[Canvas] text-[CanvasText]", className)} {...props} />
  );
}

/**
 * An `<optgroup>` for use within {@link NativeSelect}, themed to match the system color scheme.
 *
 * @example
 * ```tsx
 * import { NativeSelectOptGroup } from "@beep/ui/components/native-select"
 *
 * console.log(NativeSelectOptGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function NativeSelectOptGroup({ className, ...props }: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  );
}

/**
 * Native select component suite exports.
 *
 * @example
 * ```tsx
 * import { NativeSelect } from "@beep/ui/components/native-select"
 *
 * console.log(NativeSelect)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
