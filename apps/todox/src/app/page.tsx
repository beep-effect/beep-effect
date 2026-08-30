/**
 * Home route for the minimal Todox app.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Renders the Todox home page.
 *
 * **Example** (Render the home page)
 *
 * ```ts
 * import Home from "@/app/page"
 *
 * const page = Home()
 * console.log(page.type)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export default function Home() {
  return (
    <main>
      <h1>@beep/todox</h1>
    </main>
  );
}
