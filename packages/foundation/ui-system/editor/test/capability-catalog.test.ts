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
import { Effect, Equal } from "effect";
import * as S from "effect/Schema";
import { LineBreakNode, ParagraphNode, TabNode, TextNode } from "lexical";

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

describe("capability catalog", () => {
  it.effect(
    "reconciles every atlas-backed descriptor and command",
    Effect.fnUntraced(function* () {
      const atlasText = yield* Effect.tryPromise(() => Bun.file(atlasUrl).text());
      const atlas = yield* S.decodeEffect(S.fromJsonString(AtlasArtifact))(atlasText);
      let compatibilityMismatches: ReadonlyArray<string> = [];

      for (const descriptor of editorCapabilityCatalog) {
        if (Equal.equals(descriptor.id, "beep.artifact-ref")) {
          continue;
        }
        const atlasEntry = A.findFirst(atlas.capabilities, (entry) => Equal.equals(entry.id, descriptor.id));
        if (O.isNone(atlasEntry)) {
          return yield* Effect.die(`Missing atlas row ${descriptor.id}`);
        }

        expect(descriptor.classification.category).toBe(atlasEntry.value.category);
        expect(descriptor.classification.disposition).toBe(atlasEntry.value.disposition.kind);
        expect(
          A.every(atlasEntry.value.dependencies, (dependency) => A.contains(descriptor.dependencies, dependency))
        ).toBe(true);

        expect(A.map(descriptor.commands, (command) => command.id)).toEqual(
          A.map(atlasEntry.value.commands, (command) => command.id)
        );
        for (const atlasCommand of atlasEntry.value.commands) {
          const catalogCommand = A.findFirst(descriptor.commands, (command) =>
            Equal.equals(command.id, atlasCommand.id)
          );
          if (O.isNone(catalogCommand)) {
            return yield* Effect.die(`Missing command ${atlasCommand.id}`);
          }
          expect(catalogCommand.value.label).toBe(atlasCommand.label);
          expect(catalogCommand.value.helpText).toBe(atlasCommand.helpText);
          for (const atlasBinding of atlasCommand.keybindings) {
            const catalogBinding = A.findFirst(catalogCommand.value.keybindings, (binding) =>
              Equal.equals(binding.platform, atlasBinding.platform)
            );
            if (O.isNone(catalogBinding)) {
              return yield* Effect.die(`Missing ${atlasBinding.platform} binding for ${atlasCommand.id}`);
            }
            const parsedAtlasChord = yield* S.decodeEffect(KeyChordFromString)(atlasBinding.chord);
            expect(Equal.equals(catalogBinding.value.chord, parsedAtlasChord)).toBe(true);
          }
        }

        const canonical = A.findFirst(atlasEntry.value.compatibility, (row) => Equal.equals(row.format, "beep-md"));
        if (O.isNone(canonical)) {
          return yield* Effect.die(`Missing beep-md compatibility for ${descriptor.id}`);
        }
        if (!Equal.equals(descriptor.canonicalCompatibility, canonical.value.status)) {
          compatibilityMismatches = A.append(
            compatibilityMismatches,
            `${descriptor.id}: descriptor=${descriptor.canonicalCompatibility}, atlas=${canonical.value.status}`
          );
        }
      }
      expect(compatibilityMismatches).toEqual([]);
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
