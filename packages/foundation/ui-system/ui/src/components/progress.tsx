/**
 * Progress primitive: a determinate progress bar built on Base UI's progress.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Progress as ProgressPrimitive } from "@base-ui/react/progress";
import { cn } from "../lib/index.ts";

/**
 * Progress component.
 *
 * **Example** (Import Progress component)
 *
 * ```tsx
 * import { Progress } from "@beep/ui/components/progress"
 *
 * console.log(Progress)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Progress({ className, children, value, ...props }: ProgressPrimitive.Root.Props) {
  return (
    <ProgressPrimitive.Root
      value={value}
      data-slot="progress"
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressPrimitive.Root>
  );
}

/**
 * Progress track component.
 *
 * **Example** (Import ProgressTrack component)
 *
 * ```tsx
 * import { ProgressTrack } from "@beep/ui/components/progress"
 *
 * console.log(ProgressTrack)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ProgressTrack({ className, ...props }: ProgressPrimitive.Track.Props) {
  return (
    <ProgressPrimitive.Track
      className={cn("bg-muted h-1 rounded-full relative flex w-full items-center overflow-x-hidden", className)}
      data-slot="progress-track"
      {...props}
    />
  );
}

/**
 * Progress indicator component.
 *
 * **Example** (Import ProgressIndicator component)
 *
 * ```tsx
 * import { ProgressIndicator } from "@beep/ui/components/progress"
 *
 * console.log(ProgressIndicator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ProgressIndicator({ className, ...props }: ProgressPrimitive.Indicator.Props) {
  return (
    <ProgressPrimitive.Indicator
      data-slot="progress-indicator"
      className={cn(
        "bg-primary h-full transition-all data-[indeterminate]:absolute data-[indeterminate]:w-2/5 data-[indeterminate]:transition-none data-[indeterminate]:[animation:progress-indeterminate_1.5s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  );
}

/**
 * Progress label component.
 *
 * **Example** (Import ProgressLabel component)
 *
 * ```tsx
 * import { ProgressLabel } from "@beep/ui/components/progress"
 *
 * console.log(ProgressLabel)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ProgressLabel({ className, ...props }: ProgressPrimitive.Label.Props) {
  return (
    <ProgressPrimitive.Label className={cn("text-sm font-medium", className)} data-slot="progress-label" {...props} />
  );
}

/**
 * Progress value component.
 *
 * **Example** (Import ProgressValue component)
 *
 * ```tsx
 * import { ProgressValue } from "@beep/ui/components/progress"
 *
 * console.log(ProgressValue)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function ProgressValue({ className, ...props }: ProgressPrimitive.Value.Props) {
  return (
    <ProgressPrimitive.Value
      className={cn("text-muted-foreground ml-auto text-sm tabular-nums", className)}
      data-slot="progress-value"
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue };
