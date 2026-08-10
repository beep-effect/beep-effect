/**
 * LLM-readable OIP site summary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { getOipSiteContent, makeLlmsText } from "../../content";

/**
 * Returns `llms.txt` for oip.law.
 *
 * **Example** (Fetching llms.txt content type)
 *
 * ```ts
 * import { GET } from "@beep/oip-web/app/llms.txt/route"
 *
 * const response = await GET()
 * console.log(response.headers.get("content-type"))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function GET(): Promise<Response> {
  return getOipSiteContent().then(
    (content) =>
      new Response(makeLlmsText(content), {
        headers: {
          "content-type": "text/plain; charset=utf-8",
        },
      })
  );
}
