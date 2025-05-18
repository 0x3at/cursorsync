import { ExtensionContext } from 'vscode';
import * as vscode from 'vscode';

import { createPackageJsonTreeProvider } from './domain/commands/view';
import { buildExtensionCore } from './domain/state/core';
import Logger, { ILogger } from './utils/logger';

export async function activate(context: ExtensionContext) {
	// * Pushed to context.subscriptions within itz Logger closure
	const logger: ILogger = Logger(context);
	logger.debug('Gathering Extension State');

	// Get the workspace root path
	const workspaceRoot =
		vscode.workspace.workspaceFolders &&
		vscode.workspace.workspaceFolders.length > 0
			? vscode.workspace.workspaceFolders[0].uri.fsPath
			: undefined;

	// Create and register the Tree View if a workspace is open
	if (workspaceRoot) {
		const packageJsonProvider =
			createPackageJsonTreeProvider(workspaceRoot);
		vscode.window.createTreeView('cursorsync.visualize', {
			treeDataProvider: packageJsonProvider
		});
	}

	const result = await buildExtensionCore(context, logger);
	if (result.success === false) {
		await logger.error(
			'Could not establish remote, killing cursorsync.... ',
			true
		);
	}
	const cursorSync = result.data!;
	cursorSync.disposables.push(logger.self);
	cursorSync.disposables.forEach((cmd) => context.subscriptions.push(cmd));
	logger.debug('CursorSync Build Process Completed');
}

export function deactivate() {}
