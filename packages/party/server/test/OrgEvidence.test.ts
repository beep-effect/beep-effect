import {
  classifyByOrganization,
  MailboxEvidence,
  nameShape,
  ObservedSpan,
  organizationDomain,
} from "@beep/party-server/OrgEvidence";
import { describe, expect, it } from "@effect/vitest";
import * as TestUtils from "@effect/vitest/utils";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const span = (first: number, last: number) =>
  O.some(ObservedSpan.make({ first: DateTime.makeUnsafe(first), last: DateTime.makeUnsafe(last) }));
const box = (domains: ReadonlyArray<string>, span: O.Option<ObservedSpan>) =>
  MailboxEvidence.make({ domains: HashSet.fromIterable(domains), span });
describe("organization-domain leads", () => {
  it.effect("normalizes mailbox domains while excluding free mail and malformed input", () =>
    Effect.gen(function* () {
      const resolved1 = yield* organizationDomain("riley@mail.acme.example");
      TestUtils.assertSome(resolved1, "acme.example");
      const resolved2 = yield* organizationDomain("pat@firm.co.uk");
      TestUtils.assertSome(resolved2, "firm.co.uk");
      const resolved3 = yield* organizationDomain("someone@gmail.com");
      TestUtils.assertNone(resolved3);
      const resolved4 = yield* organizationDomain("not-an-address");
      TestUtils.assertNone(resolved4);
      const resolved5 = yield* organizationDomain("bare.example");
      TestUtils.assertNone(resolved5);
      const resolved6 = yield* organizationDomain("Dana <Dana@BÜCHER.example>");
      TestUtils.assertSome(resolved6, "xn--bcher-kva.example");
    })
  );
  it("reads a shared domain as an alias lead", () => {
    expect(classifyByOrganization([box(["acme.example"], span(1, 3)), box(["acme.example"], span(2, 4))])).toBe(
      "same-org-alias"
    );
  });
  it("identifies concurrent disjoint organizations including touching observation bounds", () => {
    expect(classifyByOrganization([box(["acme.example"], span(1, 3)), box(["other.example"], span(3, 4))])).toBe(
      "different-orgs-concurrent"
    );
  });
  it("identifies sequential disjoint organizations using numeric time", () => {
    expect(classifyByOrganization([box(["acme.example"], span(2, 9)), box(["other.example"], span(10, 20))])).toBe(
      "different-orgs-sequential"
    );
  });
  it("preserves uncertainty when time or organization evidence is missing", () => {
    expect(classifyByOrganization([box(["acme.example"], O.none()), box(["other.example"], span(1, 3))])).toBe(
      "different-orgs-undated"
    );
    expect(classifyByOrganization([box([], span(1, 3)), box(["other.example"], span(1, 3))])).toBe("no-org-evidence");
  });
  it("does not hide a known concurrent pair behind another undated pair", () => {
    expect(
      classifyByOrganization([
        box(["acme.example"], span(1, 3)),
        box(["other.example"], span(2, 4)),
        box(["third.example"], O.none()),
      ])
    ).toBe("different-orgs-concurrent");
  });
  it("rejects reversed observation spans but permits a single instant", () => {
    pipe(S.decodeResult(ObservedSpan)({ first: 5, last: 4 }), Result.isFailure, TestUtils.assertTrue);
    pipe(S.decodeResult(ObservedSpan)({ first: 5, last: 5 }), Result.isSuccess, TestUtils.assertTrue);
  });
  it("treats single-token names as low-information aliases", () => {
    expect(nameShape("chris morgan")).toBe("full-name");
    expect(nameShape("morgan, chris")).toBe("full-name");
    expect(nameShape("support")).toBe("single-token");
  });
});
