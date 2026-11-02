/**
 * Root route: the HTML document shell every page renders inside.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import appCss from "../styles/globals.css?url";
import type { ReactNode } from "react";

/**
 * Root route with the document head and the global stylesheet.
 *
 * **Example** (Read the root route id)
 *
 * ```ts
 * import { Route } from "@/routes/__root"
 *
 * console.log(Route.id) // "__root__"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "beep-effect" },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <Document>
      <Outlet />
    </Document>
  );
}

function Document(props: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {props.children}
        <Scripts />
      </body>
    </html>
  );
}
