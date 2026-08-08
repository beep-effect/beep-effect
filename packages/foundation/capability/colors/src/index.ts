/**
 * Public entrypoint for `@beep/colors`.
 *
 * **Details**
 *
 * The default export is a shared `Colors` instance configured from the current runtime,
 * while named exports expose the schema, constructor, and detection helpers for advanced use.
 *
 * **Example** (Forced plain color output)
 *
 * ```typescript
 * import colors, { createColors, isColorSupported } from "@beep/colors"
 *
 * const forcedPlain = createColors(false)
 * const status = isColorSupported ? colors.green("ok") : forcedPlain.green("ok")
 *
 * console.log(status)
 * ```
 *
 * @since 0.0.0
 */
export * from "./Colors.ts";
export { default } from "./Colors.ts";
