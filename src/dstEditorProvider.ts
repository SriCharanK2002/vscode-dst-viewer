import * as vscode from "vscode";

import { DstParseError, parseDst } from "./dstParser";
import { getWebviewHtml } from "./webviewHtml";

const VIEW_TYPE = "mydigitizerDstPlayer.viewer";

class DstDocument implements vscode.CustomDocument {
  constructor(
    readonly uri: vscode.Uri,
    readonly fileName: string,
    readonly payload:
      | { ok: true; artifact: ReturnType<typeof parseDst> }
      | { ok: false; message: string }
  ) {}

  dispose(): void {
    // The document only holds parsed data for the lifetime of the editor.
  }
}

export class DstEditorProvider implements vscode.CustomReadonlyEditorProvider<DstDocument> {
  static register(context: vscode.ExtensionContext): vscode.Disposable {
    return vscode.window.registerCustomEditorProvider(VIEW_TYPE, new DstEditorProvider(context), {
      supportsMultipleEditorsPerDocument: true,
      webviewOptions: {
        retainContextWhenHidden: true
      }
    });
  }

  private constructor(private readonly context: vscode.ExtensionContext) {}

  async openCustomDocument(uri: vscode.Uri): Promise<DstDocument> {
    const bytes = await vscode.workspace.fs.readFile(uri);
    const fileName = uri.path.split("/").pop() || "design.dst";

    try {
      return new DstDocument(uri, fileName, { ok: true, artifact: parseDst(bytes, fileName) });
    } catch (error) {
      const message =
        error instanceof DstParseError || error instanceof Error
          ? error.message
          : "Unable to parse DST file.";
      return new DstDocument(uri, fileName, { ok: false, message });
    }
  }

  async resolveCustomEditor(
    document: DstDocument,
    webviewPanel: vscode.WebviewPanel
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, "media")]
    };
    webviewPanel.webview.html = getWebviewHtml(this.context, webviewPanel.webview);

    const sendPayload = (): void => {
      if (document.payload.ok) {
        void webviewPanel.webview.postMessage({
          type: "load",
          fileName: document.fileName,
          artifact: document.payload.artifact
        });
        return;
      }

      void webviewPanel.webview.postMessage({
        type: "error",
        fileName: document.fileName,
        message: document.payload.message
      });
    };

    const readySubscription = webviewPanel.webview.onDidReceiveMessage((message) => {
      if (message?.type === "ready") {
        sendPayload();
      }
    });
    webviewPanel.onDidDispose(() => readySubscription.dispose());
  }
}
