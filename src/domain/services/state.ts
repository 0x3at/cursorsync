import { Disposable, ExtensionContext } from 'vscode';

import { contextFlags } from '../../shared/environment';
import { IResult } from '../../shared/schemas/api.git';
import { ILogger } from '../../utils/logger';
import { createValueStore, IValueStore } from '../../utils/stores';
import {
	registerDebugContext,
	registerDebugState,
	registerResetState
} from '../commands/debug';
import {
	registerUpdateLabel,
	registerUpdateSettingsLocation
} from '../commands/set';
import { createApiService, createAuthService } from './api';
import { createGistService } from './gist';
import { createConflictService, createSyncService } from './sync';

// Define a type for stateService
type StateServiceType = {
	deviceLabel: IValueStore<string>;
	settingsPath: IValueStore<string>;
	referenceID: IValueStore<string>;
	extensionCollectionID: IValueStore<string>;
	extensionProfile: IValueStore<string>;
	settingsCollectionID: IValueStore<string>;
	settingsProfile: IValueStore<string>;
	getState: (
		key: keyof Omit<StateServiceType, 'getState' | 'setState'>
	) => string | undefined; // Use keyof Omit to restrict keys
	setState: (
		key: keyof Omit<StateServiceType, 'getState' | 'setState'>,
		value: any
	) => void; // Use keyof Omit to restrict keys
};

// src/domain/core.ts
export const createCore = async (
	ctx: ExtensionContext,
	logger: ILogger
): Promise<IResult<any>> => {
	try {
		const dev = true;
		const flags = contextFlags;
		if (dev === true) {
			flags.DevMode.methods.activate();
		} else {
			flags.DevMode.methods.deactivate();
		}

		// Register Debug Commands
		const runDebugState = registerDebugState(ctx, logger);
		const runDebugContext = registerDebugContext(logger, flags);
		const runResetState = registerResetState(ctx, logger);

		// Initialize services
		const authService = createAuthService(logger);
		const apiService = createApiService(authService, logger);
		const gistService = createGistService(apiService, logger);

		// Create value stores
		const stateService: StateServiceType = {
			deviceLabel: createValueStore({
				val: ctx.globalState.get('deviceLabel'),
				getter: () => ctx.globalState.get('deviceLabel'),
				setter: (val: string) =>
					ctx.globalState.update('deviceLabel', val)
			}),

			settingsPath: createValueStore({
				val: ctx.globalState.get('settingsPath'),
				getter: () => ctx.globalState.get('settingsPath'),
				setter: (val: string) =>
					ctx.globalState.update('settingsPath', val)
			}),
			referenceID: createValueStore({
				val: ctx.globalState.get('referenceID'),
				getter: () => ctx.globalState.get('referenceID'),
				setter: (val: string) =>
					ctx.globalState.update('referenceID', val)
			}),
			settingsCollectionID: createValueStore({
				val: ctx.globalState.get('settingsCollectionID'),
				getter: () => ctx.globalState.get('settingsCollectionID'),
				setter: (val: string) =>
					ctx.globalState.update('settingsCollectionID', val)
			}),
			extensionCollectionID: createValueStore({
				val: ctx.globalState.get('extensionCollectionID'),
				getter: () => ctx.globalState.get('extensionCollectionID'),
				setter: (val: string) =>
					ctx.globalState.update('extensionCollectionID', val)
			}),
			settingsProfile: createValueStore({
				val: ctx.globalState.get('settingsProfile'),
				getter: () => ctx.globalState.get('settingsProfile'),
				setter: (val: string) =>
					ctx.globalState.update('settingsProfile', val)
			}),
			extensionProfile: createValueStore({
				val: ctx.globalState.get('extensionProfile'),
				getter: () => ctx.globalState.get('extensionProfile'),
				setter: (val: string) =>
					ctx.globalState.update('extensionProfile', val)
			}),
			getState: (key) => stateService[key]?.get() as string | undefined,
			setState: (key, value: any) => stateService[key]?.set(value)
		};

		// Initiatialize Store Dependent Commands
		const runUpdateLabel = registerUpdateLabel(
			stateService.deviceLabel,
			logger
		);
		const runUpdateSettingsLocation = registerUpdateSettingsLocation(
			stateService.settingsPath
		);

		const conflictService = createConflictService(logger);
		const syncService = createSyncService(
			gistService,
			stateService as any,
			conflictService,
			logger
		);

		// TODO: Create Profile Service
		// ? @src/services/profile.ts
		// ? Profile service is the highlevel wrapper that abstracts different combinations of configs into profiles
		// ? A profile is composed of a settings profile and an extension profile
		// ? Manages switching, creating, deleting profiles

		//TODO: Create Local Service who stores data in a minimized profile state
		// ? @src/services/local.ts
		// ? Local Service manages the settings.json filewatcher & the periodic scanning of the global extension list
		// ? The profile.json should act as the local head and state of the local profile

		//TODO: Create Remote Service which will act as a store whos getters and setters always pull from remote
		// ? @src/services/remote.ts
		// ? Store for all Remote Gists
		// ? Getters reload the object on call
		// ? Setters update the object VIA the API
		// Register commands
		const commands: Disposable[] = [
			runDebugContext,
			runDebugState,
			runResetState,
			runUpdateLabel,
			runUpdateSettingsLocation
		];

		return {
			success: true,
			data: {
				localstore: () => {},
				remotestore: () => {},
				services: {
					auth: authService,
					api: apiService,
					gist: gistService,
					sync: syncService,
					conflict: conflictService
				},
				state: stateService,
				commands
			}
		};
	} catch (error) {
		logger.error(`Failed to initialize core: ${error}`, true);
		return { success: false, error };
	}
};
