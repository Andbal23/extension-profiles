# Extension Profiles

A GNOME Shell extension that lets you create, manage, and instantly switch between different sets of extensions. 

Perfect for users who need different desktop setups for Work, Gaming, Battery-Saving mode, or Screen Sharing.

## Features

* **Quick Switch:** Change your active profile directly from the system tray indicator.
* **Smart Startup Behavior:** Choose what happens when you log in:
  * *Do nothing*
  * *Restore last used profile*
  * *Apply a specific default profile*
* **Modern Preferences UI:** Built with GTK4 and libadwaita. Create, rename, delete, and manage profiles effortlessly.
* **Sync from System:** Easily overwrite any profile with the exact extensions you currently have enabled in GNOME.

## Tray Icon

<p align="center">

<img width="501" height="321" alt="image" src="https://github.com/user-attachments/assets/2b01fbd6-5299-4038-9eff-92b7e939b661" />
</p>

## Settings Page
<p align="center">

<img width="1070" height="1185" alt="image" src="https://github.com/user-attachments/assets/70579017-7625-40f6-9faf-87a65031aa86" />
</p>

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
cd extension-profiles
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

---
## Check out this one too:)
https://github.com/Andbal23/dynamic-music-pill

---
## Support the Project

<div align="center">

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Donate-yellow?style=for-the-badge&logo=buy-me-a-coffee)](https://www.buymeacoffee.com/andbal)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-Support-red?style=for-the-badge&logo=ko-fi)](https://ko-fi.com/andbal)

</div>

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=Andbal23/extension-profiles&type=Date)](https://star-history.com/#Andbal23/extension-profiles&Date)

---

## License

This project is licensed under the [GPL-3.0 License](LICENSE).

<p align="center">Made with ❤️ for the GNOME community.</p>
