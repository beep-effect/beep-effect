/**
 * Explicit CLI stage inputs and service operations.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeIdentifyId } from "@beep/identity/packages";
import { Fn } from "@beep/schema";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { IdentificationError } from "@beep/law-practice-use-cases/DocumentIdentification";

const $I = $PracticeIdentifyId.create("PracticeIdentify.config");
const Output = S.declare((u): u is Effect.Effect<number, IdentificationError> => Effect.isEffect(u));
/**
 * Required private paths for the contacts stage.
 *
 * **Example** (Inspect ContactsInput)
 *
 * ```ts
 * import { ContactsInput } from "@/PracticeIdentify.config"
 * const input = ContactsInput.make({ csv: "csv.json", vcard: "vcard.json", output: "output.json", projection: "projection.json" })
 * console.log(input.output) // "output.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ContactsInput extends S.Class<ContactsInput>($I`ContactsInput`)(
  { csv: S.NonEmptyString, vcard: S.NonEmptyString, output: S.NonEmptyString, projection: S.NonEmptyString },
  $I.annote("ContactsInput", { description: "Explicit private paths." })
) {}
/**
 * Required private paths for the index stage.
 *
 * **Example** (Inspect IndexInput)
 *
 * ```ts
 * import { IndexInput } from "@/PracticeIdentify.config"
 * const input = IndexInput.make({ input: "input.json", contacts: "contacts.json", output: "output.json" })
 * console.log(input.output) // "output.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class IndexInput extends S.Class<IndexInput>($I`IndexInput`)(
  { input: S.NonEmptyString, contacts: S.NonEmptyString, output: S.NonEmptyString },
  $I.annote("IndexInput", { description: "Explicit private paths." })
) {}
/**
 * Required private paths for the uspto stage.
 *
 * **Example** (Inspect UsptoInput)
 *
 * ```ts
 * import { UsptoInput } from "@/PracticeIdentify.config"
 * const input = UsptoInput.make({ input: "input.json", output: "output.json", ledger: "ledger.json" })
 * console.log(input.output) // "output.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class UsptoInput extends S.Class<UsptoInput>($I`UsptoInput`)(
  { input: S.NonEmptyString, output: S.NonEmptyString, ledger: S.NonEmptyString },
  $I.annote("UsptoInput", { description: "Explicit private paths." })
) {}
/**
 * Required private paths for the resolve stage.
 *
 * **Example** (Inspect ResolveInput)
 *
 * ```ts
 * import { ResolveInput } from "@/PracticeIdentify.config"
 * const input = ResolveInput.make({ input: "input.json", context: "context.json", training: "training.json", batches: "batches.json", uspto: "uspto.json", output: "output.json" })
 * console.log(input.output) // "output.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class ResolveInput extends S.Class<ResolveInput>($I`ResolveInput`)(
  {
    input: S.NonEmptyString,
    context: S.NonEmptyString,
    training: S.NonEmptyString,
    batches: S.NonEmptyString,
    uspto: S.NonEmptyString,
    output: S.NonEmptyString,
  },
  $I.annote("ResolveInput", { description: "Explicit private paths." })
) {}
/**
 * Required private paths for the evaluate stage.
 *
 * **Example** (Inspect EvaluateInput)
 *
 * ```ts
 * import { EvaluateInput } from "@/PracticeIdentify.config"
 * const input = EvaluateInput.make({ input: "input.json", context: "context.json", output: "output.json" })
 * console.log(input.output) // "output.json"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class EvaluateInput extends S.Class<EvaluateInput>($I`EvaluateInput`)(
  { input: S.NonEmptyString, context: S.NonEmptyString, output: S.NonEmptyString, splitSalt: S.NonEmptyString },
  $I.annote("EvaluateInput", { description: "Explicit private paths and the hold-out split salt." })
) {}
/**
 * Injectable CLI stage implementations.
 *
 * **Example** (Inspect IdentificationStagesShape)
 *
 * ```ts
 * import { IdentificationStagesShape } from "@/PracticeIdentify.config"
 * import * as Effect from "effect/Effect"
 * const stages = IdentificationStagesShape.make({ contacts: () => Effect.succeed(0), index: () => Effect.succeed(0), uspto: () => Effect.succeed(0), resolve: () => Effect.succeed(0), evaluate: () => Effect.succeed(0) })
 * console.log(typeof stages.contacts) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class IdentificationStagesShape extends S.Class<IdentificationStagesShape>($I`IdentificationStagesShape`)(
  {
    contacts: Fn({ input: ContactsInput, output: Output }),
    index: Fn({ input: IndexInput, output: Output }),
    uspto: Fn({ input: UsptoInput, output: Output }),
    resolve: Fn({ input: ResolveInput, output: Output }),
    evaluate: Fn({ input: EvaluateInput, output: Output }),
  },
  $I.annote("IdentificationStagesShape", { description: "Private file pipeline stages." })
) {}
/**
 * CLI pipeline stage service tag.
 *
 * **Example** (Inspect IdentificationStages)
 *
 * ```ts
 * import { IdentificationStages, IdentificationStagesShape } from "@/PracticeIdentify.config"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(Layer.succeed(IdentificationStages, IdentificationStagesShape.make({ contacts: () => Effect.succeed(0), index: () => Effect.succeed(0), uspto: () => Effect.succeed(0), resolve: () => Effect.succeed(0), evaluate: () => Effect.succeed(0) })))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class IdentificationStages extends Context.Service<IdentificationStages, IdentificationStagesShape>()(
  $I`IdentificationStages`
) {}
