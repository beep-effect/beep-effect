# Spike 1 immutable-mode compatibility matrix

| Writer surface | Result | Evidence | Log | Operationally essential? |
| --- | --- | --- | --- | --- |
| Pairing / first-owner persistence | graceful skip | sender approved and persisted in pairing store; owner-config write refused cleanly by the NIX_MODE app guard with no config mutation | `a5-pairing-first-owner.log` | yes |
