/**
 * Schema-first capability descriptors, profiles, and resolved editor values.
 *
 * @packageDocumentation \@beep/editor/capability/schemas
 * @since 0.0.0
 */

import { $EditorId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, Equal, MutableHashSet, Result, SchemaTransformation } from "effect";
import * as S from "effect/Schema";

const $I = $EditorId.create("capability/schemas");
const dottedIdPattern = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/u;

const dottedIdCheck = S.isPattern(dottedIdPattern, {
  identifier: $I`DottedIdCheck`,
  title: "Dotted capability identifier",
  description: "A lowercase dot-separated identifier with at least two segments.",
  message: "Expected a lowercase dot-separated identifier",
});

/**
 * Stable identifier for a catalog capability.
 *
 * **Example** (Create a capability identifier)
 *
 * ```ts import.meta.vitest name="Create a capability identifier"
 * import { CapabilityId } from "@beep/editor/capability/schemas"
 *
 * CapabilityId.make("format.bold") // => "format.bold"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CapabilityId = S.NonEmptyString.check(dottedIdCheck).pipe(
  S.brand("CapabilityId"),
  $I.annoteSchema("CapabilityId", {
    title: "Capability identifier",
    description: "Stable lowercase dot-separated identifier for an editor capability.",
  })
);

/**
 * Decoded branded identifier produced by {@link CapabilityId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type CapabilityId = typeof CapabilityId.Type;

/**
 * Stable identifier for an executable editor command.
 *
 * **Example** (Create a command identifier)
 *
 * ```ts import.meta.vitest name="Create a command identifier"
 * import { CommandId } from "@beep/editor/capability/schemas"
 *
 * CommandId.make("format.bold") // => "format.bold"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CommandId = S.NonEmptyString.check(dottedIdCheck).pipe(
  S.brand("CommandId"),
  $I.annoteSchema("CommandId", {
    title: "Command identifier",
    description: "Stable lowercase dot-separated identifier for an editor command.",
  })
);

/**
 * Decoded branded identifier produced by {@link CommandId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type CommandId = typeof CommandId.Type;

/**
 * Stable identifier for an app-owned editor profile.
 *
 * **Example** (Create a profile identifier)
 *
 * ```ts import.meta.vitest name="Create a profile identifier"
 * import { ProfileId } from "@beep/editor/capability/schemas"
 *
 * ProfileId.make("editor.reference") // => "editor.reference"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const ProfileId = S.NonEmptyString.pipe(
  S.brand("ProfileId"),
  $I.annoteSchema("ProfileId", {
    title: "Profile identifier",
    description: "Stable branded identifier for an app-owned editor profile.",
  })
);

/**
 * Decoded branded identifier produced by {@link ProfileId}.
 *
 * @category identifiers
 * @since 0.0.0
 */
export type ProfileId = typeof ProfileId.Type;

/**
 * Atlas taxonomy represented by the P1 capability catalog.
 *
 * **Example** (Check a node category)
 *
 * ```ts import.meta.vitest name="Check a node category"
 * import { CapabilityCategory } from "@beep/editor/capability/schemas"
 *
 * CapabilityCategory.is.node("node") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityCategory = LiteralKit([
  "core-node",
  "node",
  "extension",
  "transformer",
  "authoring",
  "interchange",
]).annotate(
  $I.annote("CapabilityCategory", {
    title: "Capability category",
    description: "P1 subset of the editor capability atlas taxonomy.",
  })
);

/**
 * Decoded atlas category represented by {@link CapabilityCategory}.
 *
 * @category models
 * @since 0.0.0
 */
export type CapabilityCategory = typeof CapabilityCategory.Type;

/**
 * Product disposition assigned to a P1 capability.
 *
 * **Example** (Check an implementation disposition)
 *
 * ```ts import.meta.vitest name="Check an implementation disposition"
 * import { CapabilityDisposition } from "@beep/editor/capability/schemas"
 *
 * CapabilityDisposition.is.implement("implement") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityDisposition = LiteralKit(["implement", "generalize", "development-only"]).annotate(
  $I.annote("CapabilityDisposition", {
    title: "Capability disposition",
    description: "P1 implementation disposition used by profile resolution policy.",
  })
);

/**
 * Decoded product disposition represented by {@link CapabilityDisposition}.
 *
 * @category models
 * @since 0.0.0
 */
export type CapabilityDisposition = typeof CapabilityDisposition.Type;

/**
 * Compatibility of an authored semantic with canonical `@beep/md` content.
 *
 * **Example** (Check lossless compatibility)
 *
 * ```ts import.meta.vitest name="Check lossless compatibility"
 * import { CanonicalCompatibility } from "@beep/editor/capability/schemas"
 *
 * CanonicalCompatibility.is.lossless("lossless") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CanonicalCompatibility = LiteralKit(["lossless", "lossy", "unsupported", "not-applicable"]).annotate(
  $I.annote("CanonicalCompatibility", {
    title: "Canonical compatibility",
    description: "Loss behavior when an editor semantic crosses the canonical document codec.",
  })
);

/**
 * Decoded compatibility represented by {@link CanonicalCompatibility}.
 *
 * @category models
 * @since 0.0.0
 */
export type CanonicalCompatibility = typeof CanonicalCompatibility.Type;

/**
 * Read-only behavior used when authoring for a capability is unavailable.
 *
 * **Example** (Check canonical rendering fallback)
 *
 * ```ts import.meta.vitest name="Check canonical rendering fallback"
 * import { ReadOnlyFallback } from "@beep/editor/capability/schemas"
 *
 * ReadOnlyFallback.is["render-canonical"]("render-canonical") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReadOnlyFallback = LiteralKit(["render-canonical", "hide-controls", "inert-reference"]).annotate(
  $I.annote("ReadOnlyFallback", {
    title: "Read-only fallback",
    description: "Fallback presentation used for a capability whose authoring controls are disabled.",
  })
);

/**
 * Decoded read-only behavior represented by {@link ReadOnlyFallback}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReadOnlyFallback = typeof ReadOnlyFallback.Type;

/**
 * Visible UI surface to which a command can be projected.
 *
 * **Example** (Check toolbar activation)
 *
 * ```ts import.meta.vitest name="Check toolbar activation"
 * import { ActivationSurface } from "@beep/editor/capability/schemas"
 *
 * ActivationSurface.is.toolbar("toolbar") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ActivationSurface = LiteralKit(["toolbar", "slash-menu", "floating-toolbar", "context-menu"]).annotate(
  $I.annote("ActivationSurface", {
    title: "Activation surface",
    description: "User-visible affordance surface generated from a resolved command.",
  })
);

/**
 * Decoded UI surface represented by {@link ActivationSurface}.
 *
 * @category models
 * @since 0.0.0
 */
export type ActivationSurface = typeof ActivationSurface.Type;

/**
 * Operating-system keybinding family.
 *
 * **Example** (Check Apple platform)
 *
 * ```ts import.meta.vitest name="Check Apple platform"
 * import { Platform } from "@beep/editor/capability/schemas"
 *
 * Platform.is.apple("apple") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Platform = LiteralKit(["windows-linux", "apple"]).annotate(
  $I.annote("Platform", {
    title: "Keybinding platform",
    description: "Platform family used to resolve authored keyboard bindings.",
  })
);

/**
 * Decoded platform represented by {@link Platform}.
 *
 * @category models
 * @since 0.0.0
 */
export type Platform = typeof Platform.Type;

/**
 * Canonical modifier vocabulary used by parsed key chords.
 *
 * **Example** (Inspect modifier order)
 *
 * ```ts import.meta.vitest name="Inspect modifier order"
 * import { Modifier } from "@beep/editor/capability/schemas"
 *
 * Modifier.Options // => ["control", "meta", "alt", "shift"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Modifier = LiteralKit(["control", "meta", "alt", "shift"]).annotate(
  $I.annote("Modifier", {
    title: "Key chord modifier",
    description: "Canonical modifier vocabulary in deterministic chord order.",
  })
);

/**
 * Decoded modifier represented by {@link Modifier}.
 *
 * @category models
 * @since 0.0.0
 */
export type Modifier = typeof Modifier.Type;

const ModifierToken = LiteralKit(["ctrl", "control", "cmd", "meta", "win", "alt", "option", "shift"]).annotate(
  $I.annote("ModifierToken", {
    title: "Authored modifier token",
    description: "Case-normalized modifier spellings accepted by authored chord strings.",
  })
);
const isModifierToken = S.is(ModifierToken);

const modifierFromToken = ModifierToken.$match({
  ctrl: () => "control" as const,
  control: () => "control" as const,
  cmd: () => "meta" as const,
  meta: () => "meta" as const,
  win: () => "meta" as const,
  alt: () => "alt" as const,
  option: () => "alt" as const,
  shift: () => "shift" as const,
});

const modifierToToken = Modifier.$match({
  control: () => "Control",
  meta: () => "Meta",
  alt: () => "Alt",
  shift: () => "Shift",
});

const sortModifiers = (modifiers: ReadonlyArray<Modifier>): ReadonlyArray<Modifier> =>
  A.flatMap(Modifier.Options, (expected) => A.filter(modifiers, (modifier) => Equal.equals(modifier, expected)));

const uniqueModifiers = S.makeFilter<ReadonlyArray<Modifier>>(
  (modifiers) => {
    const seen = MutableHashSet.empty<Modifier>();
    return A.filterMap(modifiers, (modifier, index) => {
      if (MutableHashSet.has(seen, modifier)) {
        return Result.succeed({ path: [index], issue: `Duplicate modifier "${modifier}".` });
      }
      MutableHashSet.add(seen, modifier);
      return Result.fail(undefined);
    });
  },
  {
    identifier: $I`UniqueModifiers`,
    title: "Unique key chord modifiers",
    description: "A key chord contains each canonical modifier at most once.",
  }
);

const sortedModifiers = S.makeFilter<ReadonlyArray<Modifier>>(
  (modifiers) =>
    Equal.equals(modifiers, sortModifiers(modifiers))
      ? undefined
      : "Expected modifiers in control, meta, alt, shift order",
  {
    identifier: $I`SortedModifiers`,
    title: "Sorted key chord modifiers",
    description: "A key chord stores modifiers in canonical declaration order.",
  }
);

/**
 * Canonical parsed keyboard chord with unique, ordered modifiers.
 *
 * **Example** (Create a canonical key chord)
 *
 * ```ts import.meta.vitest name="Create a canonical key chord"
 * import { KeyChord } from "@beep/editor/capability/schemas"
 *
 * const chord = KeyChord.make({ modifiers: ["control", "shift"], key: "x" })
 * chord.key // => "x"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class KeyChord extends S.Class<KeyChord>($I`KeyChord`)(
  {
    modifiers: S.Array(Modifier)
      .check(uniqueModifiers, sortedModifiers)
      .annotateKey({ description: "Unique modifiers in canonical control, meta, alt, shift order." }),
    key: S.NonEmptyString.check(S.isLowercased({ message: "Expected a lowercase key" })).annotateKey({
      description: "Lowercase non-empty key token.",
    }),
  },
  $I.annote("KeyChord", {
    title: "Key chord",
    description: "Canonical parsed keyboard chord used for equality and conflict detection.",
  })
) {}

const parseChord = (input: string) => {
  const [modifierTokens, key] = A.unappend(Str.split(input, "+"));
  const normalizedTokens = A.map(modifierTokens, Str.toLowerCase);
  const invalidModifier = A.some(normalizedTokens, (token) => !isModifierToken(token));
  return {
    modifiers: invalidModifier
      ? []
      : sortModifiers(A.map(A.filter(normalizedTokens, isModifierToken), modifierFromToken)),
    key: invalidModifier ? "" : Str.toLowerCase(key),
  };
};

const encodeChord = (chord: KeyChord): string =>
  A.join(A.append(A.map(chord.modifiers, modifierToToken), chord.key), "+");

/**
 * String codec for authored chords such as `Ctrl+Alt+1` and `Cmd+Option+1`.
 *
 * **Example** (Decode an authored chord)
 *
 * ```ts import.meta.vitest name="Decode an authored chord"
 * import { KeyChordFromString } from "@beep/editor/capability/schemas"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = S.decodeUnknownResult(KeyChordFromString)("Ctrl+Alt+1")
 * Result.isSuccess(result) // => true
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const KeyChordFromString = S.String.pipe(
  S.decodeTo(
    KeyChord,
    SchemaTransformation.transform({
      decode: parseChord,
      encode: encodeChord,
    })
  ),
  $I.annoteSchema("KeyChordFromString", {
    title: "Key chord from string",
    description: "Bidirectional codec between authored chord strings and canonical parsed key chords.",
  })
);

/**
 * Decoded key chord produced by {@link KeyChordFromString}.
 *
 * @category models
 * @since 0.0.0
 */
export type KeyChordFromString = typeof KeyChordFromString.Type;

/**
 * Platform-specific authored keyboard binding.
 *
 * **Example** (Create an Apple binding)
 *
 * ```ts import.meta.vitest name="Create an Apple binding"
 * import { Keybinding, KeyChord } from "@beep/editor/capability/schemas"
 *
 * const binding = Keybinding.make({
 *   platform: "apple",
 *   chord: KeyChord.make({ modifiers: ["meta"], key: "b" })
 * })
 * binding.platform // => "apple"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Keybinding extends S.Class<Keybinding>($I`Keybinding`)(
  {
    platform: Platform.annotateKey({ description: "Platform family that owns the binding." }),
    chord: KeyChordFromString.annotateKey({ description: "Canonical chord decoded from its authored string." }),
  },
  $I.annote("Keybinding", {
    title: "Keybinding",
    description: "A platform-specific keyboard chord attached to a command.",
  })
) {}

/**
 * Lexical node registration keys owned by the capability catalog.
 *
 * **Example** (Check paragraph registration)
 *
 * ```ts import.meta.vitest name="Check paragraph registration"
 * import { NodeRegistrationKey } from "@beep/editor/capability/schemas"
 *
 * NodeRegistrationKey.is.ParagraphNode("ParagraphNode") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NodeRegistrationKey = LiteralKit([
  "TextNode",
  "TabNode",
  "LineBreakNode",
  "ParagraphNode",
  "HeadingNode",
  "QuoteNode",
  "ListNode",
  "ListItemNode",
  "LinkNode",
  "CodeNode",
  "TableNode",
  "TableRowNode",
  "TableCellNode",
  "YouTubeNode",
  "ArtifactRefNode",
]).annotate(
  $I.annote("NodeRegistrationKey", {
    title: "Node registration key",
    description: "Closed registry of Lexical node constructors owned by P1 descriptors.",
  })
);

/**
 * Decoded node key represented by {@link NodeRegistrationKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type NodeRegistrationKey = typeof NodeRegistrationKey.Type;

/**
 * Runtime extension keys owned by capability descriptors.
 *
 * **Example** (Check history extension)
 *
 * ```ts import.meta.vitest name="Check history extension"
 * import { ExtensionKey } from "@beep/editor/capability/schemas"
 *
 * ExtensionKey.is.HistoryPlugin("HistoryPlugin") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtensionKey = LiteralKit([
  "HistoryPlugin",
  "ListPlugin",
  "CheckListPlugin",
  "LinkPlugin",
  "MarkdownShortcutPlugin",
  "ToolbarProjection",
  "SlashPickerProjection",
  "ShortcutHelpProjection",
]).annotate(
  $I.annote("ExtensionKey", {
    title: "Extension key",
    description: "Closed registry of runtime editor extensions owned by P1 descriptors.",
  })
);

/**
 * Decoded extension key represented by {@link ExtensionKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type ExtensionKey = typeof ExtensionKey.Type;

/**
 * Markdown transformer keys owned by capability descriptors.
 *
 * **Example** (Check heading transformer)
 *
 * ```ts import.meta.vitest name="Check heading transformer"
 * import { TransformerKey } from "@beep/editor/capability/schemas"
 *
 * TransformerKey.is.HEADING("HEADING") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TransformerKey = LiteralKit([
  "HEADING",
  "QUOTE",
  "CODE",
  "UNORDERED_LIST",
  "ORDERED_LIST",
  "CHECK_LIST",
  "INLINE_CODE",
  "BOLD_STAR",
  "BOLD_UNDERSCORE",
  "BOLD_ITALIC_STAR",
  "BOLD_ITALIC_UNDERSCORE",
  "ITALIC_STAR",
  "ITALIC_UNDERSCORE",
  "HIGHLIGHT",
  "STRIKETHROUGH",
  "LINK",
]).annotate(
  $I.annote("TransformerKey", {
    title: "Transformer key",
    description: "Closed registry of Markdown transformers owned by P1 descriptors.",
  })
);

/**
 * Decoded transformer key represented by {@link TransformerKey}.
 *
 * @category models
 * @since 0.0.0
 */
export type TransformerKey = typeof TransformerKey.Type;

const uniqueValues = <Value>(name: string) =>
  S.makeFilter<ReadonlyArray<Value>>(
    (values) => {
      const seen = MutableHashSet.empty<Value>();
      return A.filterMap(values, (value, index) => {
        if (MutableHashSet.has(seen, value)) {
          return Result.succeed({ path: [index], issue: `Duplicate ${name}.` });
        }
        MutableHashSet.add(seen, value);
        return Result.fail(undefined);
      });
    },
    {
      identifier: $I`UniqueValues`,
      title: `Unique ${name}s`,
      description: `Every ${name} in the collection must be unique.`,
    }
  );

const uniqueNodeKeys = uniqueValues<NodeRegistrationKey>("node registration key");
const uniqueExtensionKeys = uniqueValues<ExtensionKey>("extension key");
const uniqueTransformerKeys = uniqueValues<TransformerKey>("transformer key");
const uniqueCapabilityIds = uniqueValues<CapabilityId>("capability id");

/**
 * Node, extension, and transformer registrations owned by one capability.
 *
 * **Example** (Create empty registrations)
 *
 * ```ts import.meta.vitest name="Create empty registrations"
 * import { CapabilityRegistrations } from "@beep/editor/capability/schemas"
 *
 * const registrations = CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: [] })
 * registrations.nodes // => []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityRegistrations extends S.Class<CapabilityRegistrations>($I`CapabilityRegistrations`)(
  {
    nodes: S.Array(NodeRegistrationKey)
      .check(uniqueNodeKeys)
      .annotateKey({ description: "Lexical node registrations owned by the capability." }),
    extensions: S.Array(ExtensionKey)
      .check(uniqueExtensionKeys)
      .annotateKey({ description: "Runtime extensions owned by the capability." }),
    transformers: S.Array(TransformerKey)
      .check(uniqueTransformerKeys)
      .annotateKey({ description: "Markdown transformers owned by the capability." }),
  },
  $I.annote("CapabilityRegistrations", {
    title: "Capability registrations",
    description: "Unique runtime registration keys owned by one capability descriptor.",
  })
) {}

const uniqueBindingPlatforms = S.makeFilter<ReadonlyArray<Keybinding>>(
  (bindings) => {
    const seen = MutableHashSet.empty<Platform>();
    return A.filterMap(bindings, (binding, index) => {
      if (MutableHashSet.has(seen, binding.platform)) {
        return Result.succeed({ path: [index, "platform"], issue: `Duplicate ${binding.platform} binding.` });
      }
      MutableHashSet.add(seen, binding.platform);
      return Result.fail(undefined);
    });
  },
  {
    identifier: $I`UniqueBindingPlatforms`,
    title: "Unique keybinding platforms",
    description: "A command declares at most one binding for each platform family.",
  }
);

/**
 * Executable command projected from a capability descriptor.
 *
 * **Example** (Create a toolbar command)
 *
 * ```ts import.meta.vitest name="Create a toolbar command"
 * import { CommandDefinition, CommandId } from "@beep/editor/capability/schemas"
 *
 * const command = CommandDefinition.make({
 *   id: CommandId.make("format.bold"), label: "Bold", helpText: "Toggle bold.",
 *   surfaces: ["toolbar"], keybindings: []
 * })
 * command.label // => "Bold"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class CommandDefinition extends S.Class<CommandDefinition>($I`CommandDefinition`)(
  {
    id: CommandId.annotateKey({ description: "Stable command identifier." }),
    label: S.NonEmptyString.annotateKey({ description: "Visible command label." }),
    helpText: S.NonEmptyString.annotateKey({ description: "Generated shortcut-help description." }),
    surfaces: S.Array(ActivationSurface)
      .check(uniqueValues<ActivationSurface>("activation surface"))
      .annotateKey({ description: "Visible surfaces that project the command." }),
    keybindings: S.Array(Keybinding)
      .check(uniqueBindingPlatforms)
      .annotateKey({ description: "Default authored bindings, at most one per platform." }),
  },
  $I.annote("CommandDefinition", {
    title: "Command definition",
    description: "Command metadata and default bindings owned by a capability descriptor.",
  })
) {}

/**
 * Atlas classification attached to a capability descriptor.
 *
 * **Example** (Create a classification)
 *
 * ```ts import.meta.vitest name="Create a classification"
 * import { CapabilityClassification } from "@beep/editor/capability/schemas"
 *
 * const value = CapabilityClassification.make({ category: "authoring", disposition: "implement" })
 * value.category // => "authoring"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityClassification extends S.Class<CapabilityClassification>($I`CapabilityClassification`)(
  {
    category: CapabilityCategory.annotateKey({ description: "Atlas taxonomy category." }),
    disposition: CapabilityDisposition.annotateKey({ description: "P1 product disposition." }),
  },
  $I.annote("CapabilityClassification", {
    title: "Capability classification",
    description: "Atlas category and ratified P1 disposition for a descriptor.",
  })
) {}

/**
 * Single source descriptor for editor registration and authoring behavior.
 *
 * **Example** (Create a descriptor)
 *
 * ```ts import.meta.vitest name="Create a descriptor"
 * import { CapabilityDescriptor, CapabilityId, CapabilityRegistrations } from "@beep/editor/capability/schemas"
 *
 * const value = CapabilityDescriptor.make({
 *   id: CapabilityId.make("format.bold"), title: "Bold", summary: "Strong emphasis.",
 *   classification: { category: "authoring", disposition: "implement" },
 *   dependencies: [], conflicts: [],
 *   registrations: CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: [] }),
 *   commands: [], readOnlyFallback: "render-canonical", canonicalCompatibility: "lossless",
 *   evidence: "editor-capability-atlas/v1#format.bold"
 * })
 * value.id // => "format.bold"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CapabilityDescriptor extends S.Class<CapabilityDescriptor>($I`CapabilityDescriptor`)(
  {
    id: CapabilityId.annotateKey({ description: "Stable capability identifier." }),
    title: S.NonEmptyString.annotateKey({ description: "Human-readable capability title." }),
    summary: S.NonEmptyString.annotateKey({ description: "Concise capability behavior summary." }),
    classification: CapabilityClassification.annotateKey({ description: "Atlas category and P1 disposition." }),
    dependencies: S.Array(CapabilityId)
      .check(uniqueCapabilityIds)
      .annotateKey({ description: "Capabilities that must also be enabled." }),
    conflicts: S.Array(CapabilityId)
      .check(uniqueCapabilityIds)
      .annotateKey({ description: "Capabilities that cannot be enabled together." }),
    registrations: CapabilityRegistrations.annotateKey({ description: "Runtime registrations owned by this row." }),
    commands: S.Array(CommandDefinition).annotateKey({ description: "Commands owned by this row." }),
    readOnlyFallback: ReadOnlyFallback.annotateKey({ description: "Behavior when authoring is unavailable." }),
    canonicalCompatibility: CanonicalCompatibility.annotateKey({
      description: "Compatibility with canonical @beep/md content.",
    }),
    evidence: S.NonEmptyString.annotateKey({ description: "Stable atlas or repository evidence locator." }),
  },
  $I.annote("CapabilityDescriptor", {
    title: "Capability descriptor",
    description: "Catalog row that owns registrations, commands, dependencies, and canonical loss policy.",
  })
) {}

const catalogRelationships = S.makeFilter<ReadonlyArray<CapabilityDescriptor>>(
  (catalog) =>
    A.flatMap(catalog, (descriptor, descriptorIndex) =>
      A.appendAll(
        A.filterMap(descriptor.dependencies, (dependency, dependencyIndex) =>
          Equal.equals(dependency, descriptor.id)
            ? Result.succeed({
                path: [descriptorIndex, "dependencies", dependencyIndex],
                issue: `Capability "${descriptor.id}" cannot depend on itself.`,
              })
            : Result.fail(undefined)
        ),
        A.filterMap(descriptor.conflicts, (conflict, conflictIndex) =>
          Equal.equals(conflict, descriptor.id)
            ? Result.succeed({
                path: [descriptorIndex, "conflicts", conflictIndex],
                issue: `Capability "${descriptor.id}" cannot conflict with itself.`,
              })
            : Result.fail(undefined)
        )
      )
    ),
  {
    identifier: $I`CatalogRelationships`,
    title: "Valid catalog relationships",
    description: "Capability descriptors cannot depend on or conflict with themselves.",
  }
);

const uniqueCatalogIds = S.makeFilter<ReadonlyArray<CapabilityDescriptor>>(
  (catalog) => {
    const seen = MutableHashSet.empty<CapabilityId>();
    return A.filterMap(catalog, (descriptor, index) => {
      if (MutableHashSet.has(seen, descriptor.id)) {
        return Result.succeed({ path: [index, "id"], issue: `Duplicate capability id "${descriptor.id}".` });
      }
      MutableHashSet.add(seen, descriptor.id);
      return Result.fail(undefined);
    });
  },
  {
    identifier: $I`UniqueCatalogIds`,
    title: "Unique catalog capability identifiers",
    description: "Every descriptor in the capability catalog has a unique identifier.",
  }
);

const uniqueCatalogCommandIds = S.makeFilter<ReadonlyArray<CapabilityDescriptor>>(
  (catalog) => {
    const seen = MutableHashSet.empty<CommandId>();
    return A.flatMap(catalog, (descriptor, descriptorIndex) =>
      A.filterMap(descriptor.commands, (command, commandIndex) => {
        if (MutableHashSet.has(seen, command.id)) {
          return Result.succeed({
            path: [descriptorIndex, "commands", commandIndex, "id"],
            issue: `Duplicate command id "${command.id}".`,
          });
        }
        MutableHashSet.add(seen, command.id);
        return Result.fail(undefined);
      })
    );
  },
  {
    identifier: $I`UniqueCatalogCommandIds`,
    title: "Unique catalog command identifiers",
    description: "Every command identifier is owned by exactly one catalog descriptor.",
  }
);

const uniqueCatalogRegistrationKeys = S.makeFilter<ReadonlyArray<CapabilityDescriptor>>(
  (catalog) => {
    const seen = MutableHashSet.empty<string>();
    return A.flatMap(catalog, (descriptor, descriptorIndex) => {
      const nodes = A.map(descriptor.registrations.nodes, (key, index) => ({
        key,
        path: [descriptorIndex, "registrations", "nodes", index],
      }));
      const extensions = A.map(descriptor.registrations.extensions, (key, index) => ({
        key,
        path: [descriptorIndex, "registrations", "extensions", index],
      }));
      const transformers = A.map(descriptor.registrations.transformers, (key, index) => ({
        key,
        path: [descriptorIndex, "registrations", "transformers", index],
      }));
      return A.filterMap(A.appendAll(A.appendAll(nodes, extensions), transformers), ({ key, path }) => {
        if (MutableHashSet.has(seen, key)) {
          return Result.succeed({ path, issue: `Duplicate registration key "${key}".` });
        }
        MutableHashSet.add(seen, key);
        return Result.fail(undefined);
      });
    });
  },
  {
    identifier: $I`UniqueCatalogRegistrationKeys`,
    title: "Unique catalog registration keys",
    description: "Every node, extension, and transformer key is owned by exactly one descriptor.",
  }
);

/**
 * Validated single source of all editor capability descriptors.
 *
 * **Example** (Decode an empty catalog)
 *
 * ```ts import.meta.vitest name="Decode an empty catalog"
 * import { CapabilityCatalog } from "@beep/editor/capability/schemas"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * Result.isSuccess(S.decodeUnknownResult(CapabilityCatalog)([])) // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityCatalog = S.Array(CapabilityDescriptor)
  .check(catalogRelationships, uniqueCatalogIds, uniqueCatalogCommandIds, uniqueCatalogRegistrationKeys)
  .pipe(
    $I.annoteSchema("CapabilityCatalog", {
      title: "Capability catalog",
      description: "Validated registration source with globally unique capability, command, and registration keys.",
    })
  );

/**
 * Decoded descriptor collection produced by {@link CapabilityCatalog}.
 *
 * @category models
 * @since 0.0.0
 */
export type CapabilityCatalog = typeof CapabilityCatalog.Type;

/**
 * Ownership class of an editor profile.
 *
 * **Example** (Check production profile kind)
 *
 * ```ts import.meta.vitest name="Check production profile kind"
 * import { ProfileKind } from "@beep/editor/capability/schemas"
 *
 * ProfileKind.is.production("production") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProfileKind = LiteralKit(["production", "development-reference"]).annotate(
  $I.annote("ProfileKind", {
    title: "Profile kind",
    description: "Profile ownership class used to gate development-only capabilities.",
  })
);

/**
 * Decoded ownership class represented by {@link ProfileKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProfileKind = typeof ProfileKind.Type;

/**
 * Replacement keybindings for one resolved command.
 *
 * **Example** (Unbind a command)
 *
 * ```ts import.meta.vitest name="Unbind a command"
 * import { CommandId, KeybindingOverride } from "@beep/editor/capability/schemas"
 *
 * const value = KeybindingOverride.make({ commandId: CommandId.make("format.bold"), keybindings: [] })
 * value.keybindings // => []
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class KeybindingOverride extends S.Class<KeybindingOverride>($I`KeybindingOverride`)(
  {
    commandId: CommandId.annotateKey({ description: "Resolved command whose defaults are replaced." }),
    keybindings: S.Array(Keybinding)
      .check(uniqueBindingPlatforms)
      .annotateKey({ description: "Replacement bindings; an empty array unbinds the command." }),
  },
  $I.annote("KeybindingOverride", {
    title: "Keybinding override",
    description: "Complete replacement for one resolved command's default bindings.",
  })
) {}

const uniqueOverrideCommandIds = S.makeFilter<ReadonlyArray<KeybindingOverride>>(
  (overrides) => {
    const seen = MutableHashSet.empty<CommandId>();
    return A.filterMap(overrides, (override, index) => {
      if (MutableHashSet.has(seen, override.commandId)) {
        return Result.succeed({ path: [index, "commandId"], issue: `Duplicate override for "${override.commandId}".` });
      }
      MutableHashSet.add(seen, override.commandId);
      return Result.fail(undefined);
    });
  },
  {
    identifier: $I`UniqueOverrideCommandIds`,
    title: "Unique override command identifiers",
    description: "A profile contains at most one keybinding override per command.",
  }
);

/**
 * App-owned selection of authoring capabilities and keybinding replacements.
 *
 * **Example** (Create a default production profile)
 *
 * ```ts import.meta.vitest name="Create a default production profile"
 * import { EditorProfile, ProfileId } from "@beep/editor/capability/schemas"
 *
 * const profile = EditorProfile.make({ id: ProfileId.make("editor.empty"), capabilities: [] })
 * profile.kind // => "production"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class EditorProfile extends S.Class<EditorProfile>($I`EditorProfile`)(
  {
    id: ProfileId.annotateKey({ description: "Stable app-owned profile identifier." }),
    kind: ProfileKind.pipe(S.withConstructorDefault(Effect.succeed("production" as const))).annotateKey({
      description: "Ownership class; defaults to production.",
    }),
    capabilities: S.Array(CapabilityId)
      .check(uniqueCapabilityIds)
      .annotateKey({ description: "Explicit authoring capabilities selected by the app." }),
    keybindingOverrides: S.Array(KeybindingOverride)
      .check(uniqueOverrideCommandIds)
      .pipe(S.withConstructorDefault(Effect.succeed([])))
      .annotateKey({ description: "Complete command binding replacements; defaults to none." }),
  },
  $I.annote("EditorProfile", {
    title: "Editor profile",
    description: "App-owned explicit capability selection and keybinding override set.",
  })
) {}

/**
 * Authoring state of a catalog capability after resolution.
 *
 * **Example** (Check authoring mode)
 *
 * ```ts import.meta.vitest name="Check authoring mode"
 * import { CapabilityMode } from "@beep/editor/capability/schemas"
 *
 * CapabilityMode.is.authoring("authoring") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CapabilityMode = LiteralKit(["authoring", "read-only"]).annotate(
  $I.annote("CapabilityMode", {
    title: "Capability mode",
    description: "Whether a catalog capability is authoring-enabled or readable only.",
  })
);

/**
 * Decoded capability state represented by {@link CapabilityMode}.
 *
 * @category models
 * @since 0.0.0
 */
export type CapabilityMode = typeof CapabilityMode.Type;

/**
 * Catalog capability annotated with its resolved authoring state.
 *
 * **Example** (Create a read-only capability)
 *
 * ```ts import.meta.vitest name="Create a read-only capability"
 * import { CapabilityId, ResolvedCapability } from "@beep/editor/capability/schemas"
 *
 * const value = ResolvedCapability.make({
 *   id: CapabilityId.make("node.paragraph"), mode: "read-only", readOnlyFallback: "render-canonical"
 * })
 * value.mode // => "read-only"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedCapability extends S.Class<ResolvedCapability>($I`ResolvedCapability`)(
  {
    id: CapabilityId.annotateKey({ description: "Catalog capability identifier." }),
    mode: CapabilityMode.annotateKey({ description: "Resolved authoring state." }),
    readOnlyFallback: ReadOnlyFallback.annotateKey({ description: "Fallback used in read-only mode." }),
  },
  $I.annote("ResolvedCapability", {
    title: "Resolved capability",
    description: "One catalog capability in catalog order with its resolved authoring mode.",
  })
) {}

/**
 * Enabled command after profile keybinding overrides are applied.
 *
 * **Example** (Create a resolved command)
 *
 * ```ts import.meta.vitest name="Create a resolved command"
 * import { CapabilityId, CommandId, ResolvedCommand } from "@beep/editor/capability/schemas"
 *
 * const command = ResolvedCommand.make({
 *   id: CommandId.make("format.bold"), capabilityId: CapabilityId.make("format.bold"),
 *   label: "Bold", helpText: "Toggle bold.", surfaces: ["toolbar"], keybindings: []
 * })
 * command.label // => "Bold"
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export class ResolvedCommand extends S.Class<ResolvedCommand>($I`ResolvedCommand`)(
  {
    id: CommandId.annotateKey({ description: "Stable command identifier." }),
    capabilityId: CapabilityId.annotateKey({ description: "Capability that owns the command." }),
    label: S.NonEmptyString.annotateKey({ description: "Visible command label." }),
    helpText: S.NonEmptyString.annotateKey({ description: "Generated help description." }),
    surfaces: S.Array(ActivationSurface).annotateKey({ description: "Projected activation surfaces." }),
    keybindings: S.Array(Keybinding).annotateKey({ description: "Bindings after profile overrides." }),
  },
  $I.annote("ResolvedCommand", {
    title: "Resolved command",
    description: "Enabled command with its owning capability and final keybindings.",
  })
) {}

/**
 * Fully validated runtime plan produced from a catalog and app profile.
 *
 * **Example** (Create an empty resolved profile)
 *
 * ```ts import.meta.vitest name="Create an empty resolved profile"
 * import { CapabilityRegistrations, ProfileId, ResolvedEditorProfile } from "@beep/editor/capability/schemas"
 *
 * const value = ResolvedEditorProfile.make({
 *   profileId: ProfileId.make("editor.empty"), kind: "production", capabilities: [],
 *   registrations: CapabilityRegistrations.make({ nodes: [], extensions: [], transformers: [] }),
 *   commands: [], guardedChords: []
 * })
 * value.commands // => []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ResolvedEditorProfile extends S.Class<ResolvedEditorProfile>($I`ResolvedEditorProfile`)(
  {
    profileId: ProfileId.annotateKey({ description: "Resolved source profile identifier." }),
    kind: ProfileKind.annotateKey({ description: "Resolved source profile ownership class." }),
    capabilities: S.Array(ResolvedCapability).annotateKey({ description: "Every catalog row in catalog order." }),
    registrations: CapabilityRegistrations.annotateKey({ description: "Deterministic runtime registration plan." }),
    commands: S.Array(ResolvedCommand).annotateKey({ description: "Enabled commands in catalog declaration order." }),
    guardedChords: S.Array(Keybinding).annotateKey({
      description: "Default bindings swallowed for disabled catalog commands.",
    }),
  },
  $I.annote("ResolvedEditorProfile", {
    title: "Resolved editor profile",
    description: "Deterministic registration, command, and disabled-chord plan for an editor mount.",
  })
) {}
