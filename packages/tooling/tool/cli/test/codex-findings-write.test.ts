import { PacketDocument, writePacket } from "@beep/repo-cli/test/Codex";
import { it } from "@beep/test-runner";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { Effect, FileSystem } from "effect";
import { NodeTestLayer, temporaryWorkingDirectory } from "./support/CommandTest.ts";

const SLUG = "codex-security-findings-2026-08-04";

const doc = (path: string, contents: string, tracked = true) => PacketDocument.make({ contents, path, tracked });

const sampleDocuments = [
  doc("README.md", "# Codex Security Findings (2026-08-04)\n\nLifecycle: `active`\n"),
  doc("ops/manifest.json", '{\n  "schemaVersion": "initiative-manifest/v2"\n}\n'),
  doc("findings/CSF-001.md", "# CSF-001: A finding\n"),
  doc("raw/.gitignore", "*\n!.gitignore\n", false),
];

const writeIn = Effect.fn("writeIn")(function* (options: {
  readonly slug?: string;
  readonly documents?: ReadonlyArray<PacketDocument>;
  readonly dryRun?: boolean;
  readonly force?: boolean;
}) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory("goals", { recursive: true });
  return yield* writePacket({
    documents: options.documents ?? sampleDocuments,
    dryRun: options.dryRun ?? false,
    force: options.force ?? false,
    repoRoot: process.cwd(),
    slug: options.slug ?? SLUG,
  });
});

// Preserve native staging, rename and symlink subjects; each case owns its temporary cwd.
it.layer(NodeTestLayer, { timeout: "5 seconds" })((it) => {
  describe("codex findings packet promotion", () => {
    it.effect("preserves Markdown frontmatter while retaining private-content checks", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const contents = "---\nagent: codex\n---\n\n# Reflection\n";
        const reflectionPath = "history/reflections/2026-08-04-codex.md";
        const outcome = yield* writeIn({ documents: [...sampleDocuments, doc(reflectionPath, contents)] });
        const fs = yield* FileSystem.FileSystem;
        expect(outcome.committed).toBe(true);
        expect(yield* fs.readFileString(`goals/${SLUG}/${reflectionPath}`)).toBe(contents);
        const rejected = yield* writeIn({
          force: true,
          documents: [...sampleDocuments, doc(reflectionPath, `${contents}/home/private-owner/work\n`)],
        }).pipe(
          Effect.map(() => false),
          Effect.catchTag("CodexFindingsRedactionError", () => Effect.succeed(true))
        );
        expect(rejected).toBe(true);
      })
    );

    it.effect("writes every document under the packet directory", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const outcome = yield* writeIn({});
        const fs = yield* FileSystem.FileSystem;

        expect(outcome.committed).toBe(true);
        expect(outcome.packetPath).toBe(`goals/${SLUG}`);

        for (const document of sampleDocuments) {
          const contents = yield* fs.readFileString(`goals/${SLUG}/${document.path}`);
          expect(contents).toBe(document.contents);
        }
      })
    );

    it.effect("leaves no staging directory behind after a successful promotion", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        yield* writeIn({});
        const fs = yield* FileSystem.FileSystem;
        const entries = yield* fs.readDirectory("goals");

        expect(A.filter(entries, (entry) => entry.startsWith(".tmp-"))).toEqual([]);
        expect(entries).toContain(SLUG);
      })
    );

    it.effect("refuses to clobber an existing packet and leaves its bytes untouched", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`goals/${SLUG}`, { recursive: true });
        yield* fs.writeFileString(`goals/${SLUG}/README.md`, "hand written\n");

        const outcome = yield* writeIn({}).pipe(
          Effect.map(() => "written"),
          Effect.catchTag("CodexPacketWriteError", (error) => Effect.succeed(error.reason))
        );

        expect(outcome).toBe("packet-exists");
        expect(yield* fs.readFileString(`goals/${SLUG}/README.md`)).toBe("hand written\n");
      })
    );

    it.effect("leaves no packet and no staging directory when a document cannot be staged", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;

        // A file where a document's parent directory must go makes that single
        // staged write fail after earlier documents already landed.
        const outcome = yield* writeIn({
          documents: [doc("README.md", "# ok\n"), doc("ops", "not a directory\n"), doc("ops/manifest.json", "{}\n")],
        }).pipe(
          Effect.map(() => "written"),
          Effect.catchTag("CodexPacketWriteError", (error) => Effect.succeed(error.reason))
        );

        expect(outcome).toBe("staging-failed");
        expect(yield* fs.exists(`goals/${SLUG}`)).toBe(false);
        expect(A.filter(yield* fs.readDirectory("goals"), (entry) => entry.startsWith(".tmp-"))).toEqual([]);
      })
    );
  });

  describe("codex findings verbatim raw evidence", () => {
    it.effect("retains formula refusal for documents that are not Markdown", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const outcome = yield* writeIn({ documents: [doc("ops/export.csv", "=SUM(1,2)\n")] }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsRedactionError", () => Effect.succeed("refused"))
        );
        expect(outcome).toBe("refused");
      })
    );

    // Report bodies are external prose that legitimately quotes local paths.
    // Measured against a real 27-finding export, 4 bodies trip the scan — so a
    // hard refusal here would block roughly one ingest in seven.
    it.effect("reports rather than refuses hits inside verbatim raw evidence", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const outcome = yield* writeIn({
          documents: [
            doc("README.md", "# clean\n"),
            PacketDocument.make({
              path: "raw/reports/CSF-001.md",
              contents: "The resolver reads /home/someone/notes.txt without bounds.\n",
              tracked: false,
              scan: "report",
            }),
          ],
        });

        expect(outcome.committed).toBe(true);
        expect(outcome.reportedEvidence).toEqual(["raw/reports/CSF-001.md (private-home-path)"]);
      })
    );

    it.effect("still refuses the same content in a tracked document", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const outcome = yield* writeIn({
          documents: [doc("findings/CSF-001.md", "The resolver reads /home/someone/notes.txt.\n")],
        }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsRedactionError", () => Effect.succeed("refused"))
        );

        expect(outcome).toBe("refused");
      })
    );
  });

  describe("codex findings packet forced replacement", () => {
    it.effect("replaces an existing packet when force is set", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`goals/${SLUG}/findings`, { recursive: true });
        yield* fs.writeFileString(`goals/${SLUG}/README.md`, "hand written\n");
        yield* fs.writeFileString(`goals/${SLUG}/findings/CSF-999.md`, "stale finding\n");

        const outcome = yield* writeIn({ force: true });

        expect(outcome.committed).toBe(true);
        expect(yield* fs.readFileString(`goals/${SLUG}/README.md`)).toBe(sampleDocuments[0]?.contents);
        // The replaced packet is moved aside, promoted, then removed. Nothing
        // may survive under goals/ once the promotion succeeds.
        expect(A.filter(yield* fs.readDirectory("goals"), (e) => e.includes("-replaced"))).toEqual([]);
        // A replacement is a replacement: files the new packet does not declare
        // must not survive from the packet it replaced.
        expect(yield* fs.exists(`goals/${SLUG}/findings/CSF-999.md`)).toBe(false);
      })
    );

    // The removal is deliberately staged behind the scan. If it ever moves ahead
    // of it, a refused capture would destroy a packet full of hand-written triage
    // prose and write nothing in its place — this is the test that catches that.
    it.effect("leaves the existing packet intact when a forced run is refused by the scan", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`goals/${SLUG}`, { recursive: true });
        yield* fs.writeFileString(`goals/${SLUG}/README.md`, "hand written\n");

        const outcome = yield* writeIn({
          documents: [doc("raw/payload.json", '{"note":"op://Private/OpenAI/credential"}', false)],
          force: true,
        }).pipe(
          Effect.map(() => "written"),
          Effect.catchTag("CodexFindingsRedactionError", () => Effect.succeed("refused"))
        );

        expect(outcome).toBe("refused");
        expect(yield* fs.readFileString(`goals/${SLUG}/README.md`)).toBe("hand written\n");
      })
    );

    it.effect("leaves the existing packet intact when a forced run fails mid-staging", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory(`goals/${SLUG}`, { recursive: true });
        yield* fs.writeFileString(`goals/${SLUG}/README.md`, "hand written\n");

        const outcome = yield* writeIn({
          documents: [doc("README.md", "# ok\n"), doc("ops", "not a directory\n"), doc("ops/manifest.json", "{}\n")],
          force: true,
        }).pipe(
          Effect.map(() => "written"),
          Effect.catchTag("CodexPacketWriteError", (error) => Effect.succeed(error.reason))
        );

        expect(outcome).toBe("staging-failed");
        expect(yield* fs.readFileString(`goals/${SLUG}/README.md`)).toBe("hand written\n");
      })
    );
  });

  describe("codex findings packet dry run", () => {
    it.effect("writes nothing at all while still reporting the plan", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const outcome = yield* writeIn({ dryRun: true });
        const fs = yield* FileSystem.FileSystem;

        expect(outcome.committed).toBe(false);
        expect(outcome.written).toEqual([
          `goals/${SLUG}/README.md`,
          `goals/${SLUG}/ops/manifest.json`,
          `goals/${SLUG}/findings/CSF-001.md`,
          `goals/${SLUG}/raw/.gitignore`,
        ]);
        expect(yield* fs.exists(`goals/${SLUG}`)).toBe(false);
        expect(yield* fs.readDirectory("goals")).toEqual([]);
      })
    );

    it.effect("refuses secret-shaped content in dry run exactly as it would when writing", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const outcome = yield* writeIn({
          documents: [doc("raw/payload.json", '{"cookie":"__cf_bm=AbCdEf12345"}', false)],
          dryRun: true,
        }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsRedactionError", () => Effect.succeed("refused"))
        );

        expect(outcome).toBe("refused");
      })
    );
  });

  describe("codex findings packet redaction refusal", () => {
    it.effect("refuses untracked raw evidence, not only tracked documents", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        const outcome = yield* writeIn({
          documents: [
            doc("README.md", "# clean\n"),
            doc("raw/payload.json", '{"note":"op://Private/OpenAI/credential"}', false),
          ],
        }).pipe(
          Effect.map(() => A.empty<string>()),
          Effect.catchTag("CodexFindingsRedactionError", (error) => Effect.succeed(error.surfaces))
        );

        expect(outcome).toEqual(["raw/payload.json (onepassword-ref)"]);
        expect(yield* fs.exists(`goals/${SLUG}`)).toBe(false);
      })
    );

    it.effect("never reproduces the offending value in the refusal", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const secret = `sk-${"abcdefghijklmnopqrstuv"}`;
        const outcome = yield* writeIn({
          documents: [doc("raw/payload.json", `{"title":"${secret}"}`, false)],
        }).pipe(
          Effect.map(() => "accepted"),
          Effect.catchTag("CodexFindingsRedactionError", (error) =>
            Effect.succeed(`${error.message} ${A.join(error.surfaces, " ")}`)
          )
        );

        expect(outcome).not.toContain(secret);
        expect(outcome).toContain("raw/payload.json (secret-shaped-value)");
      })
    );

    it.effect("refuses a private absolute path before it can reach a tracked file", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const outcome = yield* writeIn({
          documents: [doc("findings/CSF-001.md", "See /home/elpresidank/notes.txt\n")],
        }).pipe(
          Effect.map(() => A.empty<string>()),
          Effect.catchTag("CodexFindingsRedactionError", (error) => Effect.succeed(error.surfaces))
        );

        expect(outcome).toEqual(["findings/CSF-001.md (private-home-path)"]);
      })
    );
  });

  describe("codex findings packet path containment", () => {
    const rejectsPath = (path: string) =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory("goals", { recursive: true });
        return yield* Effect.try(() => PacketDocument.make({ contents: "x\n", path, tracked: true })).pipe(
          Effect.map(() => "accepted"),
          Effect.orElseSucceed(() => "rejected")
        );
      });

    it.effect("rejects a parent-directory traversal in a document path", () =>
      rejectsPath("../escape.md").pipe(Effect.map((outcome) => expect(outcome).toBe("rejected")))
    );

    it.effect("rejects a nested traversal in a document path", () =>
      rejectsPath("findings/../../escape.md").pipe(Effect.map((outcome) => expect(outcome).toBe("rejected")))
    );

    it.effect("rejects an absolute document path", () =>
      rejectsPath("/etc/passwd").pipe(Effect.map((outcome) => expect(outcome).toBe("rejected")))
    );

    it.effect("rejects a dotfile-rooted document path outside the raw allowance", () =>
      rejectsPath(".git/config").pipe(Effect.map((outcome) => expect(outcome).toBe("rejected")))
    );

    it.effect("does not write through a symlinked packet destination", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory("goals", { recursive: true });
        yield* fs.makeDirectory("outside", { recursive: true });
        yield* fs.symlink(`${process.cwd()}/outside`, `goals/${SLUG}`);

        const outcome = yield* writePacket({
          documents: sampleDocuments,
          dryRun: false,
          repoRoot: process.cwd(),
          slug: SLUG,
        }).pipe(
          Effect.map(() => "written"),
          Effect.catchTag("CodexPacketWriteError", (error) => Effect.succeed(error.reason))
        );

        expect(outcome).toBe("packet-exists");
        expect(yield* fs.readDirectory("outside")).toEqual([]);
      })
    );
  });
});
