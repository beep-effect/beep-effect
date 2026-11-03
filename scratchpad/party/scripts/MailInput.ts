/**
 * Scratchpad boundary for mail-index rows enriched with explicit message content identity.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { ContentId } from "@beep/party-domain/Ids";
import { MailIndexRecord } from "@beep/party-server/MailIndex";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("party/scripts/MailInput");

/**
 * Header index row plus the digest identity of its child message content.
 * **Details**
 * The existing corpus index does not contain this digest. A caller must enrich
 * each row from its provenance inventory; the parent archive id is not a substitute.
 * **Example** (Decode an enriched JSONL row)
 * ```ts
 * import { ContentBoundMailRecord } from "./MailInput.ts"
 * import * as S from "effect/Schema"
 * const decode = S.decodeUnknownEffect(S.fromJsonString(ContentBoundMailRecord))
 * ```
 * @category models
 * @since 0.0.0
 */
export class ContentBoundMailRecord extends S.Opaque<ContentBoundMailRecord, { readonly brand: unique symbol }>()(
  S.Struct({ ...MailIndexRecord.fields, content: ContentId }).pipe(
    $I.annoteSchema("ContentBoundMailRecord", {
      description: "Mail index record enriched with explicit child content identity.",
    })
  )
) {}
