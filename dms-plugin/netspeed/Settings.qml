import QtQuick
import qs.Common
import qs.Modules.Plugins
import qs.Widgets

PluginSettings {
    id: root
    pluginId: "netspeed"

    StyledText {
        width: parent.width
        text: "Network Speed"
        font.pixelSize: Theme.fontSizeLarge
        font.weight: Font.Bold
        color: Theme.surfaceText
    }

    StyledText {
        width: parent.width
        text: "Live download / upload speed and total data consumed, read from /proc/net/dev."
        font.pixelSize: Theme.fontSizeSmall
        color: Theme.surfaceVariantText
        wrapMode: Text.WordWrap
    }

    StringSetting {
        settingKey: "interface"
        label: "Interface"
        description: "Interface to watch. Leave as auto for the busiest non-virtual interface."
        placeholder: "auto"
        defaultValue: "auto"
    }

    SelectionSetting {
        settingKey: "intervalMs"
        label: "Update interval"
        description: "How often the counters are sampled."
        options: [
            { label: "1 second", value: "1000" },
            { label: "2 seconds", value: "2000" },
            { label: "5 seconds", value: "5000" }
        ]
        defaultValue: "1000"
    }
}
