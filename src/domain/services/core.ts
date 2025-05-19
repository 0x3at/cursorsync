import { Disposable, ExtensionContext, window } from 'vscode';

import { contextFlags } from '../../shared/environment';
import { IProfile } from '../../shared/schemas/profile';
import { ILogger } from '../../utils/logger';
import { createValueStore, IValueStore } from '../../utils/stores';
import {
	registerDebugContext,
	registerDebugSession,
	registerDebugState,
	registerResetState
} from '../commands/debug';
import { registerUpdateSettingsLocation } from '../commands/set';
import { createApiService, createAuthService } from '../services/api';
import { createGistService } from '../services/gist';
import { createLocalService } from '../services/local';
import { createProfileService } from '../services/profile';
import { createRemoteService } from '../services/remote';

export interface IStateValues {
	activeProfile: IValueStore<string>;
	collectionID: IValueStore<string>;
	settingsPath: IValueStore<string>;
}

export const buildExtensionCore = async (
	context: ExtensionContext,
	logger: ILogger
) => {
	try {
		logger.debug('Building extension core');

		// Set development mode flag
		const dev = true;
		const flags = contextFlags;

		if (dev === true) {
			flags.DevMode.methods.activate();
		} else {
			flags.DevMode.methods.deactivate();
		}

		// Register Debug Commands
		const runDebugState = registerDebugState(context, logger);
		const runDebugContext = registerDebugContext(logger, flags);
		const runResetState = registerResetState(context, logger);
		const runDebugSession = registerDebugSession(logger);

		// Initialize value stores
		const stateValues = {
			activeProfile: createValueStore({
				val: context.globalState.get('activeProfile'),
				getter: () => context.globalState.get('activeProfile'),
				setter: (val: string) =>
					context.globalState.update('activeProfile', val)
			}),
			settingsPath: createValueStore({
				val: context.globalState.get('settingsPath'),
				getter: () => context.globalState.get('settingsPath'),
				setter: (val: string) =>
					context.globalState.update('settingsPath', val)
			}),
			collectionID: createValueStore({
				val: context.globalState.get('collectionID'),
				getter: () => context.globalState.get('collectionID'),
				setter: (val: string) =>
					context.globalState.update('collectionID', val)
			})
		};

		// Deprecated
		// Initialize store-dependent commands
		// const runUpdateLabel = registerUpdateLabel(
		// 	stateValues.deviceLabel,
		// 	logger
		// );

		const runUpdateSettingsLocation = registerUpdateSettingsLocation(
			stateValues.settingsPath
		);

		// Initialize services
		const authService = createAuthService(logger);
		const apiService = createApiService(authService, logger);
		const gistService = createGistService(apiService, logger);

		// Create new services
		const localService = createLocalService(context, logger, stateValues);
		const remoteService = createRemoteService(
			gistService,
			logger,
			stateValues
		);
		const profileService = createProfileService(
			localService,
			remoteService,
			stateValues,
			logger
		);
		const initLocal = await localService.isInitialized();
		const initRemote = await remoteService.isInitialized();
		if (!initLocal.success) {
			// If Remote Does not exist create profile
			if (!initRemote) {
				// Get Profile Name
				// If Undefined should be a substring of the machineId.get()
				const profileName: string | undefined =
					await window.showInputBox();
				// ask the user if they want to add optional tags
				// comma dellimited string parsed into a list
				const tagstring: string | undefined =
					await window.showInputBox();
				const settingsResult = await localService.readLocalSettings();
				if (!settingsResult.success) {
					// return error result
				}
				const tags: string[] = String(tagstring).split(`,`);
				const hotProfile: IProfile = {
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					profileName: profileName,
					tags: tags,
					extensions: localService.getInstalledExtensions(),
					settings: settingsResult.data!
				};
				localService.createLocalProfile(hotProfile);
				remoteService.initializeRemote(hotProfile);
			} else {
				// If Remote Exists Pull Profile List
				// 		Create New Profile
				// 		or
				// 		Pull Profile From List
				const profileList = await remoteService.pullProfileList();
				const createNew = await window.showQuickPick(['yes', 'no']);
				if (createNew) {
					// create profile flow
				} else {
					// Select Existing
					const targetProfile = await window.showQuickPick(
						profileList.data!
					);
					const switchResult = (await profileService).switchProfile(
						targetProfile as string
					);
				}
			}
		}

		// Start file watcher
		localService.startWatching();

		// Create commands array
		const commands: Disposable[] = [
			runDebugContext,
			runDebugState,
			runResetState,
			runDebugSession,
			runUpdateSettingsLocation
		];

		// Create the core object
		const core = {
			// State values
			settingsPath: stateValues.settingsPath,

			// Gist data

			// Services
			services: {
				auth: authService,
				api: apiService,
				gist: gistService,
				local: localService,
				remote: remoteService,
				profile: profileService
			},

			// Disposables for cleanup
			disposables: commands
		};
		return {
			success: true,
			data: core
		};
	} catch (error) {
		logger.error(`Failed to build extension core: ${error}`, true);
		return { success: false, error };
	}
};
