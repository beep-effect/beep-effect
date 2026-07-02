import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..", "identity");

const tsFiles = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".ts"))
    .map((e) => join(e.parentPath, e.name));

const importSpecifiers = (source: string): ReadonlyArray<string> =>
  [...source.matchAll(/(?:from|import)\s+["']([^"']+)["']/g)].map((m) => m[1]!);

describe("scratchpad/identity first-principles constraint", () => {
  it("imports only from effect or local files", () => {
    const offenders = tsFiles(root).flatMap((file) =>
      importSpecifiers(readFileSync(file, "utf8"))
        .filter((spec) => !(spec === "effect" || spec.startsWith("effect/") || spec.startsWith(".")))
        .map((spec) => `${file}: ${spec}`)
    );
    expect(offenders).toEqual([]);
  });
});
