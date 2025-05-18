import { commands, window } from 'vscode';

import { machineId } from '../../shared/environment';
import Fallbacks from '../../shared/fallbacks';
import { ContextStore } from '../../utils/context-store';
import { exists, settingsJSON } from '../../utils/file.utils';
import { LogInterface } from '../../utils/logging';

const UpdateLabel = async (
	deviceLabel: ContextStore<string>,
	logger: LogInterface
) => {
	try {
		var _label: string | undefined = await window.showInputBox({
			ignoreFocusOut: true,
			placeHolder: `${machineId.get().substring(0, 12)}....`,
			title: 'Create Unique Device Label',
			prompt: `Create A unique label to associate this device with. [default: ${machineId
				.get()
				.substring(0, 12)}....}]`
		});
	} catch (error) {
		logger.error(
			`Error Encountered Setting Custom Device Label. ${error}\nFalling Back to machineId`,
			true
		);
		var _label: string | undefined = `${machineId.get()}`;
	}
	deviceLabel.set(_label === undefined ? machineId.get() : _label);
	logger.inform(
		`CursorSync: Updated Device Label!\n  Device Label:${_label}`
	);
};

export const registerUpdateLabel = (
	deviceLabel: ContextStore<string>,
	logger: LogInterface
) => {
	return commands.registerCommand(
		'cursorsync.update.deviceLabel',
		async () => await UpdateLabel(deviceLabel, logger)
	);
};

const SetSettings = async (settingsPath: ContextStore<string>) => {
	const path: string = exists(Fallbacks.settings)
		? Fallbacks.settings.fsPath
		: (await settingsJSON())[0].fsPath;
	settingsPath.set(path);
};

export const registerSetSettings = (settingsPath: ContextStore<string>) =>
	commands.registerCommand(
		'cursorsync.scaffolding.settings',
		async () => await SetSettings(settingsPath)
	);

// export const execGeneralScaffolding = (

// 	controller: GistController,
// 	deviceLabel: ContextStore<string>,
// 	generalID: ContextStore<string>,
// 	deviceID: ContextStore<string>,
// 	settings: ContextStore<string>
// ) => {
// 	return commands.registerCommand(
// 		'cursorsync.update.deviceLabel',
// 		async () =>
// 			await creategeneral(
// 				controller,
// 				deviceLabel,
// 				generalID,
// 				deviceID,
// 				settings
// 			)
// 	);
// };

// const extensionscaffolding = async (ctx: ExtensionContext) => {
// 	logger.appendLine('Scaffolding Extensions Store...');
// 	const exts: string[] = extensions.all.map((ext) => ext.id);
// 	const payload: {
// 		description: string;
// 		public: boolean;
// 		files: {};
// 	} = {
// 		description: ExtensionKeys.extensionGist,
// 		public: false,
// 		files: {
// 			'original.json': {
// 				content: JSON.stringify({
// 					createdAt: `${Date.now()}`,
// 					profile: 'original',
// 					tags: ['original'],
// 					extensions: exts
// 				} as ExtensionSchema)
// 			}
// 		}
// 	};
// 	try {
// 		logger.appendLine(
// 			`Sending Request to Scaffold Extensions List: ${safeStringify(
// 				payload
// 			)}`
// 		);
// 		const response = await (
// 			await ExtensionState()
// 		).controller.call({
// 			method: 'P',
// 			payload: payload
// 		});
// 		ctx.globalState.update('extensionsGistID', response.id);
// 		window.showInformationMessage(safeStringify(response));
// 		window.showInformationMessage(
// 			'CursorSync: Configuration Store Created on Remote'
// 		);
// 	} catch (error) {
// 		const msg = `CursorSync: Failed to scaffold extensions\n Error: ${error}\n${trace(
// 			'Extension Scaffolding'
// 		)}`;
// 		logger.appendLine(msg);
// 		await window.showErrorMessage(msg);
// 	}
// };

// const devicescaffolding = async (ctx: ExtensionContext) => {
// 	logger.appendLine('Scaffolding Device Store...');
// 	const deviceLabel: string | undefined = ctx.globalState.get('deviceLabel');
// 	const settingsPath: string | undefined =
// 		ctx.globalState.get('settingsPath');
// 	if (deviceLabel === undefined || settingsPath === undefined) {
// 		window.showErrorMessage(
// 			`Cannot Scaffold Device Gist, missing ${
// 				deviceLabel === undefined && settingsPath === undefined
// 					? 'Device Label & Settings Path'
// 					: deviceLabel === undefined
// 					? 'Device Label'
// 					: settingsPath === undefined
// 					? 'Settings Path'
// 					: ''
// 			}`
// 		);
// 		return;
// 	}
// 	var settingsObj = await loadSettings(settingsPath!);
// 	var _files: {
// 		name: string;
// 		content: DeviceMetadataSchema | HistorySchema | Object;
// 	}[] = [
// 		{
// 			name: 'metadata.json',
// 			content: {
// 				createdAt: `${Date.now()}`,
// 				deviceId: machineId.get(),
// 				deviceLabel: deviceLabel,
// 				lastSync: ''
// 			} as DeviceMetadataSchema
// 		},
// 		{
// 			name: 'history.json',
// 			content: {} as HistorySchema
// 		},
// 		{
// 			name: 'settings.json',
// 			content: { ...settingsObj } as Object
// 		}
// 	];

// 	var payload: {
// 		description: string;
// 		public: boolean;
// 		files: {};
// 	} = {
// 		description: `${ExtensionKeys.deviceGist}.${deviceLabel}`,
// 		public: false,
// 		files: _files.reduce<{ [key: string]: any }>((acc, file) => {
// 			acc[file.name] = { content: JSON.stringify(file.content) };
// 			return acc;
// 		}, {})
// 	};
// 	try {
// 		logger.appendLine(
// 			`Sending Request to Scaffold Device Gist: ${payload}`
// 		);
// 		const response = await (
// 			await ExtensionState()
// 		).controller.call({ method: 'P', payload: payload });
// 		ctx.globalState.update('deviceGistID', response.id);
// 		logger.appendLine(safeStringify(response));
// 		window.showInformationMessage(
// 			'CursorSync: Device Store Created on Remote'
// 		);
// 	} catch (error) {
// 		const msg = `CursorSync: Failed to scaffold Devices \n Error: ${error}\n${trace(
// 			'Device Scaffolding'
// 		)}`;
// 		logger.appendLine(msg);
// 		await window.showErrorMessage(msg);
// 	}
// };
// const configurationscaffolding = async (ctx: ExtensionContext) => {
// 	logger.appendLine('Scaffolding Configuration Store...');
// 	const deviceLabel: string | undefined = ctx.globalState.get('deviceLabel');
// 	if (ctx.globalState.get('deviceLabel') === undefined) {
// 		window.showErrorMessage(
// 			'CursorSync: Cannot Scaffold configuration, no device label set'
// 		);
// 		return;
// 	}

// 	var fileNames: string[] = ['config.json', 'reference.json'];
// 	var configContent: GeneralSchema = {
// 		created: `${Date.now()}`
// 	};

// 	var device: DeviceRefSchema = {
// 		id: machineId.get(),
// 		label: deviceLabel as string,
// 		lastSync: `${Date.now()}`,
// 		isMaster: false
// 	};

// 	var referenceContent: ReferenceSchema = {
// 		created: `${Date.now()}`,
// 		lastUpdate: `${Date.now()}`,
// 		devices: [device]
// 	};

// 	var payload: {
// 		description: string;
// 		public: boolean;
// 		files: {};
// 	} = {
// 		description: ExtensionKeys.generalGist,
// 		public: false,
// 		files: {
// 			[fileNames[0]]: { content: JSON.stringify(configContent) },
// 			[fileNames[1]]: { content: JSON.stringify(referenceContent) }
// 		}
// 	};
// 	try {
// 		logger.appendLine(`Sending Request to Scaffold Config: ${payload}`);
// 		var response = await (
// 			await ExtensionState()
// 		).controller.call({ method: 'P', payload: payload });
// 		ctx.globalState.update('configGistID', response.id);
// 		window.showInformationMessage(safeStringify(response));
// 		window.showInformationMessage(
// 			'CursorSync: Configuration Store Created on Remote'
// 		);
// 	} catch (error) {
// 		const msg = `CursorSync: Failed to config extensions\n Error: ${error}\n${trace(
// 			'Config Store Scaffolding'
// 		)}`;
// 		logger.appendLine(msg);
// 		await window.showErrorMessage(msg);
// 	}
// };
// export const execExtensionScaffolding = (ctx: ExtensionContext) =>
// 	commands.registerCommand(
// 		'cursorsync.scaffolding.extensions',
// 		async () => await extensionscaffolding(ctx)
// 	);

// export const execDeviceScaffolding = (ctx: ExtensionContext) =>
// 	commands.registerCommand(
// 		'cursorsync.scaffolding.device',
// 		async () => await devicescaffolding(ctx)
// 	);
// export const execConfigScaffolding = (ctx: ExtensionContext) =>
// 	commands.registerCommand(
// 		'cursorsync.scaffolding.config',
// 		async () => await configurationscaffolding(ctx)
// 	);

// export const execSettingsScaffolding = (ctx: ExtensionContext) =>
// 	commands.registerCommand(
// 		'cursorsync.scaffolding.settings',
// 		async () => await settingscaffolding(ctx.globalState)
// 	);
