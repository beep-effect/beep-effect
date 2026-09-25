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
        # Tools-only shell. Runtimes are deliberately NOT supplied here: mise owns
        # bun (.bun-version) and node (.nvmrc), both governed by `beep version-sync`.
        # A nixpkgs runtime on PATH would shadow them with whatever version
        # flake.lock happens to carry, which no drift check covers.
        # mkShellNoCC keeps gcc/binutils/glibc/coreutils off PATH; the runtimes are
        # system-linked, so native modules resolve /usr/lib without LD_LIBRARY_PATH.
        devShells.default = pkgs.mkShellNoCC {
          packages = with pkgs; [
            # Python (SkillOpt training pilot — tools/skillopt uv project)
            python3
            uv

            # Quality tools
            typos
            gitleaks
            lefthook

            # Docker
            docker-compose
          ];

          shellHook = ''
            repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
            worktree_name="$(basename "$repo_root")"
            # Quiet under direnv: any output during zsh init trips Powerlevel10k's instant-prompt warning.
            [ -z "''${DIRENV_IN_ENVRC:-}" ] && echo "beep-effect dev shell loaded for $worktree_name"
            # Global bun installs (portless, vercel) live here; bun's cache dir is set in bunfig.toml.
            export BUN_INSTALL="$HOME/.bun"
            export PATH="$BUN_INSTALL/bin:$PATH"
          '';
        };
      });
}
