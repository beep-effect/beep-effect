/**
 * Calendar event card: status, variant, and action styling for a single calendar event.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { CheckIcon, SpinnerGapIcon } from "@phosphor-icons/react";
import { Match } from "effect";
import { cn } from "../lib/index.ts";
import type { ReactNode } from "react";

/**
 * Visual progress state for a calendar event action.
 *
 * **Example** (Completed status check)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { EventStatus } from "@beep/ui/components/calendar-event-card"
 *
 * const isCompleted = (status: EventStatus): boolean => status === "completed"
 * strictEqual(isCompleted("loading"), false)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventStatus = "idle" | "loading" | "completed";
/**
 * Presentation mode for a calendar event card.
 *
 * **Example** (Action variant check)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import type { EventVariant } from "@beep/ui/components/calendar-event-card"
 *
 * const variant: EventVariant = "action"
 * const showsActionButton = variant === "action"
 * strictEqual(showsActionButton, true)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type EventVariant = "display" | "action";

interface CalendarEventCardProps {
  readonly buttonColor?: undefined | "primary" | "danger";
  readonly children: ReactNode;
  readonly className?: undefined | string;
  readonly completedLabel?: undefined | string;
  readonly eventColor: string;
  readonly isDotted?: undefined | boolean;
  readonly label?: undefined | string;
  readonly onAction?: undefined | (() => void);
  readonly opacity?: undefined | number;
  readonly status?: undefined | EventStatus;
  readonly variant?: undefined | EventVariant;
}

/**
 * Timeline-style event card with optional action state.
 *
 * **Example** (Action event card)
 *
 * ```tsx
 * import { CalendarEventCard, EventLocation, EventTime, EventTitle } from "@beep/ui/components/calendar-event-card"
 *
 * export function ReviewEventCard() {
 *   return (
 *     <CalendarEventCard
 *       eventColor="#0ea5e9"
 *       label="Today"
 *       variant="action"
 *       status="idle"
 *       onAction={() => undefined}
 *     >
 *       <EventTitle>Review engagement letter</EventTitle>
 *       <EventTime startTime="10:00 AM" endTime="10:30 AM" />
 *       <EventLocation>Conference Room A</EventLocation>
 *     </CalendarEventCard>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function CalendarEventCard({
  eventColor,
  status = "idle",
  label,
  children,
  variant = "display",
  buttonColor = "primary",
  completedLabel = "Completed",
  onAction,
  isDotted = false,
  opacity = 1,
  className,
}: CalendarEventCardProps) {
  const hasAction = variant === "action" && onAction !== undefined;
  const hasLabel = label !== undefined && label.length > 0;
  const finalOpacity = status === "completed" ? 0.5 : opacity;

  const buttonColorClasses = {
    primary: "bg-sky-500 text-white hover:bg-sky-600",
    danger: "bg-red-500 text-white hover:bg-red-600",
  } as const;
  const actionContent = Match.value(status).pipe(
    Match.when("loading", () => (
      <>
        <SpinnerGapIcon size={16} className="animate-spin" />
        Confirm
      </>
    )),
    Match.when("completed", () => (
      <>
        <CheckIcon size={16} />
        {completedLabel}
      </>
    )),
    Match.orElse(() => "Confirm")
  );

  return (
    <div
      className={cn(
        "relative flex gap-2 rounded-lg p-3 pl-5 pr-2 transition-colors",
        hasAction ? "items-end" : "items-start",
        isDotted && "border-2 border-dashed",
        className
      )}
      style={{
        ...(isDotted
          ? {
              borderColor: `${eventColor}80`,
              backgroundColor: `${eventColor}10`,
            }
          : {
              backgroundColor: `${eventColor}20`,
            }),
        opacity: finalOpacity,
      }}
    >
      <div className="absolute left-1 top-0 flex h-full items-center">
        <div className="h-[80%] w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: eventColor }} />
      </div>

      <div className="min-w-0 flex-1">
        {hasLabel && (
          <div
            className={cn(
              "mb-1 text-xs font-medium",
              isDotted ? "text-blue-600 dark:text-blue-400" : "text-zinc-600 dark:text-zinc-500"
            )}
          >
            {label}
          </div>
        )}
        {children}
      </div>

      {hasAction && (
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            buttonColorClasses[buttonColor]
          )}
          disabled={status === "completed"}
          onClick={onAction}
        >
          {actionContent}
        </button>
      )}
    </div>
  );
}

interface EventTitleProps {
  readonly children: ReactNode;
  readonly className?: undefined | string;
}

/**
 * Primary title text inside a calendar event card.
 *
 * **Example** (Event title text)
 *
 * ```tsx
 * import { EventTitle } from "@beep/ui/components/calendar-event-card"
 *
 * export function CalendarEventHeading() {
 *   return <EventTitle>Client kickoff</EventTitle>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EventTitle({ children, className }: EventTitleProps) {
  return <h3 className={cn("font-medium text-zinc-900 dark:text-zinc-100", className)}>{children}</h3>;
}

interface EventTimeProps {
  readonly className?: undefined | string;
  readonly endTime?: undefined | string;
  readonly startTime: string;
}

/**
 * Time range text inside a calendar event card.
 *
 * **Example** (Time range display)
 *
 * ```tsx
 * import { EventTime } from "@beep/ui/components/calendar-event-card"
 *
 * export function CalendarEventTimeRange() {
 *   return <EventTime startTime="1:00 PM" endTime="2:00 PM" />
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EventTime({ startTime, endTime, className }: EventTimeProps) {
  const hasEndTime = endTime !== undefined && endTime.length > 0;

  return (
    <p className={cn("text-sm text-zinc-600 dark:text-zinc-400", className)}>
      {startTime}
      {hasEndTime ? ` - ${endTime}` : ""}
    </p>
  );
}

interface EventLocationProps {
  readonly children: ReactNode;
  readonly className?: undefined | string;
}

/**
 * Location or meeting channel text inside a calendar event card.
 *
 * **Example** (Location label text)
 *
 * ```tsx
 * import { EventLocation } from "@beep/ui/components/calendar-event-card"
 *
 * export function CalendarEventLocationLabel() {
 *   return <EventLocation>Zoom</EventLocation>
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function EventLocation({ children, className }: EventLocationProps) {
  return <p className={cn("text-xs text-zinc-500 dark:text-zinc-500", className)}>{children}</p>;
}
