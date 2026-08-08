/**
 * Shared type surface for theme options and component override maps.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { createTheme } from "@mui/material/styles";

/**
 * Theme options type.
 *
 * **Example** (Describe ThemeOptions keys)
 *
 * ```ts
 * import type { ThemeOptions } from "@beep/ui/themes/types"
 *
 * const describe = (options: ThemeOptions): string => Object.keys(options).join(",")
 *
 * console.log(typeof describe)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ThemeOptions = NonNullable<Parameters<typeof createTheme>[0]>;

/**
 * Theme components type.
 *
 * **Example** (Describe ThemeComponents keys)
 *
 * ```ts
 * import type { ThemeComponents } from "@beep/ui/themes/types"
 *
 * const describe = (components: ThemeComponents): string => Object.keys(components ?? {}).join(",")
 *
 * console.log(typeof describe)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ThemeComponents = NonNullable<Parameters<typeof createTheme>[0]>["components"];
