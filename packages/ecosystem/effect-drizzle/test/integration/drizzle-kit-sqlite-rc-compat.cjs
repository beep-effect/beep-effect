const Module = require("node:module");

// decision: drizzle-kit-sqlite-dialect-bridge
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
