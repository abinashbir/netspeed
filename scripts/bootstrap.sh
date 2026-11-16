#!/usr/bin/env bash
# One-shot bootstrap: download the project from GitHub and install it.
#
#   curl -fsSL https://raw.githubusercontent.com/abinashbir/netspeed/main/scripts/bootstrap.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/abinashbir/netspeed/main/scripts/bootstrap.sh | bash -s -- gnome
#   curl -fsSL https://raw.githubusercontent.com/abinashbir/netspeed/main/scripts/bootstrap.sh | bash -s -- dms
#   curl -fsSL https://raw.githubusercontent.com/abinashbir/netspeed/main/scripts/bootstrap.sh | bash -s -- both
set -euo pipefail

REPO="abinashbir/netspeed"
BRANCH="main"
TARGET="${1:-auto}"

TMPDIR_BOOT="$(mktemp -d)"
trap 'rm -rf "$TMPDIR_BOOT"' EXIT

echo "Fetching $REPO ($BRANCH)..."
TARBALL="$TMPDIR_BOOT/netspeed.tar.gz"
curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" -o "$TARBALL"
tar -xzf "$TARBALL" -C "$TMPDIR_BOOT"
NAME="${REPO##*/}"
ROOT="$(find "$TMPDIR_BOOT" -maxdepth 1 -type d -name "$NAME-*" | head -1)"
if [ -z "$ROOT" ]; then
    echo "Could not find the extracted project directory." >&2
    exit 1
fi

case "$TARGET" in
    gnome) TARGETS="gnome" ;;
    dms)   TARGETS="dms" ;;
    both)  TARGETS="gnome dms" ;;
    auto)
        TARGETS=""
        command -v gnome-extensions >/dev/null 2>&1 && TARGETS="$TARGETS gnome"
        [ -d "$HOME/.config/DankMaterialShell" ] && TARGETS="$TARGETS dms"
        [ -n "$TARGETS" ] || TARGETS="gnome"
        ;;
    *)
        echo "Unknown target '$TARGET' (use: gnome, dms, both, auto)." >&2
        exit 2
        ;;
esac

for t in $TARGETS; do
    echo
    echo "=== Installing ($t) ==="
    bash "$ROOT/scripts/install-$t.sh"
done

echo
echo "All done."
