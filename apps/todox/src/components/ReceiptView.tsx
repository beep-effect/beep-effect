/**
 * The activity receipt for one record.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as Str from "effect/String";
import { Fragment } from "react";
import { spanRefLabel } from "@/session/Session.schema";
import type { Receipt } from "@/session/Session.schema";

/**
 * Renders a snake_case action name with a soft break opportunity after each
 * underscore, so narrow receipts wrap at word joints and never mid-word.
 *
 * **Example** (Break an action name)
 *
 * ```ts
 * import { ActionName } from "@/components/ReceiptView"
 * import { createElement } from "react"
 *
 * console.log(createElement(ActionName, { value: "accept_or_edit_candidate_claims" }).props.value)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ActionName({ value }: { readonly value: string }) {
  return (
    <>
      {Str.split(value, "_").map((part, index) => (
        <Fragment key={`${index}-${part}`}>
          {index > 0 ? (
            <>
              _<wbr />
            </>
          ) : null}
          {part}
        </Fragment>
      ))}
    </>
  );
}

/**
 * Renders the receipt fields in the fixed order: requested action, reviewer,
 * candidate ref, evidence, policy basis, state, time, producer.
 *
 * **Example** (Render a receipt)
 *
 * ```ts
 * import { ReceiptView } from "@/components/ReceiptView"
 * import { packet } from "@/session/session"
 * import { createElement } from "react"
 *
 * const view = createElement(ReceiptView, { receipt: packet.receipt })
 * console.log(view.props.receipt.candidateRef)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function ReceiptView({ receipt }: { readonly receipt: Receipt }) {
  return (
    <dl className="receipt">
      <dt>REQUESTED ACTION</dt>
      <dd>
        <ActionName value={receipt.requestedAction} />
      </dd>
      <dt>REVIEWER</dt>
      <dd>{receipt.reviewer}</dd>
      <dt>CANDIDATE REF</dt>
      <dd>{receipt.candidateRef}</dd>
      <dt>EVIDENCE</dt>
      <dd>{A.join(A.map(receipt.evidence, spanRefLabel), ", ")}</dd>
      <dt>POLICY BASIS</dt>
      <dd>{receipt.policyBasis}</dd>
      <dt>STATE</dt>
      <dd>{receipt.state}</dd>
      <dt>TIME</dt>
      <dd>{receipt.time}</dd>
      <dt>PRODUCER</dt>
      <dd data-field="producer">{receipt.producer}</dd>
    </dl>
  );
}
