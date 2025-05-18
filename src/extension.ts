import { ExtensionContext } from 'vscode';

import { buildExtensionCore } from './domain/state/statemap';
import Logger, { ILogger } from './utils/logger';

export async function activate(context: ExtensionContext) {
	// * Pushed to context.subscriptions within itz Logger closure
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
	cursorSync.disposables.forEach((cmd) => context.subscriptions.push(cmd));
	logger.debug('CursorSync Build Process Completed');
}

export function deactivate() {}

activate('' as unknown as ExtensionContext);
