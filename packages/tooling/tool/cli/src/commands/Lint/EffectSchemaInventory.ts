/**
 * Pinned Effect schema inventory command: regenerate, verify, and prompt from the
 * `schema-inventory/v1` fixture.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { findRepoRoot } from "@beep/repo-utils";
import { Effect } from "effect";
import { Command, Flag } from "effect/cli";
import {
  effectSchemaInventoryRequestFromFlags,
  runEffectSchemaInventory,
} from "./internal/EffectSchemaInventoryRun.ts";
import { EffectSchemaInventorySource } from "./internal/EffectSchemaInventorySource.ts";
import { EffectSchemaInventoryError } from "./Lint.errors.ts";
import type * as Layer from "effect/Layer";

const effectSchemaInventoryCommandDefinition = Command.make(
  "effect-schema-inventory",
  {
    write: Flag.Boolean("write").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Regenerate the committed fixture from .repos/effect at the catalog pin")
    ),
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "Regenerate in memory and require byte-identical fixture files and lane prompts (the default mode)"
      )
    ),
    prompt: Flag.String("prompt").pipe(
      Flag.withDescription("Write the lane prompt for one inventoried module, such as effect/SchemaIssue"),
      Flag.optional
    ),
    out: Flag.String("out").pipe(
      Flag.withDescription(
        "Prompt path relative to the repository root (default goals/effect-schema-parity/ops/prompts/<slug>.md)"
      ),
      Flag.optional
    ),
  },
  Effect.fn("EffectSchemaInventory.command")(function* (flags) {
    const request = yield* effectSchemaInventoryRequestFromFlags(flags);
    const root = yield* findRepoRoot().pipe(
      EffectSchemaInventoryError.mapError("Unable to locate the repository root for effect-schema-inventory")
    );
    yield* runEffectSchemaInventory(root, request);
  })
).pipe(
  Command.withDescription(
    "Regenerate, verify, or prompt from the pinned Effect schema inventory (reads .repos/effect at the catalog pin)"
  )
);

/**
 * Build the command over a chosen input source, so tests can drive the real flag parsing and
 * handler with a fake source instead of `.repos/effect`.
 *
 * **Example** (Build the command over the live source)
 *
 * ```ts
 * import { EffectSchemaInventorySource, makeLintEffectSchemaInventoryCommand } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 * import { Command } from "effect/cli"
 *
 * const command = makeLintEffectSchemaInventoryCommand(EffectSchemaInventorySource.live)
 * console.log(Effect.isEffect(Command.run(command, { version: "0.0.0" }))) // true
 * ```
 *
 * @param sourceLayer - Layer providing {@link EffectSchemaInventorySource}.
 * @returns The `effect-schema-inventory` command with that source provided.
 * @category cli-commands
 * @since 0.0.0
 */
export const makeLintEffectSchemaInventoryCommand = <E, R>(
  sourceLayer: Layer.Layer<EffectSchemaInventorySource, E, R>
) => effectSchemaInventoryCommandDefinition.pipe(Command.provide(sourceLayer));

/**
 * Regenerate (`--write`), verify (`--check`, the default), or write a lane prompt (`--prompt`)
 * for the pinned Effect schema inventory.
 *
 * **Details**
 *
 * Every mode reads `inventoryPin` from the root `package.json` catalog and source bytes only
 * through `git -C .repos/effect show <pin>:<file>`. A missing reference clone, a pin it does not
 * contain, or an extraction with zero rows fails the command; it never passes on empty input.
 * `--check` also re-renders the committed lane prompts, and `--prompt` fails when graft context
 * cannot be read. Hosted CI does not run this command: the repo-cli fixture test verifies the
 * committed rows without an Effect checkout and cannot verify prompts.
 *
 * **Example** (Build the command runner)
 *
 * ```ts
 * import { lintEffectSchemaInventoryCommand } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 * import { Command } from "effect/cli"
 *
 * const run = Command.run(lintEffectSchemaInventoryCommand, { version: "0.0.0" })
 * console.log(Effect.isEffect(run)) // true
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const lintEffectSchemaInventoryCommand = makeLintEffectSchemaInventoryCommand(EffectSchemaInventorySource.live);

/**
 * Syntax-only row extraction.
 *
 * @category parsing
 * @since 0.0.0
 */
export {
  compactEffectSchemaInventoryPreview,
  effectSchemaInventoryJsDocBlocks,
  extractEffectSchemaInventory,
} from "./internal/EffectSchemaInventoryExtract.ts";
/**
 * Tool-owned module list, pin parsing, and path derivation.
 *
 * @category configuration
 * @since 0.0.0
 */
export {
  EffectSchemaInventoryModules,
  effectSchemaInventoryModuleOf,
  effectSchemaInventorySlugOf,
  findEffectSchemaInventoryModule,
  parseEffectSchemaInventoryPin,
} from "./internal/EffectSchemaInventoryModules.ts";
/**
 * Lane prompt rendering and generation.
 *
 * @category use-cases
 * @since 0.0.0
 */
export {
  checkEffectSchemaInventoryPrompts,
  generateEffectSchemaInventoryPrompt,
  renderEffectSchemaInventoryPrompt,
} from "./internal/EffectSchemaInventoryPrompt.ts";
/**
 * JSONL, digest, and index rendering plus the fixture comparison.
 *
 * @category formatting
 * @since 0.0.0
 */
export {
  diffEffectSchemaInventoryFiles,
  digestEffectSchemaInventoryJsonl,
  effectSchemaInventoryByteLength,
  effectSchemaInventoryJsonlName,
  formatEffectSchemaInventoryDrift,
  readEffectSchemaInventoryIndexHeader,
  renderEffectSchemaInventory,
  renderEffectSchemaInventoryIndex,
  renderEffectSchemaInventoryJsonl,
} from "./internal/EffectSchemaInventoryRender.ts";
/**
 * Command orchestration.
 *
 * @category use-cases
 * @since 0.0.0
 */
export {
  checkEffectSchemaInventory,
  effectSchemaInventoryRequestFromFlags,
  generateEffectSchemaInventory,
  reportEffectSchemaInventoryCheck,
  runEffectSchemaInventory,
} from "./internal/EffectSchemaInventoryRun.ts";
/**
 * External input service: catalog pin, pinned sources, and graft context.
 *
 * @category services
 * @since 0.0.0
 */
export { EffectSchemaInventorySource } from "./internal/EffectSchemaInventorySource.ts";
/**
 * Fixture persistence.
 *
 * @category resources
 * @since 0.0.0
 */
export {
  readEffectSchemaInventoryFixture,
  readEffectSchemaInventoryModuleRows,
  writeEffectSchemaInventoryFixture,
} from "./internal/EffectSchemaInventoryStore.ts";
/**
 * External input service contract.
 *
 * @category services
 * @since 0.0.0
 */
export type { EffectSchemaInventorySourceShape } from "./internal/EffectSchemaInventorySource.ts";
