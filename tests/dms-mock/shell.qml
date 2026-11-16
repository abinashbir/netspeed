import QtQuick

Item {
    id: shell
    property int status: -1

    Loader {
        id: loader
        source: "netspeed/BandwidthWidget.qml"
        onLoaded: {
            console.warn("DMS-WIDGET-LOADED");
            try {
                const v = loader.item.instantiatePill("vertical");
                const h = loader.item.instantiatePill("horizontal");
                console.warn("DMS-PILLS-OK vertical=" + (v ? "yes" : "no") + " horizontal=" + (h ? "yes" : "no"));
            } catch (e) {
                console.warn("DMS-PILL-FAILED " + e);
            }
        }
    }

    Connections {
        target: loader
        function onStatusChanged() {
            console.warn("DMS-LOADER-STATUS " + loader.status + " " + loader.errorString);
            if (loader.status === Loader.Error)
                console.warn("DMS-WIDGET-ERROR " + loader.errorString);
        }
    }

    Timer {
        interval: 2000
        running: true
        repeat: true
        onTriggered: {
            if (!loader.item)
                return;
            console.warn("DMS-SAMPLE iface=" + loader.item.ifaceName
                + " rx=" + loader.item.rxRate.toFixed(0)
                + " tx=" + loader.item.txRate.toFixed(0)
                + " total=" + loader.item.totalText);
        }
    }
}
