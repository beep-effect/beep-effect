import { renderCodexConfigWithSkills, runSkillsUpdate, skillsCommand } from "@beep/repo-cli/commands/Skills";
import { it } from "@beep/test-runner";
import { A, O } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe, expect } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as TestConsole from "effect/testing/TestConsole";
import { temporaryWorkingDirectory } from "./support/CommandTest.ts";

const runSkillsCommand = Command.runWith(skillsCommand, { version: "0.0.0" });
const CommandTestLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer, NodeCrypto.layer);

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

const traversalGithubTreeFixture = `{
  "tree": [
    {
      "path": "skills/productivity/grill-me/SKILL.md",
      "type": "blob",
      "sha": "skill-sha",
      "size": 142
    },
    {
      "path": "skills/productivity/grill-me/../../pwned.md",
      "type": "blob",
      "sha": "pwned-sha",
      "size": 11
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

const makeTraversalSkillsClient = () =>
  makeWebHandlerClient((request) =>
    Effect.runPromise(
      Effect.gen(function* () {
        if (request.url === "https://api.github.com/repos/mattpocock/skills/git/trees/main?recursive=1") {
          return new Response(traversalGithubTreeFixture, {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        if (request.url.startsWith("https://raw.githubusercontent.com/mattpocock/skills/main/")) {
          return new Response(remoteGrillMeSkill, {
            status: 200,
            headers: { "content-type": "text/markdown" },
          });
        }

        return new Response("missing", { status: 404 });
      })
    )
  );

const temporaryRepository = Effect.gen(function* () {
  const root = yield* temporaryWorkingDirectory;
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(".git", { recursive: true });
  return root;
}).pipe(Effect.withSpan("SkillsCommandTest.temporaryRepository"));

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

  it.layer(CommandTestLayer, { timeout: "30 seconds" })((it) => {
    it.effect("updates a selected remote skill, lockfile, Codex config, and agents mirror", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
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

        const currentDrift = yield* runSkillsUpdate({ mode: "check", skill: O.some("grill-me") });
        expect(currentDrift).toEqual([]);
      }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
    );
  });

  it.layer(CommandTestLayer, { timeout: "30 seconds" })((it) => {
    it.effect("rejects traversal paths from remote GitHub trees", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeProjectFile(".codex/config.toml", "[skills]\n  include_instructions = true\n");

        const result = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") }).pipe(Effect.flip);
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;

        expect(result.message).toContain("unsafe file path");
        expect(yield* fs.exists(path.join(process.cwd(), ".claude", "pwned.md"))).toBe(false);
      }).pipe(Effect.provideService(HttpClient.HttpClient, makeTraversalSkillsClient()))
    );
  });
});

// Exercise the constructor used by the command cases, including its fallible
// .git setup. The native services remain the subject; these overrides observe
// acquisition/release and provoke native failures at the owning boundaries.
it.layer(CommandTestLayer, { timeout: "30 seconds" })("skills fixture ownership", (it) => {
  for (const scenario of ["setup failure", "body failure", "interruption", "cleanup failure"]) {
    it.effect(`restores cwd and owns the repository during ${scenario}`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const previousCwd = process.cwd();
        const fiberId = yield* Effect.fiberId;
        const rootRef = yield* Ref.make<O.Option<string>>(O.none());
        const removeCwd = yield* Ref.make<O.Option<string>>(O.none());
        const expectedError = yield* Ref.make<O.Option<PlatformError.PlatformError>>(O.none());
        const observedFileSystem: FileSystem.FileSystem = {
          ...fs,
          makeTempDirectory: Effect.fn("SkillsCommandTest.observeRoot")(function* (options) {
            const root = yield* fs.makeTempDirectory(options);
            yield* Ref.set(rootRef, O.some(root));
            return root;
          }),
          makeDirectory: Effect.fn("SkillsCommandTest.fixtureDirectory")(function* (directory, options) {
            if (scenario === "setup failure" && directory === ".git") {
              yield* fs.writeFileString(".git", "setup obstruction");
            }
            return yield* fs
              .makeDirectory(directory, options)
              .pipe(Effect.tapError((error) => Ref.set(expectedError, O.some(error))));
          }),
          remove: Effect.fn("SkillsCommandTest.observeRemoval")(function* (root, options) {
            yield* Ref.set(removeCwd, O.some(process.cwd()));
            return yield* fs
              .remove(root, options)
              .pipe(Effect.tapError((error) => Ref.set(expectedError, O.some(error))));
          }),
        };
        const exit = yield* Effect.scoped(
          Effect.gen(function* () {
            const root = yield* temporaryRepository;
            if (scenario === "body failure") return yield* Effect.fail("fixture body failure");
            if (scenario === "interruption") return yield* Effect.interrupt;
            if (scenario === "cleanup failure") {
              yield* fs.makeDirectory("blocked");
              yield* fs.chmod(root, 0o000);
            }
          }).pipe(Effect.provideService(FileSystem.FileSystem, observedFileSystem))
        ).pipe(Effect.exit);
        const rootOption = yield* Ref.get(rootRef);
        assertSome(rootOption, O.getOrThrow(rootOption));
        const root = O.getOrThrow(rootOption);
        // Ensure the deliberate permission fault cannot strand this control's
        // root even if the cause assertion fails.
        yield* Effect.gen(function* () {
          expect(process.cwd()).toBe(previousCwd);
          assertSome(yield* Ref.get(removeCwd), previousCwd);
          if (scenario === "body failure") {
            assertExitFailure(exit, Cause.fail("fixture body failure"));
          } else if (scenario === "interruption") {
            assertExitFailure(exit, Cause.interrupt(fiberId));
          } else {
            const errorOption = yield* Ref.get(expectedError);
            const error = O.getOrThrow(errorOption);
            assertSome(errorOption, error);
            assert.instanceOf(error.reason, PlatformError.SystemError);
            assert(exit._tag === "Failure");
            if (scenario === "setup failure") {
              expect(error.reason._tag).toBe("AlreadyExists");
              expect(error.reason.method).toBe("makeDirectory");
              expect(error.reason.pathOrDescriptor).toBe(".git");
              assertExitFailure(exit, Cause.annotate(Cause.fail(error), Cause.annotations(exit.cause)));
            } else {
              expect(error.reason._tag).toBe("PermissionDenied");
              expect(error.reason.method).toBe("remove");
              expect(error.reason.pathOrDescriptor).toBe(root);
              assertExitFailure(exit, Cause.annotate(Cause.die(error), Cause.annotations(exit.cause)));
            }
          }
          if (scenario !== "cleanup failure") expect(yield* fs.exists(root)).toBe(false);
        }).pipe(
          Effect.ensuring(
            scenario === "cleanup failure"
              ? fs.chmod(root, 0o700).pipe(Effect.andThen(fs.remove(root, { recursive: true })), Effect.orDie)
              : Effect.void
          )
        );
        expect(yield* fs.exists(root)).toBe(false);
      })
    );
  }
});
