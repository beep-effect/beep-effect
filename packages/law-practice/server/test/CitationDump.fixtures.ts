/** Portable native dump decoding; source observations remain expectation-only.
 * @internal @packageDocumentation @since 0.0.0
 */
import { CitationDumpRow } from "@beep/law-practice-server/internal/Citation/Dump";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import * as S from "effect/Schema";

/** Exact ordered input views and independent ANSI/native output observations.
 * @internal @category testing @since 0.0.0
 */
export const CitationDumpCorpus = S.Struct({
  schemaVersion: S.tag("citation-builtin-dump-cases/v1"),
  license: S.tag("BSD-2-Clause"),
  producerSha256: S.String,
  profileSha256: S.tag("9054c6bfa1d5095991daf5c5644858db3715e1cedfef96a931c561e9e88e7944"),
  cases: S.Array(
    S.Struct({
      input: S.Struct({ text: CitationPythonUnicodeStorage, citations: S.Array(CitationDumpRow), contextChars: S.Int }),
      output: CitationPythonUnicodeStorage,
    })
  ).check(S.isBetweenLength(803, 803)),
}).pipe(S.toCodecJson, S.fromJsonString);
