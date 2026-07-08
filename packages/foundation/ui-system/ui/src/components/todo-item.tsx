/**
 * Todo-item primitive: a task row with priority, due-date, and subtask styling.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { A, Str } from "@beep/utils";
import { ArrowRightIcon, CalendarIcon, CheckIcon, InfoIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { DateTime } from "effect";
import { formatShortDate, toUtcDateTime } from "../lib/date-time.ts";
import { cn } from "../lib/index.ts";

type TodoPriority = "high" | "medium" | "low" | "none";

const dueDateToneClassName = (isToday: boolean, isOverdue: boolean): string => {
  if (isToday) {
    return "bg-green-500/10 text-green-600 dark:text-green-400";
  }

  if (isOverdue) {
    return "bg-red-500/10 text-red-600 dark:text-red-400";
  }

  return "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
};

interface TodoLabel {
  readonly color?: undefined | string;
  readonly id: string;
  readonly name: string;
}

interface TodoSubtask {
  readonly completed: boolean;
  readonly id: string;
  readonly title: string;
}

interface TodoProject {
  readonly color?: undefined | string;
  readonly id: string;
  readonly name: string;
}

interface TodoItemProps {
  readonly className?: undefined | string;
  readonly completed: boolean;
  readonly description?: undefined | string;
  readonly dueDate?: undefined | Date | string;
  readonly id: string;
  readonly isSelected?: undefined | boolean;
  readonly labels?: undefined | TodoLabel[];
  readonly onClick?: undefined | ((id: string) => void);
  readonly onToggleComplete?: undefined | ((id: string, completed: boolean) => void);
  readonly priority: TodoPriority;
  readonly project?: undefined | TodoProject;
  readonly subtasks?: undefined | TodoSubtask[];
  readonly title: string;
}

const priorityConfig = {
  high: {
    textColor: "text-red-500 dark:text-red-400",
    bgColor: "bg-red-500/10 dark:bg-red-400/10",
    borderColor: "border-red-500",
  },
  medium: {
    textColor: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500/10 dark:bg-yellow-400/10",
    borderColor: "border-yellow-500",
  },
  low: {
    textColor: "text-blue-500 dark:text-blue-400",
    bgColor: "bg-sky-500/10 dark:bg-sky-400/10",
    borderColor: "border-blue-500",
  },
  none: {
    textColor: "text-zinc-500 dark:text-zinc-500",
    bgColor: "bg-zinc-500/10 dark:bg-zinc-500/10",
    borderColor: "border-zinc-400 dark:border-zinc-500",
  },
} as const;

const formatDate = (date: Date | string): string => {
  const parsed = toUtcDateTime(date);
  const now = DateTime.nowUnsafe();
  const diff = DateTime.toEpochMillis(parsed) - DateTime.toEpochMillis(now);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days < 7) return `In ${days} days`;

  return formatShortDate(parsed);
};

/**
 * Todo item component.
 *
 * @example
 * ```tsx
 * import { TodoItem } from "@beep/ui/components/todo-item"
 *
 * console.log(TodoItem)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function TodoItem({
  id,
  title,
  description,
  completed,
  priority,
  dueDate,
  labels = [],
  subtasks = [],
  project,
  onToggleComplete,
  onClick,
  isSelected = false,
  className,
}: TodoItemProps) {
  const priorityStyle = priorityConfig[priority];
  const hasDescription = description !== undefined && description.length > 0;
  const hasDueDate = dueDate !== undefined;
  const hasProject = project !== undefined;
  const hasLabels = labels.length > 0;
  const hasSubtasks = subtasks.length > 0;
  const dueDateTime = hasDueDate ? toUtcDateTime(dueDate) : undefined;
  const now = DateTime.nowUnsafe();

  const isOverdue =
    dueDateTime !== undefined ? DateTime.toEpochMillis(dueDateTime) < DateTime.toEpochMillis(now) && !completed : false;
  const isToday =
    dueDateTime !== undefined &&
    !completed &&
    (() => {
      const parsed = DateTime.toPartsUtc(dueDateTime);
      const nowParts = DateTime.toPartsUtc(now);
      return parsed.year === nowParts.year && parsed.month === nowParts.month && parsed.day === nowParts.day;
    })();
  const hasMetadata = priority !== "none" || hasDueDate || hasLabels || hasProject || hasSubtasks;

  const completedSubtasks = A.filter(subtasks, (subtask) => subtask.completed).length;

  return (
    <div
      className={cn(
        "group pointer-events-auto mb-0 w-full cursor-pointer rounded-lg p-4 pl-5 text-left transition-all",
        isSelected ? "bg-sky-500/5 ring-2 ring-blue-500" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/70",
        completed && "opacity-50",
        className
      )}
      onClick={() => onClick?.(id)}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleComplete?.(id, !completed);
          }}
          className={cn(
            "mt-1 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 transition-all",
            completed
              ? "border-zinc-400 bg-zinc-400 dark:border-zinc-500 dark:bg-zinc-500"
              : `${priorityStyle.borderColor} border-dashed bg-transparent`
          )}
          aria-label={completed ? "Mark as incomplete" : "Mark as complete"}
        >
          {completed && <CheckIcon size={12} className="text-white" weight="bold" />}
        </button>

        <div className="min-w-0 flex-1">
          <div>
            <h4
              className={cn(
                "text-base font-medium text-zinc-900 dark:text-zinc-100",
                completed && "line-through text-zinc-500 dark:text-zinc-500"
              )}
            >
              {title}
            </h4>
            {hasDescription && <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{description}</p>}
          </div>

          {hasMetadata && (
            <div className="mt-2 flex flex-wrap items-center gap-1">
              {hasDueDate && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                    dueDateToneClassName(isToday, isOverdue)
                  )}
                >
                  <CalendarIcon size={12} />
                  {formatDate(dueDate)}
                </span>
              )}

              {project !== undefined && (
                <span
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  style={project.color !== undefined && project.color.length > 0 ? { color: project.color } : undefined}
                >
                  <InfoIcon size={12} />
                  {project.name}
                </span>
              )}

              {A.map(labels, (label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  style={label.color !== undefined && label.color.length > 0 ? { color: label.color } : undefined}
                >
                  <InfoIcon size={12} />
                  {label.name}
                </span>
              ))}

              {priority !== "none" && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                    priorityStyle.bgColor,
                    priorityStyle.textColor
                  )}
                >
                  <WarningCircleIcon size={12} />
                  {Str.capitalize(priority)}
                </span>
              )}

              {subtasks.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  <CheckIcon size={12} />
                  {completedSubtasks}/{subtasks.length} subtasks
                </span>
              )}
            </div>
          )}
        </div>

        <ArrowRightIcon size={16} />
      </div>
    </div>
  );
}
