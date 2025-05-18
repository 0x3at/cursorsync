import {
	ExtensionContext,
	LogOutputChannel,
	MessageItem,
	MessageOptions,
	window
} from 'vscode';

import { ExtensionKeys } from '../shared/environment';

export interface ILogger {
	inform: (
		msg: string,
		items?: MessageItem[]
	) => Promise<MessageItem | undefined>;
	modal: (
		msg: string,
		detail: string,
		items: { onCancel: boolean; title: string }[]
	) => Promise<MessageItem | undefined>;
	error: (msg: string, notify: boolean) => Promise<string | undefined>;
	log: (msg: string) => void;
	debug: (msg: string) => void;
	show: () => void;
	self: LogOutputChannel;
}

const Logger = (ctx: ExtensionContext): ILogger => {
	const _errorOpts: MessageOptions = {
		modal: false,
		detail: '🔴 CursorSync Error!'
	};
	const _logger = window.createOutputChannel(ExtensionKeys.prefix, {
		log: true
	});

	return {
		inform: async (msg: string, items?: MessageItem[]) => {
			_logger.info(`Registering Notification ${msg}`);
			return await window.showInformationMessage(msg, ...(items || []));
		},
		modal: async (
			msg: string,
			detail: string,
			items: { onCancel: Boolean; title: string }[]
		) => {
			_logger.info(`Registering Modal ${msg}`);
			return await window.showInformationMessage(
				msg,
				{ detail: detail, modal: true } as MessageOptions,
				...items
			);
		},
		error: async (msg: string, notify: Boolean) => {
			_logger.error(msg);
			if (notify) {
				return await window.showErrorMessage(msg, _errorOpts);
			}
		},
		log: async (msg: string) => {
			_logger.info(msg);
		},

		debug: async (msg: string) => {
			_logger.debug(msg);
		},
		show: () => _logger.show(),
		self: _logger
	};
};

export default Logger;
