/**
 * Schema-decoded FreshBooks domain models and response envelopes.
 *
 * FreshBooks accounting endpoints wrap payloads in a
 * `{ response: { result: ... } }` envelope; list results additionally carry
 * `page` / `pages` / `per_page` / `total` pagination fields alongside the
 * resource array. Every model here is an annotated `S.Class` that decodes a
 * deliberate subset of the wire shape — the API returns far more fields than
 * the driver commits to, and unmodeled keys are dropped at the boundary.
 * Field names mirror the FreshBooks wire keys (following the driver
 * convention, e.g. `@beep/discord`, `@beep/ffmpeg`); the distinct `account_id`
 * and `business_id` namespaces are modeled as separate branded types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FreshbooksId } from "@beep/identity";
import * as S from "effect/Schema";
import { FreshbooksAccountId, FreshbooksBusinessId } from "./Freshbooks.config.ts";

const $I = $FreshbooksId.create("Freshbooks.models");

/**
 * FreshBooks positive-integer client identifier.
 *
 * **Example** (Decode client id)
 *
 * ```ts
 * import { FreshbooksClientId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(FreshbooksClientId)(238951)
 * console.log(id) // 238951
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FreshbooksClientId = S.Int.check(S.isGreaterThan(0)).pipe(
  S.brand("FreshbooksClientId"),
  $I.annoteSchema("FreshbooksClientId", {
    description: "FreshBooks positive-integer client identifier.",
  })
);

/**
 * Type for {@link FreshbooksClientId}.
 *
 * **Example** (Assign client id type)
 *
 * ```ts
 * import { FreshbooksClientId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const id: FreshbooksClientId = S.decodeUnknownSync(FreshbooksClientId)(238951)
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FreshbooksClientId = typeof FreshbooksClientId.Type;

/**
 * FreshBooks positive-integer invoice identifier.
 *
 * **Example** (Decode invoice id)
 *
 * ```ts
 * import { FreshbooksInvoiceId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(FreshbooksInvoiceId)(2201278)
 * console.log(id) // 2201278
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FreshbooksInvoiceId = S.Int.check(S.isGreaterThan(0)).pipe(
  S.brand("FreshbooksInvoiceId"),
  $I.annoteSchema("FreshbooksInvoiceId", {
    description: "FreshBooks positive-integer invoice identifier.",
  })
);

/**
 * Type for {@link FreshbooksInvoiceId}.
 *
 * **Example** (Assign invoice id type)
 *
 * ```ts
 * import { FreshbooksInvoiceId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const id: FreshbooksInvoiceId = S.decodeUnknownSync(FreshbooksInvoiceId)(2201278)
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FreshbooksInvoiceId = typeof FreshbooksInvoiceId.Type;

/**
 * FreshBooks positive-integer payment identifier.
 *
 * **Example** (Decode payment id)
 *
 * ```ts
 * import { FreshbooksPaymentId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(FreshbooksPaymentId)(10865326)
 * console.log(id) // 10865326
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const FreshbooksPaymentId = S.Int.check(S.isGreaterThan(0)).pipe(
  S.brand("FreshbooksPaymentId"),
  $I.annoteSchema("FreshbooksPaymentId", {
    description: "FreshBooks positive-integer payment identifier.",
  })
);

/**
 * Type for {@link FreshbooksPaymentId}.
 *
 * **Example** (Assign payment id type)
 *
 * ```ts
 * import { FreshbooksPaymentId } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const id: FreshbooksPaymentId = S.decodeUnknownSync(FreshbooksPaymentId)(10865326)
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FreshbooksPaymentId = typeof FreshbooksPaymentId.Type;

/**
 * FreshBooks money amount, kept as a decimal string with its currency code to
 * avoid floating-point loss.
 *
 * **Example** (Decode money)
 *
 * ```ts
 * import { FreshbooksMoney } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const money = S.decodeUnknownSync(FreshbooksMoney)({ amount: "800.00", code: "USD" })
 * console.log(money.amount) // "800.00"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksMoney extends S.Class<FreshbooksMoney>($I`FreshbooksMoney`)(
  {
    amount: S.String.annotateKey({
      description: "Decimal money amount preserved as a string.",
    }),
    code: S.NonEmptyString.annotateKey({
      description: "ISO 4217 currency code.",
    }),
  },
  $I.annote("FreshbooksMoney", {
    description: "FreshBooks money amount with currency code.",
  })
) {}

/**
 * FreshBooks business object from the Identity Model, exposing the distinct
 * `account_id` (string, accounting namespace) and `id` (integer, business
 * namespace). A pure-client identity has a `null` account id.
 *
 * **Example** (Decode business)
 *
 * ```ts
 * import { FreshbooksBusiness } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const business = S.decodeUnknownSync(FreshbooksBusiness)({
 *   id: 240340,
 *   account_id: "ABC123",
 *   name: "Awesome Business Inc."
 * })
 *
 * console.log(business.account_id) // "ABC123"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksBusiness extends S.Class<FreshbooksBusiness>($I`FreshbooksBusiness`)(
  {
    id: FreshbooksBusinessId.annotateKey({
      description: "Business-namespace identifier (integer).",
    }),
    account_id: S.NullOr(FreshbooksAccountId).annotateKey({
      description: "Accounting-namespace account id (string), null for pure-client identities.",
    }),
    name: S.optionalKey(S.String).annotateKey({
      description: "Business display name.",
    }),
  },
  $I.annote("FreshbooksBusiness", {
    description: "FreshBooks business object with distinct account/business namespaces.",
  })
) {}

/**
 * A single FreshBooks business membership from the Identity Model.
 *
 * **Example** (Decode business membership)
 *
 * ```ts
 * import { FreshbooksBusinessMembership } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const membership = S.decodeUnknownSync(FreshbooksBusinessMembership)({
 *   id: 111,
 *   role: "owner",
 *   business: { id: 240340, account_id: "ABC123", name: "Awesome Business Inc." }
 * })
 *
 * console.log(membership.business.account_id) // "ABC123"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksBusinessMembership extends S.Class<FreshbooksBusinessMembership>(
  $I`FreshbooksBusinessMembership`
)(
  {
    id: S.Int.annotateKey({
      description: "Business-membership record id (not the business id).",
    }),
    role: S.optionalKey(S.String).annotateKey({
      description: "Identity role on the business (e.g. owner, business_employee).",
    }),
    business: FreshbooksBusiness.annotateKey({
      description: "Business object carrying account/business namespaces.",
    }),
  },
  $I.annote("FreshbooksBusinessMembership", {
    description: "FreshBooks business membership from the Identity Model.",
  })
) {}

/**
 * FreshBooks identity (`/me`) — the source of truth for a user's account and
 * business memberships.
 *
 * **Example** (Decode identity)
 *
 * ```ts
 * import { FreshbooksIdentity } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const identity = S.decodeUnknownSync(FreshbooksIdentity)({
 *   id: 1,
 *   email: "owner@example.com",
 *   business_memberships: [
 *     { id: 111, role: "owner", business: { id: 240340, account_id: "ABC123", name: "Awesome" } }
 *   ]
 * })
 *
 * console.log(identity.business_memberships[0]?.business.account_id) // "ABC123"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksIdentity extends S.Class<FreshbooksIdentity>($I`FreshbooksIdentity`)(
  {
    id: S.Int.annotateKey({
      description: "Identity id.",
    }),
    first_name: S.optionalKey(S.String).annotateKey({
      description: "Identity first name.",
    }),
    last_name: S.optionalKey(S.String).annotateKey({
      description: "Identity last name.",
    }),
    email: S.optionalKey(S.String).annotateKey({
      description: "Identity email, unique across FreshBooks.",
    }),
    business_memberships: S.Array(FreshbooksBusinessMembership).annotateKey({
      description: "Business memberships carrying account/business namespaces.",
    }),
  },
  $I.annote("FreshbooksIdentity", {
    description: "FreshBooks identity resolved from the /me endpoint.",
  })
) {}

/**
 * FreshBooks client (customer) record, decoded to a stable subset.
 *
 * **Example** (Decode client)
 *
 * ```ts
 * import { FreshbooksClient } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const client = S.decodeUnknownSync(FreshbooksClient)({
 *   id: 238951,
 *   fname: "first1",
 *   lname: "last1",
 *   organization: "company1",
 *   email: "email1@freshbooks.com",
 *   currency_code: "USD",
 *   vis_state: 0
 * })
 *
 * console.log(client.organization) // "company1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksClient extends S.Class<FreshbooksClient>($I`FreshbooksClient`)(
  {
    id: FreshbooksClientId.annotateKey({
      description: "Client identifier.",
    }),
    fname: S.optionalKey(S.String).annotateKey({
      description: "Client first name.",
    }),
    lname: S.optionalKey(S.String).annotateKey({
      description: "Client last name.",
    }),
    organization: S.optionalKey(S.String).annotateKey({
      description: "Client organization / company name.",
    }),
    email: S.optionalKey(S.String).annotateKey({
      description: "Client email address (external free-text; not validated as strict email).",
    }),
    currency_code: S.optionalKey(S.String).annotateKey({
      description: "Client default currency code.",
    }),
    vis_state: S.optionalKey(S.Int).annotateKey({
      description: "Visibility state (0 active, 1 deleted, 2 archived).",
    }),
    updated: S.optionalKey(S.String).annotateKey({
      description: "Last-updated timestamp string.",
    }),
  },
  $I.annote("FreshbooksClient", {
    description: "FreshBooks client (customer) record.",
  })
) {}

/**
 * FreshBooks invoice record, decoded to a stable subset.
 *
 * **Example** (Decode invoice)
 *
 * ```ts
 * import { FreshbooksInvoice } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const invoice = S.decodeUnknownSync(FreshbooksInvoice)({
 *   id: 2201278,
 *   invoice_number: "0000003",
 *   customerid: 2185379,
 *   amount: { amount: "800.00", code: "USD" },
 *   payment_status: "unpaid",
 *   v3_status: "sent"
 * })
 *
 * console.log(invoice.invoice_number) // "0000003"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksInvoice extends S.Class<FreshbooksInvoice>($I`FreshbooksInvoice`)(
  {
    id: FreshbooksInvoiceId.annotateKey({
      description: "Invoice identifier.",
    }),
    invoice_number: S.optionalKey(S.String).annotateKey({
      description: "Human-facing invoice number.",
    }),
    customerid: S.optionalKey(FreshbooksClientId).annotateKey({
      description: "Client id the invoice is billed to.",
    }),
    amount: S.optionalKey(FreshbooksMoney).annotateKey({
      description: "Invoice total amount.",
    }),
    outstanding: S.optionalKey(FreshbooksMoney).annotateKey({
      description: "Outstanding balance.",
    }),
    paid: S.optionalKey(FreshbooksMoney).annotateKey({
      description: "Amount paid so far.",
    }),
    payment_status: S.optionalKey(S.String).annotateKey({
      description: "Payment status (e.g. unpaid, paid, partial).",
    }),
    v3_status: S.optionalKey(S.String).annotateKey({
      description: "Lifecycle status (e.g. draft, sent, viewed, paid).",
    }),
    create_date: S.optionalKey(S.String).annotateKey({
      description: "Invoice creation date.",
    }),
    due_date: S.optionalKey(S.String).annotateKey({
      description: "Invoice due date.",
    }),
    currency_code: S.optionalKey(S.String).annotateKey({
      description: "Invoice currency code.",
    }),
  },
  $I.annote("FreshbooksInvoice", {
    description: "FreshBooks invoice record.",
  })
) {}

/**
 * FreshBooks payment record, decoded to a stable subset.
 *
 * **Example** (Decode payment)
 *
 * ```ts
 * import { FreshbooksPayment } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const payment = S.decodeUnknownSync(FreshbooksPayment)({
 *   id: 10865326,
 *   invoiceid: 2010190,
 *   clientid: 1758507,
 *   amount: { amount: "10.00", code: "USD" },
 *   date: "2013-12-10",
 *   type: "Check"
 * })
 *
 * console.log(payment.type) // "Check"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksPayment extends S.Class<FreshbooksPayment>($I`FreshbooksPayment`)(
  {
    id: FreshbooksPaymentId.annotateKey({
      description: "Payment identifier.",
    }),
    invoiceid: S.optionalKey(FreshbooksInvoiceId).annotateKey({
      description: "Invoice id the payment is applied to.",
    }),
    clientid: S.optionalKey(FreshbooksClientId).annotateKey({
      description: "Client id the payment is from.",
    }),
    amount: S.optionalKey(FreshbooksMoney).annotateKey({
      description: "Payment amount.",
    }),
    date: S.optionalKey(S.String).annotateKey({
      description: "Payment date.",
    }),
    type: S.optionalKey(S.String).annotateKey({
      description: "Payment type (e.g. Check, Credit Card).",
    }),
    note: S.optionalKey(S.String).annotateKey({
      description: "Free-text payment note.",
    }),
  },
  $I.annote("FreshbooksPayment", {
    description: "FreshBooks payment record.",
  })
) {}

/**
 * FreshBooks list pagination metadata carried alongside each result array.
 *
 * **Example** (Decode pagination)
 *
 * ```ts
 * import { FreshbooksPagination } from "@beep/freshbooks"
 * import * as S from "effect/Schema"
 *
 * const page = S.decodeUnknownSync(FreshbooksPagination)({ page: 1, pages: 1, per_page: 15, total: 2 })
 * console.log(page.total) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FreshbooksPagination extends S.Class<FreshbooksPagination>($I`FreshbooksPagination`)(
  {
    page: S.Int.annotateKey({ description: "Current 1-based page number." }),
    pages: S.Int.annotateKey({ description: "Total page count." }),
    per_page: S.Int.annotateKey({
      description: "Page size (capped by FreshBooks at 100).",
    }),
    total: S.Int.annotateKey({ description: "Total item count across pages." }),
  },
  $I.annote("FreshbooksPagination", {
    description: "FreshBooks list pagination metadata.",
  })
) {}

const AccountingResult = <A, I, R>(schema: S.Codec<A, I, R>) =>
  S.Struct({
    response: S.Struct({
      result: schema,
    }),
  });

const paginationFields = {
  page: S.Int,
  pages: S.Int,
  per_page: S.Int,
  total: S.Int,
} as const;

/**
 * A page of decoded FreshBooks records with its pagination metadata. Returned
 * by the driver's list verbs after the response envelope is unwrapped.
 *
 * **Example** (Describe a client page type)
 *
 * ```ts
 * import type { FreshbooksClient, FreshbooksPagination } from "@beep/freshbooks"
 *
 * type ClientPage = {
 *   readonly items: ReadonlyArray<FreshbooksClient>
 *   readonly pagination: FreshbooksPagination
 * }
 *
 * const empty: ClientPage["items"] = []
 * console.log(empty.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type FreshbooksPage<A> = {
  readonly items: ReadonlyArray<A>;
  readonly pagination: FreshbooksPagination;
};

const identityBody = S.Struct({ response: FreshbooksIdentity });
const clientDetailBody = AccountingResult(S.Struct({ client: FreshbooksClient }));
const clientListBody = AccountingResult(S.Struct({ clients: S.Array(FreshbooksClient), ...paginationFields }));
const invoiceDetailBody = AccountingResult(S.Struct({ invoice: FreshbooksInvoice }));
const invoiceListBody = AccountingResult(S.Struct({ invoices: S.Array(FreshbooksInvoice), ...paginationFields }));
const paymentDetailBody = AccountingResult(S.Struct({ payment: FreshbooksPayment }));
const paymentListBody = AccountingResult(S.Struct({ payments: S.Array(FreshbooksPayment), ...paginationFields }));

/**
 * Boundary decoders for the FreshBooks response envelopes. Each unwraps the
 * `response.result` (or bare `response`) shell before the service reshapes it
 * into a domain value or {@link FreshbooksPage}.
 *
 * @category decoders
 * @since 0.0.0
 */
export const FreshbooksDecode = {
  identity: S.decodeUnknownEffect(identityBody),
  client: S.decodeUnknownEffect(clientDetailBody),
  clients: S.decodeUnknownEffect(clientListBody),
  invoice: S.decodeUnknownEffect(invoiceDetailBody),
  invoices: S.decodeUnknownEffect(invoiceListBody),
  payment: S.decodeUnknownEffect(paymentDetailBody),
  payments: S.decodeUnknownEffect(paymentListBody),
} as const;
