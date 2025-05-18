import { commands, Disposable, ExtensionContext } from 'vscode';

import {
	ContextFlags,
	contextFlags,
	ExtensionKeys,
	machineId
} from '../../shared/environment';
import {
	DeviceRefSchema,
	GistOverview,
	ReferenceSchema
} from '../../shared/schemas/api.git';
import { ContextStore, contextStore } from '../../utils/context-store';
import { LogInterface } from '../../utils/logging';
import { showcontext, showstate } from '../commands/debug';
import { registerSetSettings, registerUpdateLabel } from '../commands/setters';
import { Controller, GistController } from '../network/git';

interface Result<T = any> {
	success: boolean;
	data?: T;
	error?: any;
}

interface BuildDependencies {
	generalGistID: ContextStore<string | undefined>;
	devicesGistID: ContextStore<string | undefined>;
	extensionsGistID: ContextStore<string | undefined>;
	deviceLabel: ContextStore<string | undefined>;
	settingsPath: ContextStore<string | undefined>;
	flags: ContextFlags;
	commands: Disposable[];
	controller: GistController;
}

const buildContext = async (
	ctx: ExtensionContext,
	logger: LogInterface
): Promise<Result<BuildDependencies>> => {
	const dev = true;
	const flags = contextFlags;
	// Handle DevMode activation/deactivation
	if (dev === true) {
		flags.DevMode.methods.activate();
	} else {
		flags.DevMode.methods.deactivate();
	}

	logger.log(`Dev Mode:${dev}`);
	logger.log('Gathering Build Context...');

	// ? Initialize Context Stores
	const generalGistID = contextStore({
		val: ctx.globalState.get('generalGistID'),
		getter: () => ctx.globalState.get('generalGistID'),
		setter: (val: string) => ctx.globalState.update('generalGistID', val)
	});
	logger.log(`General Gist ID: ${generalGistID.get()}`);

	const devicesGistID = contextStore({
		val: ctx.globalState.get('devicesGistID'),
		getter: () => ctx.globalState.get('devicesGistID'),
		setter: (val: string) => ctx.globalState.update('devicesGistID', val)
	});
	logger.log(`Device Profile ID: ${devicesGistID.get()}`);

	const extensionsGistID = contextStore({
		val: ctx.globalState.get('extensionsGistID'),
		getter: () => ctx.globalState.get('extensionsGistID'),
		setter: (val: string) => ctx.globalState.update('extensionsGistID', val)
	});
	logger.log(`Device Profile ID: ${devicesGistID.get()}`);

	const deviceLabel = contextStore({
		val: ctx.globalState.get('deviceLabel'),
		getter: () => ctx.globalState.get('deviceLabel'),
		setter: (val: string) => ctx.globalState.update('deviceLabel', val)
	});
	logger.log(`Device Label: ${deviceLabel.get()}`);

	const settingsPath = contextStore({
		val: ctx.globalState.get('settingsPath'),
		getter: () => ctx.globalState.get('settingsPath'),
		setter: (val: string) => ctx.globalState.update('settingsPath', val)
	});
	logger.log(`Settings Path: ${settingsPath.get()}`);

	// ? Initialize Commands
	const showState = showstate(ctx, logger);
	const showContext = showcontext(logger, flags);
	const runUpdateLabel = registerUpdateLabel(deviceLabel, logger);
	const runSetSettings = registerSetSettings(settingsPath);

	try {
		// ? Initialize API Controller
		const controller = await Controller(
			logger,
			deviceLabel,
			generalGistID,
			devicesGistID,
			extensionsGistID,
			settingsPath
		);
		return {
			success: true,
			data: {
				generalGistID: generalGistID,
				devicesGistID: devicesGistID,
				extensionsGistID: extensionsGistID,
				deviceLabel: deviceLabel,
				settingsPath: settingsPath,
				flags: flags,
				commands: [
					showState,
					showContext,
					runUpdateLabel,
					runSetSettings
				],
				controller: controller
			}
		} as Result<BuildDependencies>;
	} catch (error) {
		logger.error(`Could not connect to Github: ${error}`, true);
		return {
			success: false,
			error: `Could not connect to Github: ${error}`
		} as Result<BuildDependencies>;
	}
};

const preBuildHooks = async (
	controller: GistController,
	generalGistID: ContextStore<string | undefined>,
	devicesGistID: ContextStore<string | undefined>,
	extensionsGistID: ContextStore<string | undefined>,
	deviceLabel: ContextStore<string | undefined>,
	settingsPath: ContextStore<string | undefined>,
	logger: LogInterface
) => {
	logger.debug('Building PreBuild Hooks...');
	if (generalGistID.get() === undefined) {
		logger.debug('Scanning for existing General Gist');
		const _gist = await controller.section({
			key: ExtensionKeys.generalGist
		});
		generalGistID.set(_gist?.id || undefined);
		logger.debug(
			generalGistID.get() === undefined
				? `Existing gist not found`
				: `Found Existing Conf:${generalGistID.get()}`
		);
		devicesGistID.set(
			devicesGistID.get() === undefined
				? (
						_gist!.files['references.json']
							.content as ReferenceSchema
				  ).devices.find(
						(reference: DeviceRefSchema) =>
							reference.deviceID === machineId.get()
				  )
				: devicesGistID.get()
		);
	}

	const hooks: CallableFunction[] = [
		async () => {
			if (deviceLabel.get() === undefined) {
				await commands.executeCommand('cursorsync.update.deviceLabel');
			}
		},
		async () => {
			if (settingsPath.get() === undefined) {
				await commands.executeCommand('cursorsync.update.settingspath');
			}
		},
		(() => {
			const initActions = {
				none: controller.initRemote,
				generalExists: () => {
					if (
						devicesGistID.get() === undefined &&
						extensionsGistID.get() === undefined
					) {
						return async () => {
							await controller.initDeviceProfile();
							await controller.initExtensionProfile();
						};
					}
					return devicesGistID.get() === undefined
						? controller.initDeviceProfile
						: extensionsGistID.get() === undefined
						? controller.initExtensionProfile
						: async () => {};
				}
			};

			if (generalGistID.get() === undefined) {
				return initActions.none;
			} else {
				return initActions.generalExists();
			}
		})()
	];

	logger.debug('Hooks completed...');
	return hooks;
};

interface BuildResults {
	generalGist: GistOverview | null;
	deviceGist: GistOverview | null;
	extensionsGist: GistOverview | null;
}
const build = async (
	controller: GistController,
	generalGistID: ContextStore<string | undefined>,
	devicesGistID: ContextStore<string | undefined>,
	deviceLabel: ContextStore<string | undefined>,
	settingsPath: ContextStore<string | undefined>,
	logger: LogInterface
) => {
	{
		try {
			logger.debug('Beginning build process...');
			const general = await controller.section({
				key: ExtensionKeys.generalGist,
				id: generalGistID.get()
			});
			logger.debug(
				`Indexed ${ExtensionKeys.generalGist} Gist: ${
					general === null ? false : true
				}`
			);
			const device = await controller.section({
				key: ExtensionKeys.deviceGist,
				id: devicesGistID.get()
			});
			logger.debug(
				`Indexed ${ExtensionKeys.deviceGist} Gist: ${
					device === null ? false : true
				}`
			);
			const extensions = await controller.section({
				key: ExtensionKeys.extensionGist,
				id: devicesGistID.get()
			});
			logger.debug(
				`Indexed ${ExtensionKeys.extensionGist} Gist: ${
					extensions === null ? false : true
				}`
			);
			logger.debug('Completed Build Process');
			return {
				success: true,
				data: {
					generalGist: general,
					deviceGist: device,
					extensionsGist: extensions
				}
			} as Result<BuildResults>;
		} catch (error) {
			logger.debug(`Error occurred during build process: ${error}`);
			return {
				success: false,
				error: error
			};
		}
	}
};

interface ExtensionStateDependencies {
	controller: GistController;
	deviceLabel: ContextStore<string | undefined>;
	settingsPath: ContextStore<string | undefined>;
	generalGistID: ContextStore<string | undefined>;
	generalGist: GistOverview | null;
	devicesGistID: ContextStore<string | undefined>;
	deviceGist: GistOverview | null;
	extensionsGistID: ContextStore<string | undefined>;
	extensionsGist: GistOverview | null;
	disposables: Disposable[];
	flags: ContextFlags;
}

export const extensionstate = async (
	ctx: ExtensionContext,
	logger: LogInterface
): Promise<Result<ExtensionStateDependencies>> => {
	const contextresult: Result<BuildDependencies> = await buildContext(
		ctx,
		logger
	);
	if (!contextresult.success) {
		return { success: false, error: contextresult.error };
	}

	const {
		generalGistID,
		devicesGistID,
		extensionsGistID,
		deviceLabel,
		settingsPath,
		flags,
		commands,
		controller
	} = contextresult.data! as BuildDependencies;

	let hooks = await preBuildHooks(
		controller,
		generalGistID,
		devicesGistID,
		extensionsGistID,
		deviceLabel,
		settingsPath,
		logger
	);

	logger.debug('Executing Hook');
	let num = 0;
	for (const hook of hooks) {
		num++;
		logger.debug(`Executing Hook Number ${num}`);
		await hook();
	}
	logger.debug('Completed executing pre build hooks');

	const buildResult = await build(
		controller,
		generalGistID,
		devicesGistID,
		deviceLabel,
		settingsPath,
		logger
	);

	if (buildResult.success === false) {
		logger.error('Failed to initialize...', true);
		return { success: false, error: buildResult.error };
	} else {
		logger.debug('Succsesfully Retrieved Cursor Sync Dependencies');
	}

	const { generalGist, deviceGist, extensionsGist }: BuildResults =
		buildResult.data!;

	return {
		success: true,
		data: {
			controller: controller,
			deviceLabel: deviceLabel,
			settingsPath: settingsPath,
			generalGistID: generalGistID,
			generalGist: generalGist,
			devicesGistID: devicesGistID,
			deviceGist: deviceGist,
			extensionsGistID: extensionsGistID,
			extensionsGist: extensionsGist,
			disposables: commands,
			flags: flags
		}
	};
};
