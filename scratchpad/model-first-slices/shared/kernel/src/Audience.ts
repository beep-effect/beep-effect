import * as S from "effect/Schema";

/**
 * Who a declaration is written for. An Api may list only blocks of its own
 * audience; the key reaches every declaration's annotations through the
 * augmentation below.
 *
 * **Example** (Annotate a view for reviewers)
 * ```ts
 * import "@proto/kernel/Audience";
 *
 * const annotations = { description: "One claim, as a reviewer sees it.", audience: "reviewer" } as const;
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Audience = S.Literals(["reviewer", "agent", "intake"]);
/**
 * @category models
 * @since 0.0.0
 */
export type Audience = typeof Audience.Type;

declare module "@alchemy.run/domain" {
  interface Annotations {
    /** Who the declaration is for. */
    readonly audience?: Audience;
  }
}
