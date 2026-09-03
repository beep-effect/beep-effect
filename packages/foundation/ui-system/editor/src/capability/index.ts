/**
 * Capability-aware editor components and resolved Lexical runtime bindings.
 *
 * @packageDocumentation \@beep/editor/capability
 * @since 0.0.0
 */

/** Capability-aware editor components.
 * @category components
 * @since 0.0.0
 */
export { CapabilityComposer, ProfileResolutionNotice } from "./composer.tsx";
/**
 * Resolved Lexical runtime bindings.
 *
 * @category combinators
 * @since 0.0.0
 */
export {
  chordFromKeyboardEvent,
  commandHandlers,
  detectPlatform,
  KeybindingPlugin,
  nodeRegistrations,
  ResolvedExtensions,
  resolvedNodes,
  resolvedTransformers,
  runCommand,
  transformerRegistrations,
} from "./runtime.tsx";
/**
 * Resolved shortcut-help component.
 *
 * @category components
 * @since 0.0.0
 */
export { ShortcutHelp } from "./shortcut-help.tsx";
/**
 * Resolved toolbar component.
 *
 * @category components
 * @since 0.0.0
 */
export { CapabilityToolbar } from "./toolbar.tsx";
/**
 * Capability composer property model.
 *
 * @category models
 * @since 0.0.0
 */
export type { CapabilityComposerProps } from "./composer.tsx";
