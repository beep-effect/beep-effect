import {
  CaseReportList,
  CaseResult,
  CourtCaseSearchDto,
  makePacerLayer,
  makePacerMockHttpClient,
  mockPacerConfig,
  NextGenCsoToken,
  PacerAuthError,
  PacerAuthErrorReason,
  PacerBatchOption,
  PacerCasesOption,
  PacerConfigError,
  PacerConfigLoadOptions,
  PacerDeleteReportOption,
  PacerEnvironment,
  PacerLogoutOption,
  PacerMockHttpClient,
  PacerMockOptions,
  PacerPclError,
  PartyReportList,
  PartyResult,
  PartySearchDto,
  ReportInfoType,
  VERSION,
} from "@beep/pacer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { describe, expect, it } from "tstyche";
import type { PacerAuth, PacerConfig, PacerSession, PclClient } from "@beep/pacer";
import type { Effect, Layer, Stream } from "effect";
import type * as HttpClient from "effect/unstable/http/HttpClient";

declare const auth: typeof PacerAuth.Service;
declare const pcl: typeof PclClient.Service;

describe("@beep/pacer", () => {
  it("preserves package constants and literal domains", () => {
    expect(VERSION).type.toBe<"0.0.0">();
    expect(PacerEnvironment.Enum.qa).type.toBe<"qa">();
    expect(PacerAuthErrorReason.Enum["invalid-credentials"]).type.toBe<"invalid-credentials">();
    expect(PacerBatchOption.Enum.failed).type.toBe<"failed">();
    expect(PacerCasesOption.Enum["never-last"]).type.toBe<"never-last">();
    expect(PacerDeleteReportOption.Enum.failed).type.toBe<"failed">();
    expect(PacerLogoutOption.Enum.invalid).type.toBe<"invalid">();
  });

  it("preserves config loader and mock option typing", () => {
    const cfg = mockPacerConfig();
    const options = PacerConfigLoadOptions.make({ environment: "qa" });
    const mockOptions = PacerMockOptions.make({
      auth: "success",
      batch: "failed",
      cases: "never-last",
      deleteReport: "failed",
      logout: "invalid",
    });

    expect(cfg).type.toBe<PacerConfig>();
    expect(options).type.toBe<PacerConfigLoadOptions>();
    expect(mockOptions).type.toBe<PacerMockOptions>();

    // @ts-expect-error!
    const invalidEnvironment = PacerConfigLoadOptions.make({ environment: "stage" });
    // @ts-expect-error!
    const invalidMockAuth = PacerMockOptions.make({ auth: "expired" });

    void invalidEnvironment;
    void invalidMockAuth;
  });

  it("preserves layer composition types", () => {
    const cfg = mockPacerConfig();
    const httpClient = makePacerMockHttpClient({ cases: "success", logout: "success" });
    const layers = makePacerLayer(cfg, httpClient);
    const curriedLayers = makePacerLayer(httpClient)(cfg);

    expect(PacerMockHttpClient).type.toBe<Layer.Layer<HttpClient.HttpClient>>();
    expect(httpClient).type.toBe<Layer.Layer<HttpClient.HttpClient>>();
    expect(layers.auth).type.toBe<Layer.Layer<PacerAuth>>();
    expect(layers.session).type.toBe<Layer.Layer<PacerSession, PacerAuthError>>();
    expect(layers.pcl).type.toBe<Layer.Layer<PclClient, PacerAuthError>>();
    expect(layers.full).type.toBe<Layer.Layer<PacerAuth | PacerSession | PclClient, PacerAuthError>>();
    expect(curriedLayers.full).type.toBe<Layer.Layer<PacerAuth | PacerSession | PclClient, PacerAuthError>>();

    // @ts-expect-error!
    const invalidMock = makePacerMockHttpClient({ cases: "bad-case-mode" });

    void invalidMock;
  });

  it("preserves auth and PCL service method signatures", () => {
    const token = NextGenCsoToken.make(Str.repeat(128)("Q"));
    const caseSearch = CourtCaseSearchDto.make({ caseNumberFull: O.some("1:2002bk20340") });
    const partySearch = PartySearchDto.make({ lastName: O.some("Henderson") });

    expect(auth.login).type.toBe<Effect.Effect<NextGenCsoToken, PacerAuthError>>();
    expect(auth.logout(token)).type.toBe<Effect.Effect<void, PacerAuthError>>();
    expect(pcl.findCasesPage(caseSearch, 0)).type.toBe<Effect.Effect<CaseReportList, PacerPclError>>();
    expect(pcl.findParties(partySearch)).type.toBe<Effect.Effect<PartyReportList, PacerPclError>>();
    expect(pcl.streamCases(caseSearch)).type.toBe<Stream.Stream<CaseResult, PacerPclError>>();
    expect(pcl.startCaseDownload(caseSearch)).type.toBe<Effect.Effect<ReportInfoType, PacerPclError>>();
    expect(pcl.downloadCases(caseSearch)).type.toBe<Effect.Effect<ReadonlyArray<CaseResult>, PacerPclError>>();

    // @ts-expect-error!
    const wrongPayload = pcl.findCasesPage(partySearch, 0);

    void wrongPayload;
  });

  it("preserves schema constructors and typed errors", () => {
    const caseReport = CaseReportList.make({ content: O.some([CaseResult.make({})]) });
    const partyReport = PartyReportList.make({ content: O.some([PartyResult.make({})]) });
    const reportInfo = ReportInfoType.make({ reportId: 1078, status: O.some("COMPLETED") });

    expect(caseReport).type.toBe<CaseReportList>();
    expect(partyReport).type.toBe<PartyReportList>();
    expect(reportInfo).type.toBe<ReportInfoType>();
    expect(PacerAuthError.fromLoginResult("13")).type.toBe<PacerAuthError>();
    expect(PacerPclError.fromStatus(406)).type.toBe<PacerPclError>();
    expect(PacerConfigError.make_("missing PACER_USERNAME")).type.toBe<PacerConfigError>();
  });
});
