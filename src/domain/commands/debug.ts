import { commands, Disposable, ExtensionContext } from 'vscode';

import { contextFlags, ExtensionKeys } from '../../shared/environment';
import { LogInterface } from '../../utils/logging';
import { session } from '../network/git';

export const showcontext = (
	logger: LogInterface,
	flags: typeof contextFlags
): Disposable => {
	return commands.registerCommand(
		`${ExtensionKeys.prefix}.debug.showcontext`,
		() => {
			(Object.keys(flags) as (keyof typeof flags)[]).forEach((key) => {
				logger.inform(
					`${key as string}:${
						flags[key].methods.inspect || 'NOT SET'
					}`
				);
			});
		}
	);
};

export const showstate = (
	ctx: ExtensionContext,
	logger: LogInterface
): Disposable => {
	return commands.registerCommand(
		`${ExtensionKeys.prefix}.debug.showstate`,
		() => {
			ctx.globalState.keys().forEach((key) => {
				logger.inform(
					`${key as string}:${ctx.globalState.get(key) || 'NOT SET'}`
				);
			});
		}
	);
};

export const inspectsession = (logger: LogInterface): Disposable => {
	return commands.registerCommand(
		`${ExtensionKeys.prefix}.debug.showsession`,
		async () => {
			const s = await session();
			logger.inform(
				`Auth Account: ${s.account || 'Not Authenticated'}
                Auth ID: ${s.id || 'Not Authenticated'}
                Scopes: ${s.scopes || 'Not Authenticated'}`
			);
		}
	);
};
