import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Gtk from 'gi://Gtk';
import Adw from 'gi://Adw';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ExtensionProfilesPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._window = window;
        this._extRows = [];
        this._rebuilding = false;
        this._defaultProfileSelectedId = null;

        this._loadProfiles();
        this._installed = this._getInstalledExtensions();

        const profileNames = Object.keys(this._profiles);
        this._editing = profileNames.length > 0 ? profileNames[0] : null;

        const page = new Adw.PreferencesPage();
        window.add(page);

        const startupGroup = new Adw.PreferencesGroup({title: 'Startup'});
        page.add(startupGroup);

        const modeRow = new Adw.ComboRow({
            title: 'On login',
            subtitle: 'Which profile to apply when GNOME Shell starts',
            model: new Gtk.StringList(),
        });
        modeRow.model.append('Do nothing');
        modeRow.model.append('Restore last used profile');
        modeRow.model.append('Apply a default profile');

        const modeMap = ['none', 'last', 'default'];
        const currentMode = this._settings.get_string('startup-mode');
        modeRow.set_selected(Math.max(0, modeMap.indexOf(currentMode)));
        modeRow.connect('notify::selected', () => {
            this._settings.set_string('startup-mode', modeMap[modeRow.selected]);
            this._defaultProfileRow.set_sensitive(modeRow.selected === 2);
        });
        startupGroup.add(modeRow);

        this._defaultProfileRow = new Adw.ComboRow({
            title: 'Default profile',
            sensitive: currentMode === 'default',
        });
        this._settings.connect('changed::profiles', () => this._refreshDefaultProfileCombo());
        startupGroup.add(this._defaultProfileRow);
        this._refreshDefaultProfileCombo();

        this._mgmtGroup = new Adw.PreferencesGroup({title: 'Profiles'});
        page.add(this._mgmtGroup);

        const newRow = new Adw.ActionRow({title: 'New profile'});
        this._nameEntry = new Gtk.Entry({
            placeholder_text: 'e.g. Work, Gaming, Minimal',
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        const addButton = new Gtk.Button({
            label: 'Create',
            valign: Gtk.Align.CENTER,
            css_classes: ['suggested-action'],
        });
        addButton.connect('clicked', () => this._createProfile());
        newRow.add_suffix(this._nameEntry);
        newRow.add_suffix(addButton);
        this._mgmtGroup.add(newRow);

        this._comboRow = new Adw.ComboRow({title: 'Edit profile'});
        this._comboRow.connect('notify::selected-item', () => {
            if (this._rebuilding)
                return;
            const item = this._comboRow.get_selected_item();
            if (item) {
                this._editing = item.get_string();
                this._rebuildExtRows();
            }
        });

        const deleteButton = new Gtk.Button({
            icon_name: 'user-trash-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['destructive-action'],
            tooltip_text: 'Delete this profile',
        });
        deleteButton.connect('clicked', () => this._deleteProfile());
        this._comboRow.add_suffix(deleteButton);
        this._mgmtGroup.add(this._comboRow);

        this._renameRow = new Adw.EntryRow({
            title: 'Rename profile',
            show_apply_button: true,
        });
        this._renameRow.connect('apply', () => this._renameProfile());
        this._mgmtGroup.add(this._renameRow);

        this._syncRow = new Adw.ActionRow({
            title: 'Sync from system',
            subtitle: 'Overwrite this profile with currently enabled extensions',
        });
        const syncButton = new Gtk.Button({
            icon_name: 'emblem-synchronizing-symbolic',
            valign: Gtk.Align.CENTER,
        });
        syncButton.connect('clicked', () => this._syncFromSystem());
        this._syncRow.add_suffix(syncButton);
        this._mgmtGroup.add(this._syncRow);

        this._extGroup = new Adw.PreferencesGroup();
        page.add(this._extGroup);

        const refreshButton = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Refresh extension list',
        });
        refreshButton.connect('clicked', () => {
            this._installed = this._getInstalledExtensions();
            this._rebuildExtRows();
        });
        this._extGroup.set_header_suffix(refreshButton);

        this._refreshCombo();
    }

    _refreshDefaultProfileCombo() {
        if (this._defaultProfileSelectedId) {
            this._defaultProfileRow.disconnect(this._defaultProfileSelectedId);
            this._defaultProfileSelectedId = null;
        }

        const names = Object.keys(this._profiles);
        const model = new Gtk.StringList();
        for (const name of names)
            model.append(name);

        this._defaultProfileRow.set_model(model);

        const current = this._settings.get_string('default-profile');
        const idx = names.indexOf(current);
        this._defaultProfileRow.set_selected(idx > -1 ? idx : 0);

        this._defaultProfileSelectedId = this._defaultProfileRow.connect('notify::selected', () => {
            const item = this._defaultProfileRow.get_selected_item();
            if (item)
                this._settings.set_string('default-profile', item.get_string());
        });
    }

    _createProfile() {
        const name = this._nameEntry.get_text().trim();
        if (!name || this._profiles[name])
            return;

        this._profiles[name] = [];
        this._editing = name;
        this._saveProfiles();
        this._nameEntry.set_text('');
        this._refreshCombo();
    }

    _deleteProfile() {
        if (!this._editing)
            return;

        const dialog = new Adw.MessageDialog({
            heading: `Delete "${this._editing}"?`,
            body: 'This cannot be undone. No extensions will be changed.',
            transient_for: this._window,
        });
        dialog.add_response('cancel', 'Cancel');
        dialog.add_response('delete', 'Delete');
        dialog.set_response_appearance('delete', Adw.ResponseAppearance.DESTRUCTIVE);
        dialog.set_default_response('cancel');
        dialog.set_close_response('cancel');
        dialog.connect('response', (_d, id) => {
            if (id === 'delete') {
                delete this._profiles[this._editing];
                this._saveProfiles();
                const remaining = Object.keys(this._profiles);
                this._editing = remaining.length > 0 ? remaining[0] : null;
                this._refreshCombo();
            }
            dialog.destroy();
        });
        dialog.present();
    }

    _renameProfile() {
        const newName = this._renameRow.get_text().trim();
        if (!newName || newName === this._editing || this._profiles[newName])
            return;

        this._profiles[newName] = this._profiles[this._editing];
        delete this._profiles[this._editing];

        if (this._settings.get_string('active-profile') === this._editing)
            this._settings.set_string('active-profile', newName);

        if (this._settings.get_string('default-profile') === this._editing)
            this._settings.set_string('default-profile', newName);

        this._editing = newName;
        this._saveProfiles();
        this._renameRow.set_text('');
        this._refreshCombo();
    }

    _syncFromSystem() {
        if (!this._editing)
            return;

        const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        this._profiles[this._editing] = shellSettings.get_strv('enabled-extensions')
            .filter(u => u !== this.metadata.uuid);
        this._saveProfiles();
        this._rebuildExtRows();
    }

    _refreshCombo() {
        this._rebuilding = true;

        const names = Object.keys(this._profiles);
        const model = new Gtk.StringList();
        for (const name of names)
            model.append(name);

        this._comboRow.set_model(model);

        const hasProfiles = names.length > 0;
        this._comboRow.set_sensitive(hasProfiles);
        this._renameRow.set_sensitive(hasProfiles);
        this._syncRow.set_sensitive(hasProfiles);

        if (hasProfiles) {
            const idx = names.indexOf(this._editing);
            this._comboRow.set_selected(idx > -1 ? idx : 0);
            if (idx === -1)
                this._editing = names[0];
        }

        this._rebuilding = false;
        this._rebuildExtRows();
    }

    _rebuildExtRows() {
        for (const row of this._extRows)
            this._extGroup.remove(row);
        this._extRows = [];

        if (!this._editing) {
            this._extGroup.set_title('');
            return;
        }

        this._extGroup.set_title(`Extensions in "${this._editing}"`);

        const profileExts = this._profiles[this._editing];
        const sorted = [...this._installed].sort((a, b) => {
            const aOn = profileExts.includes(a.uuid);
            const bOn = profileExts.includes(b.uuid);
            if (aOn !== bOn)
                return aOn ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        for (const ext of sorted) {
            const row = new Adw.ActionRow({title: ext.name, subtitle: ext.uuid});
            const toggle = new Gtk.Switch({
                active: profileExts.includes(ext.uuid),
                valign: Gtk.Align.CENTER,
            });
            toggle.connect('notify::active', () => {
                const on = toggle.get_active();
                const list = this._profiles[this._editing];
                const idx = list.indexOf(ext.uuid);
                if (on && idx === -1)
                    list.push(ext.uuid);
                else if (!on && idx > -1)
                    list.splice(idx, 1);
                this._saveProfiles();
            });
            row.add_suffix(toggle);
            row.activatable_widget = toggle;
            this._extGroup.add(row);
            this._extRows.push(row);
        }
    }

    _loadProfiles() {
        try {
            const parsed = JSON.parse(this._settings.get_string('profiles'));
            this._profiles = typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            this._profiles = {};
        }
    }

    _saveProfiles() {
        this._settings.set_string('profiles', JSON.stringify(this._profiles));
    }

    _getInstalledExtensions() {
        const found = new Map();
        const searchPaths = [
            GLib.build_filenamev([GLib.get_user_data_dir(), 'gnome-shell', 'extensions']),
            '/usr/share/gnome-shell/extensions',
        ];

        for (const searchPath of searchPaths) {
            const dir = Gio.File.new_for_path(searchPath);
            let enumerator;
            try {
                enumerator = dir.enumerate_children(
                    'standard::name,standard::type',
                    Gio.FileQueryInfoFlags.NONE,
                    null
                );
            } catch {
                continue;
            }

            let info;
            while ((info = enumerator.next_file(null)) !== null) {
                if (info.get_file_type() !== Gio.FileType.DIRECTORY)
                    continue;

                const metaFile = dir.get_child(info.get_name()).get_child('metadata.json');
                let contents;
                try {
                    [, contents] = metaFile.load_contents(null);
                } catch {
                    continue;
                }

                try {
                    const meta = JSON.parse(new TextDecoder().decode(contents));
                    if (meta.uuid && meta.uuid !== this.metadata.uuid && !found.has(meta.uuid))
                        found.set(meta.uuid, {uuid: meta.uuid, name: meta.name ?? meta.uuid});
                } catch {
                }
            }
        }

        return [...found.values()];
    }
}
