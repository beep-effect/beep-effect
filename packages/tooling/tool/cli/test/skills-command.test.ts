import {
  decodeSkillsLockDocumentJson,
  encodeSkillsLockDocumentJson,
  renderCodexConfigWithSkills,
  runSkillsUpdate,
  SkillEffective,
  SkillsLockDocument,
  SkillUpstreamContentFile,
  skillsCommand,
  VendoredSkillLockEntry,
} from "@beep/repo-cli/commands/Skills";
import { computeSkillTree, installedTargetsHash } from "@beep/repo-cli/test/Skills";
import { findRepoRoot } from "@beep/repo-utils";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { it } from "@beep/test-runner";
import { A, O, Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe, expect } from "@effect/vitest";
import { assertExitFailure, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/http";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
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

const remoteGrillMeSkillWithVersion = remoteGrillMeSkill.replace(
  "---\n\n# Grill Me",
  "version: 1.0\n---\n\n# Grill Me"
);

const makeSkillsClient = (skillText: string = remoteGrillMeSkill) =>
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
          return new Response(skillText, {
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
    it.effect("fails on frontmatter outside the Agent Skills format and advises on oversized skill files", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeProjectFile(".claude/skills/grill-me/SKILL.md", remoteGrillMeSkill);
        yield* writeProjectFile(
          ".claude/skills/local-only/SKILL.md",
          "---\nname: local-only\ndescription: Local test skill.\nversion: 0.1.0\n---\n\n# Local\n"
        );
        yield* writeProjectFile(
          ".claude/skills/misnamed/SKILL.md",
          "---\nname: other-name\ndescription: Misnamed test skill.\n---\n\n# Misnamed\n"
        );
        yield* writeProjectFile(
          ".claude/skills/long-one/SKILL.md",
          `---\nname: long-one\ndescription: Long test skill.\n---\n${"line\n".repeat(600)}`
        );
        yield* writeProjectFile(".codex/config.toml", "[skills]\n  include_instructions = true\n");

        const error = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") }).pipe(Effect.flip);
        const logs = A.filter(yield* TestConsole.logLines, P.isString);

        expect(error._tag).toBe("SkillFrontmatterError");
        assert(error._tag === "SkillFrontmatterError");
        expect(A.map(error.issues, (issue) => issue.skill)).toEqual(["local-only", "misnamed"]);
        expect(logs).toContain("skills:update: frontmatter issues (2)");
        expect(A.some(logs, (line) => line.startsWith("- local-only:") && line.includes("version"))).toBe(true);
        expect(A.some(logs, (line) => line.startsWith("- misnamed:") && line.includes("other-name"))).toBe(true);
        expect(A.some(logs, (line) => line.includes("advisory long-one/SKILL.md has 604 lines"))).toBe(true);
      }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
    );
  });

  it.layer(CommandTestLayer, { timeout: "30 seconds" })((it) => {
    it.effect("reports a non-spec key on an upstream mirror as an advisory instead of failing", () =>
      Effect.gen(function* () {
        yield* temporaryRepository;
        yield* writeProjectFile(".claude/skills/grill-me/SKILL.md", "old skill\n");
        yield* writeProjectFile(".codex/config.toml", "[skills]\n  include_instructions = true\n");

        const drift = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });
        const logs = A.filter(yield* TestConsole.logLines, P.isString);

        expect(A.some(drift, (entry) => entry._tag === "RemoteSkillDrift")).toBe(true);
        expect(yield* readProjectFile(".claude/skills/grill-me/SKILL.md")).toBe(remoteGrillMeSkillWithVersion);
        expect(
          A.some(
            logs,
            (line) => line.startsWith("skills:update: advisory upstream skill grill-me:") && line.includes("version")
          )
        ).toBe(true);
        expect(A.some(logs, (line) => line.startsWith("skills:update: frontmatter issues"))).toBe(false);
      }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient(remoteGrillMeSkillWithVersion)))
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

const emptyLockV2 = SkillsLockDocument.make({ version: 2, skills: {} });
const oracleLockFixture = new URL("./fixtures/skills-provenance/oracle-lock-v2.json", import.meta.url).pathname;

it.layer(CommandTestLayer, { timeout: "30 seconds" })("skills update over a v2 lock", (it) => {
  it.effect("refuses to refetch a vendored entry at its floating ref", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const fixture = yield* decodeSkillsLockDocumentJson(yield* fs.readFileString(oracleLockFixture));
      const vendored = fixture.skills.oracle;
      assert(vendored !== undefined);
      // grill-me is a known floating remote source; here the lock already vendors it.
      const lock = SkillsLockDocument.make({ version: 2, skills: { "grill-me": vendored } });
      yield* writeProjectFile("skills-lock.json", `${yield* encodeSkillsLockDocumentJson(lock)}\n`);
      yield* writeProjectFile(".claude/skills/grill-me/SKILL.md", "vendored skill\n");

      const error = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") }).pipe(Effect.flip);

      expect(error._tag).toBe("SkillVendoredRefetchError");
      expect(error.message).toContain("never refetches it at its floating ref main");
      expect(error.message).toContain("pinned bump");
      expect(yield* readProjectFile(".claude/skills/grill-me/SKILL.md")).toBe("vendored skill\n");
    }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
  );

  it.effect("treats a reformatted but JSON-equal lock as no drift and leaves its bytes alone", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      yield* writeProjectFile(".codex/config.toml", "[skills]\n  include_instructions = true\n");
      yield* writeProjectFile("skills-lock.json", `${yield* encodeSkillsLockDocumentJson(emptyLockV2)}\n`);
      // The repo mirrors `.agents/skills` as a symlink onto `.claude/skills`.
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(".agents", { recursive: true });
      yield* fs.symlink("../.claude/skills", ".agents/skills");
      yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });
      const canonical = yield* decodeSkillsLockDocumentJson(yield* readProjectFile("skills-lock.json"));
      // Same document, different bytes: compact JSON instead of the writer's two-space form.
      const reformatted = yield* encodeSkillsLockDocumentJson(canonical);
      expect(reformatted).not.toBe(yield* readProjectFile("skills-lock.json"));
      yield* writeProjectFile("skills-lock.json", reformatted);

      const checked = yield* runSkillsUpdate({ mode: "check", skill: O.some("grill-me") });
      yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });

      expect(A.some(checked, (entry) => entry._tag === "LockDrift")).toBe(false);
      expect(yield* readProjectFile("skills-lock.json")).toBe(reformatted);
    }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
  );

  it.effect("fails closed on a lock that is neither a valid v2 nor a v1 lock", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      // A broken v2 lock must not read as "no lock", which would bypass the vendored refusal.
      yield* writeProjectFile("skills-lock.json", `{"version": 2, "skills": {"grill-me": {"_tag": "vendored"}}}\n`);
      yield* writeProjectFile(".claude/skills/grill-me/SKILL.md", "vendored skill\n");

      const error = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") }).pipe(Effect.flip);

      expect(error._tag).toBe("SkillsCommandError");
      expect(error.message).toContain("neither a valid v2 lock nor a v1 lock");
      expect(yield* readProjectFile(".claude/skills/grill-me/SKILL.md")).toBe("vendored skill\n");
    }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
  );

  it.effect("reports hand-edited vendored output and names both remedies", () =>
    Effect.gen(function* () {
      yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      yield* writeProjectFile(".codex/config.toml", "[skills]\n  include_instructions = true\n");
      yield* fs.makeDirectory(".agents", { recursive: true });
      yield* fs.symlink("../.claude/skills", ".agents/skills");
      yield* writeProjectFile(".claude/skills/demo/SKILL.md", "---\nname: demo\ndescription: Demo.\n---\n");
      const tree = yield* computeSkillTree(
        [
          SkillUpstreamContentFile.make({
            path: "SKILL.md",
            mode: "100644",
            bytes: new TextEncoder().encode(yield* readProjectFile(".claude/skills/demo/SKILL.md")),
          }),
        ],
        "demo"
      );
      const fixture = yield* decodeSkillsLockDocumentJson(yield* fs.readFileString(oracleLockFixture));
      const base = fixture.skills.oracle;
      assert(base !== undefined && base._tag === "vendored");
      const targets = [".claude/skills/demo", ".agents/skills/demo"];
      const demo = VendoredSkillLockEntry.make({
        ...base,
        effective: SkillEffective.make({
          treeHash: tree.treeHash,
          installedTargets: targets,
          installedTreeHash: yield* installedTargetsHash(
            A.map(targets, (target) => [target, tree.treeHash] as const),
            "demo"
          ),
        }),
      });
      const lock = SkillsLockDocument.make({ version: 2, skills: { demo } });
      yield* writeProjectFile("skills-lock.json", `${yield* encodeSkillsLockDocumentJson(lock)}\n`);
      const vendoredDrift = (drift: ReadonlyArray<{ readonly _tag: string }>) =>
        A.filter(drift, (entry) => entry._tag === "HandEditedVendoredOutput");

      // The untouched install is not hand-edited output.
      expect(vendoredDrift(yield* runSkillsUpdate({ mode: "dry-run", skill: O.some("grill-me") }))).toEqual([]);

      yield* writeProjectFile(".claude/skills/demo/SKILL.md", "---\nname: demo\ndescription: Edited by hand.\n---\n");
      const error = yield* runSkillsUpdate({ mode: "check", skill: O.some("grill-me") }).pipe(Effect.flip);

      expect(error._tag).toBe("SkillsDriftError");
      const line = A.findFirst(A.filter(yield* TestConsole.logLines, P.isString), Str.startsWith("- hand-edited"));
      assertSome(
        line,
        "- hand-edited-vendored-output: demo no longer matches its effective tree; revert it with beep skills materialize --skill demo, or keep it as a patch under .agents/skill-patches/demo and re-record the lock with beep skills lock-plan (beep skills patch add is not available yet)"
      );
      expect(yield* readProjectFile(".claude/skills/demo/SKILL.md")).toContain("Edited by hand.");
    }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
  );
});

const BiomeFileIncludes = S.Struct({ files: S.Struct({ includes: S.Array(S.String) }) });

// A target is excluded when it, or a directory above it, appears as a negated include.
const excludedByBiome = (includes: ReadonlyArray<string>) => (target: string) => {
  const segments = Str.split("/")(target);
  return A.some(A.range(1, segments.length), (depth) =>
    A.contains(includes, `!${A.join(A.take(segments, depth), "/")}`)
  );
};

it.layer(NodeServices.layer, { timeout: "30 seconds" })("vendored skill trees in this repository", (it) => {
  it.effect("keeps every vendored install target out of biome so it stays byte-exact upstream", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const lock = yield* decodeSkillsLockDocumentJson(
        yield* fs.readFileString(path.join(repoRoot, "skills-lock.json"))
      );
      const biome = yield* decodeJsoncTextAs(BiomeFileIncludes)(
        yield* fs.readFileString(path.join(repoRoot, "biome.jsonc"))
      );
      const vendoredTargets = A.flatMap(R.values(lock.skills), (entry) =>
        entry._tag === "vendored" ? entry.effective.installedTargets : A.empty<string>()
      );

      expect(A.isArrayNonEmpty(vendoredTargets)).toBe(true);
      expect(A.filter(vendoredTargets, (target) => !excludedByBiome(biome.files.includes)(target))).toEqual([]);
    })
  );
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

it.layer(CommandTestLayer)("read-only skills lock-plan command", (it) => {
  it.effect(
    "renders both report formats without changing the lock and reports malformed input",
    Effect.fnUntraced(
      function* () {
        yield* temporaryRepository;
        const lock =
          '{"version":1,"skills":{"local-only":{"source":"beep-effect/beep-effect","sourceType":"local","computedHash":"0000000000000000000000000000000000000000000000000000000000000000"}}}';
        yield* writeProjectFile("skills-lock.json", lock);
        yield* writeProjectFile(".claude/skills/local-only/SKILL.md", "# Local-only fixture\n");
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(".agents", { recursive: true });
        yield* fs.symlink("../.claude/skills", ".agents/skills");
        yield* runSkillsCommand(["lock-plan"]);
        const human = yield* TestConsole.logLines;
        expect(human).toEqual(expect.arrayContaining([expect.stringContaining("1 local")]));
        yield* runSkillsCommand(["lock-plan", "--json"]);
        const lines = yield* TestConsole.logLines;
        expect(lines).toEqual(expect.arrayContaining([expect.stringContaining("skills-lock-migration-plan/v3")]));
        expect(yield* readProjectFile("skills-lock.json")).toBe(lock);
        yield* writeProjectFile("skills-lock.json", "not-json");
        const refused = yield* Effect.exit(runSkillsCommand(["lock-plan"]));
        expect(Exit.isFailure(refused)).toBe(true);
        const errors = yield* TestConsole.errorLines;
        expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("skills:lock-plan:")]));
      },
      Effect.provideService(HttpClient.HttpClient, makeSkillsClient())
    )
  );
});
