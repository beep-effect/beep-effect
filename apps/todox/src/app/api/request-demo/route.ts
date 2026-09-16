/**
 * Placeholder request-demo route. The request path is not connected yet:
 * this handler reads nothing, stores nothing, and sends the visitor back to
 * the demo section so a no-JS submit never lands on a 404.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Redirects a posted demo request back to the section that holds the form.
 *
 * **Example** (Follow the redirect)
 *
 * ```ts
 * import { POST } from "@/app/api/request-demo/route"
 *
 * console.log(POST().headers.get("Location"))
 * ```
 *
 * @category handlers
 * @since 0.0.0
 */
export const POST = (): Response =>
  new Response(null, {
    status: 303,
    headers: { Location: "/#request-demo" },
  });
