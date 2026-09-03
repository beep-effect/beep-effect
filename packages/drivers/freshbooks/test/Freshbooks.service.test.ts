import {
  Freshbooks,
  FreshbooksAccountId,
  FreshbooksClient,
  FreshbooksClientId,
  FreshbooksConfigInput,
  FreshbooksError,
  FreshbooksInvoice,
  FreshbooksInvoiceId,
  FreshbooksPayment,
  FreshbooksPaymentId,
  FreshbooksStoredToken,
  FreshbooksTokenStore,
} from "@beep/freshbooks";
import { A } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer, Redacted, Ref, Result } from "effect";
import * as S from "effect/Schema";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

type CapturedRequest = {
  readonly authorization: string | undefined;
  readonly method: string;
  readonly url: string;
};

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));
const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const jsonResponse = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: { "content-type": "application/json" }, status });

// Synthetic fixtures — no real client, invoice, or payment data.
const accountId = decode(FreshbooksAccountId, "TESTACCT");
const errorAccountId = decode(FreshbooksAccountId, "ERRACCT");
const clientId = decode(FreshbooksClientId, 1001);
const invoiceId = decode(FreshbooksInvoiceId, 2001);
const paymentId = decode(FreshbooksPaymentId, 3001);

const clientWire = {
  id: 1001,
  fname: "Sample",
  lname: "Client",
  organization: "Sample Org LLC",
  email: "sample.client@example.com",
  currency_code: "USD",
  vis_state: 0,
  updated: "2026-01-01 00:00:00",
};
const invoiceWire = {
  id: 2001,
  invoice_number: "TEST-0001",
  customerid: 1001,
  amount: { amount: "500.00", code: "USD" },
  outstanding: { amount: "500.00", code: "USD" },
  paid: { amount: "0.00", code: "USD" },
  payment_status: "unpaid",
  v3_status: "sent",
  create_date: "2026-01-01",
  due_date: "2026-01-31",
  currency_code: "USD",
};
const paymentWire = {
  id: 3001,
  invoiceid: 2001,
  clientid: 1001,
  amount: { amount: "250.00", code: "USD" },
  date: "2026-01-15",
  type: "Check",
  note: "partial",
};
const identityWire = {
  response: {
    id: 42,
    first_name: "Sample",
    last_name: "Owner",
    email: "owner@example.com",
    business_memberships: [
      { id: 111, role: "owner", business: { id: 240340, account_id: "TESTACCT", name: "Sample Org LLC" } },
    ],
  },
};
const listEnvelope = (key: string, items: ReadonlyArray<unknown>): unknown => ({
  response: { result: { [key]: items, page: 1, pages: 1, per_page: 100, total: items.length } },
});
const detailEnvelope = (key: string, item: unknown): unknown => ({ response: { result: { [key]: item } } });

// Stateless routing mock — returns the fixture for the requested path. Because
// there is no shared per-test response state, concurrently-scheduled tests
// cannot interfere with one another.
const route = (url: string): Response => {
  const path = new URL(url).pathname;
  if (path.includes("ERRACCT")) {
    return jsonResponse({ response: { errors: [{ errno: 429 }] } }, 429);
  }
  if (path.endsWith("/users/me")) {
    return jsonResponse(identityWire);
  }
  if (/\/users\/clients\/\d+$/.test(path)) {
    return jsonResponse(detailEnvelope("client", clientWire));
  }
  if (path.endsWith("/users/clients")) {
    return jsonResponse(listEnvelope("clients", [clientWire]));
  }
  if (/\/invoices\/invoices\/\d+$/.test(path)) {
    return jsonResponse(detailEnvelope("invoice", invoiceWire));
  }
  if (path.endsWith("/invoices/invoices")) {
    return jsonResponse(listEnvelope("invoices", [invoiceWire]));
  }
  if (/\/payments\/payments\/\d+$/.test(path)) {
    return jsonResponse(detailEnvelope("payment", paymentWire));
  }
  if (path.endsWith("/payments/payments")) {
    return jsonResponse(listEnvelope("payments", [paymentWire]));
  }
  return jsonResponse({ response: { errors: [{ errno: 404 }] } }, 404);
};

const findUrl = (captures: ReadonlyArray<CapturedRequest>, url: string): CapturedRequest | undefined =>
  A.findFirst(captures, (capture) => capture.url === url).pipe((option) =>
    option._tag === "Some" ? option.value : undefined
  );

// A token valid far into the future so verbs never trigger a refresh.
const freshToken = FreshbooksStoredToken.make({
  accessToken: Redacted.make("access-token"),
  refreshToken: Redacted.make("refresh-token"),
  expiresAt: 4_102_444_800_000,
});

class FreshbooksCaptureRef extends Context.Service<FreshbooksCaptureRef, Ref.Ref<ReadonlyArray<CapturedRequest>>>()(
  "@beep/freshbooks/test/Freshbooks.service.test/FreshbooksCaptureRef"
) {
  static readonly layer = Layer.effect(FreshbooksCaptureRef, Ref.make<ReadonlyArray<CapturedRequest>>([]));
}

const CapturingHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const ref = yield* FreshbooksCaptureRef;
    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const url = HttpClientRequest.toUrl(request).pipe((option) =>
          option._tag === "Some" ? option.value.toString() : request.url
        );
        yield* Ref.update(ref, A.append({ authorization: request.headers.authorization, method: request.method, url }));
        return HttpClientResponse.fromWeb(request, route(url));
      })
    );
  })
);

const capturesOf = Effect.gen(function* () {
  const ref = yield* FreshbooksCaptureRef;
  return yield* Ref.get(ref);
});

const TestLayer = Freshbooks.makeLayer(
  FreshbooksConfigInput.make({
    clientId: "test-client-id",
    clientSecret: Redacted.make("test-client-secret"),
    redirectUri: "https://localhost:8443/callback",
  })
).pipe(
  Layer.provideMerge(FreshbooksTokenStore.layerMemory(freshToken)),
  Layer.provide(CapturingHttpClientLayer),
  Layer.provideMerge(FreshbooksCaptureRef.layer)
);

describe("@beep/freshbooks models", () => {
  it("renames wire snake_case keys to camelCase on decode and back on encode", () => {
    const client = decode(FreshbooksClient, clientWire);
    expect(client.firstName).toBe("Sample");
    expect(client.currencyCode).toBe("USD");
    expect(client.visState).toBe(0);
    expect(encode(FreshbooksClient, client)).toEqual(clientWire);

    const invoice = decode(FreshbooksInvoice, invoiceWire);
    expect(invoice.invoiceNumber).toBe("TEST-0001");
    expect(invoice.customerId).toBe(1001);
    expect(invoice.amount?.amount).toBe("500.00");
    expect(encode(FreshbooksInvoice, invoice)).toEqual(invoiceWire);

    const payment = decode(FreshbooksPayment, paymentWire);
    expect(payment.invoiceId).toBe(2001);
    expect(payment.clientId).toBe(1001);
    expect(encode(FreshbooksPayment, payment)).toEqual(paymentWire);
  });
});

describe("@beep/freshbooks read service", () => {
  layer(TestLayer)((it) => {
    it.effect(
      "resolves the identity with distinct account and business namespaces",
      Effect.fnUntraced(function* () {
        const freshbooks = yield* Freshbooks;
        const identity = yield* freshbooks.getIdentity;
        const capture = findUrl(yield* capturesOf, "https://api.freshbooks.com/auth/api/v1/users/me");

        expect(identity.businessMemberships[0]?.business.accountId).toBe("TESTACCT");
        expect(identity.businessMemberships[0]?.business.id).toBe(240340);
        expect(capture?.method).toBe("GET");
        expect(capture?.authorization).toBe("Bearer access-token");
      })
    );

    it.effect(
      "lists clients and reshapes the pagination envelope",
      Effect.fnUntraced(function* () {
        const freshbooks = yield* Freshbooks;
        const page = yield* freshbooks.listClients(accountId);
        const capture = findUrl(
          yield* capturesOf,
          "https://api.freshbooks.com/accounting/account/TESTACCT/users/clients?page=1&per_page=100"
        );

        expect(page.items[0]?.organization).toBe("Sample Org LLC");
        expect(page.pagination.perPage).toBe(100);
        expect(page.pagination.total).toBe(1);
        expect(capture?.method).toBe("GET");
      })
    );

    it.effect(
      "fetches a single client and a single invoice by id",
      Effect.fnUntraced(function* () {
        const freshbooks = yield* Freshbooks;
        const client = yield* freshbooks.getClient(accountId, clientId);
        const invoice = yield* freshbooks.getInvoice(accountId, invoiceId);
        const captures = yield* capturesOf;

        expect(client.email).toBe("sample.client@example.com");
        expect(invoice.invoiceNumber).toBe("TEST-0001");
        expect(invoice.paymentStatus).toBe("unpaid");
        expect(
          findUrl(captures, "https://api.freshbooks.com/accounting/account/TESTACCT/users/clients/1001")
        ).toBeDefined();
        expect(
          findUrl(captures, "https://api.freshbooks.com/accounting/account/TESTACCT/invoices/invoices/2001")
        ).toBeDefined();
      })
    );

    it.effect(
      "lists and fetches payments with page selection",
      Effect.fnUntraced(function* () {
        const freshbooks = yield* Freshbooks;
        const page = yield* freshbooks.listPayments(accountId, { page: 2 });
        const payment = yield* freshbooks.getPayment(accountId, paymentId);
        const captures = yield* capturesOf;

        expect(page.items[0]?.type).toBe("Check");
        expect(payment.id).toBe(3001);
        expect(
          findUrl(
            captures,
            "https://api.freshbooks.com/accounting/account/TESTACCT/payments/payments?page=2&per_page=100"
          )
        ).toBeDefined();
        expect(
          findUrl(captures, "https://api.freshbooks.com/accounting/account/TESTACCT/payments/payments/3001")
        ).toBeDefined();
      })
    );

    it.effect(
      "maps non-success responses to typed driver errors with resource context",
      Effect.fnUntraced(function* () {
        const freshbooks = yield* Freshbooks;
        const exit = yield* Effect.exit(freshbooks.listInvoices(errorAccountId));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(error._tag).toBe("Some");
          if (error._tag === "Some") {
            expect(error.value).toBeInstanceOf(FreshbooksError);
            expect(error.value.reason).toBe("response status");
            expect(error.value.status).toBe(429);
            expect(error.value.resource).toBe("invoices");
          }
        }
      })
    );
  });
});
