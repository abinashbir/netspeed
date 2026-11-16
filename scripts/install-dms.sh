#!/usr/bin/env bash
# Install the DankMaterialShell plugin into the user's plugin directory.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="$HOME/.config/DankMaterialShell/plugins/netspeed"

echo "Installing the DMS 'netspeed' plugin to $DEST"
mkdir -p "$DEST"

cp "$ROOT/dms-plugin/netspeed/plugin.json" "$DEST/"
cp "$ROOT/dms-plugin/netspeed/BandwidthWidget.qml" "$DEST/"
cp "$ROOT/dms-plugin/netspeed/Settings.qml" "$DEST/"

# The shared core, byte for byte the same file the GNOME extension uses.
cp "$ROOT/shared/core.js" "$DEST/core.js"

if command -v dms >/dev/null 2>&1 && pgrep -x dms >/dev/null 2>&1; then
    dms ipc plugins enable netspeed || echo "Could not enable via IPC; enable it in DMS Settings -> Plugins."
    dms ipc plugins reload netspeed || true
else
    echo "DMS is not running right now - enable the plugin later with:"
    echo "    dms ipc plugins enable netspeed"
fi

cat <<EOF

Done. To show it in the bar:

  1. Open DMS Settings -> Plugins, enable "Network Speed".
  2. Open DMS Settings -> Appearance -> DankBar Layout and add
     "Network Speed" to the left / center / right section you want.
  3. If the bar does not update:  dms restart
EOF
