#!/usr/bin/env python3
"""Repair the dangling home skill links F-NATIVE-LINKS retained (issue #1862, operator ruling 2026-11-02).

Owned writes, every one a symlink under the home directory, each backed up first:

- `~/.agents/skills/turborepo`: a self-referential link (`../../.agents/skills/turborepo`)
  that `~/.claude/skills/turborepo` and `~/.codex/skills/turborepo` resolve through.
  Repointed at the primary clone's vendored mirror.
- `~/.claude/skills/plasma-sensitive-entry`: pointed at a retired lane worktree.
  Repointed at the primary clone's skill.
- `~/.codex/skills/effect-v4` and fifteen `~/.grok/skills/memory-*` links: targets that
  no longer exist anywhere on the workstation (the memory skill pack left with the
  2026-08-29 memory-service removal). Removed.

Backup: each link is copied with `cp -P` into
`~/.config-backups/rsc-f-native-links.<UTC stamp>/<relative path>` and listed in
`manifest.tsv` (path, prior target). Restore every link with
`--rollback <backup dir>`; it refuses when a live path is no longer the link this
script wrote. `--dry-run` (default) prints the plan and writes nothing.
"""
import argparse
import os
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

HOME = Path.home()
CLONE = HOME / "YeeBois/projects/beep-effect"

REPOINT = {
    HOME / ".agents/skills/turborepo": CLONE / ".agents/skills/turborepo",
    HOME / ".claude/skills/plasma-sensitive-entry": CLONE / ".claude/skills/plasma-sensitive-entry",
}
REMOVE_FIXED = [HOME / ".codex/skills/effect-v4"]


def grok_memory_links() -> list[Path]:
    root = HOME / ".grok/skills"
    if not root.is_dir():
        return []
    return sorted(
        p for p in root.iterdir()
        if p.is_symlink() and p.name.startswith("memory-") and not p.exists()
    )


def plan() -> list[tuple[Path, str, Path | None]]:
    rows: list[tuple[Path, str, Path | None]] = []
    for link, target in REPOINT.items():
        if not link.is_symlink():
            raise SystemExit(f"expected a symlink, refusing: {link}")
        if link.exists() and link.resolve() == target.resolve():
            continue
        if not target.is_dir():
            raise SystemExit(f"repair source missing, refusing: {target}")
        rows.append((link, "repoint", target))
    for link in [*REMOVE_FIXED, *grok_memory_links()]:
        if not link.is_symlink():
            continue
        if link.exists():
            raise SystemExit(f"link now resolves, refusing to remove: {link}")
        rows.append((link, "remove", None))
    return rows


def apply(rows: list[tuple[Path, str, Path | None]]) -> int:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = HOME / ".config-backups" / f"rsc-f-native-links.{stamp}"
    backup.mkdir(parents=True)
    manifest = []
    for link, action, target in rows:
        rel = link.relative_to(HOME)
        dest = backup / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        prior = os.readlink(link)
        shutil.copy2(link, dest, follow_symlinks=False)
        manifest.append(f"{rel}\t{prior}\t{action}\t{target or ''}")
        if action == "repoint":
            tmp = link.with_name(f".{link.name}.{stamp}.tmp")
            os.symlink(str(target), tmp)
            os.replace(tmp, link)
        else:
            link.unlink()
        print(f"{action}: ~/{rel} (was -> {prior})" + (f" -> {target}" if target else ""))
    (backup / "manifest.tsv").write_text("\n".join(manifest) + "\n")
    print(f"backup: {backup}")
    print(f"rollback: python3 {Path(__file__).name} --rollback {backup}")
    return 0


def rollback(backup: Path) -> int:
    rows = [line.split("\t") for line in (backup / "manifest.tsv").read_text().splitlines() if line]
    for rel, prior, action, target in rows:
        link = HOME / rel
        if action == "repoint":
            if not link.is_symlink() or os.readlink(link) != target:
                raise SystemExit(f"drift: {link} is not the link this script wrote; rollback refused before writes")
        elif link.exists() or link.is_symlink():
            raise SystemExit(f"drift: {link} exists again; rollback refused before writes")
    for rel, prior, action, target in rows:
        link = HOME / rel
        if link.is_symlink():
            link.unlink()
        os.symlink(prior, link)
        print(f"restored: ~/{rel} -> {prior}")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--dry-run", action="store_true")
    mode.add_argument("--apply", action="store_true")
    mode.add_argument("--rollback", metavar="BACKUP_DIR")
    args = parser.parse_args()
    if args.rollback:
        return rollback(Path(args.rollback))
    rows = plan()
    if not rows:
        print("nothing to repair")
        return 0
    if args.apply:
        return apply(rows)
    for link, action, target in rows:
        print(f"would {action}: ~/{link.relative_to(HOME)} (now -> {os.readlink(link)})" + (f" -> {target}" if target else ""))
    print("dry run; no files changed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
