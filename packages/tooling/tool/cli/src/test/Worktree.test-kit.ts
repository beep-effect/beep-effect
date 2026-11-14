/**
 * Source-only test facade for the Worktree command group.
 *
 * @internal
 * @since 0.0.0
 */

export * from "../commands/Worktree/index.ts";
export * from "../commands/Worktree/internal/FleetRegistry.schemas.ts";
export * from "../commands/Worktree/internal/FleetRegistry.ts";
export * from "../commands/Worktree/internal/FleetRoots.schemas.ts";
export * from "../commands/Worktree/internal/FleetRoots.ts";
export { fleetScannerCacheRoot, selectFleetScannerDir } from "../commands/Worktree/internal/FleetScannerDir.ts";
export * from "../commands/Worktree/internal/RemovalRoots.schemas.ts";
export * from "../commands/Worktree/internal/RemovalRoots.ts";
export * from "../commands/Worktree/internal/ResidueReap.schemas.ts";
export * from "../commands/Worktree/internal/ResidueReap.ts";
export * from "../commands/Worktree/internal/ResidueReapDrain.schemas.ts";
export * from "../commands/Worktree/internal/ResidueReapDrain.ts";
export * from "../commands/Worktree/internal/ResidueReapDrainLive.ts";
export * from "../commands/Worktree/internal/ResidueTerminalLane.ts";
export * from "../commands/Worktree/internal/ResidueTerminalLaneLive.ts";
export * from "../commands/Worktree/internal/TmpfsReap.schemas.ts";
export * from "../commands/Worktree/internal/TmpfsReap.ts";
export {
  renderResidueReportLinesForTesting,
  renderTmpfsReportLinesForTesting,
} from "../commands/Worktree/Janitor.command.ts";
