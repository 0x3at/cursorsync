import { Disposable, ExtensionContext, window } from 'vscode';
import * as vscode from 'vscode';

import { contextFlags, IFlags } from '../../shared/environment';
import { IResult } from '../../shared/schemas/api.git';
import { IProfile } from '../../shared/schemas/profile';
import { ILogger } from '../../utils/logger';
import { createValueStore, IValueStore } from '../../utils/stores';
import { registerUpdateSettingsLocation } from '../commands/set';
import {
	createApiService,
	createAuthService,
	IApiService,
	IAuthService
} from '../services/api';
import {
	createGistService,
	IGistService,
	IupdateProfileOpts
} from '../services/gist';
import { createLocalService, ILocalService } from '../services/local';
import { createProfileService, IProfileService } from '../services/profile';
import { createRemoteService, IRemoteService } from '../services/remote';

export interface IStateValues {
	activeProfile: IValueStore<string>;
	collectionID: IValueStore<string>;
	settingsPath: IValueStore<string>;
}

export interface IExtensionCore {
	flags: IFlags;
	settingsPath: IValueStore<string>;
	activeProfile: IValueStore<string>;
	collectionID: IValueStore<string>;
	services: {
		auth: IAuthService;
		api: IApiService;
		gist: IGistService;
		local: ILocalService;
		remote: IRemoteService;
		profile: IProfileService;
	};
	disposables: Disposable[];
}

export const buildExtensionCore = async (
	context: ExtensionContext,
	logger: ILogger
): Promise<IResult<IExtensionCore>> => {
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

		if (!stateValues.settingsPath.get()) {
			await vscode.commands.executeCommand(
				'cursorsync.update.settingspath'
			);
		}
		const commands: Disposable[] = [runUpdateSettingsLocation];

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
		const profileService = await createProfileService(
			localService,
			remoteService,
			stateValues,
			logger
		);
		const isLocalInitialized = await localService.isInitialized();
		const isRemoteInitialized = await remoteService.isInitialized();

		logger.debug(
			`Local initialized: ${isLocalInitialized.success}, Remote initialized: ${isRemoteInitialized}`
		);

		// Handle four possible scenarios
		if (isLocalInitialized.success && isRemoteInitialized) {
			// 1. Both local and remote are initialized - normal operation
			logger.inform('CursorSync is ready and synchronized');

			// Start file watcher
			localService.startWatching();
		} else if (isLocalInitialized.success && !isRemoteInitialized) {
			// 2. Local exists but remote doesn't - ask to create remote
			const shouldCreateRemote = await window.showQuickPick(
				['Yes, create remote profiles', 'No, keep local only'],
				{
					placeHolder:
						'Local profile exists but no remote. Create remote profile list?'
				}
			);

			if (shouldCreateRemote === 'Yes, create remote profiles') {
				// Use existing local profile to initialize remote
				const localProfile = isLocalInitialized.data!;
				const remoteResult = await remoteService.initializeRemote(
					localProfile
				);

				if (remoteResult.success) {
					logger.inform(
						'Remote profile collection created successfully'
					);
					stateValues.collectionID.set(remoteResult.data!.id);
					localService.startWatching();
				} else {
					throw new Error(
						`Failed to create remote profile: ${remoteResult.error}`
					);
				}
			} else {
				logger.inform('Continuing with local profile only');
				localService.startWatching();
			}
		} else if (!isLocalInitialized.success && isRemoteInitialized) {
			// 3. Remote exists but local doesn't - ask to use existing or create new
			const profileList = await remoteService.pullProfileList();

			if (!profileList.success) {
				throw new Error(
					`Failed to pull profile list: ${profileList.error}`
				);
			}

			// Only offer to create new if we have the profile list
			const options = ['Create new profile', ...profileList.data!];
			const selection = await window.showQuickPick(options, {
				placeHolder: 'Select a profile or create a new one'
			});

			if (!selection) {
				throw new Error('Profile selection was cancelled');
			}

			if (selection === 'Create new profile') {
				// Create new profile flow
				const profileName = await window.showInputBox({
					placeHolder: 'Enter a name for your new profile',
					prompt: 'Profile names should be descriptive (e.g., "Work", "Personal")'
				});

				if (!profileName) {
					throw new Error('Profile name is required');
				}

				// Ask for optional tags
				const tagString = await window.showInputBox({
					placeHolder: 'Optional: Enter tags separated by commas',
					prompt: 'Tags help you organize profiles (e.g., "work,development")'
				});

				const tags = tagString
					? tagString.split(',').map((t) => t.trim())
					: [];

				// Create profile
				const settingsResult = await localService.readLocalSettings();
				if (!settingsResult.success) {
					throw new Error(
						`Failed to read settings: ${settingsResult.error}`
					);
				}

				const profile: IProfile = {
					default: false,
					profileName: profileName,
					tags: tags,
					createdAt: Date.now(),
					modifiedAt: Date.now(),
					settings: settingsResult.data!,
					extensions: localService.getInstalledExtensions()
				};

				// Create local profile
				const localResult = await localService.createLocalProfile(
					profile
				);
				if (!localResult.success) {
					throw new Error(
						`Failed to create local profile: ${localResult.error}`
					);
				}

				// Push to remote
				const remoteResult = await remoteService.createProfile(
					profile,
					{
						profileListID: stateValues.collectionID.get()
					} as IupdateProfileOpts
				);

				if (!remoteResult.success) {
					throw new Error(
						`Failed to create remote profile: ${remoteResult.error}`
					);
				}

				logger.inform(`Profile "${profileName}" created successfully`);
				localService.startWatching();
			} else {
				// User selected an existing profile
				const profileService = await createProfileService(
					localService,
					remoteService,
					stateValues,
					logger
				);

				const switchResult = await profileService.switchProfile(
					selection
				);
				if (!switchResult.success) {
					throw new Error(
						`Failed to switch profile: ${switchResult.error}`
					);
				}

				logger.inform(`Switched to profile "${selection}"`);
				localService.startWatching();
			}
		} else {
			// 4. Neither exists - first-time setup
			logger.inform(
				'Welcome to CursorSync! Setting up your first profile...'
			);

			// Get profile name
			const profileName = await window.showInputBox({
				placeHolder: 'Enter a name for your profile',
				prompt: 'This will be your default profile'
			});

			if (!profileName) {
				throw new Error('Profile name is required for setup');
			}

			// Ask for optional tags
			const tagString = await window.showInputBox({
				placeHolder: 'Optional: Enter tags separated by commas',
				prompt: 'Tags help you organize profiles (e.g., "work,development")'
			});

			const tags = tagString
				? tagString.split(',').map((t) => t.trim())
				: [];

			// Create default profile
			const settingsResult = await localService.readLocalSettings();
			if (!settingsResult.success) {
				throw new Error(
					`Failed to read settings: ${settingsResult.error}`
				);
			}

			const profile: IProfile = {
				default: true, // This is the default profile
				profileName: profileName,
				tags: tags,
				createdAt: Date.now(),
				modifiedAt: Date.now(),
				settings: settingsResult.data!,
				extensions: localService.getInstalledExtensions()
			};

			// Create local profile
			const localResult = await localService.createLocalProfile(profile);
			if (!localResult.success) {
				throw new Error(
					`Failed to create local profile: ${localResult.error}`
				);
			}

			// Initialize remote
			const remoteResult = await remoteService.initializeRemote(profile);
			if (!remoteResult.success) {
				throw new Error(
					`Failed to initialize remote: ${remoteResult.error}`
				);
			}

			logger.inform(
				`Profile "${profileName}" created and synced to GitHub`
			);
			localService.startWatching();
		}

		// Create the core object
		const core = {
			// State values
			settingsPath: stateValues.settingsPath,
			activeProfile: stateValues.activeProfile,
			collectionID: stateValues.collectionID,
			flags: flags,

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
