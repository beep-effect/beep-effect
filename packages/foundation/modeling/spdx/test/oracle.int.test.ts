import { ACTIVE_LICENSE_IDS } from "@beep/spdx/internal/licenseIds";
import { isValidExpression } from "@beep/spdx/SpdxExpression";
import { assert, describe, it } from "@effect/vitest";
import { identity } from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import spdxParse from "spdx-expression-parse";

const oracleAccepts = (s: string): boolean => {
  try {
    spdxParse(s);
    return true;
  } catch {
    return false;
  }
};

const CORPUS = [
  "MIT",
  "Apache-2.0+",
  "(MIT OR Apache-2.0)",
  "MIT AND BSD-3-Clause",
  "GPL-2.0-or-later WITH Bison-exception-2.2",
  "LicenseRef-Foo",
  "(MIT AND (Apache-2.0 OR BSD-3-Clause))",
  "NOPE-1.0",
  "MIT AND",
  "(MIT",
  "MIT OR OR Apache-2.0",
  "",
  "GPL-3.0",
  "Apache-2.0 WITH Bogus-exception",
  "DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2",
  // LicenseRef + WITH: accepted since spdx-expression-parse v5, matching the
  // SPDX ABNF (`with-expression = simple-expression "WITH" license-exception-id`).
  "LicenseRef-Foo WITH Bison-exception-2.2",
  "DocumentRef-spdx-tool-1.2:LicenseRef-MIT-Style-2 WITH Classpath-exception-2.0",
  "LicenseRef-Foo WITH Bogus-exception",
  "LicenseRef-Foo+ WITH Bison-exception-2.2",
  "(LicenseRef-Foo WITH Classpath-exception-2.0) AND MIT",
  "MIT and BSD-3-Clause",
  "MIT or Apache-2.0",
  "GPL-2.0-or-later with Bison-exception-2.2",
];

describe("differential oracle: @effected/spdx vs spdx-expression-parse", () => {
  it("agrees on every active license id", () => {
    for (const id of ACTIVE_LICENSE_IDS) {
      assert.strictEqual(isValidExpression(id), oracleAccepts(id), `id ${id}`);
    }
  });
  it("agrees across the expression corpus", () => {
    for (const s of CORPUS) {
      assert.strictEqual(
        isValidExpression(s),
        oracleAccepts(s),
        `expr ${Result.getOrThrowWith(S.encodeUnknownResult(S.fromJsonString(S.Unknown))(s), identity)}`
      );
    }
  });
});
