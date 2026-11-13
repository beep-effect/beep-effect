/** Public fleet routes and unchanged host-side administrative programs. */
export const HOSTS = {
  dankstation: {
    label: "dankstation",
    wrapper: null,
    touch: false,
    agent_init: null,
    admin: null,
    admin_agent: null,
    down: "SSH master failed (missed touch or host down)",
  },
  "beep-worker": {
    label: "beep-worker",
    wrapper: "ssh-beep-worker-yubi",
    touch: true,
    agent_init: "dankserver-agent",
    admin: ["ssh-beep-worker-yubi", "--admin", "-tt"],
    admin_agent: "dankserver-agent",
    down: "SSH master failed (missed touch or host down)",
  },
  dankserver: {
    label: "dankserver",
    wrapper: "ssh-dankserver-worker",
    touch: true,
    agent_init: "dankserver-agent",
    admin: null,
    admin_agent: null,
    down: "SSH master failed (missed touch or host down)",
  },
  "tbk-worker": {
    label: "tbk-worker",
    wrapper: "ssh-tbk-worker",
    touch: true,
    agent_init: null,
    admin: null,
    admin_agent: null,
    down: "SSH master failed (missed touch or host down)",
  },
  "tom-pc-1-wsl": {
    label: "tom-pc-1-wsl",
    wrapper: "ssh-tom-pc-1-wsl",
    touch: true,
    agent_init: null,
    admin: ["ssh-tom-pc-1-wsl", "--admin", "-tt"],
    admin_agent: null,
    down: "SSH master failed: missed touch, or the PC is off, its Windows user is signed out or the T3AgentWSL keep-alive task is not running",
  },
  "grok-bot": {
    label: "grok-bot",
    wrapper: "ssh-grok-bot",
    touch: false,
    agent_init: null,
    admin: ["ssh-grok-bot", "--admin", "-tt"],
    admin_agent: "dankserver-agent",
    down: "asleep or unreachable; open its computer view in the Grok Bot app",
  },
};
export const CLI = ["claude", "codex", "grok", "kimi", "junie", "cursor-agent", "muse"];
export const DESKTOP = ["chatgpt-desktop", "claude-desktop", "cursor-desktop", "kimi-desktop"];
export const HARNESSES = [
  "t3code",
  "claude",
  "codex",
  "grok",
  "kimi",
  "junie",
  "cursor-agent",
  "muse",
  "chatgpt-desktop",
  "claude-desktop",
  "cursor-desktop",
  "kimi-desktop",
];
export const ONLY_ON = {
  "chatgpt-desktop": ["dankstation", "grok-bot"],
  "claude-desktop": ["dankstation", "grok-bot"],
  "cursor-desktop": ["dankstation"],
  "kimi-desktop": ["dankstation"],
};
export const ALIASES = {
  t3: "t3code",
  "t3-code": "t3code",
  "claude-code": "claude",
  "codex-cli": "codex",
  "grok-build": "grok",
  "grok-cli": "grok",
  "kimi-code": "kimi",
  "kimi-cli": "kimi",
  "junie-cli": "junie",
  agent: "cursor-agent",
  "cursor-cli": "cursor-agent",
  "muse-code": "muse",
  "meta-muse": "muse",
  chatgpt: "chatgpt-desktop",
  cursor: "cursor-desktop",
  "kimi-app": "kimi-desktop",
  "claude-app": "claude-desktop",
  "grok-bot-vm": "grok-bot",
  hub: "dankstation",
  local: "dankstation",
  "tom-pc-1": "tom-pc-1-wsl",
};
export const PACMAN = {
  "chatgpt-desktop": "chatgpt-bin",
  "claude-desktop": "claude-desktop",
  "cursor-desktop": "cursor-bin",
};
export const DEB_NAMES = {
  "chatgpt-desktop": ["chatgpt"],
  "claude-desktop": ["claude-desktop", "claude"],
};
export const NPM_LATEST = {
  claude: "@anthropic-ai/claude-code",
  codex: "@openai/codex",
};
export const DEBIAN_MIRRORS = ["deb.debian.org", "ftp.debian.org", "security.debian.org"];
export const ADMIN_PRELUDE =
  'set -uo pipefail\nok=0\nfor i in 1 2 3; do\n  echo "sudo attempt $i/3: touch the YubiKey" >&2\n  if SUDO_ASKPASS=/bin/false timeout 60 sudo -A -v; then ok=1; break; fi\ndone\n((ok)) || { echo "@@ADMIN auth-failed"; exit 77; }\n( while sleep 45; do sudo -n -v 2>/dev/null || exit 0; done ) & keep=$!\ntrap \'kill $keep 2>/dev/null\' EXIT\necho "@@ADMIN start"\n';
export const APPARMOR_FIX =
  'b64=$1; dir=/var/backups/beep-apparmor; ts=$(date +%Y%m%dT%H%M%S); prof=/etc/apparmor.d/beep-cursor-sandbox\nsudo -n install -d -m 700 "$dir" || exit 1\nsudo -n cp -a "$prof" "$dir/beep-cursor-sandbox.$ts" || exit 1\nprintf \'%s\' "$b64" | base64 -d | sudo -n tee "$dir/beep-cursor-sandbox.new" >/dev/null || exit 1\nsudo -n apparmor_parser -Q -K "$dir/beep-cursor-sandbox.new" || { echo "@@ADMIN parse-failed"; exit 1; }\nsudo -n install -m 644 -o root -g root "$dir/beep-cursor-sandbox.new" "$prof" || exit 1\nif ! sudo -n apparmor_parser -r "$prof"; then\n  sudo -n install -m 644 -o root -g root "$dir/beep-cursor-sandbox.$ts" "$prof" && sudo -n apparmor_parser -r "$prof"\n  echo "@@ADMIN reload-failed-restored"; exit 1\nfi\necho "@@ADMIN ok backup=$dir/beep-cursor-sandbox.$ts"\n';
export const APT_UPGRADE =
  'shopt -s nullglob\nstamp=$1; shift; files=()\nwhile (($#)) && [[ $1 != -- ]]; do files+=("$1"); shift; done; shift\nfor f in /etc/apt/sources.list.d/*.list /etc/apt/sources.list.d/*.sources; do\n  grep -qiE \'anthropic|claude|openai|oaistatic|chatgpt\' "$f" || continue\n  sudo -n apt-get update -o "Dir::Etc::sourcelist=$f" -o Dir::Etc::sourceparts=- \\\n    -o APT::Get::List-Cleanup=0 >&2 || echo "@@ADMIN list-update-failed $f"\ndone\nif ((${#files[@]})); then\n  # Root-owned staging; every file re-verified as root; install exactly these names.\n  src="$HOME/.cache/beep-debs/$stamp"; dst="/var/cache/beep-debs/$stamp"; debs=()\n  sudo -n install -d -m 700 "$dst" || exit 1\n  for pair in "${files[@]}"; do\n    name=${pair%%=*}; sha=${pair#*=}\n    sudo -n install -m 644 -o root -g root "$src/$name" "$dst/$name" || exit 1\n    printf \'%s  %s\\n\' "$sha" "$dst/$name" | sudo -n sha256sum -c --quiet || { echo "@@ADMIN hash-mismatch $name"; exit 1; }\n    debs+=("$dst/$name")\n  done\n  sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y "${debs[@]}" >&2 || echo "@@ADMIN pushed-debs-failed"\n  rm -rf "$src"\nfi\nif sudo -n env DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade "$@" >&2; then\n  echo "@@ADMIN apt-ok"\nelse\n  echo "@@ADMIN apt-failed"\n  sudo -n apt-get install -y --only-upgrade --print-uris -qq "$@" 2>/dev/null \\\n    | sed -n "s/^\'\\([^\']*\\)\' \\([^ ]*\\) [0-9]* SHA256:\\([0-9a-f]*\\).*/@@URI \\1 \\2 \\3/p"\nfi\n';
export const STATUS_ORDER = {
  failed: 0,
  unreachable: 1,
  skipped: 2,
  pending: 3,
  updated: 4,
  installed: 5,
  current: 6,
  absent: 7,
};
