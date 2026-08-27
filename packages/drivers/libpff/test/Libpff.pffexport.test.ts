import { ArtifactLocator, SourceArtifact } from "@beep/file-processing/Artifact";
import { ExportArchiveOperation } from "@beep/file-processing/Operation";
import { decodeTestOperationIdentifiers } from "@beep/file-processing/test";
import {
  encodePffexportMessageRecordJson,
  makePffexportFileProcessingEngine,
  PFFEXPORT_MESSAGES_SUFFIX,
  PffexportEngineConfig,
  PffexportMessageRecord,
} from "@beep/libpff";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Encoding, FileSystem, Path, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const testLayer = NodeServices.layer;

const provideTestLayer = provideScopedLayer(testLayer);

const decodeMessageRecord = S.decodeUnknownEffect(S.fromJsonString(PffexportMessageRecord));
const PffexportMessageRecordArbitrary = S.toArbitrary(PffexportMessageRecord)(fc);

const stubVersionBanner = 'if [ "$1" = "-V" ]; then printf "pffexport 20260608\\n\\nCopyright (C) test\\n"; exit 0; fi';

const stubPffexport = `#!/usr/bin/env bash
${stubVersionBanner}
target=""
mode="items"
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  if [ "$prev" = "-m" ]; then mode="$arg"; fi
  prev="$arg"
done
source="\${@: -1}"
[ -f "$source" ] || exit 2
case "$mode" in
  recovered) bases="$target.orphans $target.recovered" ;;
  all) bases="$target.export $target.orphans $target.recovered" ;;
  *) bases="$target.export" ;;
esac
for base in $bases; do [ -e "$base" ] && exit 1; done
for base in $bases; do
  inbox="$base/Top of Personal Folders/Inbox/Message00001"
  sent="$base/Top of Personal Folders/Sent Items/Message00001"
  mkdir -p "$inbox/Attachments" "$sent"
  printf 'Subject:\\tQuarterly report\\nSender name:\\tAda Lovelace\\nSender email address:\\tada@example.com\\nClient submit time:\\tJan 02, 2026 03:04:05.000000000 UTC\\n' > "$inbox/OutlookHeaders.txt"
  printf 'From: Ada Lovelace <ada@example.com>\\r\\nTo: grace@example.com\\r\\nSubject: Quarterly report\\r\\nMIME-Version: 1.0\\r\\nContent-Type: multipart/mixed;\\r\\n\\tboundary="orig-boundary"\\r\\nContent-Transfer-Encoding: 7bit\\r\\n\\r\\n' > "$inbox/InternetHeaders.txt"
  printf 'hello body' > "$inbox/Message.txt"
  printf 'pdfbytes' > "$inbox/Attachments/report.pdf"
  printf 'Subject:\\tRe: hello\\nSender name:\\tGrace Hopper\\nSender email address:\\tgrace@example.com\\n' > "$sent/OutlookHeaders.txt"
  printf 'sent body' > "$sent/Message.txt"
done
exit 0
`;

const unevenBudgetStub = `#!/usr/bin/env bash
${stubVersionBanner}
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
inbox="$target.export/Top of Personal Folders/Inbox"
large="$inbox/Message00001"
small="$inbox/Message00002"
mkdir -p "$large" "$small"
printf 'Subject:\tlarge\n' > "$large/OutlookHeaders.txt"
printf 'Subject:\tsmall\n' > "$small/OutlookHeaders.txt"
printf 'x%.0s' {1..2048} > "$large/Message.txt"
printf 'ok' > "$small/Message.txt"
exit 0
`;

// One item whose only body is a single physical HTML line over the RFC 5322
// 998-octet limit; the assembled EML must re-encode that part as base64.
const overlongBodyStub = `#!/usr/bin/env bash
${stubVersionBanner}
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
item="$target.export/Top of Personal Folders/Inbox/Message00001"
mkdir -p "$item"
printf 'Subject:\\toverlong body\\n' > "$item/OutlookHeaders.txt"
long=$(printf 'x%.0s' $(seq 1 1200))
printf '<p>%s</p>' "$long" > "$item/Message.html"
exit 0
`;

// Simulates pffexport writing an item file that already owns the driver's
// Message.eml name; the driver must not overwrite engine output.
const collidingStub = `#!/usr/bin/env bash
${stubVersionBanner}
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
item="$target.export/Top of Personal Folders/Inbox/Message00001"
mkdir -p "$item"
printf 'Subject:\\tcollision\\n' > "$item/OutlookHeaders.txt"
printf 'body text' > "$item/Message.txt"
printf 'engine-owned eml bytes' > "$item/Message.eml"
exit 0
`;

// Dies from a signal after a successful -V probe: the engine is present, so
// the failure must surface as a process failure, not engine-unavailable.
const signalStub = `#!/usr/bin/env bash
${stubVersionBanner}
kill -SEGV $$
`;

const sleepingStub = `#!/usr/bin/env bash
${stubVersionBanner}
sleep 30
`;

const failingStub = `#!/usr/bin/env bash
exit 2
`;

const corruptFailingStub = `#!/usr/bin/env bash
${stubVersionBanner}
printf 'input archive is corrupt\n' >&2
exit 2
`;

const makeMissingBinaryEngine = (exportRoot: string) =>
  makePffexportFileProcessingEngine(
    PffexportEngineConfig.make({ exportRoot, pffexportPath: "/nonexistent/pffexport-missing" })
  );

const fixture = Effect.fn(function* (stubScript: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "libpff-pffexport-test-" });
  const stubPath = path.join(dir, "pffexport-stub");
  yield* fs.writeFileString(stubPath, stubScript);
  yield* fs.chmod(stubPath, 0o755);
  const sourcePath = path.join(dir, "mailbox.pst");
  const sourceBytes = new TextEncoder().encode("not a real pst");
  yield* fs.writeFile(sourcePath, sourceBytes);
  const exportRoot = path.join(dir, "out");

  const { artifactId, digest, operationId } = yield* decodeTestOperationIdentifiers();
  const locatorValue = yield* S.decodeEffect(PosixPath)(sourcePath);
  const relativePath = yield* S.decodeEffect(PosixPath)("mailbox.pst");

  const operation = ExportArchiveOperation.make({
    format: "pst",
    operationId,
    operationKind: "export-archive",
    preference: { engine: "libpff" },
    source: SourceArtifact.make({
      digest,
      extension: "pst",
      id: artifactId,
      locator: ArtifactLocator.make({ kind: "file", value: locatorValue }),
      name: "mailbox.pst",
      relativePath,
      sizeBytes: NonNegativeInt.make(sourceBytes.length),
      bytes: sourceBytes,
    }),
  });

  return { exportRoot, operation, stubPath };
});

const readExported = Effect.fn(function* (exportRoot: string, relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(exportRoot, relativePath));
});

describe("makePffexportFileProcessingEngine", () => {
  it("round-trips schema-derived message records through the JSONL string codec", () =>
    fc.assert(
      fc.property(PffexportMessageRecordArbitrary, (record) => {
        const json = Effect.runSync(encodePffexportMessageRecordJson(record));
        const decoded = Effect.runSync(decodeMessageRecord(json));
        expect(Effect.runSync(encodePffexportMessageRecordJson(decoded))).toBe(json);
      }),
      fcRuns(25)
    ));

  it.effect(
    "exports directly from a file locator when the caller omits source bytes",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;
        const operationWithoutBytes = ExportArchiveOperation.make({
          ...operation,
          source: SourceArtifact.make(sourceWithoutBytes),
        });

        const result = yield* engine.exportArchive(operationWithoutBytes);

        expect(result.children.length).toBeGreaterThan(0);
        expect(result.sourceArtifactId).toBe(operation.source.id);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "exports children, assembles EML artifacts, and writes JSONL metadata records",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        expect(engine.descriptor.version).toBe("20260608");

        const result = yield* engine.exportArchive(operation);

        expect(result.engine).toBe("libpff");
        expect(result.sourceArtifactId).toBe(operation.source.id);

        const relativePaths = result.children.map((child) => child.relativePath);
        expect(relativePaths).toStrictEqual([...relativePaths].sort());
        expect(result.children.every((child) => child.id.startsWith("artifact:"))).toBe(true);

        const emlChildren = result.children.filter((child) => child.relativePath.endsWith("/Message.eml"));
        expect(emlChildren).toHaveLength(2);
        expect(emlChildren.every((child) => child.mediaType === "message/rfc822")).toBe(true);

        const jsonlName = `${operation.source.id}${PFFEXPORT_MESSAGES_SUFFIX}`;
        expect(relativePaths).toContain(jsonlName);
        expect(relativePaths.some((value) => value.endsWith("Attachments/report.pdf"))).toBe(true);
        expect(result.children).toHaveLength(9);

        const inboxEml = yield* readExported(
          exportRoot,
          `${operation.source.id}.export/Top of Personal Folders/Inbox/Message00001/Message.eml`
        );
        expect(inboxEml).toContain("From: Ada Lovelace <ada@example.com>");
        expect(inboxEml).toContain("To: grace@example.com");
        expect(inboxEml).toContain('Content-Type: multipart/mixed; boundary="=_beep-');
        expect(inboxEml).not.toContain("orig-boundary");
        expect(inboxEml).not.toContain("7bit");
        expect(inboxEml).toContain("hello body");
        expect(inboxEml).toContain('filename="report.pdf"');
        expect(inboxEml).toContain("cGRmYnl0ZXM=");

        const sentEml = yield* readExported(
          exportRoot,
          `${operation.source.id}.export/Top of Personal Folders/Sent Items/Message00001/Message.eml`
        );
        expect(sentEml).toContain('From: "Grace Hopper" <grace@example.com>');
        expect(sentEml).toContain("Subject: Re: hello");
        expect(sentEml).toContain("Content-Type: text/plain; charset=utf-8");
        expect(sentEml).toContain("sent body");

        const jsonl = yield* readExported(exportRoot, jsonlName);
        const lines = jsonl.trimEnd().split("\n");
        expect(lines).toHaveLength(2);

        const inboxRecord = yield* decodeMessageRecord(lines[0]);
        expect(inboxRecord.folderPath).toBe("Top of Personal Folders/Inbox");
        expect(inboxRecord.messagePath.endsWith("Inbox/Message00001")).toBe(true);
        expect(inboxRecord.headers.Subject).toBe("Quarterly report");
        expect(inboxRecord.body?.relativePath.endsWith("Message.txt")).toBe(true);
        expect(inboxRecord.eml?.relativePath.endsWith("Message.eml")).toBe(true);
        expect(inboxRecord.attachments).toHaveLength(1);
        expect(inboxRecord.attachments[0]?.relativePath.endsWith("Attachments/report.pdf")).toBe(true);

        const sentRecord = yield* decodeMessageRecord(lines[1]);
        expect(sentRecord.folderPath).toBe("Top of Personal Folders/Sent Items");
        expect(sentRecord.attachments).toHaveLength(0);
        expect(sentRecord.eml?.relativePath.endsWith("Message.eml")).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "walks both recovered target trees when the export mode selects them",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportMode: "recovered", exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(operation);

        expect(result.children.length).toBeGreaterThan(0);
        expect(result.children.some((child) => child.relativePath.includes(".orphans/"))).toBe(true);
        expect(result.children.some((child) => child.relativePath.includes(".recovered/"))).toBe(true);
        expect(result.children.some((child) => child.relativePath.includes(".export/"))).toBe(false);
        expect(result.children.some((child) => child.relativePath.endsWith("/Message.eml"))).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "walks all three target trees under the all export mode",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportMode: "all", exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(operation);

        expect(result.children.some((child) => child.relativePath.includes(".export/"))).toBe(true);
        expect(result.children.some((child) => child.relativePath.includes(".orphans/"))).toBe(true);
        expect(result.children.some((child) => child.relativePath.includes(".recovered/"))).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "re-encodes an over-long body line as base64 in the assembled EML",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(overlongBodyStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(operation);

        expect(result.children.some((child) => child.relativePath.endsWith("/Message.eml"))).toBe(true);

        const eml = yield* readExported(
          exportRoot,
          `${operation.source.id}.export/Top of Personal Folders/Inbox/Message00001/Message.eml`
        );
        expect(eml).toContain("Content-Type: text/html; charset=utf-8");
        expect(eml).toContain("Content-Transfer-Encoding: base64");

        const payload = eml.slice(eml.indexOf("\r\n\r\n") + 4);
        expect(payload.split("\r\n").every((line) => line.length <= 76)).toBe(true);
        expect(Result.getOrElse(Encoding.decodeBase64String(payload.split("\r\n").join("")), () => "")).toBe(
          `<p>${"x".repeat(1200)}</p>`
        );
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "never overwrites an engine-owned Message.eml and keeps children unique",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(collidingStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(operation);

        expect(result.warnings.some((warning) => warning.includes("already contains Message.eml"))).toBe(true);
        const relativePaths = result.children.map((child) => child.relativePath);
        expect(new Set(relativePaths).size).toBe(relativePaths.length);

        const engineEml = yield* readExported(
          exportRoot,
          `${operation.source.id}.export/Top of Personal Folders/Inbox/Message00001/Message.eml`
        );
        expect(engineEml).toBe("engine-owned eml bytes");

        const jsonlName = `${operation.source.id}${PFFEXPORT_MESSAGES_SUFFIX}`;
        const jsonl = yield* readExported(exportRoot, jsonlName);
        const record = yield* decodeMessageRecord(jsonl.trimEnd().split("\n")[0]);
        expect(record.eml).toBeUndefined();
        expect(record.body?.relativePath.endsWith("Message.txt")).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "maps a signal-killed pffexport process to archive-export-failed",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(signalStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        expect(engine.descriptor.version).toBe("20260608");

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

        expect(error.reason).toBe("archive-export-failed");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  // it.live: the timeout races a real subprocess, and the frozen TestClock of
  // it.effect would never fire Effect.timeoutOrElse against it.
  it.live(
    "maps a hung pffexport process to operation-timed-out",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(sleepingStub);
        const engine = yield* makePffexportFileProcessingEngine(
          yield* S.decodeEffect(PffexportEngineConfig)({
            exportRoot,
            pffexportPath: stubPath,
            timeoutMillis: 250,
          })
        );

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

        expect(error.reason).toBe("operation-timed-out");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "skips EML assembly with warnings when the materialization budget is exceeded",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(
          ExportArchiveOperation.make({ ...operation, maxMaterializedBytes: 1 })
        );

        expect(result.children.some((child) => child.relativePath.endsWith("/Message.eml"))).toBe(false);
        expect(
          result.warnings.filter((warning) => warning.includes("materialization budget was exceeded"))
        ).toHaveLength(2);

        const jsonlName = `${operation.source.id}${PFFEXPORT_MESSAGES_SUFFIX}`;
        const jsonl = yield* readExported(exportRoot, jsonlName);
        const record = yield* decodeMessageRecord(jsonl.trimEnd().split("\n")[0]);
        expect(record.eml).toBeUndefined();
        expect(record.body?.relativePath.endsWith("Message.txt")).toBe(true);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "continues evaluating later messages after an oversized item exceeds the budget",
    Effect.fnUntraced(
      function* () {
        const { operation, exportRoot, stubPath } = yield* fixture(unevenBudgetStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(
          ExportArchiveOperation.make({ ...operation, maxMaterializedBytes: 1024 })
        );
        const emlChildren = result.children.filter((child) => child.relativePath.endsWith("/Message.eml"));

        expect(emlChildren).toHaveLength(1);
        expect(emlChildren[0]?.relativePath).toContain("Message00002/Message.eml");
        expect(
          result.warnings.filter((warning) => warning.includes("materialization budget was exceeded"))
        ).toHaveLength(1);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "fails on stale export outputs under the default existing-export policy",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        yield* fs.makeDirectory(path.join(exportRoot, `${operation.source.id}.recovered`), { recursive: true });
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

        expect(error.reason).toBe("archive-export-failed");
        expect(error.details).toBeUndefined();
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  for (const existingExportPolicy of ["fail", "replace"] as const) {
    it.effect(
      `fails while another export claims the same target under the ${existingExportPolicy} policy`,
      Effect.fnUntraced(
        function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
          yield* fs.makeDirectory(path.join(exportRoot, `${operation.source.id}.claim`), { recursive: true });
          const engine = yield* makePffexportFileProcessingEngine(
            PffexportEngineConfig.make({ existingExportPolicy, exportRoot, pffexportPath: stubPath })
          );

          const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

          expect(error.reason).toBe("archive-export-failed");
        },
        Effect.scoped,
        provideTestLayer
      )
    );
  }

  it.effect(
    "replaces stale export outputs when configured and releases the claim",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const staleTree = path.join(exportRoot, `${operation.source.id}.export`);
        yield* fs.makeDirectory(staleTree, { recursive: true });
        yield* fs.writeFileString(path.join(staleTree, "stale-junk.txt"), "stale");
        yield* fs.makeDirectory(path.join(exportRoot, `${operation.source.id}.recovered`), { recursive: true });
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ existingExportPolicy: "replace", exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(operation);

        expect(result.children.length).toBeGreaterThan(0);
        expect(result.children.some((child) => child.relativePath.includes("stale-junk"))).toBe(false);
        expect(yield* fs.exists(path.join(exportRoot, `${operation.source.id}.claim`))).toBe(false);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "maps non-zero pffexport exits to archive-export-failed",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(failingStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        expect(engine.descriptor.version).toBeUndefined();

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

        expect(error.reason).toBe("archive-export-failed");
        expect(error.details).toStrictEqual({ exitCode: "2" });
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "maps a missing pffexport binary to engine-unavailable",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation } = yield* fixture(stubPffexport);
        const engine = yield* makeMissingBinaryEngine(exportRoot);

        expect(engine.descriptor.version).toBeUndefined();

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

        expect(error.reason).toBe("engine-unavailable");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "classifies bounded process diagnostics without retaining raw stderr",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(corruptFailingStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

        expect(error.details).toStrictEqual({ exitCode: "2", processClassification: "corrupt" });
        expect(error.message).not.toContain("input archive is corrupt");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "rejects non-pst formats without spawning",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation } = yield* fixture(stubPffexport);
        const engine = yield* makeMissingBinaryEngine(exportRoot);

        const error = yield* engine
          .exportArchive(ExportArchiveOperation.make({ ...operation, format: "docx" }))
          .pipe(Effect.flip);

        expect(error.reason).toBe("unsupported-file-format");
      },
      Effect.scoped,
      provideTestLayer
    )
  );
});
