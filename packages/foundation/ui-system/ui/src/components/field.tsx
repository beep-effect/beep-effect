/**
 * Field primitive: a labeled form-field wrapper with description and error slots.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Label } from "@beep/ui/components/label";
import { Separator } from "@beep/ui/components/separator";
import { A } from "@beep/utils";
import { cva } from "class-variance-authority";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type React from "react";

const hasRenderableNode = (node: React.ReactNode): boolean =>
  node !== undefined && node !== null && node !== false && node !== "" && node !== 0 && node !== BigInt(0);

/**
 * Field set component.
 *
 * **Example** (Import FieldSet component)
 *
 * ```tsx
 * import { FieldSet } from "@beep/ui/components/field"
 *
 * console.log(FieldSet)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3 flex flex-col",
        className
      )}
      {...props}
    />
  );
}

/**
 * Field legend component.
 *
 * **Example** (Import FieldLegend component)
 *
 * ```tsx
 * import { FieldLegend } from "@beep/ui/components/field"
 *
 * console.log(FieldLegend)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { readonly variant?: undefined | "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn("mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base", className)}
      {...props}
    />
  );
}

/**
 * Field group component.
 *
 * **Example** (Import FieldGroup component)
 *
 * ```tsx
 * import { FieldGroup } from "@beep/ui/components/field"
 *
 * console.log(FieldGroup)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "gap-5 data-[slot=checkbox-group]:gap-3 [&>[data-slot=field-group]]:gap-4 group/field-group @container/field-group flex w-full flex-col",
        className
      )}
      {...props}
    />
  );
}

const fieldVariants = cva("data-[invalid=true]:text-destructive gap-2 group/field flex w-full", {
  variants: {
    orientation: {
      vertical: "flex-col [&>*]:w-full [&>.sr-only]:w-auto",
      horizontal:
        "flex-row items-center [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      responsive:
        "flex-col [&>*]:w-full [&>.sr-only]:w-auto @md/field-group:flex-row @md/field-group:items-center @md/field-group:[&>*]:w-auto @md/field-group:[&>[data-slot=field-label]]:flex-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
    },
  },
  defaultVariants: {
    orientation: "vertical",
  },
});

/**
 * Field component.
 *
 * **Example** (Import Field component)
 *
 * ```tsx
 * import { Field } from "@beep/ui/components/field"
 *
 * console.log(Field)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
  return (
    <div
      role="group"
      data-slot="field"
      data-orientation={orientation}
      className={cn(fieldVariants({ orientation }), className)}
      {...props}
    />
  );
}

/**
 * Field content component.
 *
 * **Example** (Import FieldContent component)
 *
 * ```tsx
 * import { FieldContent } from "@beep/ui/components/field"
 *
 * console.log(FieldContent)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("gap-0.5 group/field-content flex flex-1 flex-col leading-snug", className)}
      {...props}
    />
  );
}

/**
 * Field label component.
 *
 * **Example** (Import FieldLabel component)
 *
 * ```tsx
 * import { FieldLabel } from "@beep/ui/components/field"
 *
 * console.log(FieldLabel)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "has-data-checked:bg-primary/5 has-data-checked:border-primary dark:has-data-checked:bg-primary/10 gap-2 group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border [&>*]:data-[slot=field]:p-2.5 group/field-label peer/field-label flex w-fit leading-snug",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    />
  );
}

/**
 * Field title component.
 *
 * **Example** (Import FieldTitle component)
 *
 * ```tsx
 * import { FieldTitle } from "@beep/ui/components/field"
 *
 * console.log(FieldTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50 flex w-fit items-center leading-snug",
        className
      )}
      {...props}
    />
  );
}

/**
 * Field description component.
 *
 * **Example** (Import FieldDescription component)
 *
 * ```tsx
 * import { FieldDescription } from "@beep/ui/components/field"
 *
 * console.log(FieldDescription)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-muted-foreground text-left text-sm [[data-variant=legend]+&]:-mt-1.5 leading-normal font-normal group-has-[[data-orientation=horizontal]]/field:text-balance",
        "last:mt-0 nth-last-2:-mt-1",
        "[&>a:hover]:text-primary [&>a]:underline [&>a]:underline-offset-4",
        className
      )}
      {...props}
    />
  );
}

/**
 * Field separator component.
 *
 * **Example** (Import FieldSeparator component)
 *
 * ```tsx
 * import { FieldSeparator } from "@beep/ui/components/field"
 *
 * console.log(FieldSeparator)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  readonly children?: undefined | React.ReactNode;
}) {
  const hasChildren = hasRenderableNode(children);
  return (
    <div
      data-slot="field-separator"
      data-content={hasChildren}
      className={cn("-my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2 relative", className)}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {hasChildren && (
        <span
          className="text-muted-foreground px-2 bg-background relative mx-auto block w-fit"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  );
}

/**
 * Field error component.
 *
 * **Example** (Import FieldError component)
 *
 * ```tsx
 * import { FieldError } from "@beep/ui/components/field"
 *
 * console.log(FieldError)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  readonly errors?: undefined | Array<{ readonly message?: undefined | string } | undefined>;
}) {
  const content = (() => {
    if (hasRenderableNode(children)) {
      return children;
    }

    const errorsOption = O.fromNullishOr(errors);
    if (O.isNone(errorsOption) || A.isReadonlyArrayEmpty(errorsOption.value)) {
      return null;
    }

    const uniqueErrors = pipe(
      errorsOption.value,
      A.dedupeWith((a, b) => a?.message === b?.message),
      A.filter((error): error is { readonly message?: undefined | string } => error !== undefined)
    );

    if (A.length(uniqueErrors) === 1) {
      return pipe(
        A.head(uniqueErrors),
        O.flatMap((error) => O.fromNullishOr(error.message)),
        O.getOrNull
      );
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {pipe(
          uniqueErrors,
          A.flatMapNullishOr((error) => error.message),
          A.map((message, index) => <li key={index}>{message}</li>)
        )}
      </ul>
    );
  })();

  if (!hasRenderableNode(content)) {
    return null;
  }

  return (
    <div
      role="alert"
      data-slot="field-error"
      className={cn("text-destructive text-sm font-normal", className)}
      {...props}
    >
      {content}
    </div>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
};
