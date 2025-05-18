import { commands, ExtensionContext } from 'vscode';

import {
	contextFlags,
	ExtensionKeys,
	machineId
} from '../../shared/environment';
import {
	IDeviceReference,
	IReferenceContent
} from '../../shared/schemas/content';
import {
	ICore,
	IDependencies,
	IRemoteStore,
	IResult
} from '../../shared/schemas/state';
import { ILogger } from '../../utils/logger';
import { createValueStore, IValueStore } from '../../utils/stores';
import { registerDebugContext, registerDebugState } from '../commands/debug';
import {
	registerUpdateLabel,
	registerUpdateSettingsLocation
} from '../commands/setters';
import { createController, IController } from '../network/git';

const buildDependencies = async (
	ctx: ExtensionContext,
	logger: ILogger
): Promise<IResult<IDependencies>> => {
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
	const generalGistID = createValueStore({
		val: ctx.globalState.get('generalGistID'),
		getter: () => ctx.globalState.get('generalGistID'),
		setter: (val: string) => ctx.globalState.update('generalGistID', val)
	});
	logger.log(`General Gist ID: ${generalGistID.get()}`);

	const devicesGistID = createValueStore({
		val: ctx.globalState.get('devicesGistID'),
		getter: () => ctx.globalState.get('devicesGistID'),
		setter: (val: string) => ctx.globalState.update('devicesGistID', val)
	});
	logger.log(`Device Profile ID: ${devicesGistID.get()}`);

	const extensionsGistID = createValueStore({
		val: ctx.globalState.get('extensionsGistID'),
		getter: () => ctx.globalState.get('extensionsGistID'),
		setter: (val: string) => ctx.globalState.update('extensionsGistID', val)
	});
	logger.log(`Device Profile ID: ${devicesGistID.get()}`);

	const deviceLabel = createValueStore({
		val: ctx.globalState.get('deviceLabel'),
		getter: () => ctx.globalState.get('deviceLabel'),
		setter: (val: string) => ctx.globalState.update('deviceLabel', val)
	});
	logger.log(`Device Label: ${deviceLabel.get()}`);

	const settingsPath = createValueStore({
		val: ctx.globalState.get('settingsPath'),
		getter: () => ctx.globalState.get('settingsPath'),
		setter: (val: string) => ctx.globalState.update('settingsPath', val)
	});
	logger.log(`Settings Path: ${settingsPath.get()}`);

	// ? Initialize Commands
	const runDebugState = registerDebugState(ctx, logger);
	const runDebugContext = registerDebugContext(logger, flags);
	const runUpdateLabel = registerUpdateLabel(deviceLabel, logger);
	const runUpdateSettingsLocation =
		registerUpdateSettingsLocation(settingsPath);

	try {
		// ? Initialize API Controller
		const controller = await createController(
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
					runDebugState,
					runDebugContext,
					runUpdateLabel,
					runUpdateSettingsLocation
				],
				controller: controller
			}
		} as IResult<IDependencies>;
	} catch (error) {
		logger.error(`Could not connect to Github: ${error}`, true);
		return {
			success: false,
			error: `Could not connect to Github: ${error}`
		} as IResult<IDependencies>;
	}
};

const assembleBuildHooks = async (
	controller: IController,
	generalGistID: IValueStore<string | undefined>,
	devicesGistID: IValueStore<string | undefined>,
	extensionsGistID: IValueStore<string | undefined>,
	deviceLabel: IValueStore<string | undefined>,
	settingsPath: IValueStore<string | undefined>,
	logger: ILogger
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
							.content as IReferenceContent
				  ).devices.find(
						(reference: IDeviceReference) =>
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

const pullRemote = async (
	controller: IController,
	generalGistID: IValueStore<string | undefined>,
	devicesGistID: IValueStore<string | undefined>,
	logger: ILogger
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
			} as IResult<IRemoteStore>;
		} catch (error) {
			logger.debug(`Error occurred during build process: ${error}`);
			return {
				success: false,
				error: error
			};
		}
	}
};

export const buildExtensionCore = async (
	ctx: ExtensionContext,
	logger: ILogger
): Promise<IResult<ICore>> => {
	const contextresult: IResult<IDependencies> = await buildDependencies(
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
	} = contextresult.data! as IDependencies;

	let hooks = await assembleBuildHooks(
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

	const buildResult = await pullRemote(
		controller,
		generalGistID,
		devicesGistID,
		logger
	);

	if (buildResult.success === false) {
		logger.error('Failed to initialize...', true);
		return { success: false, error: buildResult.error };
	} else {
		logger.debug('Succsesfully Retrieved Cursor Sync Dependencies');
	}

	const { generalGist, deviceGist, extensionsGist }: IRemoteStore =
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
