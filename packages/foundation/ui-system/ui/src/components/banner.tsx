/**
 * Banner primitive: class-variance helper for banner tone variants.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CheckCircleIcon, InfoIcon, SpinnerGapIcon, WarningCircleIcon, XIcon } from "@phosphor-icons/react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

/**
 * Class variance helper for banner tone variants.
 *
 * **Example** (Warning banner class names)
 *
 * ```ts
 * import { bannerVariants } from "@beep/ui/components/banner"
 *
 * const className = bannerVariants({ variant: "warning" })
 *
 * console.log(className.includes("border-warning"))
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const bannerVariants = cva("relative flex items-center gap-3 rounded-lg border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "border-border bg-muted text-foreground",
      info: "border-primary/30 bg-primary/10 text-foreground [&>svg]:text-primary",
      success: "border-success/30 bg-success/10 text-success-text [&>svg]:text-success-text",
      warning: "border-warning/30 bg-warning/10 text-warning-text [&>svg]:text-warning-text",
      destructive: "border-destructive/30 bg-destructive/10 text-destructive-text [&>svg]:text-destructive-text",
      loading: "border-border bg-muted text-foreground",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

type BannerVariant = NonNullable<VariantProps<typeof bannerVariants>["variant"]>;

const variantIcons: Record<BannerVariant, React.ReactNode> = {
  default: <InfoIcon className="size-4 shrink-0" />,
  info: <InfoIcon className="size-4 shrink-0" />,
  success: <CheckCircleIcon className="size-4 shrink-0" />,
  warning: <WarningCircleIcon className="size-4 shrink-0" />,
  destructive: <WarningCircleIcon className="size-4 shrink-0" />,
  loading: <SpinnerGapIcon className="size-4 shrink-0 animate-spin" />,
};

type BannerRootProps = React.ComponentProps<"div"> &
  VariantProps<typeof bannerVariants> & {
    readonly icon?: React.ReactNode;
  };

function Banner({ className, variant = "default", icon, children, ...props }: BannerRootProps) {
  const defaultIcon = variantIcons[variant ?? "default"];

  return (
    <div data-slot="banner" role="alert" className={cn(bannerVariants({ variant }), className)} {...props}>
      {icon ?? defaultIcon}
      {children}
    </div>
  );
}

/**
 * Flexible content column inside a {@link Banner}.
 *
 * **Example** (Banner content column)
 *
 * ```tsx
 * import { Banner, BannerContent, BannerTitle } from "@beep/ui/components/banner"
 *
 * export function BannerContentColumn() {
 *   return (
 *     <Banner>
 *       <BannerContent>
 *         <BannerTitle>Workspace ready</BannerTitle>
 *       </BannerContent>
 *     </Banner>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const BannerContent = ({ className, ...props }: React.ComponentProps<"div">) => (
  <div data-slot="banner-content" className={cn("flex-1", className)} {...props} />
);

/**
 * Short headline text inside a banner content column.
 *
 * **Example** (Success banner headline)
 *
 * ```tsx
 * import { Banner, BannerContent, BannerTitle } from "@beep/ui/components/banner"
 *
 * export function BannerHeadline() {
 *   return (
 *     <Banner variant="success">
 *       <BannerContent>
 *         <BannerTitle>Import complete</BannerTitle>
 *       </BannerContent>
 *     </Banner>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const BannerTitle = ({ className, ...props }: React.ComponentProps<"p">) => (
  <p data-slot="banner-title" className={cn("font-medium leading-none", className)} {...props} />
);

/**
 * Secondary explanatory text inside a banner content column.
 *
 * **Example** (Info banner body copy)
 *
 * ```tsx
 * import { Banner, BannerContent, BannerDescription, BannerTitle } from "@beep/ui/components/banner"
 *
 * export function BannerBodyCopy() {
 *   return (
 *     <Banner variant="info">
 *       <BannerContent>
 *         <BannerTitle>New template available</BannerTitle>
 *         <BannerDescription>Use it for every onboarding checklist.</BannerDescription>
 *       </BannerContent>
 *     </Banner>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const BannerDescription = ({ className, ...props }: React.ComponentProps<"p">) => (
  <p data-slot="banner-description" className={cn("text-sm opacity-90", className)} {...props} />
);

type BannerDismissProps = React.ComponentProps<"button"> & {
  readonly onDismiss?: undefined | (() => void);
};

/**
 * Dismiss control that calls `onDismiss` before the button `onClick` handler.
 *
 * **Example** (Dismissible banner control)
 *
 * ```tsx
 * import { Banner, BannerContent, BannerDismiss, BannerTitle } from "@beep/ui/components/banner"
 *
 * export function DismissibleBanner() {
 *   return (
 *     <Banner>
 *       <BannerContent>
 *         <BannerTitle>Invite copied</BannerTitle>
 *       </BannerContent>
 *       <BannerDismiss onDismiss={() => "dismissed"} />
 *     </Banner>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const BannerDismiss = ({ className, onDismiss, onClick, ...props }: BannerDismissProps) => (
  <button
    type="button"
    data-slot="banner-dismiss"
    className={cn(
      "inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md opacity-70 transition-all hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95",
      className
    )}
    onClick={(e) => {
      onDismiss?.();
      onClick?.(e);
    }}
    {...props}
  >
    <XIcon className="size-4" />
    <span className="sr-only">Dismiss</span>
  </button>
);

/**
 * Inline alert banner with variant-driven icon defaults, composed with its
 * content slots via `Banner.Content`, `Banner.Title`, `Banner.Description`,
 * and `Banner.Dismiss`.
 *
 * **Example** (Composed dismissible warning)
 *
 * ```tsx
 * import { Banner } from "@beep/ui/components/banner"
 *
 * export function DismissibleWarningBanner() {
 *   return (
 *     <Banner variant="warning">
 *       <Banner.Content>
 *         <Banner.Title>Maintenance scheduled</Banner.Title>
 *         <Banner.Description>Exports pause at 8 PM Central.</Banner.Description>
 *       </Banner.Content>
 *       <Banner.Dismiss onDismiss={() => "dismissed"} />
 *     </Banner>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const BannerWithParts = Object.assign(Banner, {
  Content: BannerContent,
  Description: BannerDescription,
  Dismiss: BannerDismiss,
  Title: BannerTitle,
});

/**
 * @category components
 * @since 0.0.0
 */
export { BannerContent, BannerDescription, BannerDismiss, BannerTitle, BannerWithParts as Banner, bannerVariants };
