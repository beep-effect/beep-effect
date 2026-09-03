import {
  ArtifactId,
  ArtifactLocator,
  ContentDigest,
  OperationId,
  SourceArtifact,
} from "@beep/file-processing/Artifact";
import { ExportArchiveOperation, ExtractFileOperation } from "@beep/file-processing/Operation";
import {
  encodePffexportMessageRecordJson,
  makePffexportFileProcessingEngine,
  PFFEXPORT_MESSAGES_SUFFIX,
  PffexportEngineConfig,
  PffexportMessageRecord,
} from "@beep/libpff";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Encoding, FileSystem, Path, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";

const testLayer = NodeServices.layer;

const provideTestLayer = provideScopedLayer(testLayer);

const decodeMessageRecord = S.decodeUnknownEffect(S.fromJsonString(PffexportMessageRecord));
const PffexportMessageRecordArbitrary = S.toArbitrary(PffexportMessageRecord)(fc);
const fixtureDigestHex = "166df44db090f14dbb3ec7730fc17e78c170477163a6c913e5485d075c4b92d0";

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
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
sleep 1
printf 'late write' > "$target.late"
`;

const symlinkOutputStub = `#!/usr/bin/env bash
${stubVersionBanner}
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
mkdir -p "$target.export"
ln -s /etc/passwd "$target.export/escaped"
exit 0
`;

const failingStub = `#!/usr/bin/env bash
exit 2
`;

const emptyOutputStub = `#!/usr/bin/env bash
${stubVersionBanner}
exit 0
`;

const headersOnlyStub = `#!/usr/bin/env bash
${stubVersionBanner}
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
item="$target.export/Top of Personal Folders/Inbox/Message00001"
mkdir -p "$item"
printf 'Subject:\theaders only\n' > "$item/OutlookHeaders.txt"
exit 0
`;

const corruptFailingStub = `#!/usr/bin/env bash
${stubVersionBanner}
printf 'input archive is corrupt\n' >&2
exit 2
`;

const bwrapStub = `#!/usr/bin/env bash
set -eu
mount_hosts=()
mount_targets=()
required_bind="$(dirname "$0")/interpreter"
required_bind_seen=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --ro-bind|--bind)
      [ "$1" != "--ro-bind" ] || [ "$2" != "/" ] || [ "$3" != "/" ] || exit 98
      mount_hosts+=("$2")
      mount_targets+=("$3")
      if [ "$1" = "--ro-bind" ] && [ "$2" = "$required_bind" ] && [ "$3" = "$required_bind" ]; then
        required_bind_seen=1
      fi
      shift 3
      ;;
    --)
      shift
      break
      ;;
    *)
      shift
      ;;
  esac
done
[ ! -d "$required_bind" ] || [ "$required_bind_seen" -eq 1 ] || exit 97
command="$1"
shift
mapped_command="$command"
for index in "\${!mount_targets[@]}"; do
  target="\${mount_targets[$index]}"
  host="\${mount_hosts[$index]}"
  if [ "$command" = "$target" ]; then mapped_command="$host"; fi
done
mapped=()
for argument in "$@"; do
  mapped_argument="$argument"
  for index in "\${!mount_targets[@]}"; do
    target="\${mount_targets[$index]}"
    host="\${mount_hosts[$index]}"
    if [ "$argument" = "$target" ]; then
      mapped_argument="$host"
    elif [[ "$argument" = "$target/"* ]]; then
      mapped_argument="$host\${argument#$target}"
    fi
  done
  mapped+=("$mapped_argument")
done
exec "$mapped_command" "\${mapped[@]}"
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

  const artifactId = yield* S.decodeEffect(ArtifactId)(`artifact:${fixtureDigestHex}`);
  const digest = yield* S.decodeEffect(ContentDigest)(`sha256:${fixtureDigestHex}`);
  const operationId = yield* S.decodeEffect(OperationId)(`operation:${fixtureDigestHex}`);
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
        const config = yield* S.decodeEffect(PffexportEngineConfig)({
          exportRoot,
          pffexportPath: stubPath,
        });
        const engine = yield* makePffexportFileProcessingEngine(config);
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

  it.live(
    "isolates a file-locator export inside bubblewrap when configured",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const bwrapPath = "/usr/bin/bwrap";
        if (!(yield* fs.exists(bwrapPath))) return;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({
            bwrapPath: O.some(bwrapPath),
            exportRoot,
            pffexportPath: stubPath,
          })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;
        const result = yield* engine.exportArchive(
          ExportArchiveOperation.make({
            ...operation,
            source: SourceArtifact.make(sourceWithoutBytes),
          })
        );

        expect(result.children.length).toBeGreaterThan(0);
        expect(result.warnings).toStrictEqual([]);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "binds an external shebang interpreter prefix into the sandbox",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const fixtureRoot = path.dirname(stubPath);
        const interpreterPrefix = path.join(fixtureRoot, "interpreter");
        const interpreterPath = path.join(interpreterPrefix, "bin", "bash");
        const launcherPath = path.join(fixtureRoot, "launcher", "bin", "pffexport");
        const bwrapPath = path.join(fixtureRoot, "bwrap-stub");
        yield* fs.makeDirectory(path.dirname(interpreterPath), { recursive: true });
        yield* fs.makeDirectory(path.dirname(launcherPath), { recursive: true });
        yield* fs.symlink("/bin/bash", interpreterPath);
        yield* fs.writeFileString(launcherPath, stubPffexport.replace("#!/usr/bin/env bash", `#!${interpreterPath}`));
        yield* fs.chmod(launcherPath, 0o755);
        yield* fs.writeFileString(bwrapPath, bwrapStub);
        yield* fs.chmod(bwrapPath, 0o755);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({
            bwrapPath: O.some(bwrapPath),
            exportRoot,
            pffexportPath: launcherPath,
          })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;

        const result = yield* engine.exportArchive(
          ExportArchiveOperation.make({
            ...operation,
            source: SourceArtifact.make(sourceWithoutBytes),
          })
        );

        expect(result.children.length).toBeGreaterThan(0);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.live(
    "uses a standard-root env interpreter without an additional runtime bind",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const bwrapPath = path.join(path.dirname(stubPath), "standard-env-bwrap");
        const bwrapArgumentsPath = path.join(path.dirname(stubPath), "standard-env-bwrap-arguments");
        yield* fs.writeFileString(
          stubPath,
          stubPffexport.replace("#!/usr/bin/env bash", "#!/usr/bin/env -S -a pffexport -u BEEP_UNUSED bash")
        );
        yield* fs.chmod(stubPath, 0o755);
        yield* fs.writeFileString(
          bwrapPath,
          bwrapStub.replace("set -eu", `set -eu\nprintf '%s\\n' "$@" > ${bwrapArgumentsPath}`).replace(
            'exec "$mapped_command" "${mapped[@]}"',
            `if [ "$mapped_command" = "/usr/bin/env" ] && [ "\${mapped[0]}" = "-S" ]; then
  exec /bin/bash "\${mapped[2]}" "\${mapped[@]:3}"
fi
exec "$mapped_command" "\${mapped[@]}"`
          )
        );
        yield* fs.chmod(bwrapPath, 0o755);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ bwrapPath: O.some(bwrapPath), exportRoot, pffexportPath: stubPath })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;

        const result = yield* engine.exportArchive(
          ExportArchiveOperation.make({ ...operation, source: SourceArtifact.make(sourceWithoutBytes) })
        );

        expect(result.children.length).toBeGreaterThan(0);
        const bwrapArguments = yield* fs.readFileString(bwrapArgumentsPath);
        expect(bwrapArguments).toContain("--setenv\nPATH\n/usr/bin:/bin\n");
        expect(bwrapArguments).toContain(`--\n/usr/bin/env\n-S\n-a pffexport -u BEEP_UNUSED bash\n${stubPath}\n`);
        expect(bwrapArguments).not.toContain("--ro-bind\n/\n/\n");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "fails closed when a sandboxed executable cannot be resolved",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const bwrapPath = path.join(path.dirname(stubPath), "unresolved-command-bwrap");
        yield* fs.writeFileString(bwrapPath, bwrapStub);
        yield* fs.chmod(bwrapPath, 0o755);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({
            bwrapPath: O.some(bwrapPath),
            exportRoot,
            pffexportPath: "beep-definitely-missing-pffexport",
          })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;

        const error = yield* engine
          .exportArchive(ExportArchiveOperation.make({ ...operation, source: SourceArtifact.make(sourceWithoutBytes) }))
          .pipe(Effect.flip);

        expect(error.reason).toBe("engine-unavailable");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "binds an external canonical target reached through a covered shebang symlink",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const fixtureRoot = path.dirname(stubPath);
        const interpreterPrefix = path.join(fixtureRoot, "interpreter");
        const interpreterPath = path.join(interpreterPrefix, "bin", "bash");
        const coveredInterpreterPath = path.join("/var/tmp", `${path.basename(fixtureRoot)}-bash`);
        const launcherPath = path.join(fixtureRoot, "launcher", "bin", "pffexport");
        const bwrapPath = path.join(fixtureRoot, "bwrap-stub");
        yield* fs.makeDirectory(path.dirname(interpreterPath), { recursive: true });
        yield* fs.makeDirectory(path.dirname(launcherPath), { recursive: true });
        yield* fs.copy("/bin/bash", interpreterPath);
        yield* fs.chmod(interpreterPath, 0o755);
        yield* Effect.acquireRelease(fs.symlink(interpreterPath, coveredInterpreterPath), () =>
          fs.remove(coveredInterpreterPath).pipe(Effect.ignore)
        );
        yield* fs.writeFileString(
          launcherPath,
          stubPffexport.replace("#!/usr/bin/env bash", `#!${coveredInterpreterPath}`)
        );
        yield* fs.chmod(launcherPath, 0o755);
        yield* fs.writeFileString(bwrapPath, bwrapStub);
        yield* fs.chmod(bwrapPath, 0o755);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({
            bwrapPath: O.some(bwrapPath),
            exportRoot,
            pffexportPath: launcherPath,
          })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;

        const result = yield* engine.exportArchive(
          ExportArchiveOperation.make({
            ...operation,
            source: SourceArtifact.make(sourceWithoutBytes),
          })
        );

        expect(result.children.length).toBeGreaterThan(0);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.live(
    "invokes an env-selected interpreter through its canonical path-sensitive prefix",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const fixtureRoot = path.dirname(stubPath);
        const interpreterPrefix = path.join(fixtureRoot, "interpreter");
        const commandName = `${path.basename(fixtureRoot)} bash`;
        const interpreterPath = path.join(interpreterPrefix, "bin", commandName);
        const commandDirectory = path.dirname(process.execPath);
        const commandPath = path.join(commandDirectory, commandName);
        const launcherPath = path.join(fixtureRoot, "launcher", "bin", "pffexport");
        const bwrapPath = path.join(fixtureRoot, "bwrap-stub");
        const bwrapArgumentsPath = path.join(fixtureRoot, "bwrap-arguments");
        yield* fs.makeDirectory(path.dirname(interpreterPath), { recursive: true });
        yield* fs.makeDirectory(path.dirname(launcherPath), { recursive: true });
        yield* fs.copy("/bin/bash", interpreterPath);
        yield* fs.chmod(interpreterPath, 0o755);
        yield* Effect.acquireRelease(fs.symlink(interpreterPath, commandPath), () =>
          fs.remove(commandPath).pipe(Effect.ignore)
        );
        const splitString = `'${commandName}' -c 'exec /bin/bash "$0" "$@"'`;
        yield* fs.writeFileString(
          launcherPath,
          stubPffexport.replace("#!/usr/bin/env bash", `#!/usr/bin/env -S ${splitString}`)
        );
        yield* fs.chmod(launcherPath, 0o755);
        yield* fs.writeFileString(
          bwrapPath,
          bwrapStub.replace("set -eu", `set -eu\nprintf '%s\\n' "$@" > ${bwrapArgumentsPath}`)
        );
        yield* fs.chmod(bwrapPath, 0o755);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({
            bwrapPath: O.some(bwrapPath),
            exportRoot,
            pffexportPath: launcherPath,
          })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;

        const result = yield* engine.exportArchive(
          ExportArchiveOperation.make({
            ...operation,
            source: SourceArtifact.make(sourceWithoutBytes),
          })
        );

        expect(result.children.length).toBeGreaterThan(0);
        const bwrapArguments = yield* fs.readFileString(bwrapArgumentsPath);
        expect(bwrapArguments).toContain(`--ro-bind\n${interpreterPrefix}\n${interpreterPrefix}\n`);
        expect(bwrapArguments).toContain("--setenv\nPATH\n");
        expect(bwrapArguments).toContain(":/usr/bin:/bin\n");
        expect(bwrapArguments).toContain(`--\n/usr/bin/env\n-S\n${splitString}\n${launcherPath}\n`);
        expect(bwrapArguments).not.toContain(`--\n${interpreterPath}\n`);
        expect(bwrapArguments).not.toContain(`/usr/bin/${commandName}`);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "rejects malformed or unavailable sandbox shebang interpreters",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cases = [
          ["env-without-command", "#!/usr/bin/env -S", "archive-export-failed"],
          ["missing-env-command", "#!/usr/bin/env beep-missing-sandbox-runtime", "engine-unavailable"],
          ["missing-direct-interpreter", "#!/beep/missing/sandbox-runtime", "engine-unavailable"],
          ["directory-interpreter", "#!$FIXTURE_ROOT", "engine-unavailable"],
        ] as const;

        for (const [name, shebang, expectedReason] of cases) {
          const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
          const fixtureRoot = path.dirname(stubPath);
          const launcherPath = path.join(fixtureRoot, `${name}-pffexport`);
          const bwrapPath = path.join(fixtureRoot, `${name}-bwrap`);
          yield* fs.writeFileString(launcherPath, stubPffexport);
          yield* fs.chmod(launcherPath, 0o755);
          yield* fs.writeFileString(bwrapPath, bwrapStub);
          yield* fs.chmod(bwrapPath, 0o755);
          const engine = yield* makePffexportFileProcessingEngine(
            PffexportEngineConfig.make({
              bwrapPath: O.some(bwrapPath),
              exportRoot,
              pffexportPath: launcherPath,
            })
          );
          yield* fs.writeFileString(
            launcherPath,
            stubPffexport.replace("#!/usr/bin/env bash", Str.replace("$FIXTURE_ROOT", fixtureRoot)(shebang))
          );
          yield* fs.chmod(launcherPath, 0o755);
          const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;

          const error = yield* engine
            .exportArchive(
              ExportArchiveOperation.make({
                ...operation,
                source: SourceArtifact.make(sourceWithoutBytes),
              })
            )
            .pipe(Effect.flip);

          expect(error.reason, name).toBe(expectedReason);
        }
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "rejects non-file sources without bytes and direct extraction",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;
        const syntheticSource = SourceArtifact.make({
          ...sourceWithoutBytes,
          locator: ArtifactLocator.make({ kind: "synthetic", value: operation.source.relativePath }),
        });
        const exportError = yield* engine
          .exportArchive(ExportArchiveOperation.make({ ...operation, source: syntheticSource }))
          .pipe(Effect.flip);
        const extractError = yield* engine
          .extract(
            ExtractFileOperation.make({
              format: "pst",
              operationId: operation.operationId,
              operationKind: "extract",
              preference: { engine: "libpff" },
              source: operation.source,
            })
          )
          .pipe(Effect.flip);

        expect(exportError.reason).toBe("archive-export-failed");
        expect(extractError.reason).toBe("unsupported-file-format");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "reports a successful pffexport run that produces no children",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(emptyOutputStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(operation);

        expect(result.children).toStrictEqual([]);
        expect(result.warnings).toContain("pffexport produced no exported children for this archive.");
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "assembles a headers-only message without an exported body",
    Effect.fnUntraced(
      function* () {
        const { exportRoot, operation, stubPath } = yield* fixture(headersOnlyStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const result = yield* engine.exportArchive(operation);

        expect(result.children.some((child) => child.relativePath.endsWith("/Message.eml"))).toBe(false);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "maps filesystem failures at each export traversal boundary",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        for (const failurePoint of [
          "makeDirectory",
          "exists",
          "readDirectory",
          "realPath",
          "stat",
          "readFileString",
          "readFile",
          "writeFile",
          "writeMessagesJsonl",
          "sourceSnapshot",
        ] as const) {
          const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
          const missingPath = path.join(path.dirname(exportRoot), "missing-for-injected-failure");
          const injectedFailure = fs.stat(missingPath);
          const failingFileSystem = FileSystem.FileSystem.of({
            ...fs,
            exists: Effect.fn("LibpffPffexportTest.failingExists")((candidate) =>
              failurePoint === "exists" && candidate.endsWith(".export")
                ? injectedFailure.pipe(Effect.as(false))
                : fs.exists(candidate)
            ),
            makeDirectory: Effect.fn("LibpffPffexportTest.failingMakeDirectory")((candidate, options) =>
              failurePoint === "makeDirectory" && candidate === exportRoot
                ? injectedFailure.pipe(Effect.asVoid)
                : fs.makeDirectory(candidate, options)
            ),
            readDirectory: Effect.fn("LibpffPffexportTest.failingReadDirectory")((candidate, options) =>
              failurePoint === "readDirectory" && candidate.endsWith(".export")
                ? injectedFailure.pipe(Effect.as([]))
                : fs.readDirectory(candidate, options)
            ),
            readFile: Effect.fn("LibpffPffexportTest.failingReadFile")((candidate) =>
              failurePoint === "readFile" && candidate.endsWith("report.pdf")
                ? injectedFailure.pipe(Effect.as(new Uint8Array()))
                : fs.readFile(candidate)
            ),
            readFileString: Effect.fn("LibpffPffexportTest.failingReadFileString")((candidate, encoding) =>
              failurePoint === "readFileString" && candidate.endsWith("OutlookHeaders.txt")
                ? injectedFailure.pipe(Effect.as(""))
                : fs.readFileString(candidate, encoding)
            ),
            realPath: Effect.fn("LibpffPffexportTest.failingRealPath")((candidate) =>
              failurePoint === "realPath" && candidate === exportRoot
                ? injectedFailure.pipe(Effect.as(candidate))
                : fs.realPath(candidate)
            ),
            stat: Effect.fn("LibpffPffexportTest.failingStat")((candidate) =>
              failurePoint === "stat" && candidate.includes(".export/") ? injectedFailure : fs.stat(candidate)
            ),
            writeFile: Effect.fn("LibpffPffexportTest.failingWriteFile")((candidate, data, options) =>
              (failurePoint === "writeFile" && candidate.endsWith("Message.eml")) ||
              (failurePoint === "writeMessagesJsonl" && candidate.endsWith(PFFEXPORT_MESSAGES_SUFFIX)) ||
              (failurePoint === "sourceSnapshot" && candidate.endsWith("source.pst"))
                ? injectedFailure.pipe(Effect.asVoid)
                : fs.writeFile(candidate, data, options)
            ),
          });
          const engine = yield* makePffexportFileProcessingEngine(
            PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
          ).pipe(Effect.provideService(FileSystem.FileSystem, failingFileSystem));

          const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

          expect(error.reason, failurePoint).toBe("archive-export-failed");
        }
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "resolves and binds a bare pffexport executable outside sandbox runtime roots",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { exportRoot, operation, stubPath } = yield* fixture(stubPffexport);
        const bwrapPath = path.join(path.dirname(stubPath), "bwrap-stub");
        yield* fs.writeFileString(bwrapPath, bwrapStub);
        yield* fs.chmod(bwrapPath, 0o755);
        const commandName = path.basename(path.dirname(stubPath));
        const commandPath = path.resolve(import.meta.dirname, "../../../..", "node_modules", ".bin", commandName);
        yield* Effect.acquireRelease(fs.symlink(stubPath, commandPath), () =>
          fs.remove(commandPath).pipe(Effect.ignore)
        );
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({
            bwrapPath: O.some(bwrapPath),
            exportRoot,
            pffexportPath: commandName,
          })
        );
        const { bytes: _bytes, ...sourceWithoutBytes } = operation.source;

        const result = yield* engine.exportArchive(
          ExportArchiveOperation.make({
            ...operation,
            source: SourceArtifact.make(sourceWithoutBytes),
          })
        );

        expect(result.children.length).toBeGreaterThan(0);
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
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
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
        yield* Effect.sleep("1250 millis");
        expect(yield* fs.exists(path.join(exportRoot, `${operation.source.id}.late`))).toBe(false);
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
    "requires the quota sandbox and retains no output when a ceiling is configured",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const { operation, exportRoot, stubPath } = yield* fixture(stubPffexport);
        const config = yield* S.decodeEffect(PffexportEngineConfig)({
          exportRoot,
          maxOutputBytes: 1,
          pffexportPath: stubPath,
        });
        const engine = yield* makePffexportFileProcessingEngine(config);

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

        expect(error.reason).toBe("archive-export-failed");
        expect(yield* fs.readDirectory(exportRoot)).toStrictEqual([]);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "maps quota exhaustion before host publication to an output-limit failure",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { operation, exportRoot, stubPath } = yield* fixture(stubPffexport);
        const fixtureRoot = path.dirname(stubPath);
        const bwrapPath = path.join(fixtureRoot, "quota-bwrap-stub");
        const systemdRunPath = path.join(fixtureRoot, "systemd-run-stub");
        const argumentsPath = path.join(fixtureRoot, "quota-bwrap-arguments");
        yield* fs.writeFileString(
          bwrapPath,
          `#!/usr/bin/env bash
printf '%s\n' "$@" > ${argumentsPath}
exit 97
`
        );
        yield* fs.writeFileString(
          systemdRunPath,
          `#!/usr/bin/env bash
set -eu
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--" ]; then shift; break; fi
  shift
done
exec "$@"
`
        );
        yield* Effect.forEach([bwrapPath, systemdRunPath], (file) => fs.chmod(file, 0o755), { discard: true });
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({
            bwrapPath: O.some(bwrapPath),
            exportRoot,
            maxOutputBytes: O.some(PosInt.make(1)),
            pffexportPath: stubPath,
            systemdRunPath,
          })
        );

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);
        const sandboxArguments = yield* fs.readFileString(argumentsPath);

        expect(error.reason).toBe("output-limit-exceeded");
        expect(sandboxArguments).toContain("--size\n1\n--tmpfs\n/output\n");
        expect(sandboxArguments).not.toContain(`${exportRoot}\n/output\n`);
        expect(yield* fs.readDirectory(exportRoot)).toStrictEqual([]);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "publishes a validated quota handoff only after the sandbox exits",
    Effect.fnUntraced(
      function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { operation, exportRoot, stubPath } = yield* fixture(stubPffexport);
        const fixtureRoot = path.dirname(stubPath);
        const handoffSource = path.join(fixtureRoot, "quota-handoff-source");
        const itemDirectory = path.join(
          handoffSource,
          `${operation.source.id}.export`,
          "Top of Personal Folders",
          "Inbox",
          "Message00001"
        );
        const bwrapPath = path.join(fixtureRoot, "successful-quota-bwrap-stub");
        const systemdRunPath = path.join(fixtureRoot, "successful-systemd-run-stub");
        yield* fs.makeDirectory(itemDirectory, { recursive: true });
        yield* fs.writeFileString(path.join(itemDirectory, "OutlookHeaders.txt"), "Subject:\tquota handoff\n");
        yield* fs.writeFileString(path.join(itemDirectory, "Message.txt"), "bounded body");
        yield* fs.writeFileString(
          bwrapPath,
          `#!/usr/bin/env bash
exec /usr/bin/tar -C ${handoffSource} -cf - .
`
        );
        yield* fs.writeFileString(
          systemdRunPath,
          `#!/usr/bin/env bash
set -eu
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--" ]; then shift; break; fi
  shift
done
exec "$@"
`
        );
        yield* Effect.forEach([bwrapPath, systemdRunPath], (file) => fs.chmod(file, 0o755), { discard: true });
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({
            bwrapPath: O.some(bwrapPath),
            exportRoot,
            maxOutputBytes: O.some(PosInt.make(1_000_000)),
            pffexportPath: stubPath,
            systemdRunPath,
          })
        );

        const result = yield* engine.exportArchive(operation);

        expect(result.children.length).toBeGreaterThan(0);
        expect(yield* fs.exists(path.join(exportRoot, `${operation.source.id}.export`))).toBe(true);
        expect(A.some(yield* fs.readDirectory(exportRoot), Str.startsWith(".pffexport-quota-"))).toBe(false);
      },
      Effect.scoped,
      provideTestLayer
    )
  );

  it.effect(
    "rejects symbolic links in untrusted pffexport output",
    Effect.fnUntraced(
      function* () {
        const { operation, exportRoot, stubPath } = yield* fixture(symlinkOutputStub);
        const engine = yield* makePffexportFileProcessingEngine(
          PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
        );

        const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

        expect(error.reason).toBe("archive-export-failed");
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
    "classifies password and codepage process diagnostics",
    Effect.fnUntraced(
      function* () {
        for (const [diagnostic, expectedClassification] of [
          ["archive is password encrypted", "password"],
          ["unsupported code page", "codepage"],
        ] as const) {
          const failingDiagnosticStub = `#!/usr/bin/env bash\n${stubVersionBanner}\nprintf '${diagnostic}\\n' >&2\nexit 2\n`;
          const { exportRoot, operation, stubPath } = yield* fixture(failingDiagnosticStub);
          const engine = yield* makePffexportFileProcessingEngine(
            PffexportEngineConfig.make({ exportRoot, pffexportPath: stubPath })
          );

          const error = yield* engine.exportArchive(operation).pipe(Effect.flip);

          expect(error.details).toStrictEqual({ exitCode: "2", processClassification: expectedClassification });
        }
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
