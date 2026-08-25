/**
 * Generated from the checked-in GovInfo OpenAPI document.
 *
 * This package-private module is a drift oracle for the hand-written GovInfo
 * contracts. Do not import it from package source or edit it by hand.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";
import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  HttpApiMiddleware,
  HttpApiSchema,
  HttpApiSecurity,
  OpenApi,
} from "effect/unstable/httpapi";
// non-recursive definitions
/**
 * Generated SearchRequest declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type SearchRequest = {
  readonly query?: string;
  readonly pageSize?: number;
  readonly offsetMark?: string;
  readonly sorts?: ReadonlyArray<{
    readonly field?: string;
    readonly sortOrder?: "ASC" | "DESC";
  }>;
  readonly historical?: boolean;
  readonly resultLevel?: string;
};
/**
 * Generated SearchRequest declaration for @beep/govinfo.
 *
 * **Example** (Inspect SearchRequest)
 *
 * ```ts
 * import { SearchRequest } from "@beep/govinfo"
 *
 * console.log(SearchRequest)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SearchRequest = S.Struct({
  query: S.optionalKey(S.String),
  pageSize: S.optionalKey(S.Int.annotate({ format: "int32" })),
  offsetMark: S.optionalKey(S.String),
  sorts: S.Array(
    S.Struct({
      field: S.optionalKey(S.String),
      sortOrder: S.optionalKey(S.Literals(["ASC", "DESC"])),
    }),
  ).pipe(S.optionalKey),
  historical: S.optionalKey(S.Boolean),
  resultLevel: S.optionalKey(S.String),
}).annotate({ identifier: "SearchRequest" });
/**
 * Generated SearchResponse declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type SearchResponse = {
  readonly results?: ReadonlyArray<{
    readonly title?: string;
    readonly packageId?: string;
    readonly granuleId?: string;
    readonly lastModified?: string;
    readonly governmentAuthor?: ReadonlyArray<string>;
    readonly dateIssued?: string;
    readonly collectionCode?: string;
    readonly resultLink?: string;
    readonly dateIngested?: string;
    readonly download?: { readonly [x: string]: string };
    readonly relatedLink?: string;
  }>;
  readonly offsetMark?: string;
  readonly count?: number;
};
/**
 * Generated SearchResponse declaration for @beep/govinfo.
 *
 * **Example** (Inspect SearchResponse)
 *
 * ```ts
 * import { SearchResponse } from "@beep/govinfo"
 *
 * console.log(SearchResponse)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SearchResponse = S.Struct({
  results: S.Array(
    S.Struct({
      title: S.optionalKey(S.String),
      packageId: S.optionalKey(S.String),
      granuleId: S.optionalKey(S.String),
      lastModified: S.optionalKey(S.String),
      governmentAuthor: S.Array(S.String).pipe(S.optionalKey),
      dateIssued: S.optionalKey(S.String),
      collectionCode: S.optionalKey(S.String),
      resultLink: S.optionalKey(S.String),
      dateIngested: S.optionalKey(S.String),
      download: S.Record(S.String, S.String).pipe(S.optionalKey),
      relatedLink: S.optionalKey(S.String),
    }),
  ).pipe(S.optionalKey),
  offsetMark: S.optionalKey(S.String),
  count: S.optionalKey(S.Int.annotate({ format: "int32" })),
}).annotate({ identifier: "SearchResponse" });
/**
 * Generated CollectionContainer declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type CollectionContainer = {
  readonly count?: number;
  readonly message?: string;
  readonly nextPage?: string;
  readonly previousPage?: string;
  readonly packages?: ReadonlyArray<{
    readonly packageId?: string;
    readonly lastModified?: string;
    readonly packageLink?: string;
    readonly docClass?: string;
    readonly title?: string;
    readonly congress?: string;
    readonly dateIssued?: string;
  }>;
};
/**
 * Generated CollectionContainer declaration for @beep/govinfo.
 *
 * **Example** (Inspect CollectionContainer)
 *
 * ```ts
 * import { CollectionContainer } from "@beep/govinfo"
 *
 * console.log(CollectionContainer)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const CollectionContainer = S.Struct({
  count: S.optionalKey(S.Int.annotate({ format: "int64" })),
  message: S.optionalKey(S.String),
  nextPage: S.optionalKey(S.String),
  previousPage: S.optionalKey(S.String),
  packages: S.Array(
    S.Struct({
      packageId: S.optionalKey(S.String),
      lastModified: S.optionalKey(S.String),
      packageLink: S.optionalKey(S.String),
      docClass: S.optionalKey(S.String),
      title: S.optionalKey(S.String),
      congress: S.optionalKey(S.String),
      dateIssued: S.optionalKey(S.String),
    }),
  ).pipe(S.optionalKey),
}).annotate({ identifier: "CollectionContainer" });
/**
 * Generated GranuleContainer declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GranuleContainer = {
  readonly count?: number;
  readonly offset?: number;
  readonly pageSize?: number;
  readonly nextPage?: string;
  readonly previousPage?: string;
  readonly granules?: ReadonlyArray<{
    readonly title?: string;
    readonly granuleId?: string;
    readonly granuleLink?: string;
    readonly dateIssued?: string;
    readonly granuleClass?: string;
    readonly md5?: string;
  }>;
  readonly message?: string;
};
/**
 * Generated GranuleContainer declaration for @beep/govinfo.
 *
 * **Example** (Inspect GranuleContainer)
 *
 * ```ts
 * import { GranuleContainer } from "@beep/govinfo"
 *
 * console.log(GranuleContainer)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GranuleContainer = S.Struct({
  count: S.optionalKey(S.Int.annotate({ format: "int32" })),
  offset: S.optionalKey(S.Int.annotate({ format: "int32" })),
  pageSize: S.optionalKey(S.Int.annotate({ format: "int32" })),
  nextPage: S.optionalKey(S.String),
  previousPage: S.optionalKey(S.String),
  granules: S.Array(
    S.Struct({
      title: S.optionalKey(S.String),
      granuleId: S.optionalKey(S.String),
      granuleLink: S.optionalKey(S.String),
      dateIssued: S.optionalKey(S.String),
      granuleClass: S.optionalKey(S.String),
      md5: S.optionalKey(S.String),
    }),
  ).pipe(S.optionalKey),
  message: S.optionalKey(S.String),
}).annotate({ identifier: "GranuleContainer" });
/**
 * Generated CollectionSummary declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type CollectionSummary = {
  readonly collections?: ReadonlyArray<{
    readonly collectionCode?: string;
    readonly collectionName?: string;
    readonly packageCount?: number;
    readonly granuleCount?: number;
  }>;
};
/**
 * Generated CollectionSummary declaration for @beep/govinfo.
 *
 * **Example** (Inspect CollectionSummary)
 *
 * ```ts
 * import { CollectionSummary } from "@beep/govinfo"
 *
 * console.log(CollectionSummary)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const CollectionSummary = S.Struct({
  collections: S.Array(
    S.Struct({
      collectionCode: S.optionalKey(S.String),
      collectionName: S.optionalKey(S.String),
      packageCount: S.optionalKey(S.Int.annotate({ format: "int64" })),
      granuleCount: S.optionalKey(S.Int.annotate({ format: "int64" })),
    }),
  ).pipe(S.optionalKey),
}).annotate({ identifier: "CollectionSummary" });
// schemas
/**
 * Generated SearchRequestJson declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type SearchRequestJson = SearchRequest;
/**
 * Generated SearchRequestJson declaration for @beep/govinfo.
 *
 * **Example** (Inspect SearchRequestJson)
 *
 * ```ts
 * import { SearchRequestJson } from "@beep/govinfo"
 *
 * console.log(SearchRequestJson)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const SearchRequestJson = SearchRequest;
/**
 * Generated Search200 declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type Search200 = SearchResponse;
/**
 * Generated Search200 declaration for @beep/govinfo.
 *
 * **Example** (Inspect Search200)
 *
 * ```ts
 * import { Search200 } from "@beep/govinfo"
 *
 * console.log(Search200)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const Search200 = SearchResponse;
/**
 * Generated RelatedPackageDetailsPathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type RelatedPackageDetailsPathParams = { readonly accessId: string };
/**
 * Generated RelatedPackageDetailsPathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect RelatedPackageDetailsPathParams)
 *
 * ```ts
 * import { RelatedPackageDetailsPathParams } from "@beep/govinfo"
 *
 * console.log(RelatedPackageDetailsPathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RelatedPackageDetailsPathParams = S.Struct({ accessId: S.String });
/**
 * Generated RelatedVersionsDetailsParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type RelatedVersionsDetailsParams = {
  readonly granuleClass?: string;
  readonly subGranuleClass?: string;
};
/**
 * Generated RelatedVersionsDetailsParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect RelatedVersionsDetailsParams)
 *
 * ```ts
 * import { RelatedVersionsDetailsParams } from "@beep/govinfo"
 *
 * console.log(RelatedVersionsDetailsParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RelatedVersionsDetailsParams = S.Struct({
  granuleClass: S.optionalKey(S.String),
  subGranuleClass: S.optionalKey(S.String),
});
/**
 * Generated RelatedVersionsDetailsPathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type RelatedVersionsDetailsPathParams = {
  readonly accessId: string;
  readonly collection:
    | "BILLS"
    | "CPD"
    | "DPCD"
    | "CPRT"
    | "CRPT"
    | "FR"
    | "HOB"
    | "PLAW"
    | "STATUTE"
    | "USCODE"
    | "CMR";
};
/**
 * Generated RelatedVersionsDetailsPathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect RelatedVersionsDetailsPathParams)
 *
 * ```ts
 * import { RelatedVersionsDetailsPathParams } from "@beep/govinfo"
 *
 * console.log(RelatedVersionsDetailsPathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RelatedVersionsDetailsPathParams = S.Struct({
  accessId: S.String,
  collection: S.Literals([
    "BILLS",
    "CPD",
    "DPCD",
    "CPRT",
    "CRPT",
    "FR",
    "HOB",
    "PLAW",
    "STATUTE",
    "USCODE",
    "CMR",
  ]),
});
/**
 * Generated RelatedVersionsDetailsQuery declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type RelatedVersionsDetailsQuery = {
  readonly granuleClass?: string;
  readonly subGranuleClass?: string;
};
/**
 * Generated RelatedVersionsDetailsQuery declaration for @beep/govinfo.
 *
 * **Example** (Inspect RelatedVersionsDetailsQuery)
 *
 * ```ts
 * import { RelatedVersionsDetailsQuery } from "@beep/govinfo"
 *
 * console.log(RelatedVersionsDetailsQuery)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const RelatedVersionsDetailsQuery = S.Struct({
  granuleClass: S.optionalKey(S.String),
  subGranuleClass: S.optionalKey(S.String),
});
/**
 * Generated GetPackagesByDateIssuedParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetPackagesByDateIssuedParams = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly collection: string;
  readonly congress?: string;
  readonly docClass?: string;
  readonly billVersion?:
    | "as"
    | "ash"
    | "ath"
    | "ats"
    | "cdh"
    | "cds"
    | "cph"
    | "cps"
    | "eah"
    | "eas"
    | "eh"
    | "enr"
    | "eph"
    | "es"
    | "fah"
    | "fph"
    | "fps"
    | "hdh"
    | "hds"
    | "ih"
    | "iph"
    | "ips"
    | "is"
    | "lth"
    | "lts"
    | "nat"
    | "oph"
    | "ops"
    | "pap"
    | "pav"
    | "pch"
    | "pcs"
    | "pp"
    | "pwah"
    | "rah"
    | "ras"
    | "rch"
    | "rcs"
    | "rdh"
    | "rds"
    | "re"
    | "reah"
    | "renr"
    | "res"
    | "rfh"
    | "rfs"
    | "rft"
    | "rh"
    | "rhuc"
    | "rih"
    | "ris"
    | "rs"
    | "rth"
    | "rts"
    | "s_p"
    | "sas"
    | "sc"
    | "mostrecent";
  readonly modifiedSince?: string;
  readonly courtCode?: string;
  readonly courtType?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly isGLP?: boolean;
  readonly natureSuitCode?: string;
  readonly natureSuit?: string;
};
/**
 * Generated GetPackagesByDateIssuedParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetPackagesByDateIssuedParams)
 *
 * ```ts
 * import { GetPackagesByDateIssuedParams } from "@beep/govinfo"
 *
 * console.log(GetPackagesByDateIssuedParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetPackagesByDateIssuedParams = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  collection: S.String,
  congress: S.optionalKey(S.String),
  docClass: S.optionalKey(S.String),
  billVersion: S.optionalKey(
    S.Literals([
      "as",
      "ash",
      "ath",
      "ats",
      "cdh",
      "cds",
      "cph",
      "cps",
      "eah",
      "eas",
      "eh",
      "enr",
      "eph",
      "es",
      "fah",
      "fph",
      "fps",
      "hdh",
      "hds",
      "ih",
      "iph",
      "ips",
      "is",
      "lth",
      "lts",
      "nat",
      "oph",
      "ops",
      "pap",
      "pav",
      "pch",
      "pcs",
      "pp",
      "pwah",
      "rah",
      "ras",
      "rch",
      "rcs",
      "rdh",
      "rds",
      "re",
      "reah",
      "renr",
      "res",
      "rfh",
      "rfs",
      "rft",
      "rh",
      "rhuc",
      "rih",
      "ris",
      "rs",
      "rth",
      "rts",
      "s_p",
      "sas",
      "sc",
      "mostrecent",
    ]),
  ),
  modifiedSince: S.optionalKey(S.String),
  courtCode: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "(?:AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY)[n|e|w|s]?[d|b|a]|(cofc|jpml)",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp (?:AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY)[n|e|w|s]?[d|b|a]|(cofc|jpml)",
      }),
    ),
  ),
  courtType: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp("District|Bankruptcy|Appellate|National"),
      ).annotate({
        expected:
          "a string matching the RegExp District|Bankruptcy|Appellate|National",
      }),
    ),
  ),
  state: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
      }),
    ),
  ),
  topic: S.optionalKey(S.String),
  isGLP: S.optionalKey(S.Boolean),
  natureSuitCode: S.optionalKey(S.String),
  natureSuit: S.optionalKey(S.String),
});
/**
 * Generated GetPackagesByDateIssuedPathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetPackagesByDateIssuedPathParams = {
  readonly dateIssuedStartDate: string;
};
/**
 * Generated GetPackagesByDateIssuedPathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetPackagesByDateIssuedPathParams)
 *
 * ```ts
 * import { GetPackagesByDateIssuedPathParams } from "@beep/govinfo"
 *
 * console.log(GetPackagesByDateIssuedPathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetPackagesByDateIssuedPathParams = S.Struct({
  dateIssuedStartDate: S.String.check(
    S.isPattern(new RegExp("\\d{4}-\\d{1,2}-\\d{1,2}")).annotate({
      expected: "a string matching the RegExp \\d{4}-\\d{1,2}-\\d{1,2}",
    }),
  ),
});
/**
 * Generated GetPackagesByDateIssuedQuery declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetPackagesByDateIssuedQuery = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly collection: string;
  readonly congress?: string;
  readonly docClass?: string;
  readonly billVersion?:
    | "as"
    | "ash"
    | "ath"
    | "ats"
    | "cdh"
    | "cds"
    | "cph"
    | "cps"
    | "eah"
    | "eas"
    | "eh"
    | "enr"
    | "eph"
    | "es"
    | "fah"
    | "fph"
    | "fps"
    | "hdh"
    | "hds"
    | "ih"
    | "iph"
    | "ips"
    | "is"
    | "lth"
    | "lts"
    | "nat"
    | "oph"
    | "ops"
    | "pap"
    | "pav"
    | "pch"
    | "pcs"
    | "pp"
    | "pwah"
    | "rah"
    | "ras"
    | "rch"
    | "rcs"
    | "rdh"
    | "rds"
    | "re"
    | "reah"
    | "renr"
    | "res"
    | "rfh"
    | "rfs"
    | "rft"
    | "rh"
    | "rhuc"
    | "rih"
    | "ris"
    | "rs"
    | "rth"
    | "rts"
    | "s_p"
    | "sas"
    | "sc"
    | "mostrecent";
  readonly modifiedSince?: string;
  readonly courtCode?: string;
  readonly courtType?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly isGLP?: boolean;
  readonly natureSuitCode?: string;
  readonly natureSuit?: string;
};
/**
 * Generated GetPackagesByDateIssuedQuery declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetPackagesByDateIssuedQuery)
 *
 * ```ts
 * import { GetPackagesByDateIssuedQuery } from "@beep/govinfo"
 *
 * console.log(GetPackagesByDateIssuedQuery)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetPackagesByDateIssuedQuery = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  collection: S.String,
  congress: S.optionalKey(S.String),
  docClass: S.optionalKey(S.String),
  billVersion: S.optionalKey(
    S.Literals([
      "as",
      "ash",
      "ath",
      "ats",
      "cdh",
      "cds",
      "cph",
      "cps",
      "eah",
      "eas",
      "eh",
      "enr",
      "eph",
      "es",
      "fah",
      "fph",
      "fps",
      "hdh",
      "hds",
      "ih",
      "iph",
      "ips",
      "is",
      "lth",
      "lts",
      "nat",
      "oph",
      "ops",
      "pap",
      "pav",
      "pch",
      "pcs",
      "pp",
      "pwah",
      "rah",
      "ras",
      "rch",
      "rcs",
      "rdh",
      "rds",
      "re",
      "reah",
      "renr",
      "res",
      "rfh",
      "rfs",
      "rft",
      "rh",
      "rhuc",
      "rih",
      "ris",
      "rs",
      "rth",
      "rts",
      "s_p",
      "sas",
      "sc",
      "mostrecent",
    ]),
  ),
  modifiedSince: S.optionalKey(S.String),
  courtCode: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "(?:AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY)[n|e|w|s]?[d|b|a]|(cofc|jpml)",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp (?:AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY)[n|e|w|s]?[d|b|a]|(cofc|jpml)",
      }),
    ),
  ),
  courtType: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp("District|Bankruptcy|Appellate|National"),
      ).annotate({
        expected:
          "a string matching the RegExp District|Bankruptcy|Appellate|National",
      }),
    ),
  ),
  state: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
      }),
    ),
  ),
  topic: S.optionalKey(S.String),
  isGLP: S.optionalKey(S.Boolean),
  natureSuitCode: S.optionalKey(S.String),
  natureSuit: S.optionalKey(S.String),
});
/**
 * Generated GetPackagesByDateIssued200 declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetPackagesByDateIssued200 = CollectionContainer;
/**
 * Generated GetPackagesByDateIssued200 declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetPackagesByDateIssued200)
 *
 * ```ts
 * import { GetPackagesByDateIssued200 } from "@beep/govinfo"
 *
 * console.log(GetPackagesByDateIssued200)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetPackagesByDateIssued200 = CollectionContainer;
/**
 * Generated GetPackagesByDateIssued1Params declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetPackagesByDateIssued1Params = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly collection: string;
  readonly congress?: string;
  readonly docClass?: string;
  readonly billVersion?:
    | "as"
    | "ash"
    | "ath"
    | "ats"
    | "cdh"
    | "cds"
    | "cph"
    | "cps"
    | "eah"
    | "eas"
    | "eh"
    | "enr"
    | "eph"
    | "es"
    | "fah"
    | "fph"
    | "fps"
    | "hdh"
    | "hds"
    | "ih"
    | "iph"
    | "ips"
    | "is"
    | "lth"
    | "lts"
    | "nat"
    | "oph"
    | "ops"
    | "pap"
    | "pav"
    | "pch"
    | "pcs"
    | "pp"
    | "pwah"
    | "rah"
    | "ras"
    | "rch"
    | "rcs"
    | "rdh"
    | "rds"
    | "re"
    | "reah"
    | "renr"
    | "res"
    | "rfh"
    | "rfs"
    | "rft"
    | "rh"
    | "rhuc"
    | "rih"
    | "ris"
    | "rs"
    | "rth"
    | "rts"
    | "s_p"
    | "sas"
    | "sc"
    | "mostrecent";
  readonly modifiedSince?: string;
  readonly courtCode?: string;
  readonly courtType?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly natureSuitCode?: string;
  readonly natureSuit?: string;
  readonly isGLP?: boolean;
};
/**
 * Generated GetPackagesByDateIssued1Params declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetPackagesByDateIssued1Params)
 *
 * ```ts
 * import { GetPackagesByDateIssued1Params } from "@beep/govinfo"
 *
 * console.log(GetPackagesByDateIssued1Params)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetPackagesByDateIssued1Params = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  collection: S.String,
  congress: S.optionalKey(S.String),
  docClass: S.optionalKey(S.String),
  billVersion: S.optionalKey(
    S.Literals([
      "as",
      "ash",
      "ath",
      "ats",
      "cdh",
      "cds",
      "cph",
      "cps",
      "eah",
      "eas",
      "eh",
      "enr",
      "eph",
      "es",
      "fah",
      "fph",
      "fps",
      "hdh",
      "hds",
      "ih",
      "iph",
      "ips",
      "is",
      "lth",
      "lts",
      "nat",
      "oph",
      "ops",
      "pap",
      "pav",
      "pch",
      "pcs",
      "pp",
      "pwah",
      "rah",
      "ras",
      "rch",
      "rcs",
      "rdh",
      "rds",
      "re",
      "reah",
      "renr",
      "res",
      "rfh",
      "rfs",
      "rft",
      "rh",
      "rhuc",
      "rih",
      "ris",
      "rs",
      "rth",
      "rts",
      "s_p",
      "sas",
      "sc",
      "mostrecent",
    ]),
  ),
  modifiedSince: S.optionalKey(S.String),
  courtCode: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "(?:AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY)[n|e|w|s]?[d|b|a]|(cofc|jpml)",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp (?:AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY)[n|e|w|s]?[d|b|a]|(cofc|jpml)",
      }),
    ),
  ),
  courtType: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp("District|Bankruptcy|Appellate|National"),
      ).annotate({
        expected:
          "a string matching the RegExp District|Bankruptcy|Appellate|National",
      }),
    ),
  ),
  state: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
      }),
    ),
  ),
  topic: S.optionalKey(S.String),
  natureSuitCode: S.optionalKey(S.String),
  natureSuit: S.optionalKey(S.String),
  isGLP: S.optionalKey(S.Boolean),
});
/**
 * Generated GetPackagesByDateIssued1PathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetPackagesByDateIssued1PathParams = {
  readonly dateIssuedStartDate: string;
  readonly dateIssuedEndDate: string;
};
/**
 * Generated GetPackagesByDateIssued1PathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetPackagesByDateIssued1PathParams)
 *
 * ```ts
 * import { GetPackagesByDateIssued1PathParams } from "@beep/govinfo"
 *
 * console.log(GetPackagesByDateIssued1PathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetPackagesByDateIssued1PathParams = S.Struct({
  dateIssuedStartDate: S.String.check(
    S.isPattern(new RegExp("\\d{4}-\\d{1,2}-\\d{1,2}")).annotate({
      expected: "a string matching the RegExp \\d{4}-\\d{1,2}-\\d{1,2}",
    }),
  ),
  dateIssuedEndDate: S.String.check(
    S.isPattern(new RegExp("\\d{4}-\\d{1,2}-\\d{1,2}")).annotate({
      expected: "a string matching the RegExp \\d{4}-\\d{1,2}-\\d{1,2}",
    }),
  ),
});
/**
 * Generated GetPackagesByDateIssued1Query declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetPackagesByDateIssued1Query = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly collection: string;
  readonly congress?: string;
  readonly docClass?: string;
  readonly billVersion?:
    | "as"
    | "ash"
    | "ath"
    | "ats"
    | "cdh"
    | "cds"
    | "cph"
    | "cps"
    | "eah"
    | "eas"
    | "eh"
    | "enr"
    | "eph"
    | "es"
    | "fah"
    | "fph"
    | "fps"
    | "hdh"
    | "hds"
    | "ih"
    | "iph"
    | "ips"
    | "is"
    | "lth"
    | "lts"
    | "nat"
    | "oph"
    | "ops"
    | "pap"
    | "pav"
    | "pch"
    | "pcs"
    | "pp"
    | "pwah"
    | "rah"
    | "ras"
    | "rch"
    | "rcs"
    | "rdh"
    | "rds"
    | "re"
    | "reah"
    | "renr"
    | "res"
    | "rfh"
    | "rfs"
    | "rft"
    | "rh"
    | "rhuc"
    | "rih"
    | "ris"
    | "rs"
    | "rth"
    | "rts"
    | "s_p"
    | "sas"
    | "sc"
    | "mostrecent";
  readonly modifiedSince?: string;
  readonly courtCode?: string;
  readonly courtType?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly natureSuitCode?: string;
  readonly natureSuit?: string;
  readonly isGLP?: boolean;
};
/**
 * Generated GetPackagesByDateIssued1Query declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetPackagesByDateIssued1Query)
 *
 * ```ts
 * import { GetPackagesByDateIssued1Query } from "@beep/govinfo"
 *
 * console.log(GetPackagesByDateIssued1Query)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetPackagesByDateIssued1Query = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  collection: S.String,
  congress: S.optionalKey(S.String),
  docClass: S.optionalKey(S.String),
  billVersion: S.optionalKey(
    S.Literals([
      "as",
      "ash",
      "ath",
      "ats",
      "cdh",
      "cds",
      "cph",
      "cps",
      "eah",
      "eas",
      "eh",
      "enr",
      "eph",
      "es",
      "fah",
      "fph",
      "fps",
      "hdh",
      "hds",
      "ih",
      "iph",
      "ips",
      "is",
      "lth",
      "lts",
      "nat",
      "oph",
      "ops",
      "pap",
      "pav",
      "pch",
      "pcs",
      "pp",
      "pwah",
      "rah",
      "ras",
      "rch",
      "rcs",
      "rdh",
      "rds",
      "re",
      "reah",
      "renr",
      "res",
      "rfh",
      "rfs",
      "rft",
      "rh",
      "rhuc",
      "rih",
      "ris",
      "rs",
      "rth",
      "rts",
      "s_p",
      "sas",
      "sc",
      "mostrecent",
    ]),
  ),
  modifiedSince: S.optionalKey(S.String),
  courtCode: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "(?:AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY)[n|e|w|s]?[d|b|a]|(cofc|jpml)",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp (?:AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY)[n|e|w|s]?[d|b|a]|(cofc|jpml)",
      }),
    ),
  ),
  courtType: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp("District|Bankruptcy|Appellate|National"),
      ).annotate({
        expected:
          "a string matching the RegExp District|Bankruptcy|Appellate|National",
      }),
    ),
  ),
  state: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
      }),
    ),
  ),
  topic: S.optionalKey(S.String),
  natureSuitCode: S.optionalKey(S.String),
  natureSuit: S.optionalKey(S.String),
  isGLP: S.optionalKey(S.Boolean),
});
/**
 * Generated GetPackagesByDateIssued1200 declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetPackagesByDateIssued1200 = CollectionContainer;
/**
 * Generated GetPackagesByDateIssued1200 declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetPackagesByDateIssued1200)
 *
 * ```ts
 * import { GetPackagesByDateIssued1200 } from "@beep/govinfo"
 *
 * console.log(GetPackagesByDateIssued1200)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetPackagesByDateIssued1200 = CollectionContainer;
/**
 * Generated PackageDetailsPathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type PackageDetailsPathParams = { readonly packageId: string };
/**
 * Generated PackageDetailsPathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect PackageDetailsPathParams)
 *
 * ```ts
 * import { PackageDetailsPathParams } from "@beep/govinfo"
 *
 * console.log(PackageDetailsPathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const PackageDetailsPathParams = S.Struct({ packageId: S.String });
/**
 * Generated GetGranulesForPackageParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetGranulesForPackageParams = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly md5?: string;
  readonly granuleClass?: string;
};
/**
 * Generated GetGranulesForPackageParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetGranulesForPackageParams)
 *
 * ```ts
 * import { GetGranulesForPackageParams } from "@beep/govinfo"
 *
 * console.log(GetGranulesForPackageParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetGranulesForPackageParams = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  md5: S.optionalKey(S.String),
  granuleClass: S.optionalKey(S.String),
});
/**
 * Generated GetGranulesForPackagePathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetGranulesForPackagePathParams = { readonly packageId: string };
/**
 * Generated GetGranulesForPackagePathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetGranulesForPackagePathParams)
 *
 * ```ts
 * import { GetGranulesForPackagePathParams } from "@beep/govinfo"
 *
 * console.log(GetGranulesForPackagePathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetGranulesForPackagePathParams = S.Struct({
  packageId: S.String,
});
/**
 * Generated GetGranulesForPackageQuery declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetGranulesForPackageQuery = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly md5?: string;
  readonly granuleClass?: string;
};
/**
 * Generated GetGranulesForPackageQuery declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetGranulesForPackageQuery)
 *
 * ```ts
 * import { GetGranulesForPackageQuery } from "@beep/govinfo"
 *
 * console.log(GetGranulesForPackageQuery)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetGranulesForPackageQuery = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  md5: S.optionalKey(S.String),
  granuleClass: S.optionalKey(S.String),
});
/**
 * Generated GetGranulesForPackage200 declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetGranulesForPackage200 = GranuleContainer;
/**
 * Generated GetGranulesForPackage200 declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetGranulesForPackage200)
 *
 * ```ts
 * import { GetGranulesForPackage200 } from "@beep/govinfo"
 *
 * console.log(GetGranulesForPackage200)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetGranulesForPackage200 = GranuleContainer;
/**
 * Generated GetGranuleContentDetailPathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetGranuleContentDetailPathParams = {
  readonly packageId: string;
  readonly granuleId: string;
};
/**
 * Generated GetGranuleContentDetailPathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetGranuleContentDetailPathParams)
 *
 * ```ts
 * import { GetGranuleContentDetailPathParams } from "@beep/govinfo"
 *
 * console.log(GetGranuleContentDetailPathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetGranuleContentDetailPathParams = S.Struct({
  packageId: S.String,
  granuleId: S.String,
});
/**
 * Generated GetGranuleContentDetail200 declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetGranuleContentDetail200 = string;
/**
 * Generated GetGranuleContentDetail200 declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetGranuleContentDetail200)
 *
 * ```ts
 * import { GetGranuleContentDetail200 } from "@beep/govinfo"
 *
 * console.log(GetGranuleContentDetail200)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetGranuleContentDetail200 = S.String;
/**
 * Generated GetCollectionSummary200 declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetCollectionSummary200 = CollectionSummary;
/**
 * Generated GetCollectionSummary200 declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetCollectionSummary200)
 *
 * ```ts
 * import { GetCollectionSummary200 } from "@beep/govinfo"
 *
 * console.log(GetCollectionSummary200)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetCollectionSummary200 = CollectionSummary;
/**
 * Generated GetModifiedCollectionsParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetModifiedCollectionsParams = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly congress?: number;
  readonly docClass?: string;
  readonly billVersion?:
    | "as"
    | "ash"
    | "ath"
    | "ats"
    | "cdh"
    | "cds"
    | "cph"
    | "cps"
    | "eah"
    | "eas"
    | "eh"
    | "enr"
    | "eph"
    | "es"
    | "fah"
    | "fph"
    | "fps"
    | "hdh"
    | "hds"
    | "ih"
    | "iph"
    | "ips"
    | "is"
    | "lth"
    | "lts"
    | "nat"
    | "oph"
    | "ops"
    | "pap"
    | "pav"
    | "pch"
    | "pcs"
    | "pp"
    | "pwah"
    | "rah"
    | "ras"
    | "rch"
    | "rcs"
    | "rdh"
    | "rds"
    | "re"
    | "reah"
    | "renr"
    | "res"
    | "rfh"
    | "rfs"
    | "rft"
    | "rh"
    | "rhuc"
    | "rih"
    | "ris"
    | "rs"
    | "rth"
    | "rts"
    | "s_p"
    | "sas"
    | "sc"
    | "mostrecent";
  readonly courtCode?: string;
  readonly courtType?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly isGLP?: boolean;
  readonly natureSuitCode?: string;
  readonly natureSuit?: string;
};
/**
 * Generated GetModifiedCollectionsParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetModifiedCollectionsParams)
 *
 * ```ts
 * import { GetModifiedCollectionsParams } from "@beep/govinfo"
 *
 * console.log(GetModifiedCollectionsParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetModifiedCollectionsParams = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  congress: S.optionalKey(S.Int),
  docClass: S.optionalKey(S.String),
  billVersion: S.optionalKey(
    S.Literals([
      "as",
      "ash",
      "ath",
      "ats",
      "cdh",
      "cds",
      "cph",
      "cps",
      "eah",
      "eas",
      "eh",
      "enr",
      "eph",
      "es",
      "fah",
      "fph",
      "fps",
      "hdh",
      "hds",
      "ih",
      "iph",
      "ips",
      "is",
      "lth",
      "lts",
      "nat",
      "oph",
      "ops",
      "pap",
      "pav",
      "pch",
      "pcs",
      "pp",
      "pwah",
      "rah",
      "ras",
      "rch",
      "rcs",
      "rdh",
      "rds",
      "re",
      "reah",
      "renr",
      "res",
      "rfh",
      "rfs",
      "rft",
      "rh",
      "rhuc",
      "rih",
      "ris",
      "rs",
      "rth",
      "rts",
      "s_p",
      "sas",
      "sc",
      "mostrecent",
    ]),
  ),
  courtCode: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "(?:(?:al|ak|as|az|ar|ca|co|ct|de|dc|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vt|va|vi|wa|wv|wi|wy)[n|e|w|s]?[d|b|a])|(cit|ca\\d{1,2})|(cofc|jpml)",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp (?:(?:al|ak|as|az|ar|ca|co|ct|de|dc|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vt|va|vi|wa|wv|wi|wy)[n|e|w|s]?[d|b|a])|(cit|ca\\d{1,2})|(cofc|jpml)",
      }),
    ),
  ),
  courtType: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp("District|Bankruptcy|Appellate|National"),
      ).annotate({
        expected:
          "a string matching the RegExp District|Bankruptcy|Appellate|National",
      }),
    ),
  ),
  state: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
      }),
    ),
  ),
  topic: S.optionalKey(S.String),
  isGLP: S.optionalKey(S.Boolean),
  natureSuitCode: S.optionalKey(S.String),
  natureSuit: S.optionalKey(S.String),
});
/**
 * Generated GetModifiedCollectionsPathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetModifiedCollectionsPathParams = {
  readonly collection:
    | "BILLS"
    | "BILLSTATUS"
    | "BUDGET"
    | "CCAL"
    | "CDIR"
    | "CDOC"
    | "CFR"
    | "CHRG"
    | "CMR"
    | "COMPS"
    | "CPD"
    | "CPRT"
    | "CREC"
    | "CRECB"
    | "CRI"
    | "CRPT"
    | "CZIC"
    | "ECFR"
    | "ECONI"
    | "ERIC"
    | "ERP"
    | "FR"
    | "GAOREPORTS"
    | "GOVMAN"
    | "GOVPUB"
    | "GPO"
    | "HJOURNAL"
    | "HMAN"
    | "HOB"
    | "LSA"
    | "PAI"
    | "PLAW"
    | "PPP"
    | "SERIALSET"
    | "SJOURNAL"
    | "SMAN"
    | "STATUTE"
    | "USCODE"
    | "USCOURTS"
    | "USREPORTS";
  readonly lastModifiedStartDate: string;
};
/**
 * Generated GetModifiedCollectionsPathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetModifiedCollectionsPathParams)
 *
 * ```ts
 * import { GetModifiedCollectionsPathParams } from "@beep/govinfo"
 *
 * console.log(GetModifiedCollectionsPathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetModifiedCollectionsPathParams = S.Struct({
  collection: S.Literals([
    "BILLS",
    "BILLSTATUS",
    "BUDGET",
    "CCAL",
    "CDIR",
    "CDOC",
    "CFR",
    "CHRG",
    "CMR",
    "COMPS",
    "CPD",
    "CPRT",
    "CREC",
    "CRECB",
    "CRI",
    "CRPT",
    "CZIC",
    "ECFR",
    "ECONI",
    "ERIC",
    "ERP",
    "FR",
    "GAOREPORTS",
    "GOVMAN",
    "GOVPUB",
    "GPO",
    "HJOURNAL",
    "HMAN",
    "HOB",
    "LSA",
    "PAI",
    "PLAW",
    "PPP",
    "SERIALSET",
    "SJOURNAL",
    "SMAN",
    "STATUTE",
    "USCODE",
    "USCOURTS",
    "USREPORTS",
  ]),
  lastModifiedStartDate: S.String.check(
    S.isPattern(
      new RegExp("\\d{4}-\\d{1,2}-\\d{1,2}T\\d{1,2}:\\d{1,2}:\\d{1,2}Z"),
    ).annotate({
      expected:
        "a string matching the RegExp \\d{4}-\\d{1,2}-\\d{1,2}T\\d{1,2}:\\d{1,2}:\\d{1,2}Z",
    }),
  ),
});
/**
 * Generated GetModifiedCollectionsQuery declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetModifiedCollectionsQuery = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly congress?: number;
  readonly docClass?: string;
  readonly billVersion?:
    | "as"
    | "ash"
    | "ath"
    | "ats"
    | "cdh"
    | "cds"
    | "cph"
    | "cps"
    | "eah"
    | "eas"
    | "eh"
    | "enr"
    | "eph"
    | "es"
    | "fah"
    | "fph"
    | "fps"
    | "hdh"
    | "hds"
    | "ih"
    | "iph"
    | "ips"
    | "is"
    | "lth"
    | "lts"
    | "nat"
    | "oph"
    | "ops"
    | "pap"
    | "pav"
    | "pch"
    | "pcs"
    | "pp"
    | "pwah"
    | "rah"
    | "ras"
    | "rch"
    | "rcs"
    | "rdh"
    | "rds"
    | "re"
    | "reah"
    | "renr"
    | "res"
    | "rfh"
    | "rfs"
    | "rft"
    | "rh"
    | "rhuc"
    | "rih"
    | "ris"
    | "rs"
    | "rth"
    | "rts"
    | "s_p"
    | "sas"
    | "sc"
    | "mostrecent";
  readonly courtCode?: string;
  readonly courtType?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly isGLP?: boolean;
  readonly natureSuitCode?: string;
  readonly natureSuit?: string;
};
/**
 * Generated GetModifiedCollectionsQuery declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetModifiedCollectionsQuery)
 *
 * ```ts
 * import { GetModifiedCollectionsQuery } from "@beep/govinfo"
 *
 * console.log(GetModifiedCollectionsQuery)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetModifiedCollectionsQuery = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  congress: S.optionalKey(S.Int),
  docClass: S.optionalKey(S.String),
  billVersion: S.optionalKey(
    S.Literals([
      "as",
      "ash",
      "ath",
      "ats",
      "cdh",
      "cds",
      "cph",
      "cps",
      "eah",
      "eas",
      "eh",
      "enr",
      "eph",
      "es",
      "fah",
      "fph",
      "fps",
      "hdh",
      "hds",
      "ih",
      "iph",
      "ips",
      "is",
      "lth",
      "lts",
      "nat",
      "oph",
      "ops",
      "pap",
      "pav",
      "pch",
      "pcs",
      "pp",
      "pwah",
      "rah",
      "ras",
      "rch",
      "rcs",
      "rdh",
      "rds",
      "re",
      "reah",
      "renr",
      "res",
      "rfh",
      "rfs",
      "rft",
      "rh",
      "rhuc",
      "rih",
      "ris",
      "rs",
      "rth",
      "rts",
      "s_p",
      "sas",
      "sc",
      "mostrecent",
    ]),
  ),
  courtCode: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "(?:(?:al|ak|as|az|ar|ca|co|ct|de|dc|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vt|va|vi|wa|wv|wi|wy)[n|e|w|s]?[d|b|a])|(cit|ca\\d{1,2})|(cofc|jpml)",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp (?:(?:al|ak|as|az|ar|ca|co|ct|de|dc|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vt|va|vi|wa|wv|wi|wy)[n|e|w|s]?[d|b|a])|(cit|ca\\d{1,2})|(cofc|jpml)",
      }),
    ),
  ),
  courtType: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp("District|Bankruptcy|Appellate|National"),
      ).annotate({
        expected:
          "a string matching the RegExp District|Bankruptcy|Appellate|National",
      }),
    ),
  ),
  state: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
      }),
    ),
  ),
  topic: S.optionalKey(S.String),
  isGLP: S.optionalKey(S.Boolean),
  natureSuitCode: S.optionalKey(S.String),
  natureSuit: S.optionalKey(S.String),
});
/**
 * Generated GetModifiedCollections200 declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetModifiedCollections200 = CollectionContainer;
/**
 * Generated GetModifiedCollections200 declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetModifiedCollections200)
 *
 * ```ts
 * import { GetModifiedCollections200 } from "@beep/govinfo"
 *
 * console.log(GetModifiedCollections200)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetModifiedCollections200 = CollectionContainer;
/**
 * Generated GetModifiedCollections1Params declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetModifiedCollections1Params = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly docClass?: string;
  readonly congress?: number;
  readonly billVersion?:
    | "as"
    | "ash"
    | "ath"
    | "ats"
    | "cdh"
    | "cds"
    | "cph"
    | "cps"
    | "eah"
    | "eas"
    | "eh"
    | "enr"
    | "eph"
    | "es"
    | "fah"
    | "fph"
    | "fps"
    | "hdh"
    | "hds"
    | "ih"
    | "iph"
    | "ips"
    | "is"
    | "lth"
    | "lts"
    | "nat"
    | "oph"
    | "ops"
    | "pap"
    | "pav"
    | "pch"
    | "pcs"
    | "pp"
    | "pwah"
    | "rah"
    | "ras"
    | "rch"
    | "rcs"
    | "rdh"
    | "rds"
    | "re"
    | "reah"
    | "renr"
    | "res"
    | "rfh"
    | "rfs"
    | "rft"
    | "rh"
    | "rhuc"
    | "rih"
    | "ris"
    | "rs"
    | "rth"
    | "rts"
    | "s_p"
    | "sas"
    | "sc"
    | "mostrecent";
  readonly courtCode?: string;
  readonly courtType?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly isGLP?: boolean;
  readonly natureSuitCode?: string;
  readonly natureSuit?: string;
};
/**
 * Generated GetModifiedCollections1Params declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetModifiedCollections1Params)
 *
 * ```ts
 * import { GetModifiedCollections1Params } from "@beep/govinfo"
 *
 * console.log(GetModifiedCollections1Params)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetModifiedCollections1Params = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  docClass: S.optionalKey(S.String),
  congress: S.optionalKey(S.Int),
  billVersion: S.optionalKey(
    S.Literals([
      "as",
      "ash",
      "ath",
      "ats",
      "cdh",
      "cds",
      "cph",
      "cps",
      "eah",
      "eas",
      "eh",
      "enr",
      "eph",
      "es",
      "fah",
      "fph",
      "fps",
      "hdh",
      "hds",
      "ih",
      "iph",
      "ips",
      "is",
      "lth",
      "lts",
      "nat",
      "oph",
      "ops",
      "pap",
      "pav",
      "pch",
      "pcs",
      "pp",
      "pwah",
      "rah",
      "ras",
      "rch",
      "rcs",
      "rdh",
      "rds",
      "re",
      "reah",
      "renr",
      "res",
      "rfh",
      "rfs",
      "rft",
      "rh",
      "rhuc",
      "rih",
      "ris",
      "rs",
      "rth",
      "rts",
      "s_p",
      "sas",
      "sc",
      "mostrecent",
    ]),
  ),
  courtCode: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "(?:(?:al|ak|as|az|ar|ca|co|ct|de|dc|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vt|va|vi|wa|wv|wi|wy)[n|e|w|s]?[d|b|a])|(cit|ca\\d{1,2})|(cofc|jpml)",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp (?:(?:al|ak|as|az|ar|ca|co|ct|de|dc|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vt|va|vi|wa|wv|wi|wy)[n|e|w|s]?[d|b|a])|(cit|ca\\d{1,2})|(cofc|jpml)",
      }),
    ),
  ),
  courtType: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp("District|Bankruptcy|Appellate|National"),
      ).annotate({
        expected:
          "a string matching the RegExp District|Bankruptcy|Appellate|National",
      }),
    ),
  ),
  state: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
      }),
    ),
  ),
  topic: S.optionalKey(S.String),
  isGLP: S.optionalKey(S.Boolean),
  natureSuitCode: S.optionalKey(S.String),
  natureSuit: S.optionalKey(S.String),
});
/**
 * Generated GetModifiedCollections1PathParams declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetModifiedCollections1PathParams = {
  readonly collection:
    | "BILLS"
    | "BILLSTATUS"
    | "BUDGET"
    | "CCAL"
    | "CDIR"
    | "CDOC"
    | "CFR"
    | "CHRG"
    | "CMR"
    | "COMPS"
    | "CPD"
    | "CPRT"
    | "CREC"
    | "CRECB"
    | "CRI"
    | "CRPT"
    | "CZIC"
    | "ECFR"
    | "ECONI"
    | "ERIC"
    | "ERP"
    | "FR"
    | "GAOREPORTS"
    | "GOVMAN"
    | "GOVPUB"
    | "GPO"
    | "HJOURNAL"
    | "HMAN"
    | "HOB"
    | "LSA"
    | "PAI"
    | "PLAW"
    | "PPP"
    | "SERIALSET"
    | "SJOURNAL"
    | "SMAN"
    | "STATUTE"
    | "USCODE"
    | "USCOURTS"
    | "USREPORTS";
  readonly lastModifiedStartDate: string;
  readonly lastModifiedEndDate: string;
};
/**
 * Generated GetModifiedCollections1PathParams declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetModifiedCollections1PathParams)
 *
 * ```ts
 * import { GetModifiedCollections1PathParams } from "@beep/govinfo"
 *
 * console.log(GetModifiedCollections1PathParams)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetModifiedCollections1PathParams = S.Struct({
  collection: S.Literals([
    "BILLS",
    "BILLSTATUS",
    "BUDGET",
    "CCAL",
    "CDIR",
    "CDOC",
    "CFR",
    "CHRG",
    "CMR",
    "COMPS",
    "CPD",
    "CPRT",
    "CREC",
    "CRECB",
    "CRI",
    "CRPT",
    "CZIC",
    "ECFR",
    "ECONI",
    "ERIC",
    "ERP",
    "FR",
    "GAOREPORTS",
    "GOVMAN",
    "GOVPUB",
    "GPO",
    "HJOURNAL",
    "HMAN",
    "HOB",
    "LSA",
    "PAI",
    "PLAW",
    "PPP",
    "SERIALSET",
    "SJOURNAL",
    "SMAN",
    "STATUTE",
    "USCODE",
    "USCOURTS",
    "USREPORTS",
  ]),
  lastModifiedStartDate: S.String.check(
    S.isPattern(
      new RegExp("\\d{4}-\\d{1,2}-\\d{1,2}T\\d{1,2}:\\d{1,2}:\\d{1,2}Z"),
    ).annotate({
      expected:
        "a string matching the RegExp \\d{4}-\\d{1,2}-\\d{1,2}T\\d{1,2}:\\d{1,2}:\\d{1,2}Z",
    }),
  ),
  lastModifiedEndDate: S.String.check(
    S.isPattern(
      new RegExp("\\d{4}-\\d{1,2}-\\d{1,2}T\\d{1,2}:\\d{1,2}:\\d{1,2}Z"),
    ).annotate({
      expected:
        "a string matching the RegExp \\d{4}-\\d{1,2}-\\d{1,2}T\\d{1,2}:\\d{1,2}:\\d{1,2}Z",
    }),
  ),
});
/**
 * Generated GetModifiedCollections1Query declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetModifiedCollections1Query = {
  readonly offsetMark?: string;
  readonly offset?: number;
  readonly pageSize: number;
  readonly docClass?: string;
  readonly congress?: number;
  readonly billVersion?:
    | "as"
    | "ash"
    | "ath"
    | "ats"
    | "cdh"
    | "cds"
    | "cph"
    | "cps"
    | "eah"
    | "eas"
    | "eh"
    | "enr"
    | "eph"
    | "es"
    | "fah"
    | "fph"
    | "fps"
    | "hdh"
    | "hds"
    | "ih"
    | "iph"
    | "ips"
    | "is"
    | "lth"
    | "lts"
    | "nat"
    | "oph"
    | "ops"
    | "pap"
    | "pav"
    | "pch"
    | "pcs"
    | "pp"
    | "pwah"
    | "rah"
    | "ras"
    | "rch"
    | "rcs"
    | "rdh"
    | "rds"
    | "re"
    | "reah"
    | "renr"
    | "res"
    | "rfh"
    | "rfs"
    | "rft"
    | "rh"
    | "rhuc"
    | "rih"
    | "ris"
    | "rs"
    | "rth"
    | "rts"
    | "s_p"
    | "sas"
    | "sc"
    | "mostrecent";
  readonly courtCode?: string;
  readonly courtType?: string;
  readonly state?: string;
  readonly topic?: string;
  readonly isGLP?: boolean;
  readonly natureSuitCode?: string;
  readonly natureSuit?: string;
};
/**
 * Generated GetModifiedCollections1Query declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetModifiedCollections1Query)
 *
 * ```ts
 * import { GetModifiedCollections1Query } from "@beep/govinfo"
 *
 * console.log(GetModifiedCollections1Query)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetModifiedCollections1Query = S.Struct({
  offsetMark: S.optionalKey(S.String),
  offset: S.optionalKey(S.Int),
  pageSize: S.Int.check(
    S.isLessThanOrEqualTo(1000).annotate({
      expected: "a value less than or equal to 1000",
    }),
  ),
  docClass: S.optionalKey(S.String),
  congress: S.optionalKey(S.Int),
  billVersion: S.optionalKey(
    S.Literals([
      "as",
      "ash",
      "ath",
      "ats",
      "cdh",
      "cds",
      "cph",
      "cps",
      "eah",
      "eas",
      "eh",
      "enr",
      "eph",
      "es",
      "fah",
      "fph",
      "fps",
      "hdh",
      "hds",
      "ih",
      "iph",
      "ips",
      "is",
      "lth",
      "lts",
      "nat",
      "oph",
      "ops",
      "pap",
      "pav",
      "pch",
      "pcs",
      "pp",
      "pwah",
      "rah",
      "ras",
      "rch",
      "rcs",
      "rdh",
      "rds",
      "re",
      "reah",
      "renr",
      "res",
      "rfh",
      "rfs",
      "rft",
      "rh",
      "rhuc",
      "rih",
      "ris",
      "rs",
      "rth",
      "rts",
      "s_p",
      "sas",
      "sc",
      "mostrecent",
    ]),
  ),
  courtCode: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "(?:(?:al|ak|as|az|ar|ca|co|ct|de|dc|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vt|va|vi|wa|wv|wi|wy)[n|e|w|s]?[d|b|a])|(cit|ca\\d{1,2})|(cofc|jpml)",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp (?:(?:al|ak|as|az|ar|ca|co|ct|de|dc|fl|ga|gu|hi|id|il|in|ia|ks|ky|la|me|md|ma|mi|mn|ms|mo|mt|ne|nv|nh|nj|nm|ny|nc|nd|mp|oh|ok|or|pa|pr|ri|sc|sd|tn|tx|ut|vt|va|vi|wa|wv|wi|wy)[n|e|w|s]?[d|b|a])|(cit|ca\\d{1,2})|(cofc|jpml)",
      }),
    ),
  ),
  courtType: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp("District|Bankruptcy|Appellate|National"),
      ).annotate({
        expected:
          "a string matching the RegExp District|Bankruptcy|Appellate|National",
      }),
    ),
  ),
  state: S.optionalKey(
    S.String.check(
      S.isPattern(
        new RegExp(
          "AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
        ),
      ).annotate({
        expected:
          "a string matching the RegExp AL|AK|AS|AZ|AR|CA|CO|CT|DE|DC|FL|GA|GU|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|MP|OH|OK|OR|PA|PR|RI|SC|SD|TN|TX|UT|VT|VA|VI|WA|WV|WI|WY",
      }),
    ),
  ),
  topic: S.optionalKey(S.String),
  isGLP: S.optionalKey(S.Boolean),
  natureSuitCode: S.optionalKey(S.String),
  natureSuit: S.optionalKey(S.String),
});
/**
 * Generated GetModifiedCollections1200 declaration for @beep/govinfo.
 *
 * @category models
 * @since 0.0.0
 */
export type GetModifiedCollections1200 = CollectionContainer;
/**
 * Generated GetModifiedCollections1200 declaration for @beep/govinfo.
 *
 * **Example** (Inspect GetModifiedCollections1200)
 *
 * ```ts
 * import { GetModifiedCollections1200 } from "@beep/govinfo"
 *
 * console.log(GetModifiedCollections1200)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const GetModifiedCollections1200 = CollectionContainer;

/**
 * Generated ApiKeySchemeSecurity declaration for @beep/govinfo.
 *
 * **Example** (Inspect ApiKeySchemeSecurity)
 *
 * ```ts
 * import { ApiKeySchemeSecurity } from "@beep/govinfo"
 *
 * console.log(ApiKeySchemeSecurity)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export const ApiKeySchemeSecurity = HttpApiSecurity.apiKey({
  key: "api_key",
  in: "query",
});

/**
 * Generated ApiKeySchemeSecurityMiddleware declaration for @beep/govinfo.
 *
 * **Example** (Inspect ApiKeySchemeSecurityMiddleware)
 *
 * ```ts
 * import { ApiKeySchemeSecurityMiddleware } from "@beep/govinfo"
 *
 * console.log(ApiKeySchemeSecurityMiddleware)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export class ApiKeySchemeSecurityMiddleware extends HttpApiMiddleware.Service<ApiKeySchemeSecurityMiddleware>()(
  "apiKeyScheme security",
  { security: { apiKeyScheme: ApiKeySchemeSecurity } },
) {}

class SearchGroup extends HttpApiGroup.make("Search")
  .add(
    HttpApiEndpoint.post("search", "/search", {
      payload: SearchRequestJson,
      success: Search200,
      error: [
        HttpApiSchema.Empty(400),
        HttpApiSchema.Empty(404),
        HttpApiSchema.Empty(500),
      ],
    })
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "search")
      .annotate(
        OpenApi.Description,
        "This service can be used to query the GovInfo search engine and return results that are the equivalent to what is returned by the main user interface. You can use field operators, such as congress, publishdate, branch, and others to construct complex queries that will return only matching documents. For additional information, please see our <a href='https://www.govinfo.gov/features/search-service-overview' target='blank' style='text-decoration:underline'>search service overview</a>.",
      ),
  )
  .annotate(
    OpenApi.Description,
    "Discover documents on GovInfo using search queries and field operators available in the GovInfo UI",
  ) {}

class RelatedGroup extends HttpApiGroup.make("Related")
  .add(
    HttpApiEndpoint.get("relatedPackageDetails", "/related/:accessId", {
      params: RelatedPackageDetailsPathParams,
    })
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "relatedPackageDetails")
      .annotate(
        OpenApi.Summary,
        "Get a list of relationships for a given accessId",
      ),
    HttpApiEndpoint.get(
      "relatedVersionsDetails",
      "/related/:accessId/:collection",
      {
        params: RelatedVersionsDetailsPathParams,
        query: RelatedVersionsDetailsQuery,
      },
    )
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "relatedVersionsDetails")
      .annotate(
        OpenApi.Summary,
        "Get a list of relationships for a given accessId",
      ),
  )
  .annotate(
    OpenApi.Description,
    "Discover relationships between documents available on GovInfo",
  ) {}

class PublishedGroup extends HttpApiGroup.make("Published")
  .add(
    HttpApiEndpoint.get(
      "getPackagesByDateIssued",
      "/published/:dateIssuedStartDate",
      {
        params: GetPackagesByDateIssuedPathParams,
        query: GetPackagesByDateIssuedQuery,
        success: GetPackagesByDateIssued200,
      },
    )
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "getPackagesByDateIssued")
      .annotate(
        OpenApi.Summary,
        "Retrieve list of packages based on dateIssued value",
      ),
    HttpApiEndpoint.get(
      "getPackagesByDateIssued1",
      "/published/:dateIssuedStartDate/:dateIssuedEndDate",
      {
        params: GetPackagesByDateIssued1PathParams,
        query: GetPackagesByDateIssued1Query,
        success: GetPackagesByDateIssued1200,
      },
    )
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "getPackagesByDateIssued_1")
      .annotate(
        OpenApi.Summary,
        "Retrieve list of packages based on dateIssued value range",
      ),
  )
  .annotate(
    OpenApi.Description,
    "Discover documents on GovInfo based on official publication date",
  ) {}

class PackagesGroup extends HttpApiGroup.make("Packages")
  .add(
    HttpApiEndpoint.get("packageDetails", "/packages/:packageId/summary", {
      params: PackageDetailsPathParams,
    })
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "packageDetails")
      .annotate(OpenApi.Summary, "Return json summary for specified package"),
    HttpApiEndpoint.get(
      "getGranulesForPackage",
      "/packages/:packageId/granules",
      {
        params: GetGranulesForPackagePathParams,
        query: GetGranulesForPackageQuery,
        success: GetGranulesForPackage200,
      },
    )
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "getGranulesForPackage")
      .annotate(
        OpenApi.Summary,
        "Get a list of granules associated with a package",
      ),
    HttpApiEndpoint.get(
      "getGranuleContentDetail",
      "/packages/:packageId/granules/:granuleId/summary",
      {
        params: GetGranuleContentDetailPathParams,
        success: GetGranuleContentDetail200,
      },
    )
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "getGranuleContentDetail")
      .annotate(OpenApi.Summary, "Return json summary for specified granule"),
  )
  .annotate(
    OpenApi.Description,
    "Return content and metadata for individual packages",
  ) {}

class CollectionsGroup extends HttpApiGroup.make("Collections")
  .add(
    HttpApiEndpoint.get("getCollectionSummary", "/collections", {
      success: GetCollectionSummary200,
    })
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "getCollectionSummary")
      .annotate(
        OpenApi.Summary,
        "Request list of collections. Response includes collectionCode,collectionName, package and granule counts",
      ),
    HttpApiEndpoint.get(
      "getModifiedCollections",
      "/collections/:collection/:lastModifiedStartDate",
      {
        params: GetModifiedCollectionsPathParams,
        query: GetModifiedCollectionsQuery,
        success: GetModifiedCollections200,
      },
    )
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "getModifiedCollections")
      .annotate(
        OpenApi.Summary,
        "Retrieve new or updated packages for a collection given a start date and time",
      ),
    HttpApiEndpoint.get(
      "getModifiedCollections1",
      "/collections/:collection/:lastModifiedStartDate/:lastModifiedEndDate",
      {
        params: GetModifiedCollections1PathParams,
        query: GetModifiedCollections1Query,
        success: GetModifiedCollections1200,
      },
    )
      .middleware(ApiKeySchemeSecurityMiddleware)
      .annotate(OpenApi.Identifier, "getModifiedCollections_1")
      .annotate(
        OpenApi.Summary,
        "Retrieve new or updated packages for a collection within a date range",
      ),
  )
  .annotate(
    OpenApi.Description,
    "Discover new and updated documents based on GovInfo lastModified date/time",
  ) {}

/**
 * Generated GovinfoApi declaration for @beep/govinfo.
 *
 * **Example** (Inspect GovinfoApi)
 *
 * ```ts
 * import { GovinfoApi } from "@beep/govinfo"
 *
 * console.log(GovinfoApi)
 * ```
 *
 * @category tools
 * @since 0.0.0
 */
export class GovinfoApi extends HttpApi.make("GovinfoApi")
  .annotate(OpenApi.Title, "GovInfo API")
  .annotate(OpenApi.Version, "2.0")
  .annotate(
    OpenApi.Description,
    '<p>The GovInfo API provides services for developers and webmasters to access GovInfo content and metadata. For more information on other developer resources, see our <a href="https://www.govinfo.gov/developers" target="blank"> developer hub</a>. If you have feedback or would like to learn more about plans for the API, please see our <a href="https://www.github.com/usgpo/api" target="blank">GitHub repository<i class="bi bi-github"></i></a>.</p><p>This API requires the use of an <a href="https://api.data.gov" target="blank">API.data.gov</a> key - <a href="https://www.govinfo.gov/api-signup" target="blank">signup here</a>. If you already have one, click on Authorize and enter your key. Then you can make all the requests via this page. For information about copyright, please see our <a href="https://www.govinfo.gov/about/policies#copyright" target="blank">Public Domain & Copyright Notice</a>.',
  )
  .annotate(OpenApi.License, {
    name: "License",
    url: "https://github.com/usgpo/api/blob/master/LICENSE.md",
  })
  .annotate(OpenApi.Servers, [{ url: "" }])
  .add(
    SearchGroup,
    RelatedGroup,
    PublishedGroup,
    PackagesGroup,
    CollectionsGroup,
  ) {}
