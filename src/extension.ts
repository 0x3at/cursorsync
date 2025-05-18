import { ExtensionContext } from 'vscode';

import { registerGistTreeView } from './domain/commands/view';
import { buildExtensionCore } from './domain/state/core';
import Logger, { ILogger } from './utils/logger';

export async function activate(context: ExtensionContext) {
	const logger: ILogger = Logger(context);
	logger.debug('Gathering Extension State');

	const result = await buildExtensionCore(context, logger);
	if (result.success === false) {
		await logger.error(
			'Could not establish remote, killing cursorsync.... ',
			true
		);
	}
	const cursorSync = result.data!;

	registerGistTreeView(context, cursorSync);
	cursorSync.disposables.push(logger.self);
	cursorSync.disposables.forEach((cmd) => context.subscriptions.push(cmd));
	logger.debug('CursorSync Build Process Completed');
}

export function deactivate() {}
