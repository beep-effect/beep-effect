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
        nativeCliLibraries = with pkgs; [
          # Native libs needed by globally-installed Node CLIs (e.g. grok -> keytar -> libsecret + glib)
          libsecret
          glib
        ];
        tauriLinuxTools = with pkgs; lib.optionals stdenv.isLinux [
          pkg-config
        ];
        tauriLinuxLibraries = with pkgs; lib.optionals stdenv.isLinux [
          cairo
          dbus
          gdk-pixbuf
          glib
          gtk3
          libappindicator-gtk3
          libayatana-appindicator
          librsvg
          libsoup_3
          openssl
          pango
          webkitgtk_4_1
          xdotool
        ];
        devShellRuntimeLibraries = nativeCliLibraries ++ tauriLinuxLibraries;
      in
      {
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Runtime
            bun
            nodejs_22

            # Quality tools
            typos
            gitleaks
            lefthook

            # Docker
            docker-compose
          ] ++ nativeCliLibraries ++ tauriLinuxTools ++ tauriLinuxLibraries;

          shellHook = ''
            repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
            worktree_name="$(basename "$repo_root")"
            echo "beep-effect dev shell loaded for $worktree_name"
            export BUN_INSTALL="$HOME/.bun"
            export BUN_INSTALL_CACHE_DIR="''${XDG_CACHE_HOME:-$HOME/.cache}/beep-effect/bun-install-cache"
            mkdir -p "$BUN_INSTALL_CACHE_DIR"
            export PATH="$BUN_INSTALL/bin:$PATH"
            # Tauri/WebKitGTK dev shells on non-NixOS need the host GL stack first.
            export LD_LIBRARY_PATH="${pkgs.lib.optionalString pkgs.stdenv.isLinux "/usr/lib:"}${pkgs.lib.makeLibraryPath devShellRuntimeLibraries}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
            export GDK_BACKEND="''${GDK_BACKEND:-x11}"
          '';
        };
      });
}
