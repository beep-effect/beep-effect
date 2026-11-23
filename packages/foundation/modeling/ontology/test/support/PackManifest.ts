import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Str from "effect/String";

export const fixtureRoot = "test/fixtures";

export const approval = {
  license: "MIT",
  licenseEvidenceUrl: "https://github.com/beep-effect/beep-effect/blob/main/LICENSE",
  reuseVerdict: "adopt",
  verdictRationale: "Test-owned fixture.",
  maintenanceStatus: "active",
} as const;

export const encodeJson = Effect.fnUntraced(function* (row: Record<string, unknown>) {
  return yield* S.encodeUnknownEffect(S.fromJsonString(S.Unknown))(row);
});

export const zeros = Str.repeat(64)("0");

export const sha256Of = Effect.fnUntraced(function* (path: string) {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(path);
  return yield* digest.digestHex(Digest.sha256, bytes);
});

export const schemeRow = ({
  id,
  path,
  origin,
  sha256,
}: {
  readonly id: string;
  readonly path: string;
  readonly origin: "repo-owned" | "vendor";
  readonly sha256: string;
}): Record<string, unknown> => ({
  id,
  format: "json",
  loadKind: "concept-scheme",
  origin,
  path,
  sha256,
  verified: true,
  loadStatus: "VETTED",
  ...approval,
});

export const fixtureSchemeRow = Effect.fnUntraced(function* (
  id: string,
  path: string,
  origin: "repo-owned" | "vendor"
) {
  const sha256 = yield* sha256Of(`${fixtureRoot}/${path}`);
  return schemeRow({ id, path, origin, sha256 });
});

export const writeManifest = Effect.fnUntraced(function* (rows: ReadonlyArray<Record<string, unknown>>) {
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "beep-pack-manifest-" });
  const lines = yield* Effect.forEach(rows, (row) => encodeJson(row), { concurrency: 1 });
  const path = `${directory}/manifest.jsonl`;
  yield* fs.writeFileString(path, A.join(lines, "\n"));
  return path;
});
