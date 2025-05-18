import { ExtensionContext } from 'vscode';

import { extensionstate } from './domain/state/statemap';
import Logger, { LogInterface } from './utils/logging';

export async function activate(context: ExtensionContext) {
	// * Pushed to context.subscriptions within itz Logger closure
	const logger: LogInterface = Logger(context);
	logger.debug('Gathering Extension State');
	const result = await extensionstate(context, logger);
	if (result.success === false) {
		await logger.error(
			'Could not establish remote, killing cursorsync.... ',
			true
		);
	}
	const cursorSync = result.data!;
	cursorSync.disposables.forEach((cmd) => context.subscriptions.push(cmd));
	logger.debug('CursorSync Build Process Completed');
}

export function deactivate() {}

activate('' as unknown as ExtensionContext);
