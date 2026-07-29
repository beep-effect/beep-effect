import { Matter } from "@beep/law-practice-domain";
import { describe, expect, it } from "tstyche";
import type {
  Citation,
  CitationBase,
  CitationWarning,
  ContextOptions,
  DurableLocatorOptions,
  FullCaseCitation,
  IdCitation,
  LegalClientStatus,
  LegalClientStatus as LegalClientStatusType,
  LegalContactRole,
  LegalContactRole as LegalContactRoleType,
  MatterType,
  MatterType as MatterTypeType,
  NeutralCitation,
  Parenthetical,
  PatentAssetStatus,
  PatentAssetStatus as PatentAssetStatusType,
  PinciteInfo,
  RegulationCitation,
  ResolutionResult,
  ShortFormCaseCitation,
  StatuteCitation,
  StatutesAtLargeCitation,
  SubsequentHistoryEntry,
  SupraCitation,
} from "@beep/law-practice-domain";
import type { NonNegativeInt } from "@beep/schema";
import type * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import type * as O from "effect/Option";

declare const matter: Matter;

describe("@beep/law-practice-domain", () => {
  it("preserves exported value schema types", () => {
    expect<LegalClientStatus>().type.toBe<LegalClientStatusType>();
    expect<LegalClientStatusType>().type.toBe<"active_client">();
    expect<LegalContactRole>().type.toBe<LegalContactRoleType>();
    expect<LegalContactRoleType>().type.toBe<"founder">();
    expect<MatterType>().type.toBe<MatterTypeType>();
    expect<MatterTypeType>().type.toBe<"patent_application">();
    expect<PatentAssetStatus>().type.toBe<PatentAssetStatusType>();
    expect<PatentAssetStatusType>().type.toBe<"pre_filing">();
  });

  it("preserves Matter BaseEntity identity wiring", () => {
    expect(Matter.definition.entityId).type.toBe<typeof LawPractice.MatterId>();
    expect<typeof Matter.definition.entityId.tableName>().type.toBe<"law_practice_matter">();
    expect<typeof Matter.definition.entityId.entityType>().type.toBe<"LawPracticeMatter">();
    expect<typeof Matter.definition.persisted.matterType.storageKind>().type.toBe<"literal">();
    expect<
      typeof Matter.definition.persisted.legalClientFixtureKey.columnName
    >().type.toBe<"legal_client_fixture_key">();
    expect<typeof Matter.fields.matterType.Type>().type.toBe<MatterTypeType>();
  });

  it("preserves decode and constructor types", () => {
    expect<typeof Matter.Encoded>().type.toBeAssignableTo<typeof Matter.Encoded>();
    expect(Matter.make(matter)).type.toBe<Matter>();
    expect<Matter["matterType"]>().type.toBe<MatterTypeType>();
  });

  it("keeps definitive citation defaults total while wire keys remain optional", () => {
    expect<CitationBase["warnings"]>().type.toBe<ReadonlyArray<CitationWarning>>();
    expect<CitationBase.Encoded["warnings"]>().type.toBe<ReadonlyArray<CitationWarning.Encoded> | undefined>();
    expect<CitationBase["inFootnote"]>().type.toBe<O.Option<boolean>>();

    expect<ContextOptions["type"]>().type.toBe<"sentence" | "paragraph">();
    expect<ContextOptions.Encoded["type"]>().type.toBe<"sentence" | "paragraph" | undefined>();
    expect<ContextOptions["maxLength"]>().type.toBe<O.Option<NonNegativeInt>>();

    expect<DurableLocatorOptions["space"]>().type.toBe<"original" | "clean">();
    expect<DurableLocatorOptions["fullSpan"]>().type.toBe<boolean>();
    expect<DurableLocatorOptions["contextLength"]>().type.toBe<NonNegativeInt>();
    expect<DurableLocatorOptions.Encoded["space"]>().type.toBe<"original" | "clean" | undefined>();
    expect<DurableLocatorOptions.Encoded["fullSpan"]>().type.toBe<boolean | undefined>();
    expect<DurableLocatorOptions.Encoded["contextLength"]>().type.toBe<number | undefined>();

    expect<Parenthetical.Type["citations"]>().type.toBe<ReadonlyArray<Citation.Type>>();
    expect<Parenthetical.Encoded["citations"]>().type.toBe<ReadonlyArray<Citation.Encoded> | undefined>();

    expect<FullCaseCitation["unpublished"]>().type.toBe<boolean>();
    expect<FullCaseCitation["hasBlankPage"]>().type.toBe<boolean>();
    expect<FullCaseCitation["parentheticals"]>().type.toBe<ReadonlyArray<Parenthetical.Type>>();
    expect<FullCaseCitation["subsequentHistoryEntries"]>().type.toBe<ReadonlyArray<SubsequentHistoryEntry>>();
    expect<FullCaseCitation["justices"]>().type.toBe<ReadonlyArray<string>>();
    expect<FullCaseCitation.Encoded["unpublished"]>().type.toBe<boolean | undefined>();
    expect<FullCaseCitation.Encoded["hasBlankPage"]>().type.toBe<boolean | undefined>();
    expect<FullCaseCitation.Encoded["parentheticals"]>().type.toBe<ReadonlyArray<Parenthetical.Encoded> | undefined>();
    expect<FullCaseCitation.Encoded["subsequentHistoryEntries"]>().type.toBe<
      ReadonlyArray<SubsequentHistoryEntry.Encoded> | undefined
    >();
    expect<FullCaseCitation.Encoded["justices"]>().type.toBe<ReadonlyArray<string> | undefined>();

    expect<IdCitation["pinciteInherited"]>().type.toBe<boolean>();
    expect<SupraCitation["pinciteInherited"]>().type.toBe<boolean>();
    expect<ShortFormCaseCitation["pinciteInherited"]>().type.toBe<boolean>();
    expect<IdCitation.Encoded["pinciteInherited"]>().type.toBe<boolean | undefined>();
    expect<SupraCitation.Encoded["pinciteInherited"]>().type.toBe<boolean | undefined>();
    expect<ShortFormCaseCitation.Encoded["pinciteInherited"]>().type.toBe<boolean | undefined>();

    expect<NeutralCitation["unpublished"]>().type.toBe<boolean>();
    expect<StatuteCitation["hasEtSeq"]>().type.toBe<boolean>();
    expect<RegulationCitation["hasEtSeq"]>().type.toBe<boolean>();
    expect<StatutesAtLargeCitation["pinciteIsRange"]>().type.toBe<boolean>();
    expect<NeutralCitation.Encoded["unpublished"]>().type.toBe<boolean | undefined>();
    expect<StatuteCitation.Encoded["hasEtSeq"]>().type.toBe<boolean | undefined>();
    expect<RegulationCitation.Encoded["hasEtSeq"]>().type.toBe<boolean | undefined>();
    expect<StatutesAtLargeCitation.Encoded["pinciteIsRange"]>().type.toBe<boolean | undefined>();

    expect<PinciteInfo["starPage"]>().type.toBe<boolean>();
    expect<PinciteInfo["additionalPincites"]>().type.toBe<ReadonlyArray<PinciteInfo.Type>>();
    expect<PinciteInfo.Encoded["starPage"]>().type.toBe<boolean | undefined>();
    expect<PinciteInfo.Encoded["additionalPincites"]>().type.toBe<ReadonlyArray<PinciteInfo.Encoded> | undefined>();

    expect<ResolutionResult["warnings"]>().type.toBe<ReadonlyArray<string>>();
    expect<ResolutionResult.Encoded["warnings"]>().type.toBe<ReadonlyArray<string> | undefined>();
  });
});
