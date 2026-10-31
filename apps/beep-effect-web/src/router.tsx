/**
 * Router factory that TanStack Start loads for SSR and client hydration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "../generated/routeTree.gen";

/**
 * Creates the app router from the generated file-route tree.
 *
 * **Example** (Create the router)
 *
 * ```ts
 * import { getRouter } from "@/router"
 *
 * const router = getRouter()
 * console.log(Object.keys(router.routesByPath))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
