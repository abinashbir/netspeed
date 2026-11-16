pragma Singleton
import QtQuick
QtObject {
    readonly property int iconSizeSmall: 16
    readonly property int iconSize: 20
    readonly property int fontSizeSmall: 11
    readonly property int fontSizeMedium: 13
    readonly property int fontSizeLarge: 16
    readonly property int spacingS: 4
    readonly property int spacingM: 8
    readonly property color widgetIconColor: "#ffffff"
    readonly property color widgetTextColor: "#ffffff"
    readonly property color surfaceText: "#ffffff"
    readonly property color surfaceVariantText: "#cccccc"
    readonly property color primary: "#88c0d0"
    function barIconSize(t, i, m, s) { return 18; }
    function barTextSize(t, s, m) { return 12; }
}
