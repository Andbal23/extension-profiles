import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

const EXTENSION_STATE_OUT_OF_DATE = 4;

export default class ExtensionProfilesPrefs extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        this._settings = this.getSettings();
        this._window = window;
        this._extRows = [];
        this._orderRows = [];
        this._alwaysOnRows = [];
        this._rebuilding = false;
        this._defaultProfileSelectedId = null;

        this._loadProfiles();
        this._installed = this._getInstalledExtensions();

        const profileNames = Object.keys(this._profiles);
        this._editing = profileNames.length > 0 ? profileNames[0] : null;

        const pageProfiles = new Adw.PreferencesPage({
            title: 'Profiles',
            icon_name: 'view-list-symbolic',
        });
        window.add(pageProfiles);

        const startupGroup = new Adw.PreferencesGroup({title: 'Startup'});
        pageProfiles.add(startupGroup);

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
        this._profilesChangedId = this._settings.connect('changed::profiles', () => {
            this._refreshDefaultProfileCombo();
        });
        startupGroup.add(this._defaultProfileRow);
        this._refreshDefaultProfileCombo();

        const appearanceGroup = new Adw.PreferencesGroup({title: 'Appearance & Interaction'});
        pageProfiles.add(appearanceGroup);

        const styleRow = new Adw.ComboRow({
            title: 'Panel Indicator Style',
            subtitle: 'Choose how the extension looks on the top panel',
            model: new Gtk.StringList({strings: ['Icon only', 'Icon + Text', 'Text only', 'Hidden']}),
            selected: this._settings.get_int('indicator-style'),
        });
        styleRow.connect('notify::selected', () => {
            this._settings.set_int('indicator-style', styleRow.selected);
        });
        appearanceGroup.add(styleRow);

        const shortcutRow = new Adw.EntryRow({
            title: 'Keyboard Shortcut',
            text: this._settings.get_strv('shortcut-key')[0] || '',
            show_apply_button: true,
        });
        shortcutRow.connect('apply', () => {
            this._settings.set_strv('shortcut-key', [shortcutRow.get_text()]);
        });
        appearanceGroup.add(shortcutRow);

        this._mgmtGroup = new Adw.PreferencesGroup({title: 'Profiles'});
        pageProfiles.add(this._mgmtGroup);

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

        this._orderGroup = new Adw.PreferencesGroup({
            title: 'Profile Order',
            description: 'Drag rows or use the arrows to change the order shown in the selector menu.',
        });
        pageProfiles.add(this._orderGroup);

        const backupGroup = new Adw.PreferencesGroup({title: 'Backup & Restore'});
        pageProfiles.add(backupGroup);

        const exportRow = new Adw.ActionRow({title: 'Export Profiles'});
        const exportBtn = new Gtk.Button({label: 'Export', valign: Gtk.Align.CENTER});
        exportBtn.connect('clicked', () => {
            const data = this._settings.get_string('profiles');
            const dialog = new Gtk.FileDialog({
                title: 'Save Profiles Backup',
                initial_name: 'extension-profiles-backup.json',
            });
            dialog.save(this._window, null, (dlg, res) => {
                try {
                    const file = dlg.save_finish(res);
                    if (file) {
                        const bytes = new GLib.Bytes(new TextEncoder().encode(data));
                        file.replace_contents_bytes_async(
                            bytes, null, false,
                            Gio.FileCreateFlags.REPLACE_DESTINATION,
                            null, null
                        );
                    }
                } catch (e) {
                    if (!e.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED))
                        console.error(e);
                }
            });
        });
        exportRow.add_suffix(exportBtn);
        backupGroup.add(exportRow);

        const importRow = new Adw.ActionRow({title: 'Import Profiles'});
        const importBtn = new Gtk.Button({label: 'Import', valign: Gtk.Align.CENTER});
        importBtn.connect('clicked', () => {
            const dialog = new Gtk.FileDialog({title: 'Open Profiles Backup'});
            dialog.open(this._window, null, (dlg, res) => {
                try {
                    const file = dlg.open_finish(res);
                    if (file) {
                        file.load_contents_async(null, (f, r) => {
                            try {
                                const [ok, contents] = f.load_contents_finish(r);
                                if (ok) {
                                    const data = new TextDecoder().decode(contents);
                                    const parsed = JSON.parse(data);
                                    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
                                        return;
                                    this._settings.set_string('profiles', data);
                                    this._loadProfiles();
                                    this._refreshCombo();
                                }
                            } catch (e) {
                                console.error(e);
                            }
                        });
                    }
                } catch (e) {
                    if (!e.matches?.(Gtk.DialogError, Gtk.DialogError.DISMISSED))
                        console.error(e);
                }
            });
        });
        importRow.add_suffix(importBtn);
        backupGroup.add(importRow);

        this._extGroup = new Adw.PreferencesGroup();
        pageProfiles.add(this._extGroup);

        const refreshButton = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            valign: Gtk.Align.CENTER,
            css_classes: ['flat'],
            tooltip_text: 'Refresh extension list',
        });
        refreshButton.connect('clicked', () => {
            this._installed = this._getInstalledExtensions();
            this._rebuildExtRows();
            this._rebuildAlwaysOnRows();
        });
        this._extGroup.set_header_suffix(refreshButton);

        const pageAlwaysOn = new Adw.PreferencesPage({
            title: 'Always Enabled',
            icon_name: 'security-high-symbolic',
        });
        window.add(pageAlwaysOn);

        this._alwaysOnGroup = new Adw.PreferencesGroup({
            title: 'Whitelist',
            description: 'These extensions will NEVER be disabled, regardless of which profile is active.',
        });
        pageAlwaysOn.add(this._alwaysOnGroup);

        this._rebuildAlwaysOnRows();

        const aboutPage = new Adw.PreferencesPage({
            title: 'About',
            icon_name: 'help-about-symbolic',
        });

        const whatsNewGroup = new Adw.PreferencesGroup({
            title: "What's New",
        });

        const v2Row = new Adw.ExpanderRow({
            title: 'v2.0 - GNOME 51 Support & Usability Fixes',
            subtitle: 'Profile reordering, incompatible indicator & whitelist fixes',
            expanded: true,
        });

        const v2Notes = new Gtk.Label({
            label:
                '• Added GNOME 51 support.\n' +
                '• Profile Ordering: Drag-and-drop or use arrow buttons to customize the order of profiles in the selector menu.\n' +
                '• Incompatible Indicator: Displays a red warning clock icon next to extensions incompatible with the current GNOME Shell version.\n' +
                '• Whitelist & Switching Fixes: Clears GNOME Shell disabled-extensions when enabling profile or whitelisted entries, immediately applies whitelist additions, and preserves active extension order during switches.',
            justify: Gtk.Justification.LEFT,
            xalign: 0,
            wrap: true,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 15,
            margin_end: 15,
        });
        v2Row.add_row(v2Notes);
        whatsNewGroup.add(v2Row);

        const releaseRow = new Adw.ExpanderRow({
            title: 'v1.0 - Initial Release',
            subtitle: 'Whitelist & Core Features',
            expanded: false,
        });

        const releaseNotes = new Gtk.Label({
            label: '• Extension Profiles: Create, manage, and instantly switch between different sets of GNOME extensions.\n' +
                   '• Whitelist (Always Enabled): Keep your essential extensions running safely regardless of the active profile.\n' +
                   '• Keyboard Shortcut & Customization: Toggle profiles via a shortcut or configure how the tray icon looks.\n' +
                   '• Backup & Restore: Export your profiles as a JSON file and import them anytime.\n' +
                   '• Smart Startup: Choose what happens when you log in (Restore last used, apply a default, or do nothing).\n' +
                   '• Sync from System: Easily overwrite any profile with the exact extensions you currently have enabled in GNOME.',
            justify: Gtk.Justification.LEFT,
            xalign: 0,
            wrap: true,
            margin_top: 10,
            margin_bottom: 10,
            margin_start: 15,
            margin_end: 15,
        });

        releaseRow.add_row(releaseNotes);
        whatsNewGroup.add(releaseRow);
        aboutPage.add(whatsNewGroup);

        const supportGroup = new Adw.PreferencesGroup({
            title: 'Support the Project',
        });

        const kofiRow = new Adw.ActionRow({
            title: 'Support on Ko-fi',
            subtitle: 'Buy me a coffee on Ko-fi',
        });
        const kofiBtn = new Gtk.Button({label: 'Open', valign: Gtk.Align.CENTER, css_classes: ['suggested-action']});
        kofiBtn.connect('clicked', () => Gio.AppInfo.launch_default_for_uri('https://ko-fi.com/andbal', null));
        kofiRow.add_suffix(kofiBtn);
        supportGroup.add(kofiRow);

        const bmacRow = new Adw.ActionRow({
            title: 'Buy Me a Coffee',
            subtitle: 'Support via BuyMeACoffee',
        });
        const bmacBtn = new Gtk.Button({label: 'Open', valign: Gtk.Align.CENTER, css_classes: ['suggested-action']});
        bmacBtn.connect('clicked', () => Gio.AppInfo.launch_default_for_uri('https://buymeacoffee.com/andbal', null));
        bmacRow.add_suffix(bmacBtn);
        supportGroup.add(bmacRow);

        const paypalRow = new Adw.ActionRow({
            title: 'Support via PayPal',
            subtitle: 'Direct donation via PayPal',
        });
        const paypalBtn = new Gtk.Button({label: 'Open', valign: Gtk.Align.CENTER, css_classes: ['suggested-action']});
        paypalBtn.connect('clicked', () => Gio.AppInfo.launch_default_for_uri('https://paypal.me/andraslaszlo23', null));
        paypalRow.add_suffix(paypalBtn);
        supportGroup.add(paypalRow);

        const githubRow = new Adw.ActionRow({
            title: 'Source Code',
            subtitle: 'Report bugs or view source on GitHub',
        });
        const githubBtn = new Gtk.Button({icon_name: 'external-link-symbolic', valign: Gtk.Align.CENTER});
        githubBtn.connect('clicked', () => Gio.AppInfo.launch_default_for_uri('https://github.com/Andbal23/extension-profiles', null));
        githubRow.add_suffix(githubBtn);
        supportGroup.add(githubRow);

        aboutPage.add(supportGroup);

        const promoGroup = new Adw.PreferencesGroup({
            title: 'Check Out My Other Extensions',
        });

        const promoRow = new Adw.ActionRow({
            title: 'Dynamic Music Pill',
            subtitle: 'An elegant music player widget with an audio visualizer and seamless integration.',
        });
        const promoBtn = new Gtk.Button({
            label: 'View on GitHub',
            valign: Gtk.Align.CENTER,
        });
        promoBtn.connect('clicked', () => Gio.AppInfo.launch_default_for_uri('https://github.com/Andbal23/dynamic-music-pill', null));
        promoRow.add_suffix(promoBtn);
        promoGroup.add(promoRow);

        aboutPage.add(promoGroup);
        window.add(aboutPage);

        window.connect('close-request', () => {
            if (this._profilesChangedId) {
                this._settings?.disconnect(this._profilesChangedId);
                this._profilesChangedId = null;
            }
            if (this._defaultProfileSelectedId) {
                this._defaultProfileRow?.disconnect(this._defaultProfileSelectedId);
                this._defaultProfileSelectedId = null;
            }
            return false;
        });

        this._refreshCombo();
    }

    _escapeMarkup(text) {
        return text ? GLib.markup_escape_text(String(text), -1) : '';
    }

    _createExtensionRow(ext, isActive, onToggle) {
        const row = new Adw.ActionRow({
            title: this._escapeMarkup(ext.name),
            subtitle: this._escapeMarkup(ext.uuid),
        });

        if (ext.incompatible) {
            const incompatIcon = new Gtk.Image({
                icon_name: 'preferences-system-time-symbolic',
                css_classes: ['error'],
                valign: Gtk.Align.CENTER,
                tooltip_text: 'Incompatible with the current GNOME Shell version',
            });
            row.add_suffix(incompatIcon);
        }

        const toggle = new Gtk.Switch({
            active: isActive,
            valign: Gtk.Align.CENTER,
        });
        toggle.connect('notify::active', () => onToggle(toggle.get_active()));

        row.add_suffix(toggle);
        row.activatable_widget = toggle;
        return row;
    }

    _rebuildAlwaysOnRows() {
        for (const row of this._alwaysOnRows)
            this._alwaysOnGroup.remove(row);
        this._alwaysOnRows = [];

        const alwaysEnabled = this._settings.get_strv('always-enabled');
        const sorted = [...this._installed].sort((a, b) => a.name.localeCompare(b.name));

        for (const ext of sorted) {
            const row = this._createExtensionRow(
                ext,
                alwaysEnabled.includes(ext.uuid),
                (active) => {
                    const currentList = new Set(this._settings.get_strv('always-enabled'));
                    if (active)
                        currentList.add(ext.uuid);
                    else
                        currentList.delete(ext.uuid);
                    this._settings.set_strv('always-enabled', [...currentList]);
                }
            );
            this._alwaysOnGroup.add(row);
            this._alwaysOnRows.push(row);
        }
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

        // Preserve insertion order position when renaming a profile key.
        const rebuilt = {};
        for (const [k, v] of Object.entries(this._profiles)) {
            rebuilt[k === this._editing ? newName : k] = v;
        }
        this._profiles = rebuilt;

        if (this._settings.get_string('active-profile') === this._editing)
            this._settings.set_string('active-profile', newName);

        if (this._settings.get_string('default-profile') === this._editing)
            this._settings.set_string('default-profile', newName);

        this._editing = newName;
        this._saveProfiles();
        this._renameRow.set_text('');
        this._refreshCombo();
    }

    _moveProfile(fromName, toIndex) {
        const entries = Object.entries(this._profiles);
        const fromIndex = entries.findIndex(([k]) => k === fromName);
        if (fromIndex === -1 || toIndex < 0 || toIndex >= entries.length || fromIndex === toIndex)
            return;

        const [moved] = entries.splice(fromIndex, 1);
        entries.splice(toIndex, 0, moved);
        this._profiles = Object.fromEntries(entries);
        this._saveProfiles();
        this._refreshCombo();
    }

    _rebuildOrderRows() {
        for (const row of this._orderRows)
            this._orderGroup.remove(row);
        this._orderRows = [];

        const entries = Object.entries(this._profiles);
        if (entries.length === 0) {
            const emptyRow = new Adw.ActionRow({
                title: 'No profiles yet',
                subtitle: 'Create a profile above to manage its order.',
                sensitive: false,
            });
            this._orderGroup.add(emptyRow);
            this._orderRows.push(emptyRow);
            return;
        }

        entries.forEach(([name, uuids], idx) => {
            const count = Array.isArray(uuids) ? uuids.length : 0;
            const row = new Adw.ActionRow({
                title: this._escapeMarkup(name),
                subtitle: `${count} extension${count === 1 ? '' : 's'}`,
            });

            const dragHandle = new Gtk.Image({
                icon_name: 'list-drag-handle-symbolic',
                css_classes: ['dim-label'],
                valign: Gtk.Align.CENTER,
            });
            row.add_prefix(dragHandle);

            const dragSource = new Gtk.DragSource({actions: Gdk.DragAction.MOVE});
            dragSource.connect('prepare', () => {
                const value = new GObject.Value();
                value.init(GObject.TYPE_STRING);
                value.set_string(name);
                return Gdk.ContentProvider.new_for_value(value);
            });
            dragSource.connect('drag-begin', (src) => {
                src.set_icon(Gtk.WidgetPaintable.new(row), 0, 0);
            });
            row.add_controller(dragSource);

            const dropTarget = Gtk.DropTarget.new(GObject.TYPE_STRING, Gdk.DragAction.MOVE);
            dropTarget.connect('drop', (_target, value) => {
                if (typeof value === 'string' && value !== name) {
                    this._moveProfile(value, idx);
                    return true;
                }
                return false;
            });
            row.add_controller(dropTarget);

            const btnBox = new Gtk.Box({spacing: 4, valign: Gtk.Align.CENTER});
            const upBtn = new Gtk.Button({
                icon_name: 'go-up-symbolic',
                css_classes: ['flat'],
                valign: Gtk.Align.CENTER,
                sensitive: idx > 0,
                tooltip_text: 'Move up',
            });
            upBtn.connect('clicked', () => this._moveProfile(name, idx - 1));

            const downBtn = new Gtk.Button({
                icon_name: 'go-down-symbolic',
                css_classes: ['flat'],
                valign: Gtk.Align.CENTER,
                sensitive: idx < entries.length - 1,
                tooltip_text: 'Move down',
            });
            downBtn.connect('clicked', () => this._moveProfile(name, idx + 1));

            btnBox.append(upBtn);
            btnBox.append(downBtn);
            row.add_suffix(btnBox);

            this._orderGroup.add(row);
            this._orderRows.push(row);
        });
    }

    _syncFromSystem() {
        if (!this._editing)
            return;

        const shellSettings = new Gio.Settings({schema_id: 'org.gnome.shell'});
        const disabled = new Set(shellSettings.get_strv('disabled-extensions'));
        this._profiles[this._editing] = shellSettings.get_strv('enabled-extensions')
            .filter(u => u !== this.metadata.uuid && !disabled.has(u));
        this._saveProfiles();
        this._rebuildExtRows();
        this._rebuildOrderRows();
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
        } else {
            this._editing = null;
        }

        this._rebuilding = false;
        this._rebuildOrderRows();
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

        this._extGroup.set_title(this._escapeMarkup(`Extensions in "${this._editing}"`));

        const profileExts = this._profiles[this._editing];
        const sorted = [...this._installed].sort((a, b) => {
            const aOn = profileExts.includes(a.uuid);
            const bOn = profileExts.includes(b.uuid);
            if (aOn !== bOn)
                return aOn ? -1 : 1;
            return a.name.localeCompare(b.name);
        });

        for (const ext of sorted) {
            const row = this._createExtensionRow(
                ext,
                profileExts.includes(ext.uuid),
                (on) => {
                    const list = this._profiles[this._editing];
                    const idx = list.indexOf(ext.uuid);
                    if (on && idx === -1)
                        list.push(ext.uuid);
                    else if (!on && idx > -1)
                        list.splice(idx, 1);
                    this._saveProfiles();
                    this._rebuildOrderRows();
                }
            );
            this._extGroup.add(row);
            this._extRows.push(row);
        }
    }

    _loadProfiles() {
        try {
            const parsed = JSON.parse(this._settings.get_string('profiles'));
            this._profiles = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
        } catch {
            this._profiles = {};
        }
    }

    _saveProfiles() {
        this._settings.set_string('profiles', JSON.stringify(this._profiles));
    }

    _getShellExtensionStates() {
        const states = new Map();
        let shellMajor = null;

        try {
            const versionRes = Gio.DBus.session.call_sync(
                'org.gnome.Shell',
                '/org/gnome/Shell',
                'org.freedesktop.DBus.Properties',
                'Get',
                new GLib.Variant('(ss)', ['org.gnome.Shell.Extensions', 'ShellVersion']),
                new GLib.VariantType('(v)'),
                Gio.DBusCallFlags.NONE,
                250,
                null
            );
            const [verVariant] = versionRes.deepUnpack();
            const verStr = verVariant?.deepUnpack?.() ?? verVariant;
            if (typeof verStr === 'string' && verStr.length > 0)
                shellMajor = verStr.split('.')[0];
        } catch {
        }

        try {
            const listRes = Gio.DBus.session.call_sync(
                'org.gnome.Shell',
                '/org/gnome/Shell',
                'org.gnome.Shell.Extensions',
                'ListExtensions',
                null,
                new GLib.VariantType('(a{sa{sv}})'),
                Gio.DBusCallFlags.NONE,
                250,
                null
            );
            const [extensionsMap] = listRes.deepUnpack();
            for (const [uuid, props] of Object.entries(extensionsMap)) {
                const stateVal = props.state?.unpack?.() ?? props.state;
                states.set(uuid, stateVal);
            }
        } catch {
        }

        return {states, shellMajor};
    }

    _getInstalledExtensions() {
        const found = new Map();
        const {states, shellMajor} = this._getShellExtensionStates();
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
                    if (meta.uuid && meta.uuid !== this.metadata.uuid && !found.has(meta.uuid)) {
                        const shellState = states.get(meta.uuid);
                        const isOutOfDateState = shellState === EXTENSION_STATE_OUT_OF_DATE;
                        const versions = Array.isArray(meta['shell-version']) ? meta['shell-version'] : [];
                        const unsupportedVersion = shellMajor !== null &&
                            versions.length > 0 &&
                            !versions.some(v => String(v).split('.')[0] === shellMajor);

                        found.set(meta.uuid, {
                            uuid: meta.uuid,
                            name: meta.name ?? meta.uuid,
                            incompatible: isOutOfDateState || unsupportedVersion,
                        });
                    }
                } catch {
                }
            }
        }

        return [...found.values()];
    }
}
