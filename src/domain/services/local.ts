import {
	Extension,
	ExtensionContext,
	extensions,
	FileSystemWatcher,
	Uri,
	workspace
} from 'vscode';

import { IResult } from '../../shared/schemas/api.git';
import { IProfile, ISettings } from '../../shared/schemas/profile';
import { ILogger } from '../../utils/logger';
import { exists, loadSettings } from '../../utils/utils';
import { IStateValues } from './core';

export interface ILocalService {
	resetLocalProfile(): Promise<void>;
	isInitialized(): Promise<IResult<IProfile>>;
	// Get the current local profile state
	refreshLocalProfile(): Promise<IResult<IProfile>>;

	// Load settings from the local settings.json file
	readLocalSettings(): Promise<IResult<ISettings>>;

	// Save settings to the local settings.json file
	applyToSettings(settings: ISettings): Promise<IResult<any>>;

	// Get the current list of installed extensions
	getInstalledExtensions(): string[];

	// Apply remote settings to local environment (this is in the interface but not implemented)
	// applySettings(settings: any): Promise<IResult<any>>;

	// Watch for changes to local settings.json
	startWatching(): void;

	// Stop watching for changes
	stopWatching(): void;

	// Create a new local profile
	createLocalProfile(profile: IProfile): Promise<IResult<IProfile>>;

	// Update local profile record
	updateLocalRecord(profile: IProfile): Promise<Thenable<void>>;
}

export const createLocalService = (
	ctx: ExtensionContext,
	logger: ILogger,
	stateValues: IStateValues
): ILocalService => {
	let fileWatcher: FileSystemWatcher | null = null;
	const localProfilePath: Uri = Uri.joinPath(
		ctx.globalStorageUri,
		'profile.json'
	);

	// Ensure the globalStorage directory exists
	const ensureStorageDir = async (): Promise<void> => {
		if (!exists(ctx.globalStorageUri)) {
			await workspace.fs.createDirectory(ctx.globalStorageUri);
			logger.debug('Created globalStorage directory');
		}
	};
	const ensureLocalRecord = async (): Promise<void> => {
		if (!exists(ctx.globalStorageUri)) {
			await workspace.fs.writeFile(localProfilePath, new Uint8Array());
			logger.debug('Created Local Profile Record');
		}
	};
	const resetLocalProfile = async (): Promise<void> => {
		await workspace.fs.writeFile(localProfilePath, new Uint8Array());
		stateValues.activeProfile.set(undefined);
		logger.debug('Reset Local Profile Record');
	};

	const isInitialized = async () => {
		const profile = await refreshLocalProfile();
		if (
			profile.data?.profileName &&
			stateValues.activeProfile.get() &&
			stateValues.settingsPath.get()
		) {
			return { success: true, date: profile };
		} else {
			return { success: false, error: profile.error };
		}
	};

	const updateLocalRecord = async (
		profile: IProfile
	): Promise<Thenable<void>> => {
		return workspace.fs.writeFile(
			localProfilePath,
			Buffer.from(JSON.stringify(profile), 'utf8')
		);
	};

	const createLocalProfile = async (
		profile: IProfile
	): Promise<IResult<IProfile>> => {
		try {
			await updateLocalRecord(profile);
			stateValues.activeProfile.set(profile.profileName);
			return { success: true, data: profile };
		} catch (error) {
			logger.error(`Failed to Create Profile ${error}`, false);
			return {
				success: false,
				error: `Failed to Create Profile ${error}`
			};
		}
	};

	// Initialize or get local profile
	const refreshLocalProfile = async (): Promise<IResult<IProfile>> => {
		logger.debug('Getting local profile');
		await ensureStorageDir();
		await ensureLocalRecord();

		try {
			const settingsResult: IResult<ISettings> =
				await readLocalSettings();
			if (!settingsResult.success) {
				return { success: false, error: settingsResult.error! };
			}
			const settings: ISettings = settingsResult.data!;
			const exts = getInstalledExtensions();
			const byteBuffer = await workspace.fs.readFile(localProfilePath);
			const localRecord: IProfile = JSON.parse(
				Buffer.from(byteBuffer).toString('utf8')
			) as IProfile;
			logger.debug(
				`Loaded existing profile: ${JSON.stringify(localRecord)}`
			);
			const profile = {
				...{ createdAt: Date.now() },
				...localRecord,
				...{
					settings: settings,
					extensions: exts
				}
			};
			if (
				!Object.is(settings, localRecord.settings) ||
				exts.length !== localRecord.extensions.length
			) {
				logger.inform(
					'Updating Local Profile Record, Configuration State has changed..'
				);
				updateLocalRecord(profile);
			}
			return { success: true, data: profile } as IResult<IProfile>;
		} catch (error) {
			logger.error(`Error getting local profile: ${error}`, false);
			return { success: false, error: error };
		}
	};

	// Load settings from the settings.json file
	const readLocalSettings = async (): Promise<IResult<ISettings>> => {
		try {
			const _settingsPath: string | undefined =
				stateValues.settingsPath.get();
			if (!_settingsPath) {
				throw new Error('Settings path not defined');
			}

			logger.debug(`Loading settings from: ${_settingsPath}`);
			const settings: ISettings = await loadSettings(_settingsPath);
			return { success: true, data: settings };
		} catch (error) {
			logger.error(`Failed to read settings: ${error}`, false);
			return { success: false, error: error };
		}
	};

	// Save settings to the settings.json file
	const applyToSettings = async (
		hotSettings: ISettings
	): Promise<IResult<any>> => {
		try {
			const _settingsPath = stateValues.settingsPath.get();
			if (!_settingsPath) {
				return { success: false, error: 'Settings path not defined' };
			}
			const settingsUri = Uri.parse(_settingsPath);
			logger.debug(`Saving settings to: ${settingsUri.path}`);
			// const coldSettings: ISettings = await loadSettings(_settingsPath);
			// const updatedSettings: ISettings = {
			// 	...coldSettings,
			// 	...hotSettings
			// };
			await workspace.fs.writeFile(
				Uri.parse(_settingsPath),
				Buffer.from(JSON.stringify(hotSettings), 'utf8')
			);
			return { success: true };
		} catch (error) {
			logger.error(`Failed to save settings: ${error}`, true);
			return { success: false, error };
		}
	};

	// Get currently installed extensions
	const getInstalledExtensions = (): string[] => {
		const extensionList = extensions.all
			.filter((ext: Extension<any>) => !ext.packageJSON.isBuiltin)
			.map((ext: Extension<any>) => ext.id);

		logger.debug(`Found ${extensionList.length} installed extensions`);
		return extensionList;
	};

	// Watch for changes to the settings.json file
	const startWatching = (): void => {
		const _settingsPath = stateValues.settingsPath.get();
		if (!_settingsPath) {
			logger.error(
				'Cannot start watching: Settings path not defined',
				false
			);
			return;
		}

		logger.debug(`Starting to watch settings file: ${_settingsPath}`);

		if (fileWatcher) {
			fileWatcher.dispose();

			fileWatcher = workspace.createFileSystemWatcher(
				_settingsPath,
				true,
				false,
				true
			);
			fileWatcher.onDidChange(async (uri: Uri) => {
				if (uri.fsPath !== stateValues.settingsPath.get()) {
					logger.debug('Settings file changed');

					const result = await refreshLocalProfile();
					if (result.success) {
						logger.debug(
							'Updated local profile after settings change'
						);
					} else {
						logger.error(
							`Error handling settings change: ${result.error}`,
							false
						);
					}
				}
			});

			// Also watch for extension changes
			const extensionWatcher = extensions.onDidChange(async () => {
				logger.debug('Extensions changed');
				try {
					await refreshLocalProfile();
					logger.debug(
						'Updated local profile after extensions change'
					);
				} catch (error) {
					logger.error(
						`Error handling extensions change: ${error}`,
						false
					);
				}
			});

			ctx.subscriptions.push(fileWatcher, extensionWatcher);
		}
	};
	const stopWatching = () => {
		if (fileWatcher) {
			logger.debug('Stopping settings file watcher');
			fileWatcher.dispose();
			fileWatcher = null;
		}
	};
	return {
		resetLocalProfile,
		isInitialized,
		startWatching,
		stopWatching,
		createLocalProfile,
		updateLocalRecord,
		refreshLocalProfile,
		readLocalSettings,
		getInstalledExtensions,
		applyToSettings
	};
};
