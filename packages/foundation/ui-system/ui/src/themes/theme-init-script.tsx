/**
 * Inline script component that applies the persisted color-scheme before first paint.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import InitColorSchemeScript from "@mui/material/InitColorSchemeScript";
import type { ComponentProps } from "react";

type AppThemeInitScriptProps = ComponentProps<typeof InitColorSchemeScript>;

/**
 * App theme init script component.
 *
 * **Example** (Import and log component)
 *
 * ```tsx
 * import { AppThemeInitScript } from "@beep/ui/themes/theme-init-script"
 *
 * console.log(AppThemeInitScript)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function AppThemeInitScript(props: AppThemeInitScriptProps) {
  return <InitColorSchemeScript {...props} />;
}
