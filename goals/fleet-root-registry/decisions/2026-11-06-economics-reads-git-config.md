---
title: "Economics resolves the repository key from .git/config and warns on a bad roots.json"
date: 2026-11-06
lane: "feat/fleet-root-registry"
reversal: "Give Economics a ChildProcessSpawner requirement and call detectPrRepository, and let a bad roots.json fail the report."
---

Yeet economics is filesystem-only (FileSystem, Path, Digest) and its review-lane read has a never error channel. It reads the clone's .git/config origin (originUrlFromGitConfig, fleetRepositoryFromOriginUrl) for the roots.json key and shares readConfiguredFleetRoots with the mirror. A roots.json that does not decode logs a warning and falls back to the derived projects root; worktree fleet refuses it. Rejected: spawning git from Economics (widens four explicit signatures and the source services); silently ignoring a bad file.
