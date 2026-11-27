---
title: The minted GitHub App credentials reach the vault writer only through a stdin pipe
date: 2026-11-26
reversal: Pass the vault template to `op item create` as a file path or argument instead of the bash pipe.
governs:
  - src/commands/Github/Github.service.ts#storeCommand
enforcedBy: []
---

The vault template, private key included, is streamed from memory into `bash -c 'cat | "$1" item create --vault <vault> -'`, with stdout and stderr ignored, so no secret reaches argv, stdout, stderr, the callback page or a temporary file.
Reason: the op CLI detects a JSON template only on a real pipe, so `cat` bridges the in-memory stdin stream into one. The writer's command is the positional `$1`, never interpolated into the script.
Rejected: a template file on disk, which leaves the private key in a temporary file, and a template argument, which puts it in argv where any process listing reads it.
