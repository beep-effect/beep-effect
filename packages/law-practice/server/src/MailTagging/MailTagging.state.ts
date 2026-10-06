/**
 * Where the mail-tagging ledgers and checkpoint live on disk.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeServerId } from "@beep/identity/packages";
import { Context } from "effect";
import * as S from "effect/Schema";

const $I = $LawPracticeServerId.create("MailTagging/MailTagging.state");

/**
 * Configuration of the file-backed mail-tagging state.
 *
 * **Details**
 *
 * The directory is private operator state and is never tracked. It holds
 * `tag-ledger.jsonl`, `filing-ledger.jsonl`, and `checkpoint.json`, and is
 * created on the first write. There is no default: the caller names it.
 *
 * **Example** (Name a state directory)
 *
 * ```ts
 * import { MailTaggingStateConfig } from "@beep/law-practice-server/MailTagging"
 *
 * const config = MailTaggingStateConfig.make({ stateDirectory: "state/practice-mail-tagging" })
 * console.log(config.stateDirectory) // "state/practice-mail-tagging"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MailTaggingStateConfig extends S.Class<MailTaggingStateConfig>($I`MailTaggingStateConfig`)(
  {
    stateDirectory: S.NonEmptyString.annotateKey({
      description: "Directory holding the ledgers and the checkpoint.",
    }),
  },
  $I.annote("MailTaggingStateConfig", {
    description: "Configuration of the file-backed mail-tagging state.",
  })
) {}

/**
 * Service tag carrying the mail-tagging state directory.
 *
 * **Example** (Provide the state location)
 *
 * ```ts
 * import { MailTaggingStateConfig, MailTaggingStateLocation } from "@beep/law-practice-server/MailTagging"
 * import * as Layer from "effect/Layer"
 *
 * const Location = Layer.succeed(
 *   MailTaggingStateLocation,
 *   MailTaggingStateConfig.make({ stateDirectory: "state/practice-mail-tagging" })
 * )
 * console.log(Layer.isLayer(Location)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class MailTaggingStateLocation extends Context.Service<MailTaggingStateLocation, MailTaggingStateConfig>()(
  $I`MailTaggingStateLocation`
) {}
