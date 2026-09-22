import {
  GitHubRepoSlug,
  GitHubRepoSlugFromRemote,
  planPacket,
  readSecurityBundle,
  renderPacketDocuments,
  securityRepositoryFromRemote,
  writePacket,
} from "@beep/repo-cli/test/Codex";
import { Sha256HexFromBytes } from "@beep/schema";
import { NodeCrypto } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { NodeTestLayer } from "./support/CommandTest.ts";

const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const hash = S.decodeEffect(Sha256HexFromBytes);
const encodeRepository = S.encodeEffect(GitHubRepoSlugFromRemote);
const decodeRepository = S.decodeEffect(GitHubRepoSlugFromRemote);
const testLayer = Layer.mergeAll(NodeTestLayer, NodeCrypto.layer);

const fixture = Effect.fn("SecurityTest.fixture")(function* (coverage = "complete") {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  const findings = {
    documentType: "codex-security.findings",
    schemaVersion: "1.0",
    scanId: "scan-test",
    findings: [
      {
        findingId: "csf_aaaaaaaaaaaaaaaaaaaaaaaa",
        occurrenceId: "occ_bbbbbbbbbbbbbbbbbbbbbbbb",
        fingerprints: { algorithm: "codex-security/v1", primary: `codex-security/v1:sha256:${Str.repeat(64)("c")}` },
        title: "Synthetic source boundary finding",
        summary: "Synthetic evidence for a test.",
        severity: { level: "medium" },
        locations: [{ path: "src/example.ts", startLine: 1 }],
        remediation: "Validate the input.",
      },
    ],
  };
  const coverageDocument = {
    documentType: "codex-security.coverage",
    schemaVersion: "1.0",
    scanId: "scan-test",
    completeness: coverage,
    includePaths: ["src"],
    excludePaths: [],
    deferred: [],
    explicitExclusions: [],
  };
  const artifacts = yield* Effect.forEach(
    [
      { path: "findings.json", contents: findings },
      { path: "coverage.json", contents: coverageDocument },
    ],
    Effect.fnUntraced(function* (artifact: { readonly path: string; readonly contents: unknown }) {
      const text = yield* encode(artifact.contents);
      yield* fs.writeFileString(path.join(root, artifact.path), text);
      return {
        path: artifact.path,
        sha256: yield* hash(new TextEncoder().encode(text)),
        mediaType: "application/json",
      };
    })
  );
  const manifest = {
    documentType: "codex-security.scan-manifest",
    schemaVersion: "1.0",
    scan: {
      id: "scan-test",
      producer: { name: "codex-security-plugin", version: "0.1.95" },
      status: "completed",
      startedAt: "2026-09-16T01:00:00Z",
      completedAt: "2026-09-16T01:01:00Z",
      sealedAt: "2026-09-16T01:01:01Z",
      target: {
        kind: "git_revision",
        revision: Str.repeat(40)("a"),
        remote: "https://github.com/example/project.git",
        targetId: "test-target",
      },
      scope: { includePaths: ["src"], excludePaths: [] },
      coverageRef: "coverage.json",
      findingsRef: "findings.json",
      artifacts,
    },
  };
  yield* fs.writeFileString(path.join(root, "scan-manifest.json"), yield* encode(manifest));
  return { root, manifest, findings, coverageDocument };
});

type Manifest = Effect.Success<ReturnType<typeof fixture>>["manifest"];

const writeJson = Effect.fn("SecurityTest.writeJson")(function* (root: string, name: string, contents: unknown) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(root, name), yield* encode(contents));
});

const replaceArtifact = Effect.fn("SecurityTest.replaceArtifact")(function* (
  root: string,
  manifest: Manifest,
  name: string,
  contents: unknown
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const text = yield* encode(contents);
  yield* fs.writeFileString(path.join(root, name), text);
  const digest = yield* hash(new TextEncoder().encode(text));
  yield* writeJson(root, "scan-manifest.json", {
    ...manifest,
    scan: {
      ...manifest.scan,
      artifacts: A.map(manifest.scan.artifacts, (artifact) =>
        artifact.path === name ? { ...artifact, sha256: digest } : artifact
      ),
    },
  });
});

const expectRejected = Effect.fn("SecurityTest.expectRejected")(function* (root: string) {
  const result = yield* readSecurityBundle(root).pipe(Effect.result);
  expect(result._tag).toBe("Failure");
  return result;
});

it.layer(testLayer, { timeout: "30 seconds" })("sealed local security findings", (it) => {
  it.effect.prop(
    "round trips schema-generated repository identities",
    { repository: GitHubRepoSlug },
    ({ repository }) =>
      Effect.gen(function* () {
        const remote = yield* encodeRepository(repository);
        expect(yield* decodeRepository(remote)).toBe(repository);
      }),
    { arbitrary: { runs: 100 } }
  );
  it.effect(
    "encodes canonical repository identity and rejects a foreign origin",
    Effect.fnUntraced(function* () {
      expect(yield* encodeRepository("example/project")).toBe("https://github.com/example/project.git");
      const rejected = yield* securityRepositoryFromRemote("https://example.invalid/project").pipe(Effect.result);
      expect(rejected._tag).toBe("Failure");
    })
  );

  it.effect(
    "refuses oversized individual files and total bundle input",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const { root, manifest } = yield* fixture();
      const large = new Uint8Array(14 * 1024 * 1024);
      const digest = yield* hash(large);
      const extra = yield* Effect.forEach(
        ["a", "b", "c", "d", "e"],
        Effect.fnUntraced(function* (name) {
          const filename = `${name}.bin`;
          yield* fs.writeFile(path.join(root, filename), large);
          return { path: filename, sha256: digest, mediaType: "application/octet-stream" };
        })
      );
      yield* writeJson(root, "scan-manifest.json", {
        ...manifest,
        scan: { ...manifest.scan, artifacts: [...manifest.scan.artifacts, ...extra] },
      });
      const aggregate = yield* expectRejected(root);
      if (aggregate._tag === "Failure") expect(aggregate.failure.message).toContain("64 MiB");
      const oversizedBytes = new Uint8Array(16777217);
      yield* fs.writeFile(path.join(root, "oversized.bin"), oversizedBytes);
      yield* writeJson(root, "scan-manifest.json", {
        ...manifest,
        scan: {
          ...manifest.scan,
          artifacts: [
            ...manifest.scan.artifacts,
            { path: "oversized.bin", sha256: yield* hash(oversizedBytes), mediaType: "application/octet-stream" },
          ],
        },
      });
      const oversized = yield* expectRejected(root);
      if (oversized._tag === "Failure") expect(oversized.failure.message).toContain("16 MiB");
      yield* fs.writeFile(path.join(root, "scan-manifest.json"), oversizedBytes);
      const oversizedManifest = yield* expectRejected(root);
      if (oversizedManifest._tag === "Failure") expect(oversizedManifest.failure.message).toContain("16 MiB");
    })
  );
  it.effect(
    "uses a separate source receipt when the upstream remote is absent and rejects revision drift",
    Effect.fnUntraced(function* () {
      const { root, manifest } = yield* fixture();
      const { remote: _remote, ...target } = manifest.scan.target;
      yield* writeJson(root, "scan-manifest.json", { ...manifest, scan: { ...manifest.scan, target } });
      yield* expectRejected(root);
      const receipt = {
        schemaVersion: "beep-security-source/v1",
        repository: "example/project",
        revision: manifest.scan.target.revision,
      };
      yield* writeJson(root, "beep-source.json", receipt);
      expect((yield* readSecurityBundle(root)).payload.capture.repository).toBe("example/project");
      yield* writeJson(root, "beep-source.json", { ...receipt, revision: Str.repeat(40)("b") });
      yield* expectRejected(root);
    })
  );

  it.effect(
    "normalizes the seal's ssh URL remote and labels a receipt-less identity unverified",
    Effect.fnUntraced(function* () {
      const { root, manifest } = yield* fixture();
      yield* writeJson(root, "scan-manifest.json", {
        ...manifest,
        scan: {
          ...manifest.scan,
          target: { ...manifest.scan.target, remote: "ssh://git@github.com/example/project.git" },
        },
      });
      const imported = yield* readSecurityBundle(root);
      expect(imported.payload.capture.repository).toBe("example/project");
      expect(imported.evidenceJson).toContain("sealed-remote-unverified");
    })
  );

  it.effect(
    "rejects a receipt whose repository disagrees with a normalizable sealed remote",
    Effect.fnUntraced(function* () {
      const { root, manifest } = yield* fixture();
      yield* writeJson(root, "scan-manifest.json", {
        ...manifest,
        scan: { ...manifest.scan, target: { ...manifest.scan.target, remote: "https://github.com/other/repo.git" } },
      });
      yield* writeJson(root, "beep-source.json", {
        schemaVersion: "beep-security-source/v1",
        repository: "example/project",
        revision: manifest.scan.target.revision,
      });
      yield* expectRejected(root);
    })
  );

  it.effect(
    "uses the receipt when the sealed remote is not a GitHub URL",
    Effect.fnUntraced(function* () {
      const { root, manifest } = yield* fixture();
      yield* writeJson(root, "scan-manifest.json", {
        ...manifest,
        scan: {
          ...manifest.scan,
          target: { ...manifest.scan.target, remote: "https://example.com/mirror/project.git" },
        },
      });
      yield* expectRejected(root);
      yield* writeJson(root, "beep-source.json", {
        schemaVersion: "beep-security-source/v1",
        repository: "example/project",
        revision: manifest.scan.target.revision,
      });
      const imported = yield* readSecurityBundle(root);
      expect(imported.payload.capture.repository).toBe("example/project");
      expect(imported.evidenceJson).toContain("local-source-receipt");
    })
  );

  it.effect(
    "imports a secret-shaped report body while keeping it out of every tracked document",
    Effect.fnUntraced(function* () {
      const { root, manifest, findings } = yield* fixture();
      const token = "TOKEN=abc123def456";
      yield* replaceArtifact(root, manifest, "findings.json", {
        ...findings,
        findings: A.map(findings.findings, (finding) => ({ ...finding, summary: `Hard-coded ${token} in config.` })),
      });
      const imported = yield* readSecurityBundle(root);
      expect(imported.evidenceJson).toContain(token);
      const plan = yield* planPacket(imported.payload, {});
      const docs = renderPacketDocuments({ plan, rawPayloadJson: imported.evidenceJson, rawReports: imported.reports });
      for (const document of A.filter(docs, (document) => document.tracked)) {
        expect(document.contents).not.toContain(token);
      }
    })
  );

  it.effect(
    "ingests critical findings as the top packet severity, ordered before High",
    Effect.fnUntraced(function* () {
      const { root, manifest, findings } = yield* fixture();
      const base = A.head(findings.findings);
      yield* replaceArtifact(root, manifest, "findings.json", {
        ...findings,
        findings: [
          {
            ...O.getOrUndefined(base),
            findingId: "csf_111111111111111111111111",
            occurrenceId: "occ_111111111111111111111111",
            severity: { level: "high" },
          },
          {
            ...O.getOrUndefined(base),
            findingId: "csf_222222222222222222222222",
            occurrenceId: "occ_222222222222222222222222",
            severity: { level: "critical" },
          },
        ],
      });
      const imported = yield* readSecurityBundle(root);
      expect(A.map(imported.payload.findings, (finding) => finding.severity)).toEqual(["High", "Critical"]);
      const plan = yield* planPacket(imported.payload, {});
      expect(plan.severityCounts.Critical).toBe(1);
      expect(A.map(plan.records, (record) => record.severity)).toEqual(["Critical", "High"]);
    })
  );

  it.effect(
    "rejects cross-scan coverage even with matching artifact hashes",
    Effect.fnUntraced(function* () {
      const { root, manifest, coverageDocument } = yield* fixture();
      yield* replaceArtifact(root, manifest, "coverage.json", { ...coverageDocument, scanId: "another-scan" });
      yield* expectRejected(root);
    })
  );

  it.effect(
    "rejects duplicate finding identities and secret-shaped tracked fields without reproducing them",
    Effect.fnUntraced(function* () {
      const { root, manifest, findings } = yield* fixture();
      yield* replaceArtifact(root, manifest, "findings.json", {
        ...findings,
        findings: [...findings.findings, ...findings.findings],
      });
      yield* expectRejected(root);
      // Titles reach tracked files, so a secret-shaped title is refused outright.
      yield* replaceArtifact(root, manifest, "findings.json", {
        ...findings,
        findings: A.map(findings.findings, (finding) => ({ ...finding, title: "Leaked TOKEN=private-owner" })),
      });
      const rejected = yield* expectRejected(root);
      if (rejected._tag === "Failure") expect(rejected.failure.message).not.toContain("private-owner");
    })
  );

  it.effect(
    "keeps private raw evidence out of tracked documents while preserving it in the evidence record",
    Effect.fnUntraced(function* () {
      const { root, manifest, findings } = yield* fixture();
      yield* replaceArtifact(root, manifest, "findings.json", {
        ...findings,
        privateMetadata: "/home/private-owner/secret",
      });
      const imported = yield* readSecurityBundle(root);
      expect(imported.evidenceJson).toContain("private-owner");
      const plan = yield* planPacket(imported.payload, {});
      const docs = renderPacketDocuments({ plan, rawPayloadJson: imported.evidenceJson, rawReports: imported.reports });
      for (const document of A.filter(docs, (document) => document.tracked)) {
        expect(document.contents).not.toContain("private-owner");
      }
    })
  );

  it.effect(
    "preserves local identities and partial coverage without cloud closure guidance",
    Effect.fnUntraced(function* () {
      const { root } = yield* fixture("partial");
      const imported = yield* readSecurityBundle(root);
      expect(imported.coverage).toBe("partial");
      expect(imported.payload.findings[0]?.codexId).toBe("local:csf_aaaaaaaaaaaaaaaaaaaaaaaa");
      expect(imported.evidenceJson).toContain("occ_bbbbbbbbbbbbbbbbbbbbbbbb");
      expect(imported.evidenceJson).toContain("manifestSha256");
      const plan = yield* planPacket(imported.payload, {});
      const docs = renderPacketDocuments({ plan, rawPayloadJson: imported.evidenceJson, rawReports: imported.reports });
      for (const document of A.filter(docs, (document) => document.tracked)) {
        expect(document.contents).not.toContain("signed-in CSV export");
        expect(document.contents).not.toContain("close as `Already fixed`");
      }
      const goal = A.findFirst(docs, (document) => document.path === "GOAL.md");
      expect(goal._tag).toBe("Some");
      if (goal._tag === "Some") {
        expect(goal.value.contents).toContain("Do not close cloud dashboard IDs");
        expect(goal.value.contents.length).toBeLessThanOrEqual(4000);
      }
      const fs = yield* FileSystem.FileSystem;
      const destination = yield* fs.makeTempDirectoryScoped();
      const outcome = yield* writePacket({
        repoRoot: destination,
        slug: plan.slug,
        documents: docs,
        dryRun: true,
        force: false,
      });
      expect(outcome.committed).toBe(false);
    })
  );

  it.effect(
    "rejects modified sealed bytes",
    Effect.fnUntraced(function* () {
      const { root } = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.writeFileString(path.join(root, "findings.json"), "{}");
      yield* expectRejected(root);
    })
  );

  it.effect(
    "rejects a symlink even when it points to matching bytes",
    Effect.fnUntraced(function* () {
      const { root } = yield* fixture();
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      yield* fs.rename(path.join(root, "findings.json"), path.join(root, "original.json"));
      yield* fs.symlink(path.join(root, "original.json"), path.join(root, "findings.json"));
      yield* expectRejected(root);
    })
  );

  it.effect(
    "rejects duplicate artifact paths before import",
    Effect.fnUntraced(function* () {
      const { root, manifest } = yield* fixture();
      yield* writeJson(root, "scan-manifest.json", {
        ...manifest,
        scan: { ...manifest.scan, artifacts: [...manifest.scan.artifacts, ...manifest.scan.artifacts] },
      });
      yield* expectRejected(root);
    })
  );

  it.effect(
    "rejects unsupported producer versions and dirty snapshot targets",
    Effect.fnUntraced(function* () {
      const { root, manifest } = yield* fixture();
      for (const scan of [
        { ...manifest.scan, producer: { name: "codex-security-plugin", version: "99.0.0" } },
        { ...manifest.scan, target: { ...manifest.scan.target, kind: "git_worktree" } },
        { ...manifest.scan, extensions: { mock: true } },
        { ...manifest.scan, scope: { ...manifest.scan.scope, runtimeStatus: "mock" } },
        {
          ...manifest.scan,
          artifacts: [
            ...manifest.scan.artifacts,
            { path: "../outside.json", sha256: Str.repeat(64)("a"), mediaType: "application/json" },
          ],
        },
      ]) {
        yield* writeJson(root, "scan-manifest.json", { ...manifest, scan });
        yield* expectRejected(root);
      }
    })
  );
});
