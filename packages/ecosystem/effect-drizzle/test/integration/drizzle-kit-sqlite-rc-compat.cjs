/**
 * Test-only compatibility bridge for the independently pinned Drizzle RC hashes.
 *
 * drizzle-kit rc.4-ca0f029 still imports `SQLiteSyncDialect`; drizzle-orm
 * rc.4-fb12281 renamed that export to `SQLiteDialect`. The implementations have
 * the same constructor surface used by the kit serializer. This preload leaves
 * installed packages untouched and can be removed when the hashes converge.
 */
const Module = require("node:module");

const load = Module._load;
Module._load = function loadWithSqliteDialectBridge(request, parent, isMain) {
  const exports = load.call(this, request, parent, isMain);
  if (
    request === "drizzle-orm/sqlite-core" &&
    exports.SQLiteSyncDialect === undefined &&
    exports.SQLiteDialect !== undefined
  ) {
    return { ...exports, SQLiteSyncDialect: exports.SQLiteDialect };
  }
  return exports;
};
