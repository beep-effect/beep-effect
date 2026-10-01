/**
 * Avatar primitive: a circular image frame with fallback content.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { useAtomSubscribe, useAtomValue } from "@effect/atom-react";
import { cva } from "class-variance-authority";
import * as P from "effect/Predicate";
import { Atom } from "effect/reactivity";
import { cn } from "../lib/index.ts";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

const avatarVariants = cva("group/avatar relative flex shrink-0 overflow-hidden", {
  variants: {
    size: {
      sm: "size-8",
      default: "size-10",
      lg: "size-14",
    },
    shape: {
      circle: "rounded-full",
      rounded: "rounded-lg",
    },
  },
  defaultVariants: {
    size: "default",
    shape: "circle",
  },
});

interface AvatarProps extends React.ComponentPropsWithoutRef<"span">, VariantProps<typeof avatarVariants> {
  readonly children?: undefined | React.ReactNode;
}

/**
 * Avatar frame for an image with fallback content.
 *
 * **Details**
 *
 * `size` sets the frame (`sm` 32px, `default` 40px, `lg` 56px) and scales the fallback
 * initials with it. `shape: "rounded"` swaps the circle for a rounded square; the fallback
 * follows the frame's shape.
 *
 * **Example** (Large rounded avatar)
 *
 * ```tsx
 * import { Avatar, AvatarFallback } from "@beep/ui/components/avatar"
 *
 * export function TeamAvatar() {
 *   return (
 *     <Avatar size="lg" shape="rounded">
 *       <AvatarFallback>BE</AvatarFallback>
 *     </Avatar>
 *   )
 * }
 * ```
 *
 * **Example** (Avatar with image fallback)
 *
 * ```tsx
 * import { Avatar, AvatarFallback, AvatarImage } from "@beep/ui/components/avatar"
 *
 * export function UserAvatar() {
 *   return (
 *     <Avatar>
 *       <AvatarImage src="/avatars/ada.png" alt="Ada Lovelace" />
 *       <AvatarFallback>AL</AvatarFallback>
 *     </Avatar>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function Avatar({ className, children, size = "default", shape = "circle", ...props }: AvatarProps) {
  return (
    <span
      data-slot="avatar"
      data-size={size}
      data-shape={shape}
      className={cn(avatarVariants({ size, shape, className }))}
      {...props}
    >
      {children}
    </span>
  );
}

interface AvatarImageProps extends Omit<React.ComponentPropsWithoutRef<"img">, "src"> {
  readonly onLoadingStatusChange?: ((status: "idle" | "loading" | "loaded" | "error") => void) | undefined;
  readonly src?: string | undefined;
}

type AvatarImageStatus = "idle" | "loading" | "loaded" | "error";

const avatarImageStatusAtom = Atom.family((src: string | undefined) =>
  Atom.make((get): AvatarImageStatus => {
    if (!P.isString(src) || src.length === 0) {
      return "error";
    }

    if (!P.isFunction(globalThis.Image)) {
      return "idle";
    }

    const image = new globalThis.Image();
    let disposed = false;

    image.onload = () => {
      if (!disposed) {
        get.setSelf("loaded");
      }
    };
    image.onerror = () => {
      if (!disposed) {
        get.setSelf("error");
      }
    };
    image.src = src;
    get.addFinalizer(() => {
      disposed = true;
    });

    return "loading";
  })
);

/**
 * Avatar image that renders only after the source loads successfully.
 *
 * **Details**
 *
 * `onLoadingStatusChange` is notified for terminal `loaded` and `error`
 * states so callers can coordinate external fallback behavior.
 *
 * **Example** (Profile avatar image)
 *
 * ```tsx
 * import { Avatar, AvatarFallback, AvatarImage } from "@beep/ui/components/avatar"
 *
 * export function ProfileAvatarImage() {
 *   return (
 *     <Avatar>
 *       <AvatarImage src="/avatars/grace.png" alt="Grace Hopper" />
 *       <AvatarFallback>GH</AvatarFallback>
 *     </Avatar>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AvatarImage({ className, src, alt, onLoadingStatusChange, ...props }: AvatarImageProps) {
  const statusAtom = avatarImageStatusAtom(src);
  const status = useAtomValue(statusAtom);

  useAtomSubscribe(statusAtom, (nextStatus) => {
    if (nextStatus === "loaded" || nextStatus === "error") {
      onLoadingStatusChange?.(nextStatus);
    }
  });

  if (status !== "loaded") {
    return null;
  }

  return (
    <img
      data-slot="avatar-image"
      className={cn("aspect-square size-full object-cover", className)}
      src={src}
      alt={alt}
      {...props}
    />
  );
}

/**
 * Fallback initials or icon shown when no avatar image is available.
 *
 * **Example** (Initials-only avatar)
 *
 * ```tsx
 * import { Avatar, AvatarFallback } from "@beep/ui/components/avatar"
 *
 * export function InitialsAvatar() {
 *   return (
 *     <Avatar>
 *       <AvatarFallback>NP</AvatarFallback>
 *     </Avatar>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AvatarFallback({ className, children, ...props }: React.ComponentPropsWithoutRef<"span">) {
  return (
    <span
      data-slot="avatar-fallback"
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full text-sm font-medium group-data-[size=sm]/avatar:text-xs group-data-[size=lg]/avatar:text-base group-data-[shape=rounded]/avatar:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { Avatar, AvatarFallback, AvatarImage };
