<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="screenshots/banner.svg">
  <source media="(prefers-color-scheme: light)" srcset="screenshots/banner.svg">
  <img src="screenshots/banner.svg" alt="Extension Profiles Banner" width="900">
</picture>

<br/><br/>

# Extension Profiles

**Save, organize, and switch curated GNOME extension presets with one click or shortcut.**

<p>
  <a href="https://extensions.gnome.org/extension/9545/extension-profiles/">
    <img src="https://img.shields.io/badge/Install%20from-GNOME%20Extensions-4a86cf?style=for-the-badge&logo=gnome&logoColor=white" alt="Install from GNOME Extensions"/>
  </a>
</p>

<p>
  
  [![Downloads](https://img.shields.io/gnome-extensions/dt/extension-profiles@andbal?style=flat-square&color=38bdf8)](https://extensions.gnome.org/extension/9545/extension-profiles/)
  <img src="https://img.shields.io/badge/GNOME-45%20%E2%80%93%2051-blue?style=flat-square&logo=gnome" alt="GNOME 45-51"/>
  <img src="https://img.shields.io/github/stars/Andbal23/extension-profiles?style=flat-square&logo=github" alt="GitHub Stars"/>
  <img src="https://komarev.com/ghpvc/?username=Andbal23e&repo=extension-profiles&color=blue&style=flat-square&label=Views" alt="Views"/>
  <img src="https://img.shields.io/badge/License-GPL--3.0-green?style=flat-square" alt="GPL-3.0"/>
</p>

</div>

---

## Preview

<div align="center">
  <img src="screenshots/demo.gif" alt="Extension Profiles Demo" width="760"/>
</div>

<br/>

<table>
  <tr>
    <td align="center" width="33%">
      <img src="screenshots/menu.png" alt="Top Bar Profile Switcher" width="100%"/>
      <br/>
      <sub><b>Top Bar Profile Menu</b><br/>One-click switching &amp; Super + E cycling</sub>
    </td>
    <td align="center" width="33%">
      <img src="screenshots/profiles-order.png" alt="Profile Order and Backup" width="100%"/>
      <br/>
      <sub><b>Management &amp; Ordering</b><br/>Drag &amp; drop order, sync &amp; JSON backup</sub>
    </td>
    <td align="center" width="33%">
      <img src="screenshots/profiles-extensions.png" alt="Extensions and Compatibility" width="100%"/>
      <br/>
      <sub><b>Extensions &amp; Whitelist</b><br/>Per-profile toggles &amp; incompatible indicator</sub>
    </td>
  </tr>
</table>

---

## Features

<div align="center">
  <img src="screenshots/features.svg" alt="Extension Profiles Features" width="900"/>
</div>

<br/>

- **Top Bar Selector** — Switch between Work, Gaming, Presentation, or custom profiles directly from the GNOME panel (`Icon only`, `Icon + Text`, `Text only`, or `Hidden`).
- **Quick Cycle Hotkey** — Rotate through your configured profiles anytime using a customizable keyboard shortcut (`Super + E` by default).
- **Drag & Drop Profile Ordering** — Reorder profiles cleanly by dragging rows or clicking Up/Down arrows; changes appear immediately in the menu and hotkey rotation.
- **Always-Enabled Whitelist** — Pin core extensions (e.g. dock, clipboard, theme tweaks) so they stay active regardless of which profile you switch to.
- **Compatibility Indicator & Sync** — Highlights extensions incompatible with your GNOME Shell version directly in the list, plus **Sync from system** to snapshot currently enabled extensions.
- **Backup, Restore & Startup** — Export/import all profiles and whitelist settings as JSON, and optionally apply a default profile or restore the last active profile at login.

---

## Installation

### Recommended (GNOME Extensions / Extension Manager)
- Visit **[Extension Profiles on GNOME Extensions](https://extensions.gnome.org/extension/9545/extension-profiles/)** and toggle it **On**.
- Or search **Extension Profiles** in the **Extension Manager** desktop app and click **Install**.

### From Source
```bash
git clone https://github.com/Andbal23/extension-profiles.git
cd extension-profiles
glib-compile-schemas schemas/
gnome-extensions pack --force --extra-source=icons --extra-source=LICENSE
gnome-extensions install --force extension-profiles@andbal.shell-extension.zip
```
Log out and log back in (or restart your GNOME session on Wayland), then enable the extension:
```bash
gnome-extensions enable extension-profiles@andbal
```

---

## More Extensions

- **[Timed Do Not Disturb](https://extensions.gnome.org/extension/9550/timed-do-not-disturb/)** — Silence notifications for custom countdowns or until a set wake-up time.
- **[Dynamic Music Pill](https://github.com/Andbal23/dynamic-music-pill)** — Smooth MPRIS music pill, visualizer & media controls for the GNOME top bar.

---

<div align="center">

### Support

If Extension Profiles streamlines your GNOME workflow, consider supporting its development:

<p>
  <a href="https://buymeacoffee.com/Andbal23">
    <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-ffdd00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee"/>
  </a>
  <a href="https://ko-fi.com/Andbal23">
    <img src="https://img.shields.io/badge/Ko--fi-F16061?style=for-the-badge&logo=ko-fi&logoColor=white" alt="Ko-fi"/>
  </a>
</p>

<br/>

<a href="https://star-history.com/#Andbal23/extension-profiles&Date">
  <img src="https://api.star-history.com/svg?repos=Andbal23/extension-profiles&type=Date" alt="Star History Chart" width="600"/>
</a>

<br/><br/>

<sub>Released under the <a href="LICENSE">GPL-3.0 License</a> • Built for GNOME Shell 45 – 51</sub>

</div>
