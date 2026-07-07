import { renderCodexConfigWithSkills, skillsCommand } from "@beep/repo-cli/commands/Skills";
import { A } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { Command } from "effect/unstable/cli";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/unstable/http";
import { describe, expect, it } from "vitest";

const runSkillsCommand = Command.runWith(skillsCommand, { version: "0.0.0" });
const CommandTestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer, NodeCrypto.layer);

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const remoteGrillMeSkill = `---
name: grill-me
description: Ask focused planning questions until the decision tree is clear.
---

# Grill Me

Ask direct questions before implementation.
`;

const githubTreeFixture = `{
  "tree": [
    {
      "path": "skills/productivity/grill-me",
      "type": "tree",
      "sha": "tree-sha"
    },
    {
      "path": "skills/productivity/grill-me/SKILL.md",
      "type": "blob",
      "sha": "skill-sha",
      "size": 142
    }
  ],
  "truncated": false
}`;

const makeWebHandlerClient = (handler: (request: Request) => Promise<Response>) =>
  HttpClient.make((request, url) =>
    Effect.tryPromise({
      try: () =>
        Effect.runPromise(
          Effect.gen(function* () {
            const response = yield* Effect.promise(() =>
              Promise.resolve(
                handler(
                  new Request(url.toString(), {
                    method: request.method,
                    headers: request.headers,
                  })
                )
              )
            );
            return HttpClientResponse.fromWeb(request, response);
          })
        ),
      catch: (cause) =>
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause }),
        }),
    })
  );

const makeSkillsClient = () =>
  makeWebHandlerClient((request) =>
    Effect.runPromise(
      Effect.gen(function* () {
        if (request.url === "https://api.github.com/repos/mattpocock/skills/git/trees/main?recursive=1") {
          return new Response(githubTreeFixture, {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (
          request.url ===
          "https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grill-me/SKILL.md"
        ) {
          return new Response(remoteGrillMeSkill, {
            status: 200,
            headers: { "content-type": "text/markdown" },
          });
        }

        return new Response("missing", { status: 404 });
      })
    )
  );

const withTempRepoCommand = <A, E, R>(use: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const tmpDir = yield* fs.makeTempDirectory();
      const previousCwd = process.cwd();

      process.chdir(tmpDir);
      yield* fs.makeDirectory(".git", { recursive: true });

      return { fs, previousCwd, tmpDir } as const;
    }),
    () => use,
    ({ fs, previousCwd, tmpDir }) =>
      Effect.gen(function* () {
        process.chdir(previousCwd);
        yield* fs.remove(tmpDir, { recursive: true, force: true });
      })
  ).pipe(provideScopedLayer(CommandTestLayer));

const writeProjectFile = Effect.fn("SkillsCommandTest.writeProjectFile")(function* (
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(process.cwd(), relativePath);
  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const readProjectFile = Effect.fn("SkillsCommandTest.readProjectFile")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(process.cwd(), relativePath));
});

describe("skills command", () => {
  it("renders Codex skills while preserving later tables", () => {
    const rendered = renderCodexConfigWithSkills(
      A.join(
        [
          "[features]",
          "  apps = false",
          "",
          "[skills]",
          "  include_instructions = true",
          "  [[skills.config]]",
          '    name = "stale"',
          "    enabled = true",
          "",
          "[mcp_servers.webstorm]",
          '  url = "http://127.0.0.1:64542/stream"',
          "",
        ],
        "\n"
      ),
      ["grill-me", "local-only"]
    );

    expect(rendered).toContain('name = "grill-me"');
    expect(rendered).toContain('name = "local-only"');
    expect(rendered).not.toContain('name = "stale"');
    expect(rendered).toContain("[mcp_servers.webstorm]");
  });

  it("updates a selected remote skill, lockfile, Codex config, and agents mirror", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        yield* writeProjectFile(".claude/skills/grill-me/SKILL.md", "old skill\n");
        yield* writeProjectFile(
          ".claude/skills/local-only/SKILL.md",
          "---\nname: local-only\ndescription: Local test skill.\n---\n\n# Local\n"
        );
        yield* writeProjectFile(
          ".codex/config.toml",
          A.join(
            [
              "[features]",
              "  apps = false",
              "",
              "[skills]",
              "  include_instructions = true",
              "  [[skills.config]]",
              '    name = "stale"',
              "    enabled = true",
              "",
              "[mcp_servers.webstorm]",
              '  url = "http://127.0.0.1:64542/stream"',
              "",
            ],
            "\n"
          )
        );

        yield* runSkillsCommand(["update", "--skill", "grill-me"]);

        const updatedSkill = yield* readProjectFile(".claude/skills/grill-me/SKILL.md");
        const lockFile = yield* readProjectFile("skills-lock.json");
        const codexConfig = yield* readProjectFile(".codex/config.toml");
        const logs = yield* TestConsole.logLines;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const agentsRealPath = yield* fs.realPath(path.join(process.cwd(), ".agents", "skills"));
        const claudeRealPath = yield* fs.realPath(path.join(process.cwd(), ".claude", "skills"));

        expect(updatedSkill).toBe(remoteGrillMeSkill);
        expect(lockFile).toContain('"grill-me"');
        expect(lockFile).toContain('"source": "mattpocock/skills"');
        expect(lockFile).toContain('"local-only"');
        expect(lockFile).toContain('"sourceType": "local"');
        expect(codexConfig).toContain('name = "grill-me"');
        expect(codexConfig).toContain('name = "local-only"');
        expect(codexConfig).not.toContain('name = "stale"');
        expect(agentsRealPath).toBe(claudeRealPath);
        expect(logs).toContain("skills:update: drift (4)");
      }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()), withTempRepoCommand)
    ));
});
