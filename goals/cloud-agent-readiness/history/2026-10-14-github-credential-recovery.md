# GitHub credential recovery across desktop logout — 2026-10-14

Status: **credential storage cause confirmed and headless access repaired**.

After the repeat Ubuntu reboot, gh auth status described the saved token as
invalid and gh api user returned 401. The hosts.yml file retained the account
and protocol metadata but had no oauth_token field. gh auth token returned no
token. GNOME Secret Service's login collection was locked; the worker was at
the desktop sign-in screen. User services were running through lingering.

The operator logged into the worker desktop. Secret Service then reported the
login collection unlocked, gh auth status exited zero and authenticated user
lookup returned the expected kriegcloud identity using the existing credential.
This demonstrates unavailable keyring retrieval, not token revocation, for the
observed failure. No credential refresh or new OAuth authorization was needed.

## Repair and storage tradeoff

Retrieved the existing token through gh auth token into a subprocess pipe and
passed it directly to gh auth login --hostname github.com --git-protocol https
--with-token --insecure-storage. Secret output and login output were captured
and suppressed. No token entered command arguments, tool output, tracked files
or this receipt. The worker ~/.config/gh directory is mode 0700 and hosts.yml
is mode 0600. The persistent oauth_token field is populated. This is GitHub
CLI's supported plain-text file-storage mode: it removes the desktop-unlock
dependency but stores an unencrypted token protected by Unix file permissions.
It is not equivalent to encrypted keyring storage. Existing 1Password agent
configuration was not modified. Other desktop keyring credentials remain intact.

Sources: https://cli.github.com/manual/gh_auth_login documents credential store,
file-storage fallback and --insecure-storage;
https://cli.github.com/manual/gh_help_environment documents headless environment
authentication. This repair uses persistent CLI file storage, not an environment
token override or an added per-command wrapper.

## Verification and limits

An SSH subprocess with DBUS_SESSION_BUS_ADDRESS pointed to a nonexistent
socket, GH_TOKEN/GITHUB_TOKEN absent and SSH agent forwarding disabled passes:

- gh auth status, exit zero;
- gh api user, expected account identity;
- authenticated repository permissions, push=true;
- repository PR listing, exit zero.

Private sanitized receipt: worker
~/.cache/beep/readiness/reboot/github-no-keyring.json.

A separate transient user-systemd service beep-gh-headless-check, invocation
2dbee60092c940c28e27602b819dd970, uses the same nonexistent desktop bus,
RuntimeMaxSec=45 and no forwarded SSH agent. Both ~/.local/bin/gh (used by T3)
and /usr/bin/gh (used by the existing HTTPS Git credential helper) return the
expected authenticated identity; repository push permission is true. Service
exits 0/SUCCESS in 1.651 seconds, peak memory 41 MiB. The user manager has no
GH_TOKEN/GITHUB_TOKEN override. No push, PR creation or other GitHub mutation
was used as an authentication test.

This proves credential access without Secret Service in SSH and user-systemd
contexts. No additional full reboot or T3 browser interaction was performed
for this repair. Existing repeat-boot service/proxy qualification remains valid.
A follow-up machine reboot can verify the new persistent credential path with
the login collection locked; this receipt does not claim that extra boot ran.

Rollback is to log in with normal secure-store mode and verify it before
removing file credentials. Do not remove the current credential before a
replacement route passes; secure-store rollback restores the desktop-login
dependency for unattended services. The repository's eight existing worker
edits are preserved; this repair changed only out-of-repository gh credentials.
