import * as NodeURL from "node:url";
import {
  identityLeafInitializer,
  typedIdentityExportBlock,
} from "@beep/repo-cli/commands/CreatePackage/internal/IdentityExportBlock";
import { CreatePackageIdentityRegistration } from "@beep/repo-cli/commands/CreatePackage/internal/IdentityRegistration";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";

const identityRegistrationPath = NodeURL.fileURLToPath(
  new URL("../src/commands/CreatePackage/internal/IdentityRegistration.ts", import.meta.url)
);
const identityExportBlockPath = NodeURL.fileURLToPath(
  new URL("../src/commands/CreatePackage/internal/IdentityExportBlock.ts", import.meta.url)
);

it.layer(NodeServices.layer)("create-package identity template", (it) => {
  it.effect(
    "keeps the identity registration template aligned with @beep/identity's generated surface",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const identityRegistrationSource = yield* fs.readFileString(identityRegistrationPath);
      const identityExportBlockSource = yield* fs.readFileString(identityExportBlockPath);

      expect(identityRegistrationSource).toContain('const IDENTITY_PACKAGE_NAME = "@beep/identity" as const;');
      expect(identityExportBlockSource).toContain(
        "const toIdentityAccessorName = (packageName: string): string => `$${Str.pascalCase(packageName)}Id`;"
      );
      expect(identityExportBlockSource).toContain('` * import { ${accessorName} } from "@beep/identity/packages"`');
      expect(identityRegistrationSource).toContain(
        'sourceFile.getVariableDeclaration("generatedComposers") ?? sourceFile.getVariableDeclarationOrThrow("composers")'
      );
    })
  );
});

describe("identity export template", () => {
  it("renders every export as an independent pure $I.create leaf over its own slug", () => {
    expect(identityLeafInitializer("repo-cli")).toBe('/*#__PURE__*/ $I.create("repo-cli")');
    expect(typedIdentityExportBlock("repo-cli")).toContain(
      'export const $RepoCliId: Identity.IdentityComposer<"@beep/repo-cli"> = /*#__PURE__*/ $I.create("repo-cli");'
    );
  });

  it("reads a rendered leaf back as a registry export with no leaf mismatch", () => {
    const registry = `const generatedComposers = /*#__PURE__*/ $I.compose("repo-cli");\n${typedIdentityExportBlock("repo-cli")}\n`;

    expect(CreatePackageIdentityRegistration.registeredIdentityExportSlugs(registry)).toEqual(["repo-cli"]);
    expect(CreatePackageIdentityRegistration.identityLeafMismatches(registry)).toEqual([]);
  });
});
