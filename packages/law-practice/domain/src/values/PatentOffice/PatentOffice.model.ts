/**
 * Patent office metadata value model.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import * as S from "effect/Schema";
import type { O } from "@beep/utils";

const $I = $LawPracticeDomainId.create("values/PatentOffice/PatentOffice");

/**
 * WIPO ST.16 / office logo + flag metadata, used for jurisdiction-aware UI.
 *
 * @category models
 * @since 0.0.0
 */
export class Metadata extends S.Class<Metadata>($I`Metadata`)(
  {},
  $I.annote("Metadata", {
    description: "WIPO ST.16 / office logo + flag metadata, used for jurisdiction-aware UI.",
  })
) {}
// {
// 				readonly name: string;
// 				readonly logo: O.Option<string>;
// 				readonly flag: O.Option<string>;
// 			}
declare module "effect/Schema" {
  namespace Annotations {
    interface Annotations {
      readonly patentOffice?: {
        readonly name: string;
        readonly logo: O.Option<string>;
        readonly flag: O.Option<string>;
      };
    }
  }
}
