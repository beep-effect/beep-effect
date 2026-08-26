import { ArtifactRefNode } from "@beep/editor/artifact-ref-node";
import { editorCapabilityCatalog } from "@beep/editor/capability/catalog";
import { KeyChordFromString } from "@beep/editor/capability/schemas";
import { editorNodes } from "@beep/editor/nodes";
import { YouTubeNode } from "@beep/editor/youtube-node";
import { $EditorId } from "@beep/identity";
import { A, O } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import { Effect, Equal, pipe, Result } from "effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as S from "effect/Schema";
import { LineBreakNode, ParagraphNode, TabNode, TextNode } from "lexical";
import type { CapabilityDescriptor, CommandDefinition, Keybinding } from "@beep/editor/capability/schemas";

const $I = $EditorId.create("capability/catalog-test");

class AtlasBinding extends S.Class<AtlasBinding>($I`AtlasBinding`)(
  {
    platform: S.String.annotateKey({ description: "Atlas platform string." }),
    chord: S.String.annotateKey({ description: "Atlas authored chord string." }),
  },
  $I.annote("AtlasBinding", {
    title: "Atlas binding slice",
    description: "Lenient keybinding fields used by catalog reconciliation.",
  })
) {}

class AtlasCommand extends S.Class<AtlasCommand>($I`AtlasCommand`)(
  {
    id: S.String.annotateKey({ description: "Atlas command identifier." }),
    label: S.String.annotateKey({ description: "Atlas command label." }),
    helpText: S.String.annotateKey({ description: "Atlas command help text." }),
    keybindings: S.Array(AtlasBinding).annotateKey({ description: "Atlas command keybindings." }),
  },
  $I.annote("AtlasCommand", {
    title: "Atlas command slice",
    description: "Lenient command fields used by catalog reconciliation.",
  })
) {}

class AtlasDisposition extends S.Class<AtlasDisposition>($I`AtlasDisposition`)(
  { kind: S.String.annotateKey({ description: "Atlas disposition kind." }) },
  $I.annote("AtlasDisposition", {
    title: "Atlas disposition slice",
    description: "Lenient disposition fields used by catalog reconciliation.",
  })
) {}

class AtlasCompatibility extends S.Class<AtlasCompatibility>($I`AtlasCompatibility`)(
  {
    format: S.String.annotateKey({ description: "Compatibility target format." }),
    status: S.String.annotateKey({ description: "Compatibility status." }),
  },
  $I.annote("AtlasCompatibility", {
    title: "Atlas compatibility slice",
    description: "Lenient compatibility fields used by catalog reconciliation.",
  })
) {}

class AtlasCapability extends S.Class<AtlasCapability>($I`AtlasCapability`)(
  {
    id: S.String.annotateKey({ description: "Atlas capability identifier." }),
    category: S.String.annotateKey({ description: "Atlas capability category." }),
    disposition: AtlasDisposition.annotateKey({ description: "Atlas capability disposition." }),
    dependencies: S.Array(S.String).annotateKey({ description: "Atlas dependency identifiers." }),
    commands: S.Array(AtlasCommand).annotateKey({ description: "Atlas command rows." }),
    compatibility: S.Array(AtlasCompatibility).annotateKey({ description: "Atlas compatibility rows." }),
  },
  $I.annote("AtlasCapability", {
    title: "Atlas capability slice",
    description: "Lenient capability fields used by P1 catalog reconciliation.",
  })
) {}

class AtlasArtifact extends S.Class<AtlasArtifact>($I`AtlasArtifact`)(
  { capabilities: S.Array(AtlasCapability).annotateKey({ description: "Atlas capability rows." }) },
  $I.annote("AtlasArtifact", {
    title: "Atlas artifact slice",
    description: "Lenient root slice decoded from capability-atlas.json.",
  })
) {}

const atlasUrl = new URL(
  "../../../../../goals/lexical-playground-capability-atlas/research/capability-atlas.json",
  import.meta.url
);

const decodeKeyChord = S.decodeUnknownResult(KeyChordFromString);

const mismatch = (matches: boolean, message: string): ReadonlyArray<string> => (matches ? [] : [message]);

const orderedStringsEqual = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean =>
  A.length(left) === A.length(right) &&
  A.every(A.zip(left, right), ([leftValue, rightValue]) => leftValue === rightValue);

const classificationMismatches = (
  descriptor: CapabilityDescriptor,
  atlasEntry: AtlasCapability
): ReadonlyArray<string> => [
  ...mismatch(
    descriptor.classification.category === atlasEntry.category,
    `${descriptor.id}: category descriptor=${descriptor.classification.category}, atlas=${atlasEntry.category}`
  ),
  ...mismatch(
    descriptor.classification.disposition === atlasEntry.disposition.kind,
    `${descriptor.id}: disposition descriptor=${descriptor.classification.disposition}, atlas=${atlasEntry.disposition.kind}`
  ),
];

const dependencyMismatches = (descriptor: CapabilityDescriptor, atlasEntry: AtlasCapability): ReadonlyArray<string> =>
  mismatch(
    A.every(atlasEntry.dependencies, (dependency) => A.contains(descriptor.dependencies, dependency)),
    `${descriptor.id}: atlas dependencies are not a subset of descriptor dependencies`
  );

const bindingMismatches = (
  descriptor: CapabilityDescriptor,
  catalogCommand: CommandDefinition,
  atlasCommand: AtlasCommand
): ReadonlyArray<string> =>
  A.flatMap(atlasCommand.keybindings, (atlasBinding) =>
    pipeBinding(
      descriptor,
      atlasCommand,
      atlasBinding,
      A.findFirst(catalogCommand.keybindings, (binding) => Equal.equals(binding.platform, atlasBinding.platform))
    )
  );

const pipeBinding = (
  descriptor: CapabilityDescriptor,
  atlasCommand: AtlasCommand,
  atlasBinding: AtlasBinding,
  catalogBinding: O.Option<Keybinding>
): ReadonlyArray<string> =>
  O.match(catalogBinding, {
    onNone: () => [`Missing ${atlasBinding.platform} binding for ${atlasCommand.id}`],
    onSome: (binding) =>
      Result.match(decodeKeyChord(atlasBinding.chord), {
        onFailure: () => [`${descriptor.id}: invalid atlas chord ${atlasBinding.chord} for ${atlasCommand.id}`],
        onSuccess: (parsedAtlasChord) =>
          mismatch(
            Equal.equals(binding.chord, parsedAtlasChord),
            `${descriptor.id}: chord mismatch for ${atlasCommand.id} on ${atlasBinding.platform}`
          ),
      }),
  });

const commandEntryMismatches = (descriptor: CapabilityDescriptor, atlasCommand: AtlasCommand): ReadonlyArray<string> =>
  O.match(
    A.findFirst(descriptor.commands, (command) => Equal.equals(command.id, atlasCommand.id)),
    {
      onNone: () => [`Missing command ${atlasCommand.id}`],
      onSome: (catalogCommand) => [
        ...mismatch(
          catalogCommand.label === atlasCommand.label,
          `${descriptor.id}: label mismatch for ${atlasCommand.id}`
        ),
        ...mismatch(
          catalogCommand.helpText === atlasCommand.helpText,
          `${descriptor.id}: help text mismatch for ${atlasCommand.id}`
        ),
        ...bindingMismatches(descriptor, catalogCommand, atlasCommand),
      ],
    }
  );

const commandMismatches = (descriptor: CapabilityDescriptor, atlasEntry: AtlasCapability): ReadonlyArray<string> => [
  ...mismatch(
    orderedStringsEqual(
      A.map(descriptor.commands, (command) => command.id),
      A.map(atlasEntry.commands, (command) => command.id)
    ),
    `${descriptor.id}: command identifiers differ`
  ),
  ...A.flatMap(atlasEntry.commands, (atlasCommand) => commandEntryMismatches(descriptor, atlasCommand)),
];

const compatibilityMismatches = (
  descriptor: CapabilityDescriptor,
  atlasEntry: AtlasCapability
): ReadonlyArray<string> =>
  O.match(
    A.findFirst(atlasEntry.compatibility, (row) => Equal.equals(row.format, "beep-md")),
    {
      onNone: () => [`Missing beep-md compatibility for ${descriptor.id}`],
      onSome: (canonical) =>
        mismatch(
          Equal.equals(descriptor.canonicalCompatibility, canonical.status),
          `${descriptor.id}: descriptor=${descriptor.canonicalCompatibility}, atlas=${canonical.status}`
        ),
    }
  );

const reconcileEntry = (descriptor: CapabilityDescriptor, atlasEntry: AtlasCapability): ReadonlyArray<string> => [
  ...classificationMismatches(descriptor, atlasEntry),
  ...dependencyMismatches(descriptor, atlasEntry),
  ...commandMismatches(descriptor, atlasEntry),
  ...compatibilityMismatches(descriptor, atlasEntry),
];

const atlasIndex = (
  capabilities: ReadonlyArray<AtlasCapability>
): MutableHashMap.MutableHashMap<string, AtlasCapability> => {
  const index = MutableHashMap.empty<string, AtlasCapability>();
  for (const capability of capabilities) {
    MutableHashMap.set(index, capability.id, capability);
  }
  return index;
};

describe("capability catalog", () => {
  it.effect(
    "reconciles every atlas-backed descriptor and command",
    Effect.fnUntraced(function* () {
      const atlasText = yield* Effect.tryPromise(() => Bun.file(atlasUrl).text());
      const atlas = yield* S.decodeEffect(S.fromJsonString(AtlasArtifact))(atlasText);
      const index = atlasIndex(atlas.capabilities);
      const mismatches = pipe(
        editorCapabilityCatalog,
        A.filter((descriptor) => !Equal.equals(descriptor.id, "beep.artifact-ref")),
        A.flatMap((descriptor) =>
          O.match(MutableHashMap.get(index, descriptor.id), {
            onNone: () => [`Missing atlas row ${descriptor.id}`],
            onSome: (atlasEntry) => reconcileEntry(descriptor, atlasEntry),
          })
        )
      );
      expect(mismatches).toEqual([]);
    })
  );

  it.effect(
    "preserves the pre-P1 editor node registration sequence",
    Effect.fnUntraced(function* () {
      const expectedKeys = [
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
      ];
      expect(A.flatMap(editorCapabilityCatalog, (descriptor) => descriptor.registrations.nodes)).toEqual(expectedKeys);
      expect(editorNodes).toEqual([
        TextNode,
        TabNode,
        LineBreakNode,
        ParagraphNode,
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        LinkNode,
        CodeNode,
        TableNode,
        TableRowNode,
        TableCellNode,
        YouTubeNode,
        ArtifactRefNode,
      ]);

      yield* Effect.void;
    })
  );
});
