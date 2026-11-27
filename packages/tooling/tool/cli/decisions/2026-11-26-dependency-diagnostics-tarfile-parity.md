---
title: the dependency diagnostic parses tar with Python tarfile stream-mode semantics
date: 2026-11-26
reversal: Replace the reader with a strict POSIX ustar/pax parser and re-baseline the refusal fixtures.
governs:
  - src/commands/Cache/Cache.diagnostics.ts#nextMember
  - src/commands/Cache/Cache.diagnostics.ts#field
enforcedBy: []
---

The TypeScript observer replaced a Python `tarfile` observer, and it keeps that observer's refusal codes. Names that are not strict UTF-8 refuse as invalid values (Python decoded them with surrogateescape and then failed on `name.encode()`). Pax keywords apply in record order through tarfile's handlers. Non-finite pax times count as invalid and fall back to 0, so every record stays plain JSON. A V7 regular file with a trailing slash is a directory. A malformed first header fails the archive, while a later one ends iteration. In the source report, a missing key and a non-object container both refuse as invalid values, like Python's KeyError and TypeError.

Rejected: a strict POSIX parser, which would refuse V7 directories and malformed trailing headers with codes the Python observer never emitted.
