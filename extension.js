import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init(ext, settings) {
        super._init(0.0, 'Extension Profiles');
        this._ext = ext;
        this._settings = settings;

        const iconFile = Gio.File.new_for_path(ext.path + '/icons/extension-profiles-symbolic.svg');
        this.add_child(new St.Icon({
            gicon: new Gio.FileIcon({file: iconFile}),
            style_class: 'system-status-icon',
        }));

        this._rebuild();
        this._profilesId = settings.connect('changed::profiles', () => this._rebuild());
        this._activeId = settings.connect('changed::active-profile', () => this._rebuild());
    }

    _rebuild() {
        this.menu.removeAll();

        let profiles = {};
        try {
            profiles = JSON.parse(this._settings.get_string('profiles'));
        } catch {
        }

        const active = this._settings.get_string('active-profile');

        for (const [name, uuids] of Object.entries(profiles)) {
            const item = new PopupMenu.PopupMenuItem(name);
            if (name === active)
                item.setOrnament(PopupMenu.Ornament.DOT);
            item.connect('activate', () => this._ext.applyProfile(name, uuids));
            this.menu.addMenuItem(item);
        }

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        const prefsItem = new PopupMenu.PopupMenuItem('Preferences…');
        prefsItem.connect('activate', () => this._ext.openPreferences());
        this.menu.addMenuItem(prefsItem);
    }

    destroy() {
        this._settings.disconnect(this._profilesId);
        this._settings.disconnect(this._activeId);
        this._profilesId = null;
        this._activeId = null;
        super.destroy();
    }
});

export default class ExtensionProfiles extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new Indicator(this, this._settings);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        if (!this._startupDone) {
            this._startupDone = true;
            this._applyStartupProfile();
        }
    }

    disable() {
        if (this._applySourceId) {
            GLib.Source.remove(this._applySourceId);
            this._applySourceId = null;
        }
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;
    }

    _applyStartupProfile() {
        const mode = this._settings.get_string('startup-mode');
        if (mode === 'none')
            return;

        let profileName = null;
        if (mode === 'last')
            profileName = this._settings.get_string('active-profile');
        else if (mode === 'default')
            profileName = this._settings.get_string('default-profile');

        if (!profileName)
            return;

        let profiles = {};
        try {
            profiles = JSON.parse(this._settings.get_string('profiles'));
        } catch {
        }

        const uuids = profiles[profileName];
        if (uuids)
            this.applyProfile(profileName, uuids);
    }

    applyProfile(profileName, extensions) {
        if (this._applySourceId) {
            GLib.Source.remove(this._applySourceId);
        }

        this._applySourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._applySourceId = null;
            this._doApply(profileName, extensions);
            return GLib.SOURCE_REMOVE;
        });
    }

    _doApply(profileName, extensions) {
        const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});

        const newEnabled = new Set(extensions);

        const alwaysEnabled = this._settings.get_strv('always-enabled');
        for (const uuid of alwaysEnabled) {
            newEnabled.add(uuid);
        }

        newEnabled.add(this.uuid);

        shellSettings.set_strv('enabled-extensions', [...newEnabled]);

        this._settings.set_string('active-profile', profileName);
    }
}