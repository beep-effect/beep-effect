import { resolve } from "node:path";
import { Glob } from "bun";
import { Equal, pipe } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";

const repoRoot = resolve(import.meta.dir, "../../../..");
const sourceGlob = Bun.argv.includes("--scratchpad-only")
  ? "scratchpad/**/*.{ts,tsx}"
  : "{packages,apps}/**/*.{ts,tsx}";

let migratedFiles = 0;
let migratedReferences = 0;
let restoredNonSchemaReferences = 0;

for await (const path of new Glob(sourceGlob).scan(repoRoot)) {
  const absolutePath = resolve(repoRoot, path);
  const source = await Bun.file(absolutePath).text();
  const references = A.length(A.fromIterable(Str.matchAll(/\.fromUnknown\b/gu)(source)));
  const restoredReferences = A.length(
    A.fromIterable(Str.matchAll(/(?:ConfigProvider|DrizzleError)\.decodeUnknownSync\b/gu)(source))
  );
  const migrated = pipe(
    source,
    Str.replaceAll(/\.fromUnknown\b/gu, ".decodeUnknownSync"),
    Str.replaceAll("ConfigProvider.decodeUnknownSync", "ConfigProvider.fromUnknown"),
    Str.replaceAll("DrizzleError.decodeUnknownSync", "DrizzleError.fromUnknown")
  );
  if (Equal.equals(migrated, source)) {
    continue;
  }

  await Bun.write(absolutePath, migrated);
  migratedFiles += 1;
  migratedReferences += references;
  restoredNonSchemaReferences += restoredReferences;
}

console.log(JSON.stringify({ migratedFiles, migratedReferences, restoredNonSchemaReferences }));
