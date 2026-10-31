import * as NodeURL from "node:url";
import { Jsonc } from "@beep/jsonc/Jsonc";
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
import { checkInstalledSkills } from "@beep/repo-cli/test/SharedInternals";
import { computeSkillTree, installedTargetsHash } from "@beep/repo-cli/test/Skills";
import { findRepoRoot } from "@beep/repo-utils";
import { it } from "@beep/test-runner";
import { A, O, Str } from "@beep/utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe, expect } from "@effect/vitest";
import { assertExitFailure, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Toml from "effect/encoding/Toml";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Tuple from "effect/Tuple";
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

const makeWebHandlerClient = (handler: (request: Request) => Effect.Effect<Response>) =>
  HttpClient.make((request, url) =>
    Effect.try({
      try: () => new Request(url.toString(), { method: request.method, headers: request.headers }),
      catch: (cause) =>
        new HttpClientError.HttpClientError({
          reason: new HttpClientError.TransportError({ request, cause }),
        }),
    }).pipe(
      Effect.flatMap(handler),
      Effect.map((response) => HttpClientResponse.fromWeb(request, response))
    )
  );

const remoteGrillMeSkillWithVersion = Str.replace(
  "---\n\n# Grill Me",
  "version: 1.0\n---\n\n# Grill Me"
)(remoteGrillMeSkill);

const makeSkillsClient = (skillText: string = remoteGrillMeSkill) =>
  makeWebHandlerClient((request) =>
    Effect.sync(() => {
      if (request.url === "https://api.github.com/repos/mattpocock/skills/git/trees/main?recursive=1") {
        return new Response(githubTreeFixture, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (
        request.url === "https://raw.githubusercontent.com/mattpocock/skills/main/skills/productivity/grill-me/SKILL.md"
      ) {
        return new Response(skillText, {
          status: 200,
          headers: { "content-type": "text/markdown" },
        });
      }

      return new Response("missing", { status: 404 });
    })
  );

const makeTraversalSkillsClient = () =>
  makeWebHandlerClient((request) =>
    Effect.sync(() => {
      if (request.url === "https://api.github.com/repos/mattpocock/skills/git/trees/main?recursive=1") {
        return new Response(traversalGithubTreeFixture, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (Str.startsWith("https://raw.githubusercontent.com/mattpocock/skills/main/")(request.url)) {
        return new Response(remoteGrillMeSkill, {
          status: 200,
          headers: { "content-type": "text/markdown" },
        });
      }

      return new Response("missing", { status: 404 });
    })
  );

const temporaryRepository = Effect.gen(function* () {
  const root = yield* temporaryWorkingDirectory;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(root, ".git"), { recursive: true });
  return root;
}).pipe(Effect.withSpan("SkillsCommandTest.temporaryRepository"));

const writeProjectFile = Effect.fn("SkillsCommandTest.writeProjectFile")(function* (
  root: string,
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(root, relativePath);
  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const readProjectFile = Effect.fn("SkillsCommandTest.readProjectFile")(function* (root: string, relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(root, relativePath));
});

describe("skills command", () => {
  it("preserves unknown parent, row, and nested skill fields", () => {
    const native =
      '[skills]\ninclude_instructions = false\nfuture_key = "keep"\n[[skills.config]]\nname = "grill-me"\nenabled = false\nfuture_row = "keep-row"\n[skills.config.future]\nvalue = "keep-nested"\n[skills.future]\nvalue = "keep-table"\n[mcp_servers.native]\nurl = "keep-endpoint"\n';
    const rendered = renderCodexConfigWithSkills(native, ["grill-me", "closeout"]);
    expect(rendered).toContain('future_key = "keep"');
    expect(rendered).toContain('future_row = "keep-row"');
    expect(rendered).toContain('[skills.config.future]\nvalue = "keep-nested"');
    expect(rendered).toContain('[skills.future]\nvalue = "keep-table"');
    expect(rendered).toContain('[mcp_servers.native]\nurl = "keep-endpoint"');
    expect(rendered).toContain('name = "closeout"');
    expect(rendered).toContain('name = "grill-me"\nenabled = true');
  });

  it("retains an undiscovered skill row with native metadata", () => {
    const native =
      '[skills]\ninclude_instructions = true\n[[skills.config]]\nname = "unowned"\nenabled = false\nowner = "native"\n';
    expect(renderCodexConfigWithSkills(native, ["closeout"])).toContain(
      'name = "unowned"\nenabled = false\nowner = "native"'
    );
  });

  it("preserves native registrations after an unrelated table", () => {
    const native =
      '[skills]\ninclude_instructions = true\n[[skills.config]]\nname = "closeout"\nenabled = true\n[mcp_servers.native]\nurl = "native"\n[[skills.config]]\nname = "operator-skill"\nenabled = false\n[[skills.config]]\nname = "native-metadata"\nenabled = false\nowner = "operator"\n';
    const rendered = renderCodexConfigWithSkills(native, ["closeout"]);
    expect(Toml.parse(rendered)).toMatchObject({
      skills: {
        config: [
          { name: "closeout", enabled: true },
          { name: "operator-skill", enabled: false },
          { name: "native-metadata", enabled: false, owner: "operator" },
        ],
      },
    });
    expect(rendered).toContain('name = "operator-skill"\nenabled = false');
    expect(rendered).toContain('name = "native-metadata"\nenabled = false\nowner = "operator"');
  });

  it("does not duplicate a desired native row after another table", () => {
    const native =
      '[skills]\ninclude_instructions = true\n[mcp_servers.native]\nurl = "native"\n[[skills.config]]\nname = "closeout"\nenabled = false\nowner = "operator"\n';
    const rendered = renderCodexConfigWithSkills(native, ["closeout"]);
    expect(Toml.parse(rendered)).toMatchObject({
      skills: { config: [{ name: "closeout", enabled: true, owner: "operator" }] },
    });
    expect(O.getOrNull(Str.match(/name = "closeout"/g)(rendered))).toHaveLength(1);
    expect(renderCodexConfigWithSkills(rendered, ["closeout"])).toBe(rendered);
  });

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
    it.effect("preserves symlinked config, lockfile and remote skill targets with canonical backups", () =>
      Effect.gen(function* () {
        const root = yield* temporaryRepository;
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        yield* writeProjectFile(root, ".codex/config.toml", "[skills]\ninclude_instructions = false\n");
        yield* runSkillsCommand(["update", "--skill", "grill-me"]);
        const originals = [".codex/config.toml", "skills-lock.json"];
        for (const relative of originals) {
          const link = path.join(root, relative);
          const target = path.join(root, "canonical", path.basename(relative));
          yield* fs.makeDirectory(path.dirname(target), { recursive: true });
          yield* fs.rename(link, target);
          const before = Str.replace(
            "include_instructions = true",
            "include_instructions = false"
          )(`\n${yield* fs.readFileString(target)}`);
          yield* fs.writeFileString(target, before);
          yield* fs.chmod(target, 0o644);
          yield* fs.symlink(target, link);
        }
        const skillLink = path.join(root, ".claude/skills/grill-me");
        const skillTarget = path.join(root, "canonical/remote");
        yield* fs.rename(skillLink, skillTarget);
        yield* fs.symlink(skillTarget, skillLink);
        yield* fs.writeFileString(path.join(skillTarget, "SKILL.md"), "old skill\n");
        const beforeConfig = yield* fs.readFileString(path.join(root, ".codex/config.toml"));
        const beforeLock = yield* fs.readFileString(path.join(root, "skills-lock.json"));
        yield* runSkillsCommand(["update", "--skill", "grill-me"]);
        for (const [relative, before] of [
          Tuple.make(".codex/config.toml", beforeConfig),
          Tuple.make("skills-lock.json", beforeLock),
        ]) {
          const link = path.join(root, relative);
          const target = path.join(root, "canonical", path.basename(relative));
          expect(yield* fs.readLink(link)).toBe(target);
          expect(yield* fs.readFileString(target)).not.toBe(before);
          expect((yield* fs.stat(target)).mode & 0o777).toBe(0o644);
          const backupRoot = path.join(root, ".beep/skills-backups");
          const backups = A.filter(yield* fs.readDirectory(backupRoot), (entry) =>
            Str.startsWith(`${path.basename(relative)}.`)(entry)
          );
          const contents = yield* Effect.forEach(backups, (name) => fs.readFileString(path.join(backupRoot, name)));
          expect(contents).toContain(before);
        }
        expect(yield* fs.readLink(skillLink)).toBe(skillTarget);
        expect(yield* fs.readFileString(path.join(skillTarget, "SKILL.md"))).toBe(remoteGrillMeSkill);
      }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
    );

    for (const scenario of ["dangling", "outside root", "dangling parent"]) {
      it.effect(`refuses ${scenario} skill destination links before any mutation`, () =>
        Effect.gen(function* () {
          const root = yield* temporaryRepository;
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* fs.makeDirectory(path.join(root, ".codex"));
          const target = scenario === "outside root" ? yield* fs.makeTempDirectoryScoped() : path.join(root, "absent");
          if (scenario === "outside root") yield* fs.writeFileString(path.join(target, "config.toml"), "[skills]\n");
          if (scenario === "dangling parent") {
            yield* fs.remove(path.join(root, ".codex"), { recursive: true });
            yield* fs.symlink(target, path.join(root, ".codex"));
          } else yield* fs.symlink(path.join(target, "config.toml"), path.join(root, ".codex/config.toml"));
          const result = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") }).pipe(Effect.result);
          expect(result._tag).toBe("Failure");
          expect(yield* fs.exists(path.join(root, ".beep/skills-backups"))).toBe(false);
          expect(yield* fs.exists(path.join(root, ".claude"))).toBe(false);
          if (scenario === "outside root")
            expect(yield* fs.readFileString(path.join(target, "config.toml"))).toBe("[skills]\n");
        }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
      );
    }

    for (const scenario of ["backup and mode", "projection drift", "publish failure", "cleanup failure"]) {
      it.effect(`protects skill projection and remote publication during ${scenario}`, () =>
        Effect.gen(function* () {
          const root = yield* temporaryRepository;
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const config = path.join(root, ".codex/config.toml");
          const skill = path.join(root, ".claude/skills/grill-me/SKILL.md");
          yield* writeProjectFile(root, ".claude/skills/grill-me/SKILL.md", "old skill\n");
          yield* writeProjectFile(root, ".codex/config.toml", "[skills]\ninclude_instructions = false\n");
          yield* fs.chmod(config, 0o644);
          const lockfile = path.join(root, "skills-lock.json");
          yield* fs.remove(lockfile, { force: true }).pipe(Effect.when(Effect.succeed(scenario === "backup and mode")));
          const wrapped = FileSystem.FileSystem.of({
            ...fs,
            writeFileString: Effect.fn("SkillsTest.writeFileString")((target, content, options) =>
              fs
                .writeFileString(target, content, options)
                .pipe(
                  Effect.andThen(
                    scenario === "projection drift" && Str.startsWith(`${config}.tmp-`)(target)
                      ? fs.writeFileString(config, "[skills]\ninclude_instructions = false\nnew_native_key = true\n")
                      : Effect.void
                  )
                )
            ),
            rename: Effect.fn("SkillsTest.rename")((from, to) =>
              scenario === "publish failure" && Str.includes(".grill-me.stage-")(from)
                ? fs.rename(path.join(root, "missing-stage"), to)
                : fs.rename(from, to)
            ),
          });
          const observed = FileSystem.FileSystem.of({
            ...wrapped,
            remove: Effect.fn("SkillsTest.remove")((target, options) =>
              scenario === "cleanup failure" && Str.endsWith(".previous")(target)
                ? fs.remove(path.join(root, "missing-cleanup"))
                : fs.remove(target, options)
            ),
          });
          const result = yield* runSkillsCommand(["update", "--skill", "grill-me"]).pipe(
            Effect.provideService(FileSystem.FileSystem, observed),
            Effect.result
          );
          const backupRoot = path.join(root, ".beep/skills-backups");
          const entries = yield* fs.readDirectory(backupRoot);
          const skillBackup = O.getOrThrow(A.findFirst(entries, (entry) => Str.startsWith("grill-me.")(entry)));
          expect(yield* fs.readFileString(path.join(backupRoot, skillBackup, "SKILL.md"))).toBe("old skill\n");
          if (scenario === "backup and mode" || scenario === "cleanup failure") {
            expect(result).toMatchObject({ _tag: "Success" });
            expect(yield* fs.readFileString(skill)).toBe(remoteGrillMeSkill);
            expect((yield* fs.stat(config)).mode & 0o777).toBe(0o644);
            expect((yield* fs.stat(lockfile)).mode & 0o777).toBe(0o644);
            const configBackup = O.getOrThrow(A.findFirst(entries, (entry) => Str.startsWith("config.toml.")(entry)));
            expect(yield* fs.readFileString(path.join(backupRoot, configBackup))).toBe(
              "[skills]\ninclude_instructions = false\n"
            );
          } else {
            expect(result._tag).toBe("Failure");
            if (scenario === "projection drift")
              expect(yield* fs.readFileString(config)).toContain("new_native_key = true");
            else expect(yield* fs.readFileString(skill)).toBe("old skill\n");
          }
        }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
      );
    }

    it.effect("updates a selected remote skill, lockfile, Codex config, and agents mirror", () =>
      Effect.gen(function* () {
        const root = yield* temporaryRepository;
        yield* writeProjectFile(root, ".claude/skills/grill-me/SKILL.md", "old skill\n");
        yield* writeProjectFile(
          root,
          ".claude/skills/local-only/SKILL.md",
          "---\nname: local-only\ndescription: Local test skill.\n---\n\n# Local\n"
        );
        yield* writeProjectFile(
          root,
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

        const updatedSkill = yield* readProjectFile(root, ".claude/skills/grill-me/SKILL.md");
        const lockFile = yield* readProjectFile(root, "skills-lock.json");
        const codexConfig = yield* readProjectFile(root, ".codex/config.toml");
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
        const root = yield* temporaryRepository;
        yield* writeProjectFile(root, ".claude/skills/grill-me/SKILL.md", remoteGrillMeSkill);
        yield* writeProjectFile(
          root,
          ".claude/skills/local-only/SKILL.md",
          "---\nname: local-only\ndescription: Local test skill.\nversion: 0.1.0\n---\n\n# Local\n"
        );
        yield* writeProjectFile(
          root,
          ".claude/skills/misnamed/SKILL.md",
          "---\nname: other-name\ndescription: Misnamed test skill.\n---\n\n# Misnamed\n"
        );
        yield* writeProjectFile(
          root,
          ".claude/skills/json-fenced/SKILL.md",
          '---json\n{"name":"json-fenced","description":"JSON-fenced test skill."}\n---\n\n# JSON\n'
        );
        yield* writeProjectFile(
          root,
          ".claude/skills/long-one/SKILL.md",
          `---\nname: long-one\ndescription: Long test skill.\n---\n${Str.repeat(600)("line\n")}`
        );
        yield* writeProjectFile(root, ".codex/config.toml", "[skills]\n  include_instructions = true\n");

        const error = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") }).pipe(Effect.flip);
        const logs = A.filter(yield* TestConsole.logLines, P.isString);

        expect(error._tag).toBe("SkillFrontmatterError");
        assert(error._tag === "SkillFrontmatterError");
        expect(A.map(error.issues, (issue) => issue.skill)).toEqual(["json-fenced", "local-only", "misnamed"]);
        expect(logs).toContain("skills:update: frontmatter issues (3)");
        expect(logs).toContain(
          "- json-fenced: SKILL.md frontmatter is json; the Agent Skills format requires a YAML block."
        );
        expect(A.some(logs, (line) => Str.startsWith("- local-only:")(line) && Str.includes("version")(line))).toBe(
          true
        );
        expect(A.some(logs, (line) => Str.startsWith("- misnamed:")(line) && Str.includes("other-name")(line))).toBe(
          true
        );
        expect(A.some(logs, (line) => Str.includes("advisory long-one/SKILL.md has 604 lines")(line))).toBe(true);
      }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
    );
  });

  it.layer(CommandTestLayer, { timeout: "30 seconds" })((it) => {
    it.effect("reports a non-spec key on an upstream mirror as an advisory instead of failing", () =>
      Effect.gen(function* () {
        const root = yield* temporaryRepository;
        yield* writeProjectFile(root, ".claude/skills/grill-me/SKILL.md", "old skill\n");
        yield* writeProjectFile(root, ".codex/config.toml", "[skills]\n  include_instructions = true\n");

        const drift = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });
        const logs = A.filter(yield* TestConsole.logLines, P.isString);

        expect(A.some(drift, (entry) => entry._tag === "RemoteSkillDrift")).toBe(true);
        expect(yield* readProjectFile(root, ".claude/skills/grill-me/SKILL.md")).toBe(remoteGrillMeSkillWithVersion);
        expect(
          A.some(
            logs,
            (line) =>
              Str.startsWith("skills:update: advisory upstream skill grill-me:")(line) && Str.includes("version")(line)
          )
        ).toBe(true);
        expect(A.some(logs, (line) => Str.startsWith("skills:update: frontmatter issues")(line))).toBe(false);
      }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient(remoteGrillMeSkillWithVersion)))
    );
  });

  it.layer(CommandTestLayer, { timeout: "30 seconds" })((it) => {
    it.effect("rejects traversal paths from remote GitHub trees", () =>
      Effect.gen(function* () {
        const root = yield* temporaryRepository;
        yield* writeProjectFile(root, ".codex/config.toml", "[skills]\n  include_instructions = true\n");

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
const oracleLockFixture = NodeURL.fileURLToPath(
  new URL("./fixtures/skills-provenance/oracle-lock-v2.json", import.meta.url)
);

it.layer(CommandTestLayer, { timeout: "30 seconds" })("skills update over a v2 lock", (it) => {
  it.effect("refuses to refetch a vendored entry at its floating ref", () =>
    Effect.gen(function* () {
      const root = yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      const fixture = yield* decodeSkillsLockDocumentJson(yield* fs.readFileString(oracleLockFixture));
      const vendored = fixture.skills.oracle;
      assert(vendored !== undefined);
      // grill-me is a known floating remote source; here the lock already vendors it.
      const lock = SkillsLockDocument.make({ version: 2, skills: { "grill-me": vendored } });
      yield* writeProjectFile(root, "skills-lock.json", `${yield* encodeSkillsLockDocumentJson(lock)}\n`);
      yield* writeProjectFile(root, ".claude/skills/grill-me/SKILL.md", "vendored skill\n");

      const error = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") }).pipe(Effect.flip);

      expect(error._tag).toBe("SkillVendoredRefetchError");
      expect(error.message).toContain("never refetches it at its floating ref main");
      expect(error.message).toContain("pinned bump");
      expect(yield* readProjectFile(root, ".claude/skills/grill-me/SKILL.md")).toBe("vendored skill\n");
    }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
  );

  it.effect("treats a reformatted but JSON-equal lock as no drift and leaves its bytes alone", () =>
    Effect.gen(function* () {
      const root = yield* temporaryRepository;
      yield* writeProjectFile(root, ".codex/config.toml", "[skills]\n  include_instructions = true\n");
      yield* writeProjectFile(root, "skills-lock.json", `${yield* encodeSkillsLockDocumentJson(emptyLockV2)}\n`);
      // The repo mirrors `.agents/skills` as a symlink onto `.claude/skills`.
      const fs = yield* FileSystem.FileSystem;
      yield* fs.makeDirectory(`${root}/.agents`, { recursive: true });
      yield* fs.symlink("../.claude/skills", `${root}/.agents/skills`);
      yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });
      const canonical = yield* decodeSkillsLockDocumentJson(yield* readProjectFile(root, "skills-lock.json"));
      // Same document, different bytes: compact JSON instead of the writer's two-space form.
      const reformatted = yield* encodeSkillsLockDocumentJson(canonical);
      expect(reformatted).not.toBe(yield* readProjectFile(root, "skills-lock.json"));
      yield* writeProjectFile(root, "skills-lock.json", reformatted);

      const checked = yield* runSkillsUpdate({ mode: "check", skill: O.some("grill-me") });
      yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") });

      expect(A.some(checked, (entry) => entry._tag === "LockDrift")).toBe(false);
      expect(yield* readProjectFile(root, "skills-lock.json")).toBe(reformatted);
    }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
  );

  it.effect("fails closed on a lock that is neither a valid v2 nor a v1 lock", () =>
    Effect.gen(function* () {
      const root = yield* temporaryRepository;
      // A broken v2 lock must not read as "no lock", which would bypass the vendored refusal.
      yield* writeProjectFile(
        root,
        "skills-lock.json",
        `{"version": 2, "skills": {"grill-me": {"_tag": "vendored"}}}\n`
      );
      yield* writeProjectFile(root, ".claude/skills/grill-me/SKILL.md", "vendored skill\n");

      const error = yield* runSkillsUpdate({ mode: "write", skill: O.some("grill-me") }).pipe(Effect.flip);

      expect(error._tag).toBe("SkillsCommandError");
      expect(error.message).toContain("neither a valid v2 lock nor a v1 lock");
      expect(yield* readProjectFile(root, ".claude/skills/grill-me/SKILL.md")).toBe("vendored skill\n");
    }).pipe(Effect.provideService(HttpClient.HttpClient, makeSkillsClient()))
  );

  it.effect("reports hand-edited vendored output and names both remedies", () =>
    Effect.gen(function* () {
      const root = yield* temporaryRepository;
      const fs = yield* FileSystem.FileSystem;
      yield* writeProjectFile(root, ".codex/config.toml", "[skills]\n  include_instructions = true\n");
      yield* fs.makeDirectory(`${root}/.agents`, { recursive: true });
      yield* fs.symlink("../.claude/skills", `${root}/.agents/skills`);
      yield* writeProjectFile(root, ".claude/skills/demo/SKILL.md", "---\nname: demo\ndescription: Demo.\n---\n");
      const tree = yield* computeSkillTree(
        [
          SkillUpstreamContentFile.make({
            path: "SKILL.md",
            mode: "100644",
            bytes: new TextEncoder().encode(yield* readProjectFile(root, ".claude/skills/demo/SKILL.md")),
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
      yield* writeProjectFile(root, "skills-lock.json", `${yield* encodeSkillsLockDocumentJson(lock)}\n`);
      const vendoredDrift = (drift: ReadonlyArray<{ readonly _tag: string }>) =>
        A.filter(drift, (entry) => entry._tag === "HandEditedVendoredOutput");

      // The untouched install is not hand-edited output.
      expect(vendoredDrift(yield* runSkillsUpdate({ mode: "dry-run", skill: O.some("grill-me") }))).toEqual([]);

      yield* writeProjectFile(
        root,
        ".claude/skills/demo/SKILL.md",
        "---\nname: demo\ndescription: Edited by hand.\n---\n"
      );
      const error = yield* runSkillsUpdate({ mode: "check", skill: O.some("grill-me") }).pipe(Effect.flip);

      expect(error._tag).toBe("SkillsDriftError");
      const line = A.findFirst(A.filter(yield* TestConsole.logLines, P.isString), Str.startsWith("- hand-edited"));
      assertSome(
        line,
        "- hand-edited-vendored-output: demo no longer matches its effective tree; revert it with beep skills materialize --skill demo, or keep it as a patch with beep skills patch add --skill demo (plan, then --expect <planDigest>)"
      );
      expect(yield* readProjectFile(root, ".claude/skills/demo/SKILL.md")).toContain("Edited by hand.");
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
      const biome = yield* Jsonc.bind(BiomeFileIncludes).decode(
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

it.layer(NodeServices.layer, { timeout: "30 seconds" })("installed skill frontmatter check", (it) => {
  it.effect("reads the YAML block through the @beep/markdown codec and names engine diagnostics", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-skill-frontmatter-" });
      const skills: ReadonlyArray<readonly [string, string]> = [
        ["valid", "---\nname: valid\ndescription: A valid skill.\n---\n\n# Valid\n"],
        ["broken", "---\nname: [broken\n---\n\n# Broken\n"],
        ["doubled", "---\nname: doubled\ndescription: Doubled.\nname: doubled\n---\n"],
        ["toml", '+++\nname = "toml"\n+++\n'],
        ["unclosed", "---\nname: unclosed\ndescription: Unclosed.\n"],
      ];
      for (const [name, content] of skills) {
        yield* fs.makeDirectory(path.join(root, name), { recursive: true });
        yield* fs.writeFileString(path.join(root, name, "SKILL.md"), content);
      }
      const report = yield* checkInstalledSkills(
        root,
        A.map(skills, ([name]) => name),
        HashSet.empty()
      );
      expect(A.map(report.issues, (issue) => [issue.skill, issue.message])).toEqual([
        ["broken", "Invalid YAML frontmatter (YAML parse failed with 1 error: MalformedFlowCollection at 1:7)."],
        ["doubled", "Invalid YAML frontmatter (YAML parse failed with 1 error: DuplicateKey at 3:1)."],
        ["toml", "SKILL.md frontmatter is toml; the Agent Skills format requires a YAML block."],
        ["unclosed", "SKILL.md has no YAML frontmatter block."],
      ]);
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
            if (scenario === "setup failure" && directory === `${O.getOrThrow(yield* Ref.get(rootRef))}/.git`) {
              yield* fs.writeFileString(directory, "setup obstruction");
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
        const exit = yield* Effect.scopedWith((scope) =>
          Effect.gen(function* () {
            const root = yield* temporaryRepository;
            if (scenario === "body failure") return yield* Effect.fail("fixture body failure");
            if (scenario === "interruption") return yield* Effect.interrupt;
            if (scenario === "cleanup failure") {
              yield* fs.makeDirectory(`${root}/blocked`);
              yield* fs.chmod(root, 0o000);
            }
          }).pipe(Scope.provide(scope), Effect.provideService(FileSystem.FileSystem, observedFileSystem))
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
              expect(error.reason.pathOrDescriptor).toBe(`${root}/.git`);
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

it.layer(CommandTestLayer, { timeout: "30 seconds" })("skills command boundary reports", (it) => {
  it.effect(
    "renders an empty replay in both formats and refuses an unknown skill without changing the lock",
    Effect.fnUntraced(
      function* () {
        const root = yield* temporaryRepository;
        const lock = yield* encodeSkillsLockDocumentJson(emptyLockV2);
        yield* writeProjectFile(root, "skills-lock.json", lock);
        yield* runSkillsCommand(["replay", "--json", "--markdown", "replay.md"]);
        expect(yield* TestConsole.logLines).toEqual(
          expect.arrayContaining([expect.stringContaining("skills-replay/v1")])
        );
        expect(yield* readProjectFile(root, "replay.md")).toContain("<!-- beep-skills-replay -->");
        yield* runSkillsCommand(["replay"]);
        const refused = yield* Effect.exit(runSkillsCommand(["replay", "--skill", "not-registered"]));
        refused.pipe(Exit.isFailure, assertTrue);
        expect(yield* TestConsole.errorLines).toEqual(
          expect.arrayContaining([expect.stringContaining("skills:replay:")])
        );
        expect(yield* readProjectFile(root, "skills-lock.json")).toBe(lock);
      },
      Effect.provideService(HttpClient.HttpClient, makeSkillsClient())
    )
  );

  it.effect(
    "reports an unknown relock entry and leaves the lock unchanged",
    Effect.fnUntraced(
      function* () {
        const root = yield* temporaryRepository;
        const lock = yield* encodeSkillsLockDocumentJson(emptyLockV2);
        yield* writeProjectFile(root, "skills-lock.json", lock);
        const refused = yield* Effect.exit(runSkillsCommand(["relock", "--skill", "not-registered", "--json"]));
        refused.pipe(Exit.isFailure, assertTrue);
        expect(yield* TestConsole.errorLines).toEqual(
          expect.arrayContaining([expect.stringContaining("skills:relock:")])
        );
        expect(yield* readProjectFile(root, "skills-lock.json")).toBe(lock);
      },
      Effect.provideService(HttpClient.HttpClient, makeSkillsClient())
    )
  );

  it.effect(
    "writes an empty train issue and preserves that output when pull-request input is malformed",
    Effect.fnUntraced(
      function* () {
        const root = yield* temporaryRepository;
        yield* writeProjectFile(root, "prs.json", "[]");
        const args = ["train-issue", "--batch", "2026-W42", "--prs", "prs.json", "--body-out", "issue.md"];
        yield* runSkillsCommand(args);
        expect(yield* TestConsole.logLines).toEqual(expect.arrayContaining([expect.stringContaining("2026-W42")]));
        const body = yield* readProjectFile(root, "issue.md");
        expect(body).toContain("_No open skill update pull requests");
        yield* writeProjectFile(root, "prs.json", "not-json");
        const refused = yield* Effect.exit(runSkillsCommand(args));
        refused.pipe(Exit.isFailure, assertTrue);
        expect(yield* TestConsole.errorLines).toEqual(
          expect.arrayContaining([expect.stringContaining("skills:train-issue:")])
        );
        expect(yield* readProjectFile(root, "issue.md")).toBe(body);
      },
      Effect.provideService(HttpClient.HttpClient, makeSkillsClient())
    )
  );

  it.effect(
    "reports materialization refusal for a legacy lock without changing it",
    Effect.fnUntraced(
      function* () {
        const root = yield* temporaryRepository;
        const lock = '{"version":1,"skills":{}}\n';
        yield* writeProjectFile(root, "skills-lock.json", lock);

        const refused = yield* runSkillsCommand(["materialize", "--check"]).pipe(Effect.exit);
        refused.pipe(Exit.isFailure, assertTrue);
        const errors = yield* TestConsole.errorLines;
        expect(errors).toEqual(
          expect.arrayContaining([
            expect.stringContaining("skills:materialize: skills-lock.json is not a skills-lock/v2 document."),
          ])
        );
        expect(yield* readProjectFile(root, "skills-lock.json")).toBe(lock);
      },
      Effect.provideService(HttpClient.HttpClient, makeSkillsClient())
    )
  );

  it.effect(
    "reports an unknown remote update refusal and preserves the existing lock",
    Effect.fnUntraced(
      function* () {
        const root = yield* temporaryRepository;
        const lock = '{"version":1,"skills":{}}\n';
        yield* writeProjectFile(root, "skills-lock.json", lock);

        const refused = yield* runSkillsCommand(["update", "--skill", "not-registered"]).pipe(Effect.exit);
        refused.pipe(Exit.isFailure, assertTrue);
        const errors = yield* TestConsole.errorLines;
        expect(errors).toEqual(
          expect.arrayContaining([expect.stringContaining("skills:update: Unknown remote-backed skill")])
        );
        expect(yield* readProjectFile(root, "skills-lock.json")).toBe(lock);
      },
      Effect.provideService(HttpClient.HttpClient, makeSkillsClient())
    )
  );

  it.effect(
    "renders both report formats without changing the lock and reports malformed input",
    Effect.fnUntraced(
      function* () {
        const root = yield* temporaryRepository;
        const lock =
          '{"version":1,"skills":{"local-only":{"source":"beep-effect/beep-effect","sourceType":"local","computedHash":"0000000000000000000000000000000000000000000000000000000000000000"}}}';
        yield* writeProjectFile(root, "skills-lock.json", lock);
        yield* writeProjectFile(root, ".claude/skills/local-only/SKILL.md", "# Local-only fixture\n");
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`${root}/.agents`, { recursive: true });
        yield* fs.symlink("../.claude/skills", `${root}/.agents/skills`);
        yield* runSkillsCommand(["lock-plan"]);
        const human = yield* TestConsole.logLines;
        expect(human).toEqual(expect.arrayContaining([expect.stringContaining("1 local")]));
        yield* runSkillsCommand(["lock-plan", "--json"]);
        const lines = yield* TestConsole.logLines;
        expect(lines).toEqual(expect.arrayContaining([expect.stringContaining("skills-lock-migration-plan/v3")]));
        expect(yield* readProjectFile(root, "skills-lock.json")).toBe(lock);
        yield* writeProjectFile(root, "skills-lock.json", "not-json");
        const refused = yield* Effect.exit(runSkillsCommand(["lock-plan"]));
        refused.pipe(Exit.isFailure, assertTrue);
        const errors = yield* TestConsole.errorLines;
        expect(errors).toEqual(expect.arrayContaining([expect.stringContaining("skills:lock-plan:")]));
      },
      Effect.provideService(HttpClient.HttpClient, makeSkillsClient())
    )
  );
});
