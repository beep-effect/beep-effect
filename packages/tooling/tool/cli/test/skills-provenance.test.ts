import { pathToFileURL } from "node:url";
import {
  decodeSkillEffective,
  decodeSkillLicense,
  decodeSkillLockV2Entry,
  decodeSkillPatch,
  decodeSkillPatches,
  decodeSkillProvenance,
  decodeSkillSnapshot,
  decodeSkillSnapshotFile,
  decodeSkillsLockV2,
  decodeSkillsLockV2Json,
  decodeSkillUpstream,
  encodeSkillEffective,
  encodeSkillLicense,
  encodeSkillLockV2Entry,
  encodeSkillPatch,
  encodeSkillPatches,
  encodeSkillProvenance,
  encodeSkillSnapshot,
  encodeSkillSnapshotFile,
  encodeSkillsLockV2,
  encodeSkillsLockV2Json,
  encodeSkillUpstream,
  resolveSkillProvenance,
  SkillUpstreamContent,
  SkillUpstreamContentFile,
  SkillUpstreamContentSource,
} from "@beep/repo-cli/commands/Skills";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { Sha256HexFromBytes } from "@beep/schema";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, Encoding, Exit, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const fixtureRoot = new URL("./fixtures/skills-provenance", import.meta.url).pathname;
const textEncoder = new TextEncoder();
const emptyDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const hashBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const encodeUnknownJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const readFixtureText = Effect.fn("SkillsProvenanceTest.readFixtureText")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(fixtureRoot, relativePath));
});

const readFixtureBinary = Effect.fn("SkillsProvenanceTest.readFixtureBinary")(function* (relativePath: string) {
  const encoded = Str.trim(yield* readFixtureText(relativePath));
  return yield* Effect.fromResult(Encoding.decodeHex(encoded));
});

const writeFixtureFile = Effect.fn("SkillsProvenanceTest.writeFixtureFile")(function* (
  repoRoot: string,
  relativePath: string,
  bytes: Uint8Array
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(repoRoot, relativePath);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFile(target, Uint8Array.from(bytes));
});

const linkAgentsTarget = Effect.fn("SkillsProvenanceTest.linkAgentsTarget")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(repoRoot, ".agents"), { recursive: true });
  yield* fs.symlink("../.claude/skills", path.join(repoRoot, ".agents/skills"));
});

const makeStubSource = Effect.fn("SkillsProvenanceTest.makeStubSource")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>
) {
  const licenseBytes = textEncoder.encode(yield* readFixtureText("shadcn/LICENSE.md"));

  return SkillUpstreamContentSource.of({
    load: Effect.fn("SkillsProvenanceTest.stubSource.load")(() =>
      Effect.succeed(SkillUpstreamContent.make({ files, licenseBytes }))
    ),
  });
});

const makeFixtureSource = Effect.fn("SkillsProvenanceTest.makeFixtureSource")(function* () {
  const skillText = yield* readFixtureText("shadcn/upstream/SKILL.md");
  const compositionText = yield* readFixtureText("shadcn/upstream/rules/composition.md");
  const pngBytes = yield* readFixtureBinary("shadcn/upstream/assets/example.png.hex");
  const licenseBytes = textEncoder.encode(yield* readFixtureText("shadcn/LICENSE.md"));

  return SkillUpstreamContentSource.of({
    load: Effect.fn("SkillsProvenanceTest.fixtureSource.load")((resolution) => {
      expect(resolution.name).toBe("shadcn");
      expect(resolution.upstream.sourceRevision).toBe("91f21dfe1328585670275781b4525fff2507f917");
      return Effect.succeed(
        SkillUpstreamContent.make({
          files: [
            SkillUpstreamContentFile.make({
              path: "SKILL.md",
              mode: "100644",
              bytes: textEncoder.encode(skillText),
            }),
            SkillUpstreamContentFile.make({
              path: "assets/example.png",
              mode: "100644",
              bytes: pngBytes,
            }),
            SkillUpstreamContentFile.make({
              path: "rules/composition.md",
              mode: "100644",
              bytes: textEncoder.encode(compositionText),
            }),
          ],
          licenseBytes,
        })
      );
    }),
  });
});

layer(TestLayer)("skills-lock/v2 schemas", (it) => {
  it.effect("round-trips every lock block and the complete document", () =>
    Effect.gen(function* () {
      const fixture = Str.trimEnd(yield* readFixtureText("oracle-lock-v2.json"));
      const document = yield* decodeSkillsLockV2Json(fixture);
      const entry = document.skills.oracle;

      expect(entry).toBeDefined();
      if (entry === undefined) {
        return;
      }

      expect(yield* decodeSkillUpstream(yield* encodeSkillUpstream(entry.upstream))).toEqual(entry.upstream);
      expect(yield* decodeSkillSnapshot(yield* encodeSkillSnapshot(entry.snapshot))).toEqual(entry.snapshot);
      expect(yield* decodeSkillSnapshotFile(yield* encodeSkillSnapshotFile(entry.snapshot.manifest[0]))).toEqual(
        entry.snapshot.manifest[0]
      );
      expect(yield* decodeSkillLicense(yield* encodeSkillLicense(entry.license))).toEqual(entry.license);
      expect(yield* decodeSkillProvenance(yield* encodeSkillProvenance(entry.provenance))).toEqual(entry.provenance);
      expect(yield* decodeSkillPatches(yield* encodeSkillPatches(entry.patches))).toEqual(entry.patches);
      expect(yield* decodeSkillPatch(yield* encodeSkillPatch(entry.patches.series[0]))).toEqual(
        entry.patches.series[0]
      );
      expect(yield* decodeSkillEffective(yield* encodeSkillEffective(entry.effective))).toEqual(entry.effective);
      expect(yield* decodeSkillLockV2Entry(yield* encodeSkillLockV2Entry(entry))).toEqual(entry);
      expect(yield* decodeSkillsLockV2(yield* encodeSkillsLockV2(document))).toEqual(document);
    })
  );

  it.effect("preserves oracle's inferred medium-confidence d6e773a representation byte-identically", () =>
    Effect.gen(function* () {
      const fixture = Str.trimEnd(yield* readFixtureText("oracle-lock-v2.json"));
      const document = yield* decodeSkillsLockV2Json(fixture);
      const entry = document.skills.oracle;

      expect(entry).toBeDefined();
      if (entry === undefined) {
        return;
      }

      expect(entry.provenance.status).toBe("inferred");
      expect(entry.provenance.confidence).toBe("medium");
      expect(entry.upstream.sourceRevision).toBe("d6e773a562dc85c2a81b7c571f40ca2d81896679");
      expect(Str.startsWith("d6e773a")(entry.upstream.sourceRevision)).toBe(true);
      const encoded = yield* encodeSkillsLockV2Json(document);
      const decodedAgain = yield* decodeSkillsLockV2Json(encoded);
      expect(yield* encodeSkillsLockV2Json(decodedAgain)).toBe(encoded);
    })
  );
});

layer(TestLayer)("skills provenance service", (it) => {
  it.effect("detects text drift while proving the exact pin and unchanged binary asset", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-provenance-" });
        const skillText = yield* readFixtureText("shadcn/upstream/SKILL.md");
        const localComposition = yield* readFixtureText("shadcn/local/rules/composition.md");
        const pngBytes = yield* readFixtureBinary("shadcn/upstream/assets/example.png.hex");
        const source = yield* makeFixtureSource();

        yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/SKILL.md", textEncoder.encode(skillText));
        yield* writeFixtureFile(
          repoRoot,
          ".claude/skills/shadcn/rules/composition.md",
          textEncoder.encode(localComposition)
        );
        yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/assets/example.png", pngBytes);
        yield* fs.makeDirectory(path.join(repoRoot, ".agents"), { recursive: true });
        yield* fs.symlink("../.claude/skills", path.join(repoRoot, ".agents/skills"));

        const report = yield* resolveSkillProvenance("shadcn", repoRoot).pipe(
          Effect.provideService(SkillUpstreamContentSource, source)
        );

        expect(report.entry.upstream.sourceRevision).toBe("91f21dfe1328585670275781b4525fff2507f917");
        expect(report.entry.snapshot.fileCount).toBe(3);
        expect(A.map(report.entry.snapshot.manifest, (file) => file.path)).toEqual([
          "SKILL.md",
          "assets/example.png",
          "rules/composition.md",
        ]);
        expect(report.entry.snapshot.manifest[1]?.sha256).toHaveLength(64);
        expect(report.entry.provenance.status).toBe("exact");
        expect(report.entry.provenance.confidence).toBe("high");
        expect(report.entry.provenance.matchedFileCount).toBe(2);
        expect(report.entry.provenance.upstreamFileCount).toBe(3);
        expect(report.driftPaths).toEqual(["rules/composition.md"]);
        expect(report.entry.patches.required).toBe(true);
        expect(report.entry.patches.series).toHaveLength(1);
        expect(report.entry.patches.series[0]?.label).toBe("temporary-drift");
        expect(report.entry.patches.series[0]?.path).toBe("patches/0001-local-drift.patch");
        expect(report.entry.effective.installedTargets).toEqual([".claude/skills/shadcn", ".agents/skills/shadcn"]);
        expect(report.entry.effective.installedTreeHash).toHaveLength(64);
        expect(report.entry.effective.treeHash).not.toBe(report.entry.snapshot.treeHash);
        expect(yield* fs.exists(path.join(repoRoot, "skills-lock.json"))).toBe(false);
        expect(yield* fs.exists(path.join(repoRoot, "patches"))).toBe(false);
      })
    )
  );

  it.effect("records symlinks as mode 120000 link text instead of following them", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-provenance-symlink-" });
        const skillText = yield* readFixtureText("shadcn/upstream/SKILL.md");
        const compositionText = yield* readFixtureText("shadcn/upstream/rules/composition.md");
        const source = yield* makeStubSource([
          SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: textEncoder.encode(skillText) }),
          SkillUpstreamContentFile.make({ path: "entry.md", mode: "120000", bytes: textEncoder.encode("SKILL.md") }),
          SkillUpstreamContentFile.make({ path: "mirror", mode: "120000", bytes: textEncoder.encode("rules") }),
          SkillUpstreamContentFile.make({
            path: "rules/composition.md",
            mode: "100644",
            bytes: textEncoder.encode(compositionText),
          }),
        ]);

        yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/SKILL.md", textEncoder.encode(skillText));
        yield* writeFixtureFile(
          repoRoot,
          ".claude/skills/shadcn/rules/composition.md",
          textEncoder.encode(compositionText)
        );
        yield* fs.symlink("SKILL.md", path.join(repoRoot, ".claude/skills/shadcn/entry.md"));
        yield* fs.symlink("rules", path.join(repoRoot, ".claude/skills/shadcn/mirror"));
        yield* linkAgentsTarget(repoRoot);

        const report = yield* resolveSkillProvenance("shadcn", repoRoot).pipe(
          Effect.provideService(SkillUpstreamContentSource, source)
        );

        // Following the file link would hash SKILL.md's bytes under mode 100644, and walking
        // the directory link would add `mirror/composition.md` while losing `mirror` itself;
        // either one shows up here as drift against the pinned tree.
        expect(report.driftPaths).toEqual([]);
        expect(report.entry.provenance.matchedFileCount).toBe(4);
        expect(report.entry.provenance.upstreamFileCount).toBe(4);
        expect(report.entry.effective.treeHash).toBe(report.entry.snapshot.treeHash);
        expect(report.entry.patches.required).toBe(false);
      })
    )
  );

  it.effect("renders header-only patch sections for empty added and deleted files", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-provenance-empty-" });
        const skillText = yield* readFixtureText("shadcn/upstream/SKILL.md");
        const source = yield* makeStubSource([
          SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: textEncoder.encode(skillText) }),
          SkillUpstreamContentFile.make({ path: "removed-empty.md", mode: "100644", bytes: new Uint8Array() }),
        ]);

        yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/SKILL.md", textEncoder.encode(skillText));
        yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/added-empty.md", new Uint8Array());
        yield* linkAgentsTarget(repoRoot);

        const report = yield* resolveSkillProvenance("shadcn", repoRoot).pipe(
          Effect.provideService(SkillUpstreamContentSource, source)
        );

        expect(report.driftPaths).toEqual(["added-empty.md", "removed-empty.md"]);
        // What `git diff` emits for a zero-byte add or delete: mode and index headers, no hunk.
        const expectedPatch = A.join(
          [
            "diff --git a/added-empty.md b/added-empty.md",
            "new file mode 100644",
            `index 000000000000..${Str.slice(0, 12)(emptyDigest)}`,
            "diff --git a/removed-empty.md b/removed-empty.md",
            "deleted file mode 100644",
            `index ${Str.slice(0, 12)(emptyDigest)}..000000000000`,
            "",
          ],
          "\n"
        );

        expect(report.entry.patches.series[0]?.sha256).toBe(yield* hashBytes(textEncoder.encode(expectedPatch)));
      })
    )
  );

  it.effect("rejects a snapshot whose fileCount disagrees with its manifest length", () =>
    Effect.gen(function* () {
      const manifest = [{ path: "SKILL.md", mode: "100644", sha256: emptyDigest }];
      const snapshot = (fileCount: number) => ({
        algorithm: "sha256",
        treeHash: emptyDigest,
        fileCount,
        manifestHash: emptyDigest,
        manifest,
      });

      expect((yield* decodeSkillSnapshot(snapshot(1))).fileCount).toBe(1);
      expect(Exit.isFailure(yield* Effect.exit(decodeSkillSnapshot(snapshot(0))))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeSkillSnapshot(snapshot(2))))).toBe(true);
    })
  );

  it.effect("keeps browser-triggered skill workflows behind host trust boundaries", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const impeccableRoute = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live/manual-edit-routes.mjs")
      );
      const githubRoute = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live/manual-edit-routes.mjs")
      );
      const copyAgent = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-copy-edit-agent.mjs")
      );
      const githubCopyAgent = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-copy-edit-agent.mjs")
      );
      const commitAgent = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-commit-manual-edits.mjs")
      );
      const githubCommitAgent = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-commit-manual-edits.mjs")
      );
      const liveInstructions = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live/instructions.mjs")
      );
      const githubLiveInstructions = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live/instructions.mjs")
      );
      const liveServer = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-server.mjs")
      );
      const githubLiveServer = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-server.mjs")
      );
      const trustedApplyClient = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-apply-manual-edits.mjs")
      );
      const githubTrustedApplyClient = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-apply-manual-edits.mjs")
      );
      const browserClient = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-browser.js")
      );
      const githubBrowserClient = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-browser.js")
      );
      const adapterRunner = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/ontology-foundational-auditor/scripts/run_adapter_sandbox.sh")
      );
      const ontologySkill = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/ontology-foundational-auditor/SKILL.md")
      );

      expect(impeccableRoute).toBe(githubRoute);
      expect(impeccableRoute).toContain("IMPECCABLE_LIVE_COMMIT_CAPABILITY");
      expect(impeccableRoute).toContain("x-impeccable-commit-capability");
      expect(impeccableRoute).toContain("delete copyAgentEnvironment.IMPECCABLE_LIVE_COMMIT_CAPABILITY");
      expect(trustedApplyClient).toBe(githubTrustedApplyClient);
      expect(trustedApplyClient).toContain('"x-impeccable-commit-capability": capability');
      expect(trustedApplyClient).toContain('args.includes("--rollback")');
      expect(trustedApplyClient).toContain('args.includes("--discard")');
      expect(trustedApplyClient).not.toContain("console.log(capability)");
      expect(browserClient).toBe(githubBrowserClient);
      expect(browserClient).not.toContain('"/manual-edit-commit?token="');
      expect(browserClient).not.toContain('"/manual-edit-repair-decision?token="');
      expect(browserClient).not.toContain('"/manual-edit-discard?token="');
      expect(browserClient).not.toContain("live-apply-manual-edits.mjs");
      expect(browserClient).not.toContain("trustedManualApplyCommand");
      expect(browserClient).not.toContain("Show the trusted operator repair command");
      expect(browserClient).toContain("Return to the trusted terminal to authorize repair");
      expect(copyAgent).toBe(githubCopyAgent);
      expect(commitAgent).toBe(githubCommitAgent);
      expect(liveInstructions).toBe(githubLiveInstructions);
      expect(liveServer).toBe(githubLiveServer);
      expect(copyAgent).not.toContain("impeccable:manual-edit-validate");
      expect(copyAgent).not.toContain("spawnSync(script");
      expect(adapterRunner).toContain("--unshare-all");
      expect(adapterRunner).toContain('--ro-bind "${repo}" /repo');
      expect(adapterRunner).toContain("--clearenv");
      expect(adapterRunner).toContain("adapter must live outside the audited repository");
      expect(adapterRunner).toContain("adapter file is writable by another user");
      expect(adapterRunner).toContain('realpath -ms -- "${target_input}"');
      expect(ontologySkill).toContain('TRUSTED_ADAPTER_SHA256=$(sha256sum "$TRUSTED_ADAPTER"');
      expect(ontologySkill).not.toContain("find $ONT/adapters -type f");
    })
  );

  it.effect("executes the adapter sandbox trust and output containment checks", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const fixtureRoot = yield* fs.makeTempDirectoryScoped({ prefix: "adapter-sandbox-" });
        const auditedRepo = path.join(fixtureRoot, "repo");
        const trustedDirectory = path.join(fixtureRoot, "trusted");
        const adapter = path.join(trustedDirectory, "adapter.py");
        const binDirectory = path.join(fixtureRoot, "bin");
        const capturePath = path.join(fixtureRoot, "bwrap.argv");
        const outsideDirectory = path.join(fixtureRoot, "outside");
        yield* Effect.forEach(
          [auditedRepo, trustedDirectory, binDirectory, outsideDirectory],
          (directory) => fs.makeDirectory(directory, { recursive: true, mode: 0o700 }),
          { discard: true }
        );
        yield* fs.writeFileString(adapter, "#!/usr/bin/env python3\n");
        yield* fs.chmod(adapter, 0o644);
        const writeExecutable = Effect.fnUntraced(function* (filePath: string, source: string) {
          yield* fs.writeFileString(filePath, source);
          yield* fs.chmod(filePath, 0o755);
        });
        yield* writeExecutable(
          path.join(binDirectory, "prlimit"),
          '#!/bin/sh\nwhile [ "$#" -gt 0 ] && [ "$1" != "--" ]; do shift; done\n[ "$#" -gt 0 ] || exit 64\nshift\nexec "$@"\n'
        );
        yield* writeExecutable(path.join(binDirectory, "bwrap"), '#!/bin/sh\nprintf "%s\\n" "$@" > "$BWRAP_CAPTURE"\n');
        const runner = path.join(
          repoRoot,
          ".claude/skills/ontology-foundational-auditor/scripts/run_adapter_sandbox.sh"
        );
        const run = (target: string) =>
          Bun.spawnSync([runner, adapter, auditedRepo, "observe", target], {
            cwd: auditedRepo,
            env: {
              ...Bun.env,
              BWRAP_CAPTURE: capturePath,
              PATH: `${binDirectory}:${Bun.env.PATH ?? ""}`,
            },
            stderr: "pipe",
            stdout: "pipe",
          });

        yield* fs.chmod(adapter, 0o666);
        expect(run(path.join(auditedRepo, "writable-adapter-output")).exitCode).toBe(65);
        yield* fs.chmod(adapter, 0o644);

        const outsideOutput = path.join(outsideDirectory, "must-not-be-created");
        expect(run(outsideOutput).exitCode).toBe(65);
        expect(yield* fs.exists(outsideOutput)).toBe(false);

        const linkedOutput = path.join(auditedRepo, "linked-output");
        yield* fs.symlink(outsideDirectory, linkedOutput);
        expect(run(linkedOutput).exitCode).toBe(65);

        const validOutput = path.join(auditedRepo, "observations");
        expect(run(validOutput).exitCode).toBe(0);
        expect(yield* fs.exists(validOutput)).toBe(true);
        const bwrapArguments = yield* fs.readFileString(capturePath);
        expect(bwrapArguments).toContain(`${validOutput}\n/out\n`);
        expect(bwrapArguments).toContain(`${auditedRepo}\n/repo\n`);
      })
    )
  );

  it.effect("enforces the manual-edit operator capability across host mutation routes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const probeRoot = yield* fs.makeTempDirectoryScoped({ prefix: "impeccable-provider-probe-" });
        const probeBin = path.join(probeRoot, "bin");
        const probeCapture = path.join(probeRoot, "probe.env");
        yield* fs.makeDirectory(probeBin, { recursive: true });
        const fakeCodex = path.join(probeBin, "codex");
        yield* fs.writeFileString(
          fakeCodex,
          '#!/bin/sh\nif [ -n "${IMPECCABLE_LIVE_COMMIT_CAPABILITY:-}" ]; then printf "leaked\\n" >> "$PROBE_CAPTURE"; exit 1; fi\nprintf "clean\\n" >> "$PROBE_CAPTURE"\nexit 0\n'
        );
        yield* fs.chmod(fakeCodex, 0o755);
        const routeModule = yield* Effect.promise(
          () =>
            import(
              pathToFileURL(path.join(repoRoot, ".claude/skills/impeccable/scripts/live/manual-edit-routes.mjs")).href
            )
        );
        const copyAgentModule = yield* Effect.promise(
          () =>
            import(
              pathToFileURL(path.join(repoRoot, ".claude/skills/impeccable/scripts/live-copy-edit-agent.mjs")).href
            )
        );
        const activities: Array<{ readonly payload: Record<string, unknown>; readonly type: string }> = [];
        let commitCalls = 0;
        let childEnvironment: Record<string, string | undefined> | undefined;
        const transactionCalls = { cancel: 0, clear: 0, count: 0, read: 0, rollback: 0, write: 0 };
        const manualApply = {
          cancelPendingEvents: () => {
            transactionCalls.cancel += 1;
            return [];
          },
          clearTransaction: () => {
            transactionCalls.clear += 1;
          },
          countOps: () => {
            transactionCalls.count += 1;
            return 0;
          },
          readTransaction: () => {
            transactionCalls.read += 1;
            return null;
          },
          rollbackTransaction: () => {
            transactionCalls.rollback += 1;
            return null;
          },
          writeTransaction: () => {
            transactionCalls.write += 1;
            return null;
          },
        };
        const invoke = Effect.fn("SkillsProvenanceTest.invokeManualEditRoute")(function* ({
          body,
          expectedCapability,
          providedCapability,
          route = "/manual-edit-commit?token=page-token",
        }: {
          readonly body?: string;
          readonly expectedCapability: string;
          readonly providedCapability?: string;
          readonly route?: string;
        }) {
          return yield* Effect.callback<{ readonly status: number }>((resume) => {
            let status = 0;
            const response = {
              end: () => {
                resume(Effect.succeed({ status }));
              },
              writeHead: (statusCode: number) => {
                status = statusCode;
              },
            };
            const request = {
              headers: providedCapability === undefined ? {} : { "x-impeccable-commit-capability": providedCapability },
              method: "POST",
              on: (event: string, listener: (chunk?: string) => void) => {
                if (event === "data" && body !== undefined) listener(body);
                if (event === "end") queueMicrotask(listener);
                return request;
              },
            };
            const handle = routeModule.createManualEditRoutes({
              chatAgentLikelyActive: () => false,
              commitManualEdits: ({ env }: { readonly env: Record<string, string | undefined> }) => {
                commitCalls += 1;
                childEnvironment = env;
                const firstSelection = copyAgentModule.chooseCopyEditAgent({ env: { ...env } });
                const cachedSelection = copyAgentModule.chooseCopyEditAgent({ env: { ...env } });
                expect(firstSelection).toBe("codex");
                expect(cachedSelection).toBe("codex");
                return Promise.resolve({
                  applied: [],
                  cleared: 0,
                  failed: [],
                  files: [],
                  reason: "no_pending_edits",
                  warnings: [],
                });
              },
              cwd: probeRoot,
              env: () => ({
                IMPECCABLE_LIVE_COMMIT_CAPABILITY: expectedCapability,
                IMPECCABLE_LIVE_COPY_AGENT: "auto",
                PATH: `${probeBin}:${Bun.env.PATH ?? ""}`,
                PROBE_CAPTURE: probeCapture,
                VISIBLE_VALUE: "kept",
              }),
              getManualEditStatus: () => ({ perPage: {}, totalCount: 0 }),
              getToken: () => "page-token",
              manualApply,
              recordManualEditActivity: (type: string, payload: Record<string, unknown>) => {
                activities.push({ payload, type });
              },
            });
            expect(handle(request, response, new URL(`http://127.0.0.1${route}`))).toBe(true);
          });
        });

        const rollbackBody = yield* encodeUnknownJson({ action: "rollback", token: "page-token" });

        expect((yield* invoke({ expectedCapability: "" })).status).toBe(403);
        expect((yield* invoke({ expectedCapability: "expected" })).status).toBe(403);
        expect((yield* invoke({ expectedCapability: "expected", providedCapability: "wrong" })).status).toBe(403);
        expect(
          (yield* invoke({
            body: rollbackBody,
            expectedCapability: "expected",
            route: "/manual-edit-repair-decision?token=page-token",
          })).status
        ).toBe(403);
        expect(
          (yield* invoke({ expectedCapability: "expected", route: "/manual-edit-discard?token=page-token" })).status
        ).toBe(403);
        expect(transactionCalls).toEqual({ cancel: 0, clear: 0, count: 0, read: 0, rollback: 0, write: 0 });
        const accepted = yield* invoke({ expectedCapability: "expected", providedCapability: "expected" });

        expect(accepted.status).toBe(200);
        expect(commitCalls).toBe(1);
        expect(childEnvironment?.IMPECCABLE_LIVE_COMMIT_CAPABILITY).toBeUndefined();
        expect(childEnvironment?.VISIBLE_VALUE).toBe("kept");
        expect(yield* fs.readFileString(probeCapture)).toBe("clean\n");
        const postCheckTarget = path.join(probeRoot, "post-check.js");
        yield* fs.writeFileString(postCheckTarget, "export {};\n");
        let postCheckEnvironment: Record<string, string | undefined> | undefined;
        const postChecks = copyAgentModule.runCopyEditPostApplyChecks({
          cwd: probeRoot,
          env: childEnvironment,
          files: ["post-check.js"],
          spawnSyncCommand: (
            _command: string,
            _args: ReadonlyArray<string>,
            options: { readonly env: Record<string, string | undefined> }
          ) => {
            postCheckEnvironment = options.env;
            return { status: 0 };
          },
        });
        expect(postChecks.ok).toBe(true);
        expect(postCheckEnvironment).toBe(childEnvironment);
        expect(postCheckEnvironment?.IMPECCABLE_LIVE_COMMIT_CAPABILITY).toBeUndefined();
        const rollbackCallsBeforeTrustedActions = transactionCalls.rollback;
        expect(
          (yield* invoke({
            body: rollbackBody,
            expectedCapability: "expected",
            providedCapability: "expected",
            route: "/manual-edit-repair-decision?token=page-token",
          })).status
        ).toBe(200);
        expect(transactionCalls.rollback).toBe(rollbackCallsBeforeTrustedActions + 1);
        expect(
          (yield* invoke({
            expectedCapability: "expected",
            providedCapability: "expected",
            route: "/manual-edit-discard?token=page-token",
          })).status
        ).toBe(200);
        expect(transactionCalls.rollback).toBe(rollbackCallsBeforeTrustedActions + 2);
        expect(transactionCalls.cancel).toBe(1);
        const denials = A.filter(activities, (activity) => activity.type === "manual_edit_commit_denied");
        expect(denials).toEqual([
          { payload: { reason: "operator_capability_unconfigured" }, type: "manual_edit_commit_denied" },
          { payload: { reason: "operator_capability_mismatch" }, type: "manual_edit_commit_denied" },
          { payload: { reason: "operator_capability_mismatch" }, type: "manual_edit_commit_denied" },
        ]);
        expect(A.filter(activities, (activity) => activity.type === "manual_edit_repair_rollback_denied")).toEqual([
          { payload: { reason: "operator_capability_mismatch" }, type: "manual_edit_repair_rollback_denied" },
        ]);
        expect(A.filter(activities, (activity) => activity.type === "manual_edit_discard_denied")).toEqual([
          { payload: { reason: "operator_capability_mismatch" }, type: "manual_edit_discard_denied" },
        ]);
        expect(yield* encodeUnknownJson(activities)).not.toContain("expected");
      })
    )
  );
});
