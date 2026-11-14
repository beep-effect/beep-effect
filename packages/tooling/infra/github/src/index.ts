/**
 * Package entry point for `@beep/infra-github`: the typed configuration and
 * the resources of the `InfraGithub` Alchemy stack.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * The stack's configuration schemas.
 *
 * **Example** (Read the reviewer switch from the namespace)
 *
 * ```ts
 * import { Config } from "@beep/infra-github"
 *
 * console.log(Config.reviewerContext) // "beep-reviewer"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * as Config from "./Config.ts";
/**
 * The configuration every stage deploys.
 *
 * **Example** (Read the production stage)
 *
 * ```ts
 * import { Production } from "@beep/infra-github"
 *
 * console.log(Production.productionStage) // "prod"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export * as Production from "./Production.ts";
/**
 * The stack's resource declarations.
 *
 * **Example** (Make a logical id fragment)
 *
 * ```ts
 * import { Stack } from "@beep/infra-github"
 *
 * console.log(Stack.idFragment("size/L")) // "size-L"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * as Stack from "./Stack.ts";
