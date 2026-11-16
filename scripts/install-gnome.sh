#!/usr/bin/env bash
# Install the GNOME Shell extension into the user's extension directory.
set -euo pipefail

UUID="netspeed@abinash.dev"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HOME/.local/share/gnome-shell/extensions/$UUID"

echo "Installing $UUID to $DEST"
mkdir -p "$DEST"

cp "$ROOT/gnome-extension/$UUID/metadata.json" "$DEST/"
cp "$ROOT/gnome-extension/$UUID/extension.js" "$DEST/"
cp "$ROOT/gnome-extension/$UUID/stylesheet.css" "$DEST/"

# The shared core, byte for byte the same file the DMS plugin uses.
cp "$ROOT/shared/core.js" "$DEST/core.js"

if command -v gnome-extensions >/dev/null 2>&1; then
    gnome-extensions enable "$UUID" || echo "Could not enable automatically; enable it in Extensions."
fi

cat <<EOF

Done. To activate it:

  * Log out and log back in (or reboot). GNOME only discovers newly
    installed extensions at login, so nothing shows up before that.
  * The indicator then appears in the top bar on the right:

        down-arrow 1.2M/s   up-arrow 340K/s   total 4.7G

    (down-arrow = download speed, up-arrow = upload speed,
     total = data consumed on that interface since boot)

Settings are stored in ~/.config/netspeed-indicator.json
EOF
