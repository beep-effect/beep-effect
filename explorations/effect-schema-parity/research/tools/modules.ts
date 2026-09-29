/**
 * Tool-owned input contract for `schema-inventory/v1`, shared by `schema-inventory.ts` and
 * `verify-schema-inventory.ts` so the two tools cannot drift apart.
 *
 * - The pin is the repo's own catalog commit (`inventoryPin`, D4): the 40-character sha after
 *   `effect@` in the root `package.json` catalog entry for `effect`. The reference clone's HEAD
 *   (`referenceHead`) is never consulted.
 * - Every source byte is read with `git -C .repos/effect show <inventoryPin>:<file>`; the
 *   reference working tree and `node_modules/effect/src` are never read.
 * - The module list lives here, not in `CAPTURE.md` (append-only stage-0 dump).
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
export const upstream = resolve(root, ".repos/effect");

export type InventoryModule = {
  /** Upstream-relative source path. */
  readonly file: string;
  /**
   * `false` when effect's `package.json` exports map nulls the path (`./internal/*`): the rows are
   * provenance only and no consumer can import them.
   */
  readonly importable: boolean;
};

const publicModule = (file: string): InventoryModule => ({ file, importable: true });
const provenanceModule = (file: string): InventoryModule => ({ file, importable: false });

/** Inventory order: package-root modules, `effect/schema/**`, then provenance-only internals. */
export const inventoryModules: ReadonlyArray<InventoryModule> = [
  publicModule("packages/effect/src/Schema.ts"),
  publicModule("packages/effect/src/SchemaAST.ts"),
  publicModule("packages/effect/src/SchemaParser.ts"),
  publicModule("packages/effect/src/SchemaIssue.ts"),
  publicModule("packages/effect/src/SchemaGetter.ts"),
  publicModule("packages/effect/src/SchemaTransformation.ts"),
  publicModule("packages/effect/src/SchemaRepresentation.ts"),
  publicModule("packages/effect/src/Arbitrary.ts"),
  publicModule("packages/effect/src/JsonSchema.ts"),
  publicModule("packages/effect/src/Equivalence.ts"),
  publicModule("packages/effect/src/StandardSchema.ts"),
  publicModule("packages/effect/src/ChannelSchema.ts"),
  publicModule("packages/effect/src/schema/index.ts"),
  publicModule("packages/effect/src/schema/Model.ts"),
  publicModule("packages/effect/src/schema/VariantSchema.ts"),
  publicModule("packages/effect/src/schema/SchemaCompiler.ts"),
  publicModule("packages/effect/src/schema/SchemaCompiler/runtime.ts"),
  publicModule("packages/effect/src/schema/SchemaJITCompiler.ts"),
  publicModule("packages/effect/src/schema/SchemaJITCompiler/enable.ts"),
  publicModule("packages/effect/src/schema/SchemaAOTCompiler.ts"),
  publicModule("packages/effect/src/schema/SchemaAOTCompiler/Build.ts"),
  provenanceModule("packages/effect/src/internal/schema/codegen.ts"),
  provenanceModule("packages/effect/src/internal/schema/compilerRegistry.ts"),
  provenanceModule("packages/effect/src/internal/schema/interpreter.ts"),
];

/** Import path: `effect/` + path without `packages/effect/src/`, `.ts` and a trailing `/index`. */
export const moduleOf = (file: string): string =>
  "effect/" +
  file
    .replace(/^packages\/effect\/src\//, "")
    .replace(/\.ts$/, "")
    .replace(/\/index$/, "");

/** JSONL file stem: the module path with `/` replaced by `-`. */
export const slugOf = (module: string): string => module.replaceAll("/", "-");

/** Full 40-character `inventoryPin` parsed from the root `package.json` catalog entry for `effect`. */
export const readInventoryPin = (): string => {
  const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const specifier: unknown = manifest.catalog?.effect ?? manifest.workspaces?.catalog?.effect;
  const pin = typeof specifier === "string" ? /effect@([0-9a-f]{40})$/.exec(specifier)?.[1] : undefined;
  if (!pin) throw new Error(`Root package.json catalog "effect" is not an effect@<40-char sha> snapshot: ${specifier}`);
  try {
    execFileSync("git", ["-C", upstream, "cat-file", "-e", `${pin}^{commit}`], { stdio: "pipe" });
  } catch {
    throw new Error(
      `inventoryPin ${pin} is not in .repos/effect yet (nightly pull has not reached it); stop and report`
    );
  }
  return pin;
};

/** Source bytes at the pin; the only read path for inventory inputs. */
export const showPinned = (pin: string, file: string): Buffer =>
  execFileSync("git", ["-C", upstream, "show", `${pin}:${file}`], { maxBuffer: 32 * 1024 * 1024 });
