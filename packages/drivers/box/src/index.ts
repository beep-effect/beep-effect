/**
 * Schema-first, Effect-first Box technical driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Box driver configuration exports.
 *
 * **Example** (Import developer token config)
 *
 * ```ts
 * import { BoxDeveloperTokenConfig } from "@beep/box"
 *
 * console.log(BoxDeveloperTokenConfig)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Box.config.ts";
/**
 * Box technical error exports.
 *
 * **Example** (Import BoxError export)
 *
 * ```ts
 * import { BoxError } from "@beep/box"
 *
 * console.log(BoxError)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./Box.errors.ts";
/**
 * Box payload and success model exports.
 *
 * **Example** (Import file payload model)
 *
 * ```ts
 * import { FilesGetFileByIdPayload } from "@beep/box"
 *
 * console.log(FilesGetFileByIdPayload)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./Box.models.ts";
/**
 * Box service and Layer exports.
 *
 * **Example** (Import Box service)
 *
 * ```ts
 * import { Box } from "@beep/box"
 *
 * console.log(Box)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Box.service.ts";
/**
 * Box byte and event streaming exports.
 *
 * **Example** (Use BoxByteStream type)
 *
 * ```ts
 * import type { BoxByteStream } from "@beep/box"
 *
 * type Bytes = BoxByteStream
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export * from "./Box.streaming.ts";

/**
 * Package version for `@beep/box`.
 *
 * **Example** (Log package version)
 *
 * ```ts
 * import { VERSION } from "@beep/box"
 *
 * console.log(VERSION)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const VERSION = "0.0.0";
