/**
 * Home page of beep-effect.com.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { createFileRoute } from "@tanstack/react-router";

/**
 * File route for `/`.
 *
 * **Example** (Read the home route path)
 *
 * ```ts
 * import { Route } from "@/routes/index"
 *
 * console.log(Route.fullPath) // "/"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Route = createFileRoute("/")({
  component: Home,
});

/**
 * Renders the starter page.
 *
 * **Example** (Render the home page)
 *
 * ```ts
 * import { Home } from "@/routes/index"
 *
 * const page = Home()
 * console.log(page.type) // "main"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function Home() {
  return (
    <main>
      <h1>beep-effect</h1>
      <p>Served from a Cloudflare Worker, deployed with Alchemy.</p>
    </main>
  );
}
