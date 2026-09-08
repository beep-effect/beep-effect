import { fileURLToPath } from "node:url";
import {
  Agent,
  AgentMode,
  assistantContentToDocument,
  AssistantBlock as RootAssistantBlock,
  AssistantContent as RootAssistantContent,
  Skill,
  SkillFrontmatter,
  TableBlock,
  YouTubeBlock,
} from "@beep/agents-domain";
import * as AssistantContentSubpath from "@beep/agents-domain/values/AssistantContent";
import {
  AssistantBlock,
  AssistantContent,
  InlineNode,
  ParagraphBlock,
  TextInline,
} from "@beep/agents-domain/values/AssistantContent";
import * as Md from "@beep/md/Md.model";
import * as Agents from "@beep/shared-domain/identity/Agents";
import { fcRuns, productEntityFixtureInput, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { PlatformError } from "effect";

const AgentModeArbitrary = S.toArbitrary(AgentMode)(fc);

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const roundTrip = <Schema extends S.Codec<unknown>>(schema: Schema, value: Schema["Type"]): void => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};
const assistantContentSchemaId = (schema: {
  readonly ast: { readonly annotations: Record<string, unknown> | undefined };
}): symbol => {
  const schemaId = schema.ast.annotations?.schemaId;
  if (typeof schemaId !== "symbol") {
    throw new Error("expected an interned schemaId annotation symbol");
  }
  return schemaId;
};
const legacyTurnImportPattern = /^\s*import\s+(?:type\s+)?[\s\S]*?\s+from\s+["']@beep\/agents-domain\/turn["'];?/gmu;
const ignoredAgentsDirEntries = new Set(["dist", "docs", "node_modules"]);
const decodeJsonPointerSegment = (segment: string): string => segment.replaceAll("~1", "/").replaceAll("~0", "~");
const isIgnoredAgentsDirEntry = (entry: string): boolean => ignoredAgentsDirEntries.has(entry) || entry.startsWith(".");
const isAgentsSourceFile = (entryPath: string, sep: string): boolean =>
  entryPath.endsWith(".ts") && entryPath.includes(`${sep}src${sep}`);

describe("@beep/agents-domain", () => {
  it("exports value schemas from the package identity", () => {
    expect(AgentMode.is.deterministic_fixture("deterministic_fixture")).toBe(true);
  });

  it("wires Agent to the agents product-entity identity", () => {
    expect(Agent.sql.tableName).toBe(Agents.AgentId.tableName);
    expect(Agents.AgentId.entityType).toBe("AgentsAgent");
    expect(Object.keys(Agent.insert.fields)).not.toContain("id");
    expect(Object.keys(Agent.insert.fields)).not.toContain("rowVersion");
    expect(Object.keys(Agent.update.fields)).toContain("id");
    expect(Object.keys(Agent.update.fields)).toContain("rowVersion");
    expect(Object.keys(Agent.jsonCreate.fields)).toEqual(["fixtureKey", "mode", "name", "skillFixtureKey"]);
    expect(Object.keys(Agent.jsonUpdate.fields)).toEqual(["fixtureKey", "mode", "name", "skillFixtureKey"]);
  });

  it("decodes and constructs an Agent row", () => {
    const encoded = {
      ...productEntityFixtureInput("AgentsAgent", 4),
      fixtureKey: "agent.reviewer",
      mode: "deterministic_fixture",
      name: "Reviewer Agent",
      skillFixtureKey: "skill.review",
    };
    const decoded = S.decodeUnknownSync(Agent)(encoded);
    const constructed = Agent.make(decoded);
    const TaggedAgent = Agent.toTagged();
    const tagged = Result.getOrThrow(S.decodeUnknownResult(TaggedAgent)(encoded));

    expect(decoded).toBeInstanceOf(Agent);
    expect(constructed).toBeInstanceOf(Agent);
    expect(constructed.entityType).toBe("AgentsAgent");
    expect(constructed.mode).toBe("deterministic_fixture");
    expect(constructed.skillFixtureKey).toBe("skill.review");
    expect(TaggedAgent.guards.deterministic_fixture(tagged)).toBe(true);
    expect(Result.getOrThrow(S.encodeResult(Agent)(decoded))).toStrictEqual(encoded);
  });

  it("decodes and constructs a Skill row", () => {
    const encoded = {
      ...productEntityFixtureInput("AgentsSkill", 5),
      allowedTools: null,
      compatibility: null,
      description: "Reviews changed code before publication.",
      fixtureKey: "skill.review",
      license: null,
      metadata: null,
      name: "review-skill",
    };
    const decoded = S.decodeUnknownSync(Skill)(encoded);
    const constructed = Skill.make(decoded);

    expect(decoded).toBeInstanceOf(Skill);
    expect(constructed).toBeInstanceOf(Skill);
    expect(constructed.entityType).toBe("AgentsSkill");
    expect(constructed.fixtureKey).toBe("skill.review");
    expect(Skill.sql.tableName).toBe("agents_skill");
    expect(Object.keys(Skill.insert.fields)).not.toContain("id");
    expect(Object.keys(Skill.insert.fields)).not.toContain("rowVersion");
    expect(Object.keys(Skill.update.fields)).toContain("id");
    expect(Object.keys(Skill.update.fields)).toContain("rowVersion");
    expect(Skill.sql.columns.compatibility.column.length).toBe(500);
    expect(Result.getOrThrow(S.encodeResult(Skill)(decoded))).toStrictEqual(encoded);
  });

  it("rejects Skill names outside the frontmatter contract", () => {
    const base = {
      ...productEntityFixtureInput("AgentsSkill", 6),
      allowedTools: null,
      compatibility: null,
      description: "Reviews changed code before publication.",
      fixtureKey: "skill.review",
      license: null,
      metadata: null,
    };
    expect(Result.isFailure(S.decodeUnknownResult(Skill)({ ...base, name: "Review Skill" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(Skill)({ ...base, name: "-review" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(Skill)({ ...base, name: "review_skill" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(Skill)({ ...base, name: "review.skill" }))).toBe(true);
    expect(Result.isFailure(S.decodeUnknownResult(Skill)({ ...base, name: "review--skill" }))).toBe(true);
  });

  it("decodes Agent Skills frontmatter through the derived codec", () => {
    const decoded = S.decodeSync(SkillFrontmatter)({
      "allowed-tools": "Bash, Read",
      compatibility: null,
      description: "Formats commit messages.",
      license: "MIT",
      metadata: null,
      name: "commit-format",
    });

    expect(O.getOrThrow(decoded.allowedTools)).toBe("Bash, Read");
    expect(O.getOrThrow(decoded.license)).toBe("MIT");
    const encoded = Result.getOrThrow(S.encodeResult(SkillFrontmatter)(decoded));
    expect(encoded["allowed-tools"]).toBe("Bash, Read");
    expect(Object.keys(encoded)).not.toContain("allowedTools");
    expect(Object.keys(encoded)).not.toContain("fixtureKey");
  });

  it("round-trips schema-derived agent modes", () =>
    fc.assert(
      fc.property(AgentModeArbitrary, (mode) => {
        const decoded = S.decodeSync(AgentMode)(mode);
        const encoded = S.encodeSync(AgentMode)(decoded);

        expect(encoded).toBe(mode);
        expect(AgentMode.is.deterministic_fixture(decoded)).toBe(true);
      }),
      fcRuns(25)
    ));

  it("preserves assistant content exports from the canonical value-object path", () => {
    const assistantContentDocument = S.toJsonSchemaDocument(AssistantContent);
    const assistantContentSchema = assistantContentDocument.schema;

    expect(RootAssistantBlock).toBe(AssistantBlock);
    expect(RootAssistantContent).toBe(AssistantContent);
    expect(AssistantContentSubpath.AssistantBlock).toBe(AssistantBlock);
    expect(AssistantContentSubpath.AssistantContent).toBe(AssistantContent);
    expect(assistantContentSchemaId(RootAssistantBlock)).toBe(assistantContentSchemaId(AssistantBlock));
    expect(assistantContentSchemaId(RootAssistantContent)).toBe(assistantContentSchemaId(AssistantContent));
    expect(assistantContentSchema).toHaveProperty("$ref");
    if (!("$ref" in assistantContentSchema) || typeof assistantContentSchema.$ref !== "string") {
      throw new Error("expected AssistantContent JSON schema document root to be a $ref");
    }

    const assistantContentDefinitionName = decodeJsonPointerSegment(
      assistantContentSchema.$ref.slice("#/$defs/".length)
    );
    expect(assistantContentSchema.$ref).toMatch(/^#\/\$defs\/.+AssistantContentEncoded$/);
    expect(R.has(assistantContentDocument.definitions, assistantContentDefinitionName)).toBe(true);
    expect(S.toJsonSchemaDocument(RootAssistantBlock)).toStrictEqual(S.toJsonSchemaDocument(AssistantBlock));
    expect(S.toJsonSchemaDocument(AssistantContentSubpath.AssistantBlock)).toStrictEqual(
      S.toJsonSchemaDocument(AssistantBlock)
    );
    expect(assistantContentDocument).toStrictEqual(S.toJsonSchemaDocument(AssistantContent));

    const decoded = S.decodeSync(RootAssistantBlock)({
      type: "paragraph",
      children: [{ type: "text", text: "hello" }],
    });

    expect(decoded).toStrictEqual(ParagraphBlock.make({ children: [TextInline.make({ text: "hello" })] }));
  });

  it("keeps assistant content encoded shape stable", () => {
    const encoded = {
      blocks: [
        {
          type: "heading",
          level: "h2",
          children: [{ type: "text", text: "Install" }],
        },
        {
          type: "list",
          listType: "number",
          items: [{ children: [{ type: "text", text: "Step one" }] }],
        },
        {
          type: "table",
          headerRow: true,
          rows: [{ cells: [{ children: [{ type: "text", text: "Name" }] }] }],
        },
        {
          type: "youtube",
          videoId: "dQw4w9WgXcQ",
        },
      ],
    };
    const decoded = Result.getOrThrow(S.decodeUnknownResult(AssistantContent)(encoded));

    expect(Result.getOrThrow(S.encodeResult(AssistantContent)(decoded))).toStrictEqual(encoded);
    expect(AssistantBlock.is(AssistantBlock.decodeUnknownSync(encoded.blocks[0]))).toBe(true);
    expect(InlineNode.is(InlineNode.decodeUnknownSync({ type: "text", text: "Install" }))).toBe(true);
  });

  it("round-trips crispened schemas with schema-derived arbitraries", () => {
    const schemas: ReadonlyArray<S.Codec<unknown>> = [Agent, Skill, AssistantContent, AssistantBlock, InlineNode];

    for (const schema of schemas) {
      fc.assert(
        fc.property(S.toArbitrary(schema)(fc), (value) => roundTrip(schema, value)),
        fcRuns(10)
      );
    }
  });

  it.effect(
    "keeps agents source code off removed turn subpath imports",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const repoRelativePath = (absolutePath: string): string =>
        path.relative(repoRoot, absolutePath).split(path.sep).join("/");

      const collectAgentsSourceFiles = (
        directory: string
      ): Effect.Effect<ReadonlyArray<string>, PlatformError.PlatformError> =>
        Effect.gen(function* () {
          const sourceFiles: Array<string> = [];

          for (const entry of yield* fs.readDirectory(directory)) {
            if (isIgnoredAgentsDirEntry(entry)) {
              continue;
            }

            const entryPath = path.join(directory, entry);
            const info = yield* fs.stat(entryPath);
            if (info.type === "Directory") {
              sourceFiles.push(...(yield* collectAgentsSourceFiles(entryPath)));
            } else if (isAgentsSourceFile(entryPath, path.sep)) {
              sourceFiles.push(entryPath);
            }
          }

          return sourceFiles.sort();
        });

      const sourceFiles = yield* collectAgentsSourceFiles(path.join(repoRoot, "packages/agents"));
      const violations: Array<{ readonly importDeclaration: string; readonly sourcePath: string }> = [];

      for (const sourcePath of sourceFiles) {
        const sourceText = yield* fs.readFileString(sourcePath);
        for (const match of sourceText.matchAll(legacyTurnImportPattern)) {
          const importDeclaration = match[0];
          violations.push({ importDeclaration, sourcePath: repoRelativePath(sourcePath) });
        }
      }

      expect(violations).toEqual([]);
    }, provideScopedLayer(NodeServices.layer))
  );

  it("lifts rich assistant blocks into canonical Md nodes", () => {
    const document = assistantContentToDocument([
      {
        type: "code",
        language: "mermaid",
        code: "flowchart TD\nA --> B",
      },
      {
        type: "table",
        headerRow: true,
        rows: [
          {
            cells: [
              { children: [{ type: "text", text: "Name" }] },
              { children: [{ type: "text", text: "Value", code: true }] },
            ],
          },
        ],
      },
      {
        type: "youtube",
        videoId: "dQw4w9WgXcQ",
      },
    ]);

    expect(document.children).toEqual([
      Md.Pre.make({ language: O.some("mermaid"), value: "flowchart TD\nA --> B" }),
      Md.Table.make({
        headerRow: true,
        children: [
          Md.TableRow.make({
            children: [
              Md.TableCell.make({ children: [Md.Text.make({ value: "Name" })] }),
              Md.TableCell.make({ children: [Md.Code.make({ value: "Value" })] }),
            ],
          }),
        ],
      }),
      Md.YouTube.make({ videoId: "dQw4w9WgXcQ" }),
    ]);
  });

  it("rejects malformed assistant table and youtube blocks at the domain boundary", () => {
    expect(() =>
      S.decodeSync(TableBlock)({
        type: "table",
        rows: [
          { cells: [{ children: [{ type: "text", text: "Name" }] }] },
          {
            cells: [{ children: [{ type: "text", text: "Value" }] }, { children: [{ type: "text", text: "Extra" }] }],
          },
        ],
      })
    ).toThrow(/Tables must contain/);

    expect(() =>
      S.decodeSync(YouTubeBlock)({
        type: "youtube",
        videoId: "https://youtu.be/dQw4w9WgXcQ",
      })
    ).toThrow(/YouTube blocks/);
  });
});
