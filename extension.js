import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Shell from 'gi://Shell';
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';

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

        this._box = new St.BoxLayout({style_class: 'panel-status-indicators-box'});

        const iconFile = Gio.File.new_for_path(`${ext.path}/icons/extension-profiles-symbolic.svg`);
        this._icon = new St.Icon({
            gicon: new Gio.FileIcon({file: iconFile}),
            style_class: 'system-status-icon',
        });

        this._label = new St.Label({
            text: 'Profiles',
            y_align: Clutter.ActorAlign.CENTER,
            style: 'margin-left: 5px; margin-right: 5px;',
        });

        this._box.add_child(this._icon);
        this._box.add_child(this._label);
        this.add_child(this._box);

        this._rebuild();
        this._profilesId = settings.connect('changed::profiles', () => this._rebuild());
        this._activeId = settings.connect('changed::active-profile', () => this._rebuild());
        this._styleId = settings.connect('changed::indicator-style', () => this._updateStyle());
    }

    _rebuild() {
        this.menu.removeAll();

        let profiles = {};
        try {
            const parsed = JSON.parse(this._settings.get_string('profiles'));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
                profiles = parsed;
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

        this._updateStyle();
    }

    _updateStyle() {
        const style = this._settings.get_int('indicator-style');
        const active = this._settings.get_string('active-profile');
        this._label.set_text(active || 'Profiles');

        this._icon.show();
        this._label.show();
        this.show();

        if (style === 0)
            this._label.hide();
        else if (style === 2)
            this._icon.hide();
        else if (style === 3)
            this.hide();
    }

    destroy() {
        if (this._profilesId) {
            this._settings?.disconnect(this._profilesId);
            this._profilesId = null;
        }
        if (this._activeId) {
            this._settings?.disconnect(this._activeId);
            this._activeId = null;
        }
        if (this._styleId) {
            this._settings?.disconnect(this._styleId);
            this._styleId = null;
        }
        this._settings = null;
        this._ext = null;
        super.destroy();
    }
});

export default class ExtensionProfiles extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._indicator = new Indicator(this, this._settings);
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        this._alwaysEnabledId = this._settings.connect(
            'changed::always-enabled',
            () => this._syncAlwaysEnabled()
        );

        Main.wm.addKeybinding(
            'shortcut-key',
            this._settings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.ALL,
            () => {
                if (this._indicator)
                    this._indicator.menu.toggle();
            }
        );

        if (!this._startupDone) {
            this._startupDone = true;
            this._applyStartupProfile();
        }
    }

    disable() {
        Main.wm.removeKeybinding('shortcut-key');

        if (this._alwaysEnabledId) {
            this._settings?.disconnect(this._alwaysEnabledId);
            this._alwaysEnabledId = null;
        }
        if (this._applySourceId) {
            GLib.Source.remove(this._applySourceId);
            this._applySourceId = null;
        }
        if (this._followupSourceId) {
            GLib.Source.remove(this._followupSourceId);
            this._followupSourceId = null;
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
            const parsed = JSON.parse(this._settings.get_string('profiles'));
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
                profiles = parsed;
        } catch {
        }

        const uuids = profiles[profileName];
        if (Array.isArray(uuids))
            this.applyProfile(profileName, uuids);
    }

    applyProfile(profileName, extensions) {
        if (this._applySourceId)
            GLib.Source.remove(this._applySourceId);

        this._applySourceId = GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
            this._applySourceId = null;
            this._doApply(profileName, Array.isArray(extensions) ? extensions : []);
            return GLib.SOURCE_REMOVE;
        });
    }

    _arraysEqual(a, b) {
        if (a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i])
                return false;
        }
        return true;
    }

    _applyShellLists(nextEnabled, enableTargetSet) {
        if (this._followupSourceId) {
            GLib.Source.remove(this._followupSourceId);
            this._followupSourceId = null;
        }

        const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        const currentEnabled = shellSettings.get_strv('enabled-extensions');
        const currentDisabled = shellSettings.get_strv('disabled-extensions');

        const nextDisabled = currentDisabled.filter(uuid => !enableTargetSet.has(uuid));
        const disabledChanged = nextDisabled.length !== currentDisabled.length;
        const enabledChanged = !this._arraysEqual(currentEnabled, nextEnabled);

        if (disabledChanged) {
            const reEnabledFromCurrent = currentDisabled.some(
                uuid => enableTargetSet.has(uuid) && currentEnabled.includes(uuid)
            );
            shellSettings.set_strv('disabled-extensions', nextDisabled);
            if (enabledChanged) {
                if (reEnabledFromCurrent) {
                    this._followupSourceId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 50, () => {
                        this._followupSourceId = null;
                        shellSettings.set_strv('enabled-extensions', nextEnabled);
                        return GLib.SOURCE_REMOVE;
                    });
                } else {
                    shellSettings.set_strv('enabled-extensions', nextEnabled);
                }
            }
        } else if (enabledChanged) {
            shellSettings.set_strv('enabled-extensions', nextEnabled);
        }
    }

    _syncAlwaysEnabled() {
        const alwaysEnabled = this._settings.get_strv('always-enabled');
        if (alwaysEnabled.length === 0)
            return;

        const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        const currentEnabled = shellSettings.get_strv('enabled-extensions');
        const nextEnabled = [...currentEnabled];
        for (const uuid of alwaysEnabled) {
            if (!nextEnabled.includes(uuid))
                nextEnabled.push(uuid);
        }

        this._applyShellLists(nextEnabled, new Set(alwaysEnabled));
    }

    _doApply(profileName, extensions) {
        const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        const alwaysEnabled = this._settings.get_strv('always-enabled');
        const orderedDesired = [this.uuid, ...alwaysEnabled, ...extensions];
        const targetSet = new Set(orderedDesired);
        const currentEnabled = shellSettings.get_strv('enabled-extensions');

        // Keep existing order of extensions that remain active to minimize
        // unnecessary disable/re-enable cycling by GNOME Shell.
        const nextEnabled = [];
        const seen = new Set();
        for (const uuid of currentEnabled) {
            if (targetSet.has(uuid) && !seen.has(uuid)) {
                nextEnabled.push(uuid);
                seen.add(uuid);
            }
        }
        for (const uuid of orderedDesired) {
            if (!seen.has(uuid)) {
                nextEnabled.push(uuid);
                seen.add(uuid);
            }
        }

        this._applyShellLists(nextEnabled, targetSet);
        this._settings.set_string('active-profile', profileName);
    }
}
