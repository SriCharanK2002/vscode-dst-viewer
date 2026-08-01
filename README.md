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

## Development

```bash
npm install
npm test
npm run compile
npm run package
```

## Publishing Notes

Before publishing to the Visual Studio Code Marketplace:

- Replace the `publisher` field in `package.json` with your Marketplace publisher id.
- Add a non-SVG marketplace icon and reference it from `package.json`.
- Review `README.md`, `CHANGELOG.md`, and the license for public release.
- Package with `npm run package` and publish the generated `.vsix` with `vsce`.

## Limitations

This extension is read-only. It does not edit, save, convert, or export DST files.
