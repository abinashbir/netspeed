#!/usr/bin/env bash
# Load the DMS plugin widget in a real QML engine (Quickshell, the same
# engine DMS uses) with mock qs.* modules, and check that it samples the
# network counters and that both bar pills instantiate without errors.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORK=/tmp/opencode/dms-test

if ! command -v quickshell >/dev/null 2>&1; then
    echo "quickshell is not installed - skipping the DMS QML test."
    exit 0
fi

rm -rf "$WORK"
mkdir -p "$WORK/netspeed"
cp -r "$ROOT/tests/dms-mock/." "$WORK/netspeed/"
cp "$ROOT/dms-plugin/netspeed/"*.qml "$ROOT/dms-plugin/netspeed/plugin.json" "$WORK/netspeed/"
cp "$ROOT/shared/core.js" "$WORK/netspeed/"
mv "$WORK/netspeed/shell.qml" "$WORK/shell.qml"

export QML_IMPORT_PATH="$WORK/netspeed${QML_IMPORT_PATH:+:$QML_IMPORT_PATH}"

OUTPUT=$(timeout 20 quickshell -p "$WORK" 2>&1)

if echo "$OUTPUT" | grep -q "DMS-WIDGET-LOADED" \
   && echo "$OUTPUT" | grep -q "DMS-PILLS-OK vertical=yes horizontal=yes" \
   && echo "$OUTPUT" | grep -q "DMS-SAMPLE"; then
    echo "$OUTPUT" | grep "DMS-SAMPLE" | tail -2
    echo "DMS QML test passed."
    exit 0
fi

echo "$OUTPUT" | grep -iE "DMS-|is not installed|ReferenceError|TypeError" | head -20
echo "DMS QML test FAILED."
exit 1
