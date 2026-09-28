# Infrastructure shell startup isolation

The real OpenClaw missing-mode usage test now runs its unchanged rendered Bash
body with --noprofile --norc -p -c, matching the renderer's declared shell
contract. It no longer sources host login initialization through -lc. The native
child, inner scope, stderr drain, exit join, exit1 assertion and exact usage-text
witness remain unchanged. No provider or privileged mode is invoked.

The full package verification passes audit in8.2 seconds and docgen in5.6 seconds.
This removes the saved source-level isolation risk; it does not claim that a
historical flake was reproduced or justify retries, sleeps or weaker deadlines.
