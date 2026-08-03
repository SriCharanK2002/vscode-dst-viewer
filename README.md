# DST Player

DST Player opens Tajima `.dst` embroidery files directly in Visual Studio Code.

## Features

- Open `.dst` and `.DST` files with a read-only custom editor.
- Play and pause stitch playback.
- Speed playback up or down.
- Scrub through the stitch timeline.
- Highlight jumps and trims on the canvas.
- Show jump and trim markers on the timeline.
- Zoom, pan, and reset the design view.
- Inspect event, stitch, jump, trim, stop, color-change, and thread-block counts.

## Usage

Open a `.dst` file from the Explorer. VS Code will use the DST Player editor by default.

If another editor opens first, run **Reopen Editor With...** and choose **DST Player**.

## Setup

Prerequisites:

- Visual Studio Code 1.90.0 or newer.
- Node.js 20 or newer.
- npm.

Clone and install dependencies:

```bash
git clone git@github.com:SriCharanK2002/vscode-dst-viewer.git
cd vscode-dst-viewer
npm install
```

Run the checks:

```bash
npm test
npm run compile
```

Build a local VSIX package:

```bash
npm run package
```

Install or update the local extension build:

```bash
code --install-extension ./dst-player-0.1.1.vsix --force
```

Open a DST file to test:

```bash
code /path/to/design.dst
```

If VS Code does not open the custom editor automatically, use **Reopen Editor With...** and select **DST Player**.

## Development

Useful commands:

```bash
npm install
npm test
npm run compile
npm run watch
npm run package
```

For an interactive VS Code extension development session:

1. Open this repository in VS Code.
2. Run `npm install`.
3. Press `F5` to launch an Extension Development Host.
4. In the Extension Development Host window, open a `.dst` or `.DST` file.
5. Use **Developer: Reload Window** in the Extension Development Host after rebuilding.

The extension is implemented as a read-only custom editor. The TypeScript extension host reads the DST file, parses it into a compact artifact, and sends that artifact to the webview player.

## Publishing Notes

Before publishing to the Visual Studio Code Marketplace:

- Replace the `publisher` field in `package.json` with your Visual Studio Marketplace publisher id.
- Add a non-SVG marketplace icon and reference it from `package.json`.
- Review `README.md`, `CHANGELOG.md`, and the license for public release.
- Run `npm test`.
- Package with `npm run package`.
- Publish the generated `.vsix` with `vsce`.

## Limitations

This extension is read-only. It does not edit, save, convert, or export DST files.
