/**
 * The product leaves a checkout may remove, and the packets that go with them.
 *
 * **Details**
 *
 * `goals/prunable-product-leaves` defines the product leaves: the
 * law-practice, documents, workspace and architecture-lab slices, the legal and
 * office drivers, and the apps that depend on them. A checkout that removes
 * them (a downstream fork, a trimmed cloud lane) must still install, typecheck,
 * lint and test. Checks that read a real repository file skip only for a
 * subject listed here whose directory is gone (see `CheckoutSubject.ts`); every
 * other absent subject still fails. Keep this list in step with the packet's
 * definition when a leaf is added, renamed or retired.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { PacketRoot, PrunableLeaves, PrunableWorkspace } from "./CheckoutSubject.ts";

const workspace = ([packageName, directory]: readonly [string, string]): PrunableWorkspace =>
  PrunableWorkspace.make({ packageName, directory });

/**
 * The product leaves and their packets.
 *
 * **Example** (Check whether a package is a product leaf)
 *
 * ```ts
 * import { productLeaves } from "@beep/repo-cli-kit/ProductLeaves"
 *
 * console.log(productLeaves.workspaces.some((leaf) => leaf.packageName === "@beep/box")) // true
 * console.log(productLeaves.workspaces.some((leaf) => leaf.packageName === "@beep/repo-cli")) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const productLeaves: PrunableLeaves = PrunableLeaves.make({
  workspaces: A.map(
    [
      ["@beep/law-practice-domain", "packages/law-practice/domain"],
      ["@beep/law-practice-server", "packages/law-practice/server"],
      ["@beep/law-practice-tables", "packages/law-practice/tables"],
      ["@beep/law-practice-use-cases", "packages/law-practice/use-cases"],
      ["@beep/documents-domain", "packages/documents/domain"],
      ["@beep/documents-server", "packages/documents/server"],
      ["@beep/documents-tables", "packages/documents/tables"],
      ["@beep/documents-use-cases", "packages/documents/use-cases"],
      ["@beep/workspace-domain", "packages/workspace/domain"],
      ["@beep/workspace-server", "packages/workspace/server"],
      ["@beep/workspace-tables", "packages/workspace/tables"],
      ["@beep/workspace-use-cases", "packages/workspace/use-cases"],
      ["@beep/architecture-lab-client", "packages/architecture-lab/client"],
      ["@beep/architecture-lab-config", "packages/architecture-lab/config"],
      ["@beep/architecture-lab-domain", "packages/architecture-lab/domain"],
      ["@beep/architecture-lab-server", "packages/architecture-lab/server"],
      ["@beep/architecture-lab-tables", "packages/architecture-lab/tables"],
      ["@beep/architecture-lab-ui", "packages/architecture-lab/ui"],
      ["@beep/architecture-lab-use-cases", "packages/architecture-lab/use-cases"],
      ["@beep/eyecite", "packages/drivers/eyecite"],
      ["@beep/govinfo", "packages/drivers/govinfo"],
      ["@beep/ecfr", "packages/drivers/ecfr"],
      ["@beep/gov-legal-mcp", "packages/drivers/gov-legal-mcp"],
      ["@beep/pacer", "packages/drivers/pacer"],
      ["@beep/uspto", "packages/drivers/uspto"],
      ["@beep/uspto-mcp", "packages/drivers/uspto-mcp"],
      ["@beep/hubspot", "packages/drivers/hubspot"],
      ["@beep/freshbooks", "packages/drivers/freshbooks"],
      ["@beep/box", "packages/drivers/box"],
      ["@beep/box-provisioning", "packages/drivers/box-provisioning"],
      ["@beep/m365", "packages/drivers/m365"],
      ["@beep/m365-mcp", "packages/drivers/m365-mcp"],
      ["@beep/architecture-lab-proof", "apps/architecture-lab-proof"],
      ["@beep/docket-intake", "apps/docket-intake"],
      ["@beep/api-docs", "apps/labs/api-docs"],
      ["@beep/oip-web", "apps/oip-web"],
      ["@beep/practice-claude-mod", "apps/practice-claude-mod"],
      ["@beep/practice-gateway", "apps/practice-gateway"],
      ["@beep/practice-identify", "apps/practice-identify"],
      ["@beep/practice-kg-mcp", "apps/practice-kg-mcp"],
      ["@beep/practice-m365-contacts", "apps/practice-m365-contacts"],
      ["@beep/practice-mail-tagging", "apps/practice-mail-tagging"],
      ["@beep/practice-review-hub", "apps/practice-review-hub"],
      ["@beep/professional-desktop", "apps/professional-desktop"],
    ] as const,
    workspace
  ),
  packets: A.map(
    ["goals/citation-extraction-engine", "goals/claim-check-performance", "explorations/legal-ontology-landscape"],
    (root) => PacketRoot.make(root)
  ),
});
