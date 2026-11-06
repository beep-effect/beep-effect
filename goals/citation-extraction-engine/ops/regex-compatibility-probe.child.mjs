/** Maintainer compile-only survey. No source pattern is evaluated or approved. */
import { readFileSync } from "node:fs";

const entries = JSON.parse(readFileSync(0, "utf8"));
if (!Array.isArray(entries) || entries.length > 16384) throw new Error("invalid survey input");
const codes = entries.map((entry) => {
  if (!Array.isArray(entry) || entry.length !== 3 || ![0, 2].includes(entry[2])) throw new Error("invalid descriptor");
  return entry.slice(0, 2).map((pattern) => {
    if (typeof pattern !== "string" || pattern.length > 8192) throw new Error("invalid source pattern");
    try {
      // Compilation only: no exec/test/match call belongs in this subject.
      new RegExp(pattern, entry[2] === 2 ? "iu" : "u");
      return "C";
    } catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      return "S";
    }
  });
});
process.stdout.write(
  JSON.stringify({
    versions: {
      node: process.versions.node,
      bun: process.versions.bun ?? null,
      v8: process.versions.v8,
      unicode: process.versions.unicode,
      icu: process.versions.icu,
    },
    codes,
  })
);
