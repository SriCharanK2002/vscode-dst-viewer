import * as vscode from "vscode";

export function getWebviewHtml(context: vscode.ExtensionContext, webview: vscode.Webview): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "player.css"));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "player.js"));

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta
    http-equiv="Content-Security-Policy"
    content="default-src 'none'; img-src ${webview.cspSource} https: data:; style-src ${webview.cspSource}; script-src ${webview.cspSource};"
  >
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="${styleUri}">
  <title>DST Player</title>
</head>
<body>
  <main class="shell">
    <header class="topbar">
      <div class="title-group">
        <h1 id="fileName">DST Player</h1>
        <p id="summaryText">Open a DST file to inspect playback.</p>
      </div>
      <div class="stats" id="stats" aria-live="polite"></div>
    </header>

    <section class="stage" aria-label="DST stitch preview">
      <canvas id="canvas"></canvas>
      <div id="emptyState" class="empty-state">Loading DST preview...</div>
    </section>

    <section class="controls" aria-label="Playback controls">
      <button id="previousCommandButton" type="button" disabled>Previous Command</button>
      <button id="previousStitchButton" type="button" disabled>Previous</button>
      <button id="playButton" type="button" disabled>Play</button>
      <button id="nextStitchButton" type="button" disabled>Next</button>
      <button id="nextCommandButton" type="button" disabled>Next Command</button>
      <button id="speedDownButton" type="button" disabled>Slower</button>
      <output id="speedValue" for="timeline">30x</output>
      <button id="speedUpButton" type="button" disabled>Faster</button>
      <button id="resetViewButton" type="button" disabled>Reset View</button>
      <label class="toggle">
        <input id="showJumps" type="checkbox" disabled>
        Jumps
      </label>
      <label class="toggle">
        <input id="showTrims" type="checkbox" checked disabled>
        Trims
      </label>
      <div id="timelineLegend" class="timeline-legend" aria-label="Timeline marker legend">
        <span class="legend-item">
          <span class="legend-icon jump" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <path d="M3 13c3.2-7.5 11.2-7.5 14 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              <path d="M6 13h8.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-dasharray="1 3"></path>
              <circle cx="3" cy="13" r="1.7" fill="currentColor"></circle>
              <circle cx="17" cy="13" r="1.7" fill="currentColor"></circle>
            </svg>
          </span>
          Jump
        </span>
        <span class="legend-item">
          <span class="legend-icon trim" aria-hidden="true">
            <svg viewBox="0 0 20 20" focusable="false">
              <circle cx="5" cy="15" r="2.3" fill="none" stroke="currentColor" stroke-width="2"></circle>
              <circle cx="15" cy="15" r="2.3" fill="none" stroke="currentColor" stroke-width="2"></circle>
              <path d="M6.6 13.2 17 3.8M13.4 13.2 3 3.8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"></path>
              <path d="M9.9 10.2 10.1 10.2" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></path>
            </svg>
          </span>
          Trim
        </span>
      </div>
    </section>

    <section class="timeline-wrap" aria-label="Timeline">
      <input id="timeline" type="range" min="0" max="0" value="0" disabled>
      <div id="timelineMarkers" class="timeline-markers"></div>
      <output id="positionValue" for="timeline">0 / 0</output>
    </section>
  </main>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}
