// DMS bar pill: live download / upload speed + total data consumed.
//
// The measuring and formatting logic is NOT written here - it lives in the
// shared core (core.js), which is the exact same file the GNOME Shell
// extension uses. That keeps both front-ends showing identical numbers.
//
//   import "core.js" as Core;
//   Core.NetDevCore.parseNetDev(text)

import QtQuick
import Quickshell
import Quickshell.Io
import qs.Common
import qs.Modules.Plugins
import qs.Widgets

import "core.js" as Core

PluginComponent {
    id: root
    pluginId: "netspeed"

    // ── settings ────────────────────────────────────────────────────────
    property string ifaceSetting: (pluginData && pluginData.interface) ? pluginData.interface : "auto"
    property int intervalMs: (pluginData && pluginData.intervalMs) ? parseInt(pluginData.intervalMs) : 1000

    // ── live state ──────────────────────────────────────────────────────
    property string ifaceName: ""
    property real rxRate: 0
    property real txRate: 0
    property string totalText: "0B"

    property real _rxPrev: -1
    property real _txPrev: -1
    property real _rxSmooth: 0
    property real _txSmooth: 0

    // ── sampler ─────────────────────────────────────────────────────────
    Process {
        id: procReader
        command: ["cat", "/proc/net/dev"]
        stdout: StdioCollector {
            id: collector
            onStreamFinished: {
                let raw = collector.text;
                if (typeof raw === "function")
                    raw = raw();
                const content = String(raw);
                if (!content)
                    return;

                const stats = Core.NetDevCore.parseNetDev(content);
                const iface = Core.NetDevCore.pickInterface(stats, root.ifaceSetting);
                if (!iface)
                    return;

                const curr = stats[iface];
                if (root.ifaceName !== iface) {
                    root.ifaceName = iface;
                    root._rxPrev = -1;
                    root._txPrev = -1;
                }

                if (root._rxPrev >= 0) {
                    const dt = root.intervalMs / 1000;
                    const rx = Math.max(0, (curr.rx - root._rxPrev) / dt);
                    const tx = Math.max(0, (curr.tx - root._txPrev) / dt);
                    root._rxSmooth = Core.NetDevCore.smooth(root._rxSmooth, rx);
                    root._txSmooth = Core.NetDevCore.smooth(root._txSmooth, tx);
                }
                root._rxPrev = curr.rx;
                root._txPrev = curr.tx;

                root.rxRate = root._rxSmooth;
                root.txRate = root._txSmooth;
                root.totalText = Core.NetDevCore.formatBytesCompact(curr.rx + curr.tx);
            }
        }
    }

    Timer {
        interval: root.intervalMs
        repeat: true
        running: true
        triggeredOnStart: true
        onTriggered: procReader.running = true
    }

    // ── vertical bar pill ───────────────────────────────────────────────
    verticalBarPill: Component {
        Column {
            spacing: 2

            DankIcon {
                name: "swap_vert"
                size: Theme.iconSizeSmall
                color: Theme.widgetIconColor
                anchors.horizontalCenter: parent.horizontalCenter
            }

            StyledText {
                text: "↑ " + Core.NetDevCore.formatRateCompact(root.txRate)
                font.pixelSize: Theme.fontSizeSmall
                color: Theme.widgetTextColor
                anchors.horizontalCenter: parent.horizontalCenter
            }

            StyledText {
                text: "↓ " + Core.NetDevCore.formatRateCompact(root.rxRate)
                font.pixelSize: Theme.fontSizeSmall
                color: Theme.widgetTextColor
                anchors.horizontalCenter: parent.horizontalCenter
            }

            StyledText {
                text: "Σ " + root.totalText
                font.pixelSize: Theme.fontSizeSmall
                color: Theme.widgetTextColor
                anchors.horizontalCenter: parent.horizontalCenter
            }
        }
    }

    // ── horizontal bar pill ─────────────────────────────────────────────
    horizontalBarPill: Component {
        Row {
            spacing: Theme.spacingS

            DankIcon {
                name: "swap_vert"
                size: Theme.iconSizeSmall
                color: Theme.widgetIconColor
                anchors.verticalCenter: parent.verticalCenter
            }

            StyledText {
                text: "↓ " + Core.NetDevCore.formatRateCompact(root.rxRate)
                font.pixelSize: Theme.fontSizeSmall
                color: Theme.widgetTextColor
                anchors.verticalCenter: parent.verticalCenter
            }

            StyledText {
                text: "↑ " + Core.NetDevCore.formatRateCompact(root.txRate)
                font.pixelSize: Theme.fontSizeSmall
                color: Theme.widgetTextColor
                anchors.verticalCenter: parent.verticalCenter
            }

            StyledText {
                text: "Σ " + root.totalText
                font.pixelSize: Theme.fontSizeSmall
                color: Theme.widgetTextColor
                anchors.verticalCenter: parent.verticalCenter
            }
        }
    }
}
