# Extension Profiles

A powerful, yet safe GNOME Shell extension that lets you create, manage, and instantly switch between different sets of extensions. 

Perfect for users who need different desktop setups for Work, Gaming, Battery-Saving mode, or Screen Sharing.

## Features

* **Quick Switch:** Change your active profile directly from the system tray indicator.
* **Smart Startup Behavior:** Choose what happens when you log in:
  * *Do nothing*
  * *Restore last used profile*
  * *Apply a specific default profile*
* **Modern Preferences UI:** Built with GTK4 and libadwaita. Create, rename, delete, and manage profiles effortlessly.
* **Sync from System:** Easily overwrite any profile with the exact extensions you currently have enabled in GNOME.

## Installation

### From GNOME Extensions Store (Recommended) (Comming Soon)....

<p align="center">
  <a href="https://extensions.gnome.org/extension/9334/dynamic-music-pill/">
    <img alt="Get it on GNOME Extensions" width="400" src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true"/>
  </a>
</p>

### Manual Installation from Source

**1.** Clone the repository:

```bash
git clone https://github.com/Andbal23/extension-profiles.git
```

**2.** Enter the directory:

```bash
cd dynamic-music-pill
```

**3.** Create the extension directory:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/extension-profiles@andbal
```

**4.** Copy all files:

```bash
cp -r * ~/.local/share/gnome-shell/extensions/extension-profiles@andbal/
```

**5.** Compile GSettings schemas:

```bash
cd ~/.local/share/gnome-shell/extensions/extension-profiles@andbal
glib-compile-schemas schemas/
```

**6.** Restart GNOME Shell:

- **X11:** Press `Alt+F2`, type `r`, and press `Enter`.
- **Wayland:** Log out and log back in.

**7.** Enable the extension via **GNOME Extensions**, **Extension Manager**, or:

```bash
gnome-extensions enable extension-profiles@andbal
```
