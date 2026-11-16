// Minimal stand-ins for the GNOME Shell APIs the extension uses, so the
// extension logic can be executed (and bugs caught) outside gnome-shell.
// Used only by tests/run-harness.py - never shipped.

export const Clutter = {
    ActorAlign: {CENTER: 1},
};

export const GLib = {
    PRIORITY_DEFAULT: 0,
    SOURCE_CONTINUE: true,
    _timerId: 0,
    build_filenamev(parts) {
        return parts.join('/');
    },
    get_user_config_dir() {
        return '/tmp/opencode/harness-config';
    },
    get_monotonic_time() {
        return GLib._time = (GLib._time || 1000000) + 1000000; // +1s per call
    },
    file_get_contents(path) {
        try {
            const [ok, bytes] = GLib._readFile(path);
            return [ok, bytes];
        } catch (e) {
            return [false, null];
        }
    },
    file_set_contents(path, contents) {
        GLib._written = {path, contents};
        return true;
    },
    timeout_add_seconds(priority, interval, callback) {
        GLib._timerId++;
        GLib._callbacks = GLib._callbacks || [];
        GLib._callbacks.push(callback);
        return GLib._timerId;
    },
    source_remove(id) {
        return true;
    },
    // test helper
    _readFile(path) {
        const Gio = imports.gi.Gio;
        const file = Gio.File.new_for_path(path);
        const [ok, bytes] = file.load_contents(null);
        return [ok, bytes];
    },
};

export class St {
    static Label = class Label {
        constructor(params = {}) {
            this.text = params.text || '';
            this._classes = [];
        }
        add_style_class_name(name) {
            this._classes.push(name);
        }
        set_text(text) {
            this.text = text;
            globalThis.__harness.lastLabel = text;
        }
    };
}

export const Main = {
    panel: {
        _items: {},
        addToStatusArea(role, indicator, position, box) {
            if (this._items[role])
                throw new Error(`Extension point conflict: ${role}`);
            this._items[role] = indicator;
            globalThis.__harness.added = {role, box, indicator};
        },
    },
};

class FakeMenuItem {
    constructor(text, params = {}) {
        this.label = {text, set_text: t => (this.label.text = t)};
        this._params = params;
        this._connectors = {};
        this.label_actor = this.label;
    }
    connect(signal, cb) {
        this._connectors[signal] = cb;
    }
    activate() {
        if (this._connectors['activate'])
            this._connectors['activate']();
    }
}

export const PopupMenu = {
    PopupMenuItem: FakeMenuItem,
    PopupSeparatorMenuItem: class extends FakeMenuItem {},
    PopupSubMenuMenuItem: class extends FakeMenuItem {
        constructor(text) {
            super(text);
            this.menu = new FakeMenu();
        }
    },
};

class FakeMenu {
    constructor() {
        this._items = [];
        this._connectors = {};
    }
    addMenuItem(item) {
        this._items.push(item);
    }
    removeAll() {
        this._items = [];
    }
    close() {}
    connect(signal, cb) {
        this._connectors[signal] = cb;
    }
    open() {
        if (this._connectors['open-state-changed'])
            this._connectors['open-state-changed'](this, true);
    }
    get items() {
        return this._items;
    }
}

export const PanelMenu = {
    Button: class Button {
        constructor(alignment, nameText, dontCreateMenu) {
            this.alignment = alignment;
            this.nameText = nameText;
            this.menu = new FakeMenu();
            this._children = [];
        }
        add_child(child) {
            this._children.push(child);
        }
        destroy() {
            globalThis.__harness.destroyed = true;
        }
    },
};

export class Extension {
    constructor() {}
    getSettings() {
        throw new Error('not used');
    }
}
