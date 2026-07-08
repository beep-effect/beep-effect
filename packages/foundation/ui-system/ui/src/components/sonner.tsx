/**
 * Sonner primitive: theme-aware toaster wiring the `sonner` toast renderer.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { CheckCircleIcon, InfoIcon, SpinnerIcon, WarningIcon, XCircleIcon } from "@phosphor-icons/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";
import type React from "react";
import type { ToasterProps } from "sonner";

/**
 * Toaster component.
 *
 * @example
 * ```tsx
 * import { Toaster } from "@beep/ui/components/sonner"
 *
 * console.log(Toaster)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as "dark" | "light" | "system"}
      className="toaster group"
      icons={{
        success: <CheckCircleIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <WarningIcon className="size-4" />,
        error: <XCircleIcon className="size-4" />,
        loading: <SpinnerIcon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

/**
 * @category components
 * @since 0.0.0
 */
/**
 * Sonner toast controller.
 *
 * @example
 * ```tsx
 * import { toast } from "@beep/ui/components/sonner"
 *
 * toast.error("Could not complete the request")
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export { Toaster, toast };
