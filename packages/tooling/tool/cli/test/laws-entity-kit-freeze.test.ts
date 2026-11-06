import {
  diffEntityKitBaseline,
  EntityKitImport,
  entityKitFreezeExemptPaths,
  entityKitFrozenSpecifiers,
  findEntityKitImports,
  formatEntityKitFreezeFinding,
  frozenBarrelBindings,
  isEntityKitFreezeScope,
  pruneEntityKitBaseline,
  scanEntityKitImporter,
} from "@beep/repo-cli/commands/Laws";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as R from "effect/Record";

const matchesOf = (content: string) => A.map(findEntityKitImports(content), (found) => found.match);
const importersOf = (files: Record<string, string>) =>
  A.flatMap(R.toEntries(files), ([file, content]) => scanEntityKitImporter(file, content));

describe("entity kit freeze law", () => {
  describe("frozen specifiers", () => {
    it.effect("reports every frozen subpath and the entity barrel", () =>
      Effect.sync(() => {
        for (const specifier of entityKitFrozenSpecifiers) {
          expect(matchesOf(`import * as K from "${specifier}";\n`)).toEqual([specifier]);
        }
      })
    );

    it.effect("reports type imports, re-exports, side-effect and dynamic imports", () =>
      Effect.sync(() => {
        const content = pipe(
          [
            'import type { ProductEntityModel } from "@beep/shared-domain/entity/ProductEntity";',
            "export * from '@beep/shared-domain/entity/BaseEntity';",
            'export { make } from "@beep/shared-domain/entity/EntityKit";',
            'import "@beep/shared-domain/entity/primitives";',
            'const kit = await import("@beep/shared-domain/entity/OrgEntity");',
            'type Audit = typeof import("@beep/shared-domain/entity/AuditEntity");',
          ],
          A.join("\n")
        );
        expect(matchesOf(content)).toEqual([
          "@beep/shared-domain/entity/ProductEntity",
          "@beep/shared-domain/entity/BaseEntity",
          "@beep/shared-domain/entity/EntityKit",
          "@beep/shared-domain/entity/primitives",
          "@beep/shared-domain/entity/OrgEntity",
          "@beep/shared-domain/entity/AuditEntity",
        ]);
      })
    );

    it.effect("reports a multi-line import at its keyword position", () =>
      Effect.sync(() => {
        const content =
          'const a = 1;\n\nimport {\n  make,\n  type Kit,\n} from "@beep/shared-domain/entity/EntityKit";\n';
        expect(findEntityKitImports(content)).toEqual([
          EntityKitImport.make({ line: 3, column: 1, match: "@beep/shared-domain/entity/EntityKit" }),
        ]);
      })
    );
  });

  describe("surviving value schemas and near misses", () => {
    it.effect("ignores the Principal, SourceKind, PublicEntityId, EntityId and EntityRef subpaths", () =>
      Effect.sync(() => {
        for (const module of ["Principal", "SourceKind", "PublicEntityId", "EntityId", "EntityRef"]) {
          expect(matchesOf(`import * as M from "@beep/shared-domain/entity/${module}";\n`)).toEqual([]);
        }
      })
    );

    it.effect("ignores other shared-domain subpaths and look-alike specifiers", () =>
      Effect.sync(() => {
        expect(matchesOf('import { User } from "@beep/shared-domain/entities/User";')).toEqual([]);
        expect(matchesOf('import { X } from "@beep/shared-domain/entity/EntityKit/extra";')).toEqual([]);
        expect(matchesOf('import { X } from "@beep/shared-domain-entity";')).toEqual([]);
        expect(matchesOf("the @beep/shared-domain/entity barrel in prose")).toEqual([]);
      })
    );

    it.effect("does not run a from-clause across unrelated code", () =>
      Effect.sync(() => {
        const content = 'export function f() { return 1 }\nconst s = "x" + y; from("@beep/shared-domain/entity")';
        expect(matchesOf(content)).toEqual([]);
      })
    );
  });

  describe("barrel named bindings", () => {
    it.effect("reports a frozen kit binding imported from the package barrel", () =>
      Effect.sync(() => {
        expect(matchesOf('import { ProductEntity } from "@beep/shared-domain";')).toEqual([
          "@beep/shared-domain { ProductEntity }",
        ]);
      })
    );

    it.effect("reports each frozen binding among surviving ones, through type and alias forms", () =>
      Effect.sync(() => {
        const content = 'import { Principal, type EntityKit as K, OrgEntity, EntityRef } from "@beep/shared-domain";';
        expect(matchesOf(content)).toEqual(["@beep/shared-domain { EntityKit }", "@beep/shared-domain { OrgEntity }"]);
        expect(matchesOf('export { BaseEntity, AuditEntity } from "@beep/shared-domain";')).toEqual([
          "@beep/shared-domain { BaseEntity }",
          "@beep/shared-domain { AuditEntity }",
        ]);
      })
    );

    it.effect("ignores surviving barrel bindings and namespace imports", () =>
      Effect.sync(() => {
        expect(matchesOf('import { Principal, SourceKind, EntityId } from "@beep/shared-domain";')).toEqual([]);
        expect(matchesOf('import * as SharedDomain from "@beep/shared-domain";')).toEqual([]);
        expect(frozenBarrelBindings(" Default ")).toEqual([]);
        expect(frozenBarrelBindings(" { ProductEntity as PE } ")).toEqual(["ProductEntity"]);
      })
    );
  });

  describe("scope", () => {
    it.effect("scans package and app TypeScript sources only", () =>
      Effect.sync(() => {
        expect(isEntityKitFreezeScope("packages/iam/domain/src/User.ts")).toBe(true);
        expect(isEntityKitFreezeScope("apps/web/src/App.tsx")).toBe(true);
        expect(isEntityKitFreezeScope("packages/iam/domain/test/User.test.ts")).toBe(true);
        expect(isEntityKitFreezeScope("docs/example.ts")).toBe(false);
        expect(isEntityKitFreezeScope("packages/iam/domain/README.md")).toBe(false);
        expect(isEntityKitFreezeScope("packages/iam/domain/src/User.mts")).toBe(false);
      })
    );

    it.effect("skips the kit itself, node_modules, dist and the law's own files", () =>
      Effect.sync(() => {
        expect(isEntityKitFreezeScope("packages/shared/domain/src/entity/EntityKit.ts")).toBe(false);
        expect(isEntityKitFreezeScope("packages/shared/domain/src/entity.ts")).toBe(true);
        expect(isEntityKitFreezeScope("packages/x/node_modules/y/index.ts")).toBe(false);
        expect(isEntityKitFreezeScope("packages/x/dist/index.d.ts")).toBe(false);
        for (const file of entityKitFreezeExemptPaths) {
          expect(isEntityKitFreezeScope(file)).toBe(false);
        }
      })
    );
  });

  describe("baseline comparison", () => {
    const importers = importersOf({
      "packages/a/src/Kept.ts": 'import * as K from "@beep/shared-domain/entity/EntityKit";',
      "packages/a/src/New.ts": 'import { ProductEntity } from "@beep/shared-domain";',
      "packages/a/src/Clean.ts": 'import * as P from "@beep/shared-domain/entity/Principal";',
    });

    it.effect("records only files that import the kit", () =>
      Effect.sync(() => {
        expect(A.map(importers, (importer) => importer.file)).toEqual([
          "packages/a/src/Kept.ts",
          "packages/a/src/New.ts",
        ]);
      })
    );

    it.effect("allows baseline members and flags importers outside the baseline", () =>
      Effect.sync(() => {
        const findings = diffEntityKitBaseline(importers, ["packages/a/src/Kept.ts"]);
        expect(A.map(findings, (finding) => [finding.file, finding.rule])).toEqual([
          ["packages/a/src/New.ts", "new-importer"],
        ]);
        expect(A.flatMap(findings, formatEntityKitFreezeFinding)).toEqual([
          "packages/a/src/New.ts:1:1  new-importer  @beep/shared-domain { ProductEntity }",
        ]);
        expect(diffEntityKitBaseline(importers, ["packages/a/src/Kept.ts", "packages/a/src/New.ts"])).toEqual([]);
      })
    );

    it.effect("flags a baseline file that no longer imports the kit as stale", () =>
      Effect.sync(() => {
        const findings = diffEntityKitBaseline(importers, [
          "packages/a/src/Kept.ts",
          "packages/a/src/New.ts",
          "packages/a/src/Clean.ts",
          "packages/a/src/Deleted.ts",
        ]);
        expect(A.map(findings, (finding) => [finding.file, finding.rule])).toEqual([
          ["packages/a/src/Clean.ts", "stale-baseline"],
          ["packages/a/src/Deleted.ts", "stale-baseline"],
        ]);
        expect(A.length(formatEntityKitFreezeFinding(A.getUnsafe(findings, 0)))).toBe(1);
      })
    );

    it.effect("prunes stale rows and never admits a new importer", () =>
      Effect.sync(() => {
        const importerFiles = A.map(importers, (importer) => importer.file);
        expect(
          pruneEntityKitBaseline(importerFiles, [
            "packages/a/src/Kept.ts",
            "packages/a/src/Clean.ts",
            "packages/a/src/Kept.ts",
          ])
        ).toEqual(["packages/a/src/Kept.ts"]);
      })
    );
  });
});
