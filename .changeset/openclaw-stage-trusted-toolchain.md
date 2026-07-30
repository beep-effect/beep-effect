---
"@beep/infra": patch
---

Close two local privilege-escalation paths in the OpenClaw workstation applicator.

The rendered privileged scripts ran through `/bin/bash -lc`. A login shell sources the
user-writable `~/.bash_profile` before the first rendered line, so an unprivileged user could
define a `sudo` shell function, or prepend a `PATH` entry, and intercept every `sudo -n` call
while the operator's armed ticket was live. Scripts now render as
`/bin/bash --noprofile --norc -p -c`, pin `PATH=/usr/bin:/bin` before any privileged call, invoke
`/usr/bin/sudo` absolutely, and assert `sudo` is the real setuid binary rather than trusting a
name lookup.

Separately, staging prepended `nodeBinDir` to `PATH` for a privileged bare `npm install`, and the
default pointed at a per-user mise directory, so a local user who could write there executed code
as root during `pulumi up`. Staging now resolves the directory, `node`, and `npm` with
`readlink -f`, requires every path component up to `/` to be uid 0 and not group- or
world-writable, invokes the resolved absolute `npm`, and defaults to the root-owned
`/opt/beep/openclaw/node/bin`.
