{
  description = "beep-effect development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Runtime. Bun is deliberately NOT supplied here: mise owns the pin via
            # .bun-version (governed by `beep version-sync`), and a nixpkgs bun on
            # PATH shadows it with whatever version the flake.lock happens to carry.
            nodejs_24

            # Python (SkillOpt training pilot — tools/skillopt uv project)
            python3
            uv

            # Quality tools
            typos
            gitleaks
            lefthook

            # Docker
            docker-compose

            # Native libs needed by globally-installed Node CLIs (e.g. grok -> keytar -> libsecret + glib)
            libsecret
            glib

            # C++ runtime for prebuilt Node native bindings (e.g. @duckdb/node-bindings needs libstdc++.so.6).
            # The Nix bun uses the Nix glibc loader, which never searches /usr/lib.
            stdenv.cc.cc.lib
          ];

          shellHook = ''
            repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
            worktree_name="$(basename "$repo_root")"
            # Quiet under direnv: any output during zsh init trips Powerlevel10k's instant-prompt warning.
            [ -z "''${DIRENV_IN_ENVRC:-}" ] && echo "beep-effect dev shell loaded for $worktree_name"
            export BUN_INSTALL="$HOME/.bun"
            export BUN_INSTALL_CACHE_DIR="''${XDG_CACHE_HOME:-$HOME/.cache}/beep-effect/bun-install-cache"
            mkdir -p "$BUN_INSTALL_CACHE_DIR"
            export PATH="$BUN_INSTALL/bin:$PATH"
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [ pkgs.libsecret pkgs.glib pkgs.stdenv.cc.cc.lib ]}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
          '';
        };
      });
}
