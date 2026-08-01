import * as vscode from "vscode";

import { DstEditorProvider } from "./dstEditorProvider";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(DstEditorProvider.register(context));
}

export function deactivate(): void {
  // No background resources are kept alive after editor disposal.
}
