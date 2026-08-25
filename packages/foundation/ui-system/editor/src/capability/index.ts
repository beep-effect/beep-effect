/**
 * Capability descriptors, profile resolution, and pure UI projections for `@beep/editor`.
 *
 * Exact `@beep/editor/capability/*` subpaths are preferred for new imports;
 * this barrel remains a documented migration facade.
 *
 * @packageDocumentation \@beep/editor/capability
 * @since 0.0.0
 */

/**
 * Capability catalog data.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link editorCapabilityCatalog} from `@beep/editor/capability/catalog`.
   * @since 0.0.0
   */
  editorCapabilityCatalog,
} from "./catalog.ts";
/** Capability-aware editor components.
 * @category components
 * @since 0.0.0
 */
export { CapabilityComposer, ProfileResolutionNotice } from "./composer.tsx";
/**
 * Typed profile resolution failures.
 *
 * @category errors
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link CapabilityConflictError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  CapabilityConflictError,
  /**
   * @deprecated Import {@link DependencyCycleError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  DependencyCycleError,
  /**
   * @deprecated Import {@link DevelopmentOnlyCapabilityError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  DevelopmentOnlyCapabilityError,
  /**
   * @deprecated Import {@link IncompatibleRegistrationError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  IncompatibleRegistrationError,
  /**
   * @deprecated Import {@link KeybindingConflictError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  KeybindingConflictError,
  /**
   * @deprecated Import {@link MissingDependencyError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  MissingDependencyError,
  /**
   * @deprecated Import {@link ProfileResolutionError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  ProfileResolutionError,
  /**
   * @deprecated Import {@link UnknownCapabilityError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  UnknownCapabilityError,
  /**
   * @deprecated Import {@link UnknownCommandError} from `@beep/editor/capability/errors`.
   * @since 0.0.0
   */
  UnknownCommandError,
} from "./errors.ts";
/**
 * Compatibility and reference proof profiles.
 *
 * @category fixtures
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link compatibilityProfile} from `@beep/editor/capability/profiles`.
   * @since 0.0.0
   */
  compatibilityProfile,
  /**
   * @deprecated Import {@link referenceProfiles} from `@beep/editor/capability/profiles`.
   * @since 0.0.0
   */
  referenceProfiles,
} from "./profiles.ts";
/**
 * Pure resolved-command projections.
 *
 * @category projections
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link formatChord} from `@beep/editor/capability/projection`.
   * @since 0.0.0
   */
  formatChord,
  /**
   * @deprecated Import {@link projectCommands} from `@beep/editor/capability/projection`.
   * @since 0.0.0
   */
  projectCommands,
  /**
   * @deprecated Import {@link projectShortcutHelp} from `@beep/editor/capability/projection`.
   * @since 0.0.0
   */
  projectShortcutHelp,
  /**
   * @deprecated Import {@link projectSlashItems} from `@beep/editor/capability/projection`.
   * @since 0.0.0
   */
  projectSlashItems,
  /**
   * @deprecated Import {@link ShortcutHelpEntry} from `@beep/editor/capability/projection`.
   * @since 0.0.0
   */
  ShortcutHelpEntry,
} from "./projection.ts";
/**
 * Deterministic profile resolution APIs.
 *
 * @category workflows
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link resolveEditorProfile} from `@beep/editor/capability/resolver`.
   * @since 0.0.0
   */
  resolveEditorProfile,
  /**
   * @deprecated Import {@link resolveEditorProfileEffect} from `@beep/editor/capability/resolver`.
   * @since 0.0.0
   */
  resolveEditorProfileEffect,
} from "./resolver.ts";
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
 * Schema-first capability protocol models.
 *
 * @category schemas
 * @since 0.0.0
 */
export {
  /**
   * @deprecated Import {@link ActivationSurface} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  ActivationSurface,
  /**
   * @deprecated Import {@link CanonicalCompatibility} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CanonicalCompatibility,
  /**
   * @deprecated Import {@link CapabilityCatalog} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CapabilityCatalog,
  /**
   * @deprecated Import {@link CapabilityCategory} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CapabilityCategory,
  /**
   * @deprecated Import {@link CapabilityClassification} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CapabilityClassification,
  /**
   * @deprecated Import {@link CapabilityDescriptor} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CapabilityDescriptor,
  /**
   * @deprecated Import {@link CapabilityDisposition} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CapabilityDisposition,
  /**
   * @deprecated Import {@link CapabilityId} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CapabilityId,
  /**
   * @deprecated Import {@link CapabilityMode} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CapabilityMode,
  /**
   * @deprecated Import {@link CapabilityRegistrations} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CapabilityRegistrations,
  /**
   * @deprecated Import {@link CommandDefinition} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CommandDefinition,
  /**
   * @deprecated Import {@link CommandId} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  CommandId,
  /**
   * @deprecated Import {@link EditorProfile} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  EditorProfile,
  /**
   * @deprecated Import {@link ExtensionKey} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  ExtensionKey,
  /**
   * @deprecated Import {@link Keybinding} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  Keybinding,
  /**
   * @deprecated Import {@link KeybindingOverride} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  KeybindingOverride,
  /**
   * @deprecated Import {@link KeyChord} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  KeyChord,
  /**
   * @deprecated Import {@link KeyChordFromString} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  KeyChordFromString,
  /**
   * @deprecated Import {@link Modifier} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  Modifier,
  /**
   * @deprecated Import {@link NodeRegistrationKey} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  NodeRegistrationKey,
  /**
   * @deprecated Import {@link Platform} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  Platform,
  /**
   * @deprecated Import {@link ProfileId} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  ProfileId,
  /**
   * @deprecated Import {@link ProfileKind} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  ProfileKind,
  /**
   * @deprecated Import {@link ReadOnlyFallback} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  ReadOnlyFallback,
  /**
   * @deprecated Import {@link ResolvedCapability} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  ResolvedCapability,
  /**
   * @deprecated Import {@link ResolvedCommand} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  ResolvedCommand,
  /**
   * @deprecated Import {@link ResolvedEditorProfile} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  ResolvedEditorProfile,
  /**
   * @deprecated Import {@link TransformerKey} from `@beep/editor/capability/schemas`.
   * @since 0.0.0
   */
  TransformerKey,
} from "./schemas.ts";
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
