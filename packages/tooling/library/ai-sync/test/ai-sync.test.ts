import {
  AgentCommandMetadata,
  AgentPluginManifestMetadata,
  AgentSkillFrontmatter,
  AiSyncContentHash,
  AiSyncDriftFinding,
  AiSyncDriftReport,
  AiSyncError,
  AiSyncSchemaCell,
  AiSyncSourceId,
  AiSyncSourceMetadata,
  AiSyncSourceUrl,
  AiSyncValidationResult,
  AiSyncVersionPin,
  ClaudeMcpJson,
  CodexConfig,
  checkGeneratedArtifacts,
  checkSourceDriftWithFetcher,
  claudeMcpJsonToCodexConfig,
  codexMcpServersToClaudeMcpJson,
  junieMcpJsonToClaudeMcpJson,
  NormalizedAgentInstructionDocument,
  normalizeAgentSkillFrontmatter,
  normalizeInstructionDocument,
  UnknownNativeSchemaCell,
  V1_SCHEMA_COVERAGE,
  V1_TRANSFORM_EVIDENCE,
  validateDogfoodConfigs,
  validateRepoConfig,
  validateRepoSafetyPolicy,
} from "@beep/ai-sync";
import { renderGeneratedSchemas } from "@beep/ai-sync/generator";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { assert, expect, layer } from "@effect/vitest";
import { Effect, Exit, FileSystem, Path, Ref } from "effect";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { TUnsafe } from "@beep/types";
import type { Layer } from "effect";

const emptyHash = AiSyncContentHash.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const previousHash = AiSyncContentHash.make("0000000000000000000000000000000000000000000000000000000000000000");
const requiredClaudeRepoDenyPermissions: ReadonlyArray<string> = [
  "Bash(git push --force:*)",
  "Bash(git push -f:*)",
  "Bash(git push --force-with-lease:*)",
  "Bash(git push --mirror:*)",
  "Bash(git stash clear:*)",
  "Bash(git stash pop:*)",
  "Bash(git worktree remove --force:*)",
  "Bash(bun run beep worktree remove --force:*)",
  "Bash(git clean:*)",
  "Bash(git reset --hard:*)",
  "Bash(git checkout .)",
  "Bash(git checkout -- .)",
  "Bash(gh pr merge --admin:*)",
  "Bash(gh repo delete:*)",
  "Edit(**/.github/workflows/**)",
  "Edit(**/docs/_internal/**)",
  "Edit(**/.claude/settings.json)",
];
const repoSafeClaudePermissions = {
  allow: ["Bash(gh pr view:*)"],
  defaultMode: "default",
  deny: requiredClaudeRepoDenyPermissions,
};
const encodeJson = UnknownFromJsonString.encodeUnknownEffect;

const expectSchemaRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  fc.assert(
    fc.property(S.toArbitrary(schema)(fc), (value) => {
      expect(Equal.equals(S.decodeUnknownSync(schema)(S.encodeSync(schema)(value)), value)).toBe(true);
    }),
    fcRuns(25)
  );
};

const expectEncodedRoundTrip = <Schema extends S.Codec<unknown>>(schema: Schema): void => {
  fc.assert(
    fc.property(S.toArbitrary(schema)(fc), (value) => {
      const encoded = S.encodeSync(schema)(value);
      expect(S.encodeSync(schema)(S.decodeUnknownSync(schema)(encoded))).toEqual(encoded);
    }),
    fcRuns(25)
  );
};

const withTempDirectory = <A, E, R>(use: (tmpDir: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  );

const writeText = Effect.fn("AiSyncTest.writeText")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

layer(NodeServices.layer as Layer.Layer<TUnsafe.Any>)("@beep/ai-sync", (it) => {
  it.effect(
    "validates the generated artifact set offline",
    Effect.fn(function* () {
      const report = yield* checkGeneratedArtifacts();
      expect(report.findings).toEqual([]);
    })
  );

  it.effect(
    "keeps crispened schema encoded wire shapes byte-identical",
    Effect.fn(function* () {
      const source = AiSyncSourceMetadata.make({
        id: AiSyncSourceId.make("codex-config"),
        agent: "codex",
        domain: "config",
        tier: "tier_1",
        url: AiSyncSourceUrl.make("https://example.com/schema.json"),
        versionPin: O.some(AiSyncVersionPin.make("rust-v0.133.0")),
        contentHash: O.some(emptyHash),
        isOfficial: true,
        driftMechanism: "version_and_hash",
      });
      const sourceWithoutOptionals = AiSyncSourceMetadata.make({
        id: AiSyncSourceId.make("rulesync-config"),
        agent: "rulesync",
        domain: "unified-config",
        tier: "tier_1",
        url: AiSyncSourceUrl.make("https://example.com/rulesync.json"),
        isOfficial: false,
        driftMechanism: "hash",
      });

      expect(yield* S.encodeEffect(AiSyncSourceMetadata)(source)).toEqual({
        id: "codex-config",
        agent: "codex",
        domain: "config",
        tier: "tier_1",
        url: "https://example.com/schema.json",
        versionPin: "rust-v0.133.0",
        contentHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        isOfficial: true,
        driftMechanism: "version_and_hash",
      });
      expect(yield* S.encodeEffect(AiSyncSourceMetadata)(sourceWithoutOptionals)).toEqual({
        id: "rulesync-config",
        agent: "rulesync",
        domain: "unified-config",
        tier: "tier_1",
        url: "https://example.com/rulesync.json",
        isOfficial: false,
        driftMechanism: "hash",
      });
      expect(
        yield* S.encodeEffect(AiSyncSchemaCell)(
          AiSyncSchemaCell.make({
            agent: "codex",
            domain: "hooks",
            status: "supported",
            sourceId: O.some(AiSyncSourceId.make("codex-hooks")),
            rationale: "Codex publishes hook schemas.",
          })
        )
      ).toEqual({
        agent: "codex",
        domain: "hooks",
        status: "supported",
        sourceId: "codex-hooks",
        rationale: "Codex publishes hook schemas.",
      });
      expect(
        yield* S.encodeEffect(AiSyncDriftFinding)(
          AiSyncDriftFinding.make({
            sourceId: AiSyncSourceId.make("codex-config"),
            expectedHash: O.none(),
            actualHash: emptyHash,
            message: "Source moved",
          })
        )
      ).toEqual({
        sourceId: "codex-config",
        actualHash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        message: "Source moved",
      });
      expect(
        yield* S.encodeEffect(AiSyncValidationResult)(
          AiSyncValidationResult.make({ relativePath: "AGENTS.md", schemaId: "agent-instruction-document" })
        )
      ).toEqual({
        relativePath: "AGENTS.md",
        schemaId: "agent-instruction-document",
      });
      expect(yield* S.encodeEffect(AiSyncError)(AiSyncError.make({ message: "Validation failed" }))).toEqual({
        _tag: "AiSyncError",
        message: "Validation failed",
      });
      expect(
        yield* S.encodeEffect(AgentCommandMetadata)(
          AgentCommandMetadata.make({ name: "review", description: "Review repo" })
        )
      ).toEqual({
        name: "review",
        description: "Review repo",
      });
      expect(
        yield* S.encodeEffect(AgentPluginManifestMetadata)(
          AgentPluginManifestMetadata.make({ name: "example", version: "0.0.0" })
        )
      ).toEqual({
        name: "example",
        version: "0.0.0",
      });
      expect(
        yield* S.encodeEffect(UnknownNativeSchemaCell)(
          UnknownNativeSchemaCell.make({
            agent: "grok-build",
            domain: "hooks",
            reason: "Native hook payload schema is not public.",
          })
        )
      ).toEqual({
        agent: "grok-build",
        domain: "hooks",
        reason: "Native hook payload schema is not public.",
      });
      expect(yield* S.decodeEffect(NormalizedAgentInstructionDocument)("# Rules  \n\nUse Effect.  ")).toBe(
        "# Rules\n\nUse Effect."
      );
    })
  );

  it.effect(
    "round-trips crispened schemas with schema-derived arbitraries",
    Effect.fn(function* () {
      expectSchemaRoundTrip(AiSyncSourceId);
      expectSchemaRoundTrip(AiSyncSourceUrl);
      expectSchemaRoundTrip(AiSyncVersionPin);
      expectSchemaRoundTrip(AiSyncContentHash);
      expectSchemaRoundTrip(AiSyncSourceMetadata);
      expectSchemaRoundTrip(AiSyncSchemaCell);
      expectSchemaRoundTrip(AiSyncDriftFinding);
      expectSchemaRoundTrip(AiSyncDriftReport);
      expectSchemaRoundTrip(AiSyncValidationResult);
      expectEncodedRoundTrip(AiSyncError);
      expectSchemaRoundTrip(AgentCommandMetadata);
      expectSchemaRoundTrip(AgentPluginManifestMetadata);
      expectSchemaRoundTrip(UnknownNativeSchemaCell);
      expectSchemaRoundTrip(NormalizedAgentInstructionDocument);
    })
  );

  it.effect(
    "renders generated literal domains through LiteralKit",
    Effect.fn(function* () {
      const generatedSchemas = renderGeneratedSchemas();
      expect(generatedSchemas).toContain('import { LiteralKit, UnknownRecord } from "@beep/schema";');
      expect(generatedSchemas).toContain("approval_policy: LiteralKit([");
      expect(generatedSchemas).toContain("sandbox_mode: LiteralKit([");
      expect(generatedSchemas).toContain("type: LiteralKit([");
      expect(generatedSchemas).not.toContain("approval_policy: S.Union(");
      expect(generatedSchemas).not.toContain("sandbox_mode: S.Union(");
      expect(generatedSchemas).not.toContain("type: S.Union(");
    })
  );

  it.effect(
    "validates a Codex TOML config and rejects typed invalid fields",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          yield* writeText(
            path.join(tmpDir, ".codex/config.toml"),
            'model = "gpt-5"\n\n[skills]\ninclude_instructions = true\n\n[[skills.config]]\nname = "effect-first-development"\nenabled = true\n'
          );

          const valid = yield* validateRepoConfig({ repoRoot: tmpDir, config: ".codex/config.toml" });
          expect(valid.schemaId).toBe("codex-config");

          yield* writeText(
            path.join(tmpDir, ".codex/config.toml"),
            'model = "gpt-5"\n\n[skills]\ninclude_instructions = "definitely"\n'
          );
          const invalid = yield* Effect.exit(validateRepoConfig({ repoRoot: tmpDir, config: ".codex/config.toml" }));
          expect(Exit.isFailure(invalid)).toBe(true);
          expect(String(invalid)).toContain('["skills"]["include_instructions"]');
        })
      );
    })
  );

  it.effect(
    "separates native config compatibility from checked-in repository safety policy",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const path = yield* Path.Path;
          const codexPath = path.join(tmpDir, ".codex/config.toml");
          const claudePath = path.join(tmpDir, ".claude/settings.json");

          yield* writeText(codexPath, "");
          assert.strictEqual(
            (yield* validateRepoConfig({ repoRoot: tmpDir, config: ".codex/config.toml" })).schemaId,
            "codex-config"
          );
          yield* validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".codex/config.toml" });

          yield* writeText(codexPath, 'approval_policy = "never"\nsandbox_mode = "danger-full-access"\n');
          const pinnedCodex = yield* Effect.flip(
            validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".codex/config.toml" })
          );
          assert.include(pinnedCodex.message, "approval_policy must be omitted");
          assert.include(pinnedCodex.message, "sandbox_mode must be omitted");

          yield* writeText(codexPath, 'approval_policy = "on-request"\nsandbox_mode = "workspace-write"\n');
          const safePinnedCodex = yield* Effect.flip(
            validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".codex/config.toml" })
          );
          assert.include(safePinnedCodex.message, "approval_policy must be omitted");
          assert.include(safePinnedCodex.message, "sandbox_mode must be omitted");

          yield* writeText(codexPath, 'sandbox_mode = "workspace-write"\n');
          const partialPinCodex = yield* Effect.flip(
            validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".codex/config.toml" })
          );
          assert.include(partialPinCodex.message, "sandbox_mode must be omitted");
          assert.notInclude(partialPinCodex.message, "approval_policy");

          yield* writeText(
            codexPath,
            '[sandbox_workspace_write]\nnetwork_access = true\nwritable_roots = ["/tmp/outside"]\n'
          );
          assert.strictEqual(
            (yield* validateRepoConfig({ repoRoot: tmpDir, config: ".codex/config.toml" })).schemaId,
            "codex-config"
          );
          const unsafeWorkspaceWrite = yield* Effect.flip(
            validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".codex/config.toml" })
          );
          assert.include(
            unsafeWorkspaceWrite.message,
            "sandbox_workspace_write.network_access must be false or omitted"
          );
          assert.include(
            unsafeWorkspaceWrite.message,
            "sandbox_workspace_write.writable_roots must be empty or omitted"
          );

          yield* writeText(codexPath, "[sandbox_workspace_write]\nnetwork_access = false\nwritable_roots = []\n");
          yield* validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".codex/config.toml" });

          yield* writeText(
            claudePath,
            yield* encodeJson({
              permissions: { allow: ["Bash(gh pr view:*)"], deny: requiredClaudeRepoDenyPermissions },
            })
          );
          const implicitClaudeMode = yield* Effect.flip(
            validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".claude/settings.json" })
          );
          assert.include(implicitClaudeMode.message, 'permissions.defaultMode must be explicitly set to "default"');

          const missingForcePushDeny = A.filter(
            requiredClaudeRepoDenyPermissions,
            (permission) => !Equal.equals(permission, "Bash(git push --force:*)")
          );
          yield* writeText(
            claudePath,
            yield* encodeJson({
              permissions: { ...repoSafeClaudePermissions, deny: missingForcePushDeny },
            })
          );
          assert.strictEqual(
            (yield* validateRepoConfig({ repoRoot: tmpDir, config: ".claude/settings.json" })).schemaId,
            "claude-settings"
          );
          const missingCriticalDeny = yield* Effect.flip(
            validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".claude/settings.json" })
          );
          assert.include(missingCriticalDeny.message, "missing required deny rule: Bash(git push --force:*)");

          const unexpectedDeny = "Bash(git branch -D:*)";
          yield* writeText(
            claudePath,
            yield* encodeJson({
              permissions: {
                ...repoSafeClaudePermissions,
                deny: A.append(requiredClaudeRepoDenyPermissions, unexpectedDeny),
              },
            })
          );
          const driftedDenyDomain = yield* Effect.flip(
            validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".claude/settings.json" })
          );
          assert.include(
            driftedDenyDomain.message,
            `unexpected deny rule outside exact repository policy: ${unexpectedDeny}`
          );

          yield* writeText(
            claudePath,
            yield* encodeJson({
              permissions: {
                ...repoSafeClaudePermissions,
                allow: ["Bash(git push:*)"],
              },
            })
          );
          const directPushGrant = yield* Effect.flip(
            validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".claude/settings.json" })
          );
          assert.include(directPushGrant.message, "unapproved auto-approved permission: Bash(git push:*)");

          yield* Effect.forEach(
            ["Write(**/.github/workflows/**)", "WebFetch(domain:example.com)", "mcp__github__create_pull_request"],
            Effect.fn(function* (permission) {
              yield* writeText(
                claudePath,
                yield* encodeJson({ permissions: { ...repoSafeClaudePermissions, allow: [permission] } })
              );
              const unsafeClaude = yield* Effect.flip(
                validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".claude/settings.json" })
              );
              assert.include(unsafeClaude.message, `unapproved auto-approved permission: ${permission}`);
            }),
            { discard: true }
          );

          yield* Effect.forEach(
            [
              "Bash(gh:*)",
              "Bash(gh *)",
              "Bash(gh*)",
              "Bash(*gh*)",
              "Bash(*)",
              "Bash",
              "Bash(codex exec:*)",
              "Bash(codex:*)",
              "Bash(/usr/bin/gh:*)",
              "Bash(env gh:*)",
              "Bash(GH_PAGER=cat gh:*)",
              "Bash(command codex exec:*)",
              "Bash(bash:*)",
              "Bash(timeout:*)",
            ],
            Effect.fn(function* (permission) {
              yield* writeText(
                claudePath,
                yield* encodeJson({
                  permissions: { ...repoSafeClaudePermissions, allow: [permission] },
                  enabledMcpjsonServers: ["phoenix"],
                })
              );
              assert.strictEqual(
                (yield* validateRepoConfig({ repoRoot: tmpDir, config: ".claude/settings.json" })).schemaId,
                "claude-settings"
              );

              const unsafeClaude = yield* Effect.flip(
                validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".claude/settings.json" })
              );
              assert.include(unsafeClaude.message, permission);
            }),
            { discard: true }
          );

          yield* Effect.forEach(
            ["acceptEdits", "plan", "auto", "dontAsk", "bypassPermissions"],
            Effect.fn(function* (defaultMode) {
              yield* writeText(
                claudePath,
                yield* encodeJson({ permissions: { ...repoSafeClaudePermissions, defaultMode } })
              );
              assert.strictEqual(
                (yield* validateRepoConfig({ repoRoot: tmpDir, config: ".claude/settings.json" })).schemaId,
                "claude-settings"
              );

              const unsafeClaudeMode = yield* Effect.flip(
                validateRepoSafetyPolicy({ repoRoot: tmpDir, config: ".claude/settings.json" })
              );
              assert.include(unsafeClaudeMode.message, `permissions.defaultMode must be "default"`);
            }),
            { discard: true }
          );

          yield* writeText(codexPath, "[features]\napps = false\n");
          yield* writeText(
            claudePath,
            yield* encodeJson({
              permissions: {
                ...repoSafeClaudePermissions,
                allow: ["Bash(gh pr view:*)", "Bash(gh pr checks:*)", "Bash(gh run view:*)"],
              },
            })
          );

          const safeResults = yield* validateDogfoodConfigs(tmpDir);
          assert.deepEqual(
            A.map(safeResults, (result) => result.relativePath),
            [".codex/config.toml", ".claude/settings.json"]
          );
        })
      );
    })
  );

  it.effect(
    "keeps check and audit cache keys coupled to repository safety configs",
    Effect.fn(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
      const turboText = yield* fs.readFileString(path.join(repoRoot, "packages/tooling/library/ai-sync/turbo.json"));
      const turboConfig = yield* S.decodeEffect(S.fromJsonString(S.Record(S.String, S.Unknown)))(turboText);
      const tasks = R.get(turboConfig, "tasks").pipe(
        O.flatMap(S.decodeUnknownOption(S.Record(S.String, S.Unknown))),
        O.getOrThrow
      );
      const configInputs = ["$TURBO_ROOT$/.codex/config.toml", "$TURBO_ROOT$/.claude/settings.json"];

      A.forEach(["check", "audit"], (taskName) => {
        const task = R.get(tasks, taskName).pipe(
          O.flatMap(S.decodeUnknownOption(S.Struct({ inputs: S.Array(S.String) }))),
          O.getOrThrow
        );
        assert.deepEqual(A.intersection(task.inputs, configInputs), configInputs);
      });
    })
  );

  it.effect(
    "keeps checked-in Claude grants inside the exact 50-value allow domain",
    Effect.fn(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..", "..", "..");
      const settingsText = yield* fs.readFileString(path.join(repoRoot, ".claude/settings.json"));
      const settings = yield* S.decodeEffect(
        S.fromJsonString(
          S.Struct({
            permissions: S.Struct({ allow: S.Array(S.String) }),
          })
        )
      )(settingsText);

      assert.lengthOf(settings.permissions.allow, 50);
      assert.include(settings.permissions.allow, "Bash(git worktree prune:*)");
      assert.include(settings.permissions.allow, "Bash(bun run beep yeet sweep:*)");
      assert.notInclude(settings.permissions.allow, "Bash(git worktree remove:*)");
      assert.include(settings.permissions.allow, "Bash(git stash drop:*)");
      assert.include(settings.permissions.allow, "Bash(git update-ref refs/archive/:*)");
      assert.notInclude(settings.permissions.allow, "Bash(git update-ref:*)");
      assert.notInclude(settings.permissions.allow, "Bash(git push --delete:*)");
      assert.notInclude(settings.permissions.allow, "Bash(git push origin --delete:*)");
      assert.notInclude(settings.permissions.allow, "Bash(git push:*)");
      assert.include(settings.permissions.allow, "Bash(bun run beep yeet publish:*)");
      yield* validateRepoSafetyPolicy({ repoRoot, config: ".claude/settings.json" });
    })
  );

  it.effect(
    "reads each mandatory config exactly once during combined validation",
    Effect.fn(function* () {
      yield* withTempDirectory(
        Effect.fn(function* (tmpDir) {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const codexPath = path.join(tmpDir, ".codex/config.toml");
          const claudePath = path.join(tmpDir, ".claude/settings.json");
          yield* writeText(codexPath, "[features]\napps = false\n");
          yield* writeText(claudePath, yield* encodeJson({ permissions: repoSafeClaudePermissions }));

          const readPaths = yield* Ref.make(A.empty<string>());
          const countingFs: FileSystem.FileSystem = {
            ...fs,
            readFileString: (filePath, encoding) =>
              Ref.update(readPaths, A.append(filePath)).pipe(Effect.andThen(fs.readFileString(filePath, encoding))),
          };
          const results = yield* validateDogfoodConfigs(tmpDir).pipe(
            Effect.provideService(FileSystem.FileSystem, countingFs)
          );

          assert.deepEqual(yield* Ref.get(readPaths), [codexPath, claudePath]);
          assert.deepEqual(
            A.map(results, (result) => result.relativePath),
            [".codex/config.toml", ".claude/settings.json"]
          );
        })
      );
    })
  );

  it.effect(
    "reports synthetic source drift against an injected upstream response",
    Effect.fn(function* () {
      const source = AiSyncSourceMetadata.make({
        id: AiSyncSourceId.make("synthetic"),
        agent: "codex",
        domain: "config",
        tier: "tier_1",
        url: AiSyncSourceUrl.make("https://example.com/schema.json"),
        contentHash: O.some(previousHash),
        isOfficial: true,
        driftMechanism: "hash",
      });

      const findings = yield* checkSourceDriftWithFetcher({
        sources: [source],
        fetcher: () => Effect.succeed("different"),
      });
      expect(findings).toHaveLength(1);
      expect(findings[0]?.sourceId).toBe("synthetic");
      expect(findings[0] !== undefined && O.isSome(findings[0].expectedHash)).toBe(true);
    })
  );

  it.effect(
    "round-trips Codex-compatible MCP fields through Claude-style MCP JSON",
    Effect.fn(function* () {
      const transformed = codexMcpServersToClaudeMcpJson(
        CodexConfig.make({
          mcp_servers: {
            shadcn: {
              command: "npx",
              args: ["-y", "shadcn@4.7.0", "mcp"],
            },
          },
        })
      );

      expect(transformed).toBeInstanceOf(ClaudeMcpJson);
      expect(transformed.mcpServers.shadcn?.command).toBe("npx");
      expect(transformed.mcpServers.shadcn?.args).toEqual(["-y", "shadcn@4.7.0", "mcp"]);

      const roundTripped = claudeMcpJsonToCodexConfig(transformed);
      expect(roundTripped.mcp_servers?.shadcn?.command).toBe("npx");
      expect(roundTripped.mcp_servers?.shadcn?.args).toEqual(["-y", "shadcn@4.7.0", "mcp"]);
    })
  );

  it.effect(
    "round-trips the modeled Junie and Claude MCP JSON shape",
    Effect.fn(function* () {
      const config = ClaudeMcpJson.make({
        mcpServers: {
          local: {
            type: "stdio",
            command: "node",
            args: ["mcp.js"],
          },
        },
      });

      const roundTripped = junieMcpJsonToClaudeMcpJson(config);
      expect(roundTripped.mcpServers.local?.command).toBe("node");
    })
  );

  it.effect(
    "normalizes lossy instruction and shared skill transform candidates",
    Effect.fn(function* () {
      expect(normalizeInstructionDocument("# Rules  \n\nUse Effect.  ")).toBe("# Rules\n\nUse Effect.");
      const skill = normalizeAgentSkillFrontmatter(
        AgentSkillFrontmatter.make({ name: "effect-first-development", description: "Use Effect patterns" })
      );
      expect(skill.name).toBe("effect-first-development");
    })
  );

  it.effect(
    "keeps unsupported and unknown V1 cells explicit",
    Effect.fn(function* () {
      expect(A.some(V1_SCHEMA_COVERAGE, (cell) => cell.status === "unknown_schema")).toBe(true);
      expect(A.some(V1_SCHEMA_COVERAGE, (cell) => cell.status === "na")).toBe(true);
      expect(A.some(V1_TRANSFORM_EVIDENCE, (entry) => entry.status === "declined")).toBe(true);
    })
  );
});
