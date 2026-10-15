/**
 * Practice gateway: one MCP extension serving setup tools and the practice
 * providers a saved practice profile selects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Elicited repair approvals.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Approvals.ts";
/**
 * Box Drive provider tools.
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./BoxDriveTools.ts";
/**
 * Process-level gateway settings.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./GatewaySettings.ts";
/**
 * Microsoft 365 provider tools.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./M365Provider.ts";
/**
 * Microsoft 365 sign-in: loopback authorizer and DPAPI token cache.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./M365SignIn.ts";
/**
 * Onboarding guide tool text and prompt.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./OnboardingGuide.ts";
/**
 * Gateway-owned typed failures.
 *
 * @category errors
 * @since 0.0.0
 */
export * from "./PracticeGateway.errors.ts";
/**
 * Lazily loaded practice knowledge-graph provider.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./PracticeKgProvider.ts";
/**
 * Setup probes per requirement id.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Probes.ts";
/**
 * Saved practice profile store.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./ProfileStore.ts";
/**
 * Slice 1 requirement catalog.
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./Requirements.ts";
/**
 * `--self-check` report and printer.
 *
 * @category use-cases
 * @since 0.0.0
 */
export * from "./SelfCheck.ts";
/**
 * Gateway composition.
 *
 * @category layers
 * @since 0.0.0
 */
export * from "./Server.ts";
/**
 * Always-mounted setup tools.
 *
 * @category tools
 * @since 0.0.0
 */
export * from "./SetupTools.ts";
/**
 * The system web browser.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./SystemBrowser.ts";
/**
 * Gateway version.
 *
 * @category constants
 * @since 0.0.0
 */
export * from "./Version.ts";
/**
 * Windows facts for the probes.
 *
 * @category services
 * @since 0.0.0
 */
export * from "./WindowsHost.ts";
