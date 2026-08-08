/**
 * Aspect-ratio primitive: a fixed-ratio wrapper that keeps media cropped inside a stable box.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { cn } from "../lib/index.ts";

/**
 * Fixed-ratio media wrapper that keeps children cropped inside a stable box.
 *
 * **Example** (Sixteen-by-nine video thumbnail)
 *
 * ```tsx
 * import { AspectRatio } from "@beep/ui/components/aspect-ratio"
 *
 * export function VideoThumbnail() {
 *   return (
 *     <AspectRatio ratio={16 / 9} className="overflow-hidden rounded-lg bg-muted">
 *       <img src="/thumbnails/demo.png" alt="Demo video" className="h-full w-full object-cover" />
 *     </AspectRatio>
 *   )
 * }
 * ```
 *
 * @category components
 * @since 0.0.0
 */
function AspectRatio({ ratio, className, ...props }: React.ComponentProps<"div"> & { readonly ratio: number }) {
  return (
    <div
      data-slot="aspect-ratio"
      style={
        {
          "--ratio": ratio,
        } as React.CSSProperties
      }
      className={cn("relative aspect-(--ratio)", className)}
      {...props}
    />
  );
}

/**
 * @category components
 * @since 0.0.0
 */
export { AspectRatio };
