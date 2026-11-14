/**
 * `beep ci binary-pin`: check or rewrite the CI binary pin in
 * `.github/actions/fetch-beep-ci/action.yml`.
 *
 * **Details**
 *
 * The composite action pins one `beep-ci-<12 hex>` release tag
 * (`BEEP_CI_RELEASE_TAG`) and the sha256 of its `beep-linux-x64` asset
 * (`BEEP_CI_SHA256`). `beep-ci-binary.yml` runs this command with `--write`
 * after it publishes a new release, then opens the reviewed pin-bump pull
 * request (goals/heavy-pool-diet PERIH-11 slice 2). The command lives in the
 * source CLI, not in the compiled binary: the release job has the toolchain
 * installed, and keeping it out of `bin-ci.ts` keeps it out of the binary's
 * closure.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";

const $I = $RepoCliId.create("commands/Ci/CiBinaryPin");

/**
 * The checked-in file that pins the CI binary release, relative to the repository root.
 *
 * **Example** (Read the pin file path)
 *
 * ```ts
 * import { CI_BINARY_PIN_FILE } from "@beep/repo-cli/commands/Ci/CiBinaryPin"
 *
 * console.log(CI_BINARY_PIN_FILE) // ".github/actions/fetch-beep-ci/action.yml"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CI_BINARY_PIN_FILE = ".github/actions/fetch-beep-ci/action.yml";

/**
 * A CI binary release tag: `beep-ci-` and the first 12 hex characters of the main commit.
 *
 * **Example** (Recognize a release tag)
 *
 * ```ts
 * import { BeepCiReleaseTag } from "@beep/repo-cli/commands/Ci/CiBinaryPin"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(BeepCiReleaseTag)("beep-ci-a56516d6d309")) // true
 * console.log(S.is(BeepCiReleaseTag)("beep-ci-PENDING")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const BeepCiReleaseTag = S.String.check(
  S.isPattern(/^beep-ci-[0-9a-f]{12}$/u, {
    identifier: "BeepCiReleaseTagPattern",
    title: "Beep CI release tag",
    description: "beep-ci- followed by the 12-character lowercase hex prefix of a main commit",
    message: "expected a beep-ci-<12 lowercase hex> release tag",
  })
).pipe(
  S.brand("BeepCiReleaseTag"),
  $I.annoteSchema("BeepCiReleaseTag", {
    description: "The tag of a published pre-toolchain beep CI binary release.",
  })
);

/**
 * Type for {@link BeepCiReleaseTag}.
 *
 * @category models
 * @since 0.0.0
 */
export type BeepCiReleaseTag = typeof BeepCiReleaseTag.Type;

/**
 * The pinned CI binary: a release tag and the sha256 of its `beep-linux-x64` asset.
 *
 * **Example** (Decode a pin)
 *
 * ```ts
 * import { CiBinaryPin } from "@beep/repo-cli/commands/Ci/CiBinaryPin"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(CiBinaryPin)
 * const program = decode({ tag: "beep-ci-a56516d6d309", sha256: "0".repeat(64) })
 * console.log(typeof program) // "object"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiBinaryPin extends S.Opaque<CiBinaryPin, { readonly brand: unique symbol }>()(
  S.Struct({ tag: BeepCiReleaseTag, sha256: Sha256Hex }).pipe(
    $I.annoteSchema("CiBinaryPin", {
      description: "The release tag and sha256 the fetch-beep-ci composite action pins.",
    })
  )
) {}

const decodeCiBinaryPin = S.decodeUnknownEffect(CiBinaryPin);

// One `KEY: value` line under a step's `env:` block; the value is a single token.
const pinLinePattern = (key: string): RegExp => new RegExp(`^([\\t ]*${key}:[\\t ]*)(\\S+)[\\t ]*$`, "gmu");

const TAG_KEY = "BEEP_CI_RELEASE_TAG";
const SHA256_KEY = "BEEP_CI_SHA256";

const rewritePinLine = Effect.fnUntraced(function* (text: string, key: string, value: string) {
  const matches = A.fromIterable(Str.matchAll(pinLinePattern(key))(text));
  if (A.length(matches) !== 1) {
    return yield* CiCommandError.make({
      message: `${CI_BINARY_PIN_FILE} must contain exactly one ${key} line; found ${A.length(matches)}.`,
    });
  }
  const current = A.flatMap(matches, (match) => A.fromNullishOr(match[2]));
  return {
    current: A.join(current, ""),
    text: Str.replace(pinLinePattern(key), `$1${value}`)(text),
  };
});

/**
 * Rewrite the two pinned values in the text of the fetch-beep-ci action.
 *
 * **Details**
 *
 * Replaces exactly the `BEEP_CI_RELEASE_TAG` and `BEEP_CI_SHA256` values and
 * leaves every other byte alone, so rewriting with the pin already present
 * returns the same text. Fails with a `CiCommandError` when the text holds
 * none or more than one line for either key.
 *
 * **Example** (Rewrite a pin)
 *
 * ```ts
 * import { CiBinaryPin, rewriteCiBinaryPin } from "@beep/repo-cli/commands/Ci/CiBinaryPin"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const program = Effect.flatMap(
 *   S.decodeUnknownEffect(CiBinaryPin)({ tag: "beep-ci-a56516d6d309", sha256: "0".repeat(64) }),
 *   (pin) => rewriteCiBinaryPin("BEEP_CI_RELEASE_TAG: old\nBEEP_CI_SHA256: old\n", pin)
 * )
 * console.log(typeof program) // "object"
 * ```
 *
 * @param text - The action file's contents.
 * @param pin - The release to pin.
 * @returns The rewritten text and the tag and sha256 it pinned before.
 * @category use-cases
 * @since 0.0.0
 */
export const rewriteCiBinaryPin = Effect.fn("Ci.rewriteCiBinaryPin")(function* (text: string, pin: CiBinaryPin) {
  const tag = yield* rewritePinLine(text, TAG_KEY, pin.tag);
  const sha256 = yield* rewritePinLine(tag.text, SHA256_KEY, pin.sha256);
  return { text: sha256.text, previousTag: tag.current, previousSha256: sha256.current };
});

const runBinaryPin = Effect.fn("Ci.binaryPin")(function* (options: {
  readonly tag: string;
  readonly sha256: string;
  readonly check: boolean;
  readonly write: boolean;
  readonly file: string;
}) {
  if (options.check && options.write) {
    return yield* CiCommandError.make({ message: "Pass --check or --write, not both." });
  }
  const pin = yield* decodeCiBinaryPin({ tag: options.tag, sha256: options.sha256 }).pipe(
    Effect.mapError((error) => CiCommandError.make({ message: `Invalid pin: ${error.message}` }))
  );
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* findRepoRoot().pipe(Effect.mapError(CiCommandError.new("Cannot find the repository root.")));
  const file = path.resolve(root, options.file);
  const text = yield* fs.readFileString(file).pipe(Effect.mapError(CiCommandError.new(`Failed to read ${file}.`)));
  const rewritten = yield* rewriteCiBinaryPin(text, pin);
  const pinned = `${pin.tag} (sha256 ${pin.sha256})`;
  if (rewritten.text === text) {
    yield* Console.log(`${options.file} already pins ${pinned}.`);
    return;
  }
  if (!options.write) {
    return yield* CiCommandError.make({
      message: `${options.file} pins ${rewritten.previousTag} (sha256 ${rewritten.previousSha256}), not ${pinned}; rerun with --write.`,
    });
  }
  yield* fs.writeFileString(file, rewritten.text).pipe(Effect.mapError(CiCommandError.new(`Failed to write ${file}.`)));
  yield* Console.log(`${options.file}: ${rewritten.previousTag} -> ${pinned}.`);
});

/**
 * `beep ci binary-pin --tag <beep-ci-...> --sha256 <hex> [--check|--write] [--file <path>]`.
 *
 * **Details**
 *
 * Without `--write` the command checks: it exits non-zero when the file pins
 * anything else. With `--write` it rewrites the two pinned values in place
 * and is a no-op when they already match.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciBinaryPinCommand } from "@beep/repo-cli/commands/Ci/CiBinaryPin"
 *
 * console.log(ciBinaryPinCommand.name) // "binary-pin"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciBinaryPinCommand = Command.make(
  "binary-pin",
  {
    tag: Flag.String("tag").pipe(Flag.withDescription("Release tag to pin (beep-ci-<12 hex>)")),
    sha256: Flag.String("sha256").pipe(Flag.withDescription("sha256 of the release's beep-linux-x64 asset")),
    check: Flag.Boolean("check").pipe(
      Flag.withDefault(false),
      Flag.withDescription("Fail unless the file already pins this release (the default mode)")
    ),
    write: Flag.Boolean("write").pipe(Flag.withDefault(false), Flag.withDescription("Rewrite the pin in place")),
    file: Flag.String("file").pipe(
      Flag.withDefault(CI_BINARY_PIN_FILE),
      Flag.withDescription("Pin file, relative to the repository root")
    ),
  },
  (options) => runBinaryPin(options).pipe(Effect.catchTag("CiCommandError", reportCiCommandError))
).pipe(Command.withDescription("Check or rewrite the pinned CI binary release tag and sha256"));
