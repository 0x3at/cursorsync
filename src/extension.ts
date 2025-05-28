import { commands, ExtensionContext, window } from 'vscode';

import { registerCommands } from './domain/commands/menus';
import { registerProfileTreeView } from './domain/commands/view';
import { buildExtensionCore, IExtensionCore } from './domain/services/core';
import { IResult } from './shared/schemas/api.git';
import Logger, { ILogger } from './utils/logger';

export async function activate(context: ExtensionContext) {
	const logger: ILogger = Logger(context);
	logger.debug('Gathering Extension State');

	try {
		// Initialize core services
		const core: IResult<IExtensionCore> = await buildExtensionCore(
			context,
			logger
		);
		if (!core.success) {
			throw new Error(`Core initialization failed: ${core.error}`);
		}
		// Register Commands
		registerCommands(context, core.data!, logger);
		core.data?.disposables.forEach((d) => context.subscriptions.push(d));
		// Register Explorer View
		registerProfileTreeView(context, core.data!);
		logger.inform('CursorSync activated successfully');
	} catch (error) {
		logger.error(`Activation failed: ${error}`, true);
		const action = await window.showErrorMessage(
			'CursorSync failed to activate properly. Would you like to retry or configure settings?',
			'Retry',
			'Open Settings'
		);

		if (action === 'Retry') {
			// Restart activation process
			await activate(context);
		} else if (action === 'Open Settings') {
			await commands.executeCommand(
				'workbench.action.openSettings',
				'cursorsync'
			);
		}
	}
}

export function deactivate() {}
