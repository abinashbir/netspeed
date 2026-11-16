import QtQuick
Item {
    id: root
    property string pluginId: ""
    property var pluginData: ({})
    property Component horizontalBarPill: null
    property Component verticalBarPill: null
    property Item pillHost: Item {}
    function instantiatePill(which) {
        const c = (which === "vertical") ? verticalBarPill : horizontalBarPill;
        if (!c) return null;
        return c.createObject(pillHost);
    }
}
