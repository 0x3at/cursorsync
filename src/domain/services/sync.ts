import { window } from 'vscode';

import { machineId } from '../../shared/environment';
import { IGist, IResult } from '../../shared/schemas/api.git';
import {
	IDeviceReference,
	IReferenceContent,
	ISettingsProfile
} from '../../shared/schemas/content';
import { ILogger } from '../../utils/logger';
import { loadSettings } from '../../utils/utils';
import { IGistService } from './gist';

// Define a basic interface for conflictService based on usage
interface IConflictService {
	detectConflicts: (
		localSettings: ISettingsProfile['settings'],
		remoteSettings: ISettingsProfile['settings']
	) => any[]; // Replace 'any[]' with actual conflict type array
	resolveConflicts: (conflicts: any[]) => Promise<IResult<any>>; // Replace 'any[]' and 'any' with actual conflict and settings types
}

// src/domain/services/conflict.ts
export enum ConflictResolutionStrategy {
	UseLocal,
	UseRemote,
	UseNewer,
	Manual
}

export interface IConflict {
	path: string[]; // Path to the setting
	localValue: any; // Local value
	remoteValue: any; // Remote value
	localTimestamp?: number;
	remoteTimestamp?: number;
}
// src/domain/services/sync.ts
export const createSyncService = (
	gistService: IGistService,
	stateService: any, //todo: annotate state service
	conflictService: IConflictService, // Typed conflictService
	logger: ILogger
) => {
	// Push local settings to remote
	const push = async (): Promise<IResult<any>> => {
		logger.debug('Starting push operation.');
		try {
			const deviceLabel = stateService.getState('deviceLabel');
			const referenceID = stateService.getState('referenceID');
			const settingsCollectionID = stateService.getState(
				'settingsCollectionID'
			);

			logger.debug(
				`Push: Retrieved state - deviceLabel: ${deviceLabel}, referenceID: ${referenceID}, deviceGistID: ${settingsCollectionID}`
			);

			if (!referenceID || !settingsCollectionID) {
				logger.debug('Push: Missing gist IDs.');
				throw new Error('Missing gist IDs');
			}

			logger.debug(`Push: Getting general gist with ID: ${referenceID}`);
			const referenceGist = await gistService.getGist({
				id: referenceID
			});
			logger.debug('Push: Successfully retrieved general gist.');

			logger.debug(
				`Push: Getting device gist with ID: ${settingsCollectionID}`
			);
			const settingsGist = await gistService.getGist({
				id: settingsCollectionID
			});
			logger.debug('Push: Successfully retrieved device gist.');

			logger.debug('Push: Updating device reference.');
			await updateReference(referenceGist, settingsGist);
			logger.debug('Push: Device reference updated.');

			logger.debug('Push: Updating device profile.');
			await updateSettingsProfile(settingsGist);
			logger.debug('Push: Device profile updated.');

			logger.debug('Push operation completed successfully.');
			return { success: true };
		} catch (error) {
			logger.error(`Push failed: ${error}`, true);
			return { success: false, error };
		}
	};

	// Pull remote settings to local
	const pull = async (): Promise<IResult<any>> => {
		logger.debug('Starting pull operation.');
		try {
			const referenceID = stateService.getState('referenceID');
			const deviceGistID = stateService.getState('settingsCollectionID');

			logger.debug(
				`Pull: Retrieved state - referenceID: ${referenceID}, deviceGistID: ${deviceGistID}`
			);

			if (!referenceID || !deviceGistID) {
				logger.debug('Pull: Missing gist IDs.');
				throw new Error('Missing gist IDs');
			}

			logger.debug(`Pull: Getting general gist with ID: ${referenceID}`);
			const generalGist = await gistService.getGist(referenceID);
			logger.debug('Pull: Successfully retrieved general gist.');

			logger.debug(`Pull: Getting device gist with ID: ${deviceGistID}`);
			const deviceGist = await gistService.getGist(deviceGistID);
			logger.debug('Pull: Successfully retrieved device gist.');

			logger.debug('Pull: Loading local settings.');
			const localSettings = await loadLocalSettings();
			logger.debug('Pull: Successfully loaded local settings.');

			logger.debug('Pull: Getting remote settings.');
			const remoteSettings = await getRemoteSettings(deviceGist);
			logger.debug('Pull: Successfully retrieved remote settings.');

			logger.debug('Pull: Checking for conflicts.');
			const conflicts = conflictService.detectConflicts(
				localSettings,
				remoteSettings // getRemoteSettings is now async
			);
			logger.debug(
				`Pull: Detected ${
					conflicts.length
				} conflicts. Conflicts: ${JSON.stringify(conflicts)}`
			);

			if (conflicts.length > 0) {
				logger.debug('Pull: Conflicts found, resolving conflicts.');
				const resolution = await conflictService.resolveConflicts(
					conflicts
				);
				logger.debug(
					`Pull: Conflict resolution result: ${
						resolution.success
					}. Resolution: ${JSON.stringify(resolution)}`
				);

				if (!resolution.success) {
					logger.debug('Pull: Conflict resolution failed.');
					return {
						success: false,
						error: 'Conflict resolution failed'
					};
				}

				logger.debug('Pull: Applying resolved settings.');
				await applySettings(resolution.data);
				logger.debug('Pull: Resolved settings applied.');
			} else {
				logger.debug(
					'Pull: No conflicts found, applying remote settings.'
				);
				await applySettings(remoteSettings); // getRemoteSettings is now async
				logger.debug('Pull: Remote settings applied.');
			}

			logger.debug('Pull operation completed successfully.');
			return { success: true };
		} catch (error) {
			logger.error(`Pull failed: ${error}`, true);
			return { success: false, error };
		}
	};

	// Helper functions for sync operations
	const updateReference = async (
		referenceGist: IGist,
		settingsGist: IGist
	) => {
		logger.debug('Starting updateDeviceReference.');
		try {
			const referencesFile = referenceGist.files['references.json'];
			const deviceList =
				(referencesFile?.content as IReferenceContent)?.devices || [];
			logger.debug(
				`updateDeviceReference: Retrieved device list from reference gist. List: ${JSON.stringify(
					deviceList
				)}`
			);

			const deviceReference = {
				deviceID: machineId.get(),
				deviceLabel: stateService.getState('deviceLabel'),
				targetMaster: false,
				extensionProfile: stateService.getState('extensionProfile'),
				settingsProfile: stateService.getState('settingsProfile'),
				lastSync: Date.now()
			} as Partial<IDeviceReference>;
			logger.debug(
				`updateDeviceReference: Created device reference object. Reference: ${JSON.stringify(
					deviceReference
				)}`
			);

			// Find and update the existing reference or add a new one
			const existingIndex = deviceList.findIndex(
				(reference: IDeviceReference) =>
					reference.deviceID === machineId.get() // Explicitly type reference
			);
			logger.debug(
				`updateDeviceReference: Existing device reference index: ${existingIndex}`
			);

			if (existingIndex !== -1) {
				logger.debug(
					'updateDeviceReference: Updating existing device reference.'
				);
				deviceList[existingIndex] = {
					...deviceList[existingIndex],
					...deviceReference
				} as IDeviceReference;
			} else {
				logger.debug(
					'updateDeviceReference: Adding new device reference.'
				);
				deviceList.push(deviceReference as IDeviceReference);
			}
			logger.debug(
				`updateDeviceReference: Final device list. List: ${JSON.stringify(
					deviceList
				)}`
			);

			// Update the general gist with the modified device list
			const filesToUpdate: { [key: string]: { content: string } } = {
				'references.json': {
					content: JSON.stringify({
						// Preserve other properties if any, like 'created', 'lastUpdate'
						...(referencesFile?.content as IReferenceContent),
						devices: deviceList
					})
				}
			};
			logger.debug(
				`updateDeviceReference: Files to update in general gist. Files: ${JSON.stringify(
					filesToUpdate
				)}`
			);

			logger.debug(
				`updateDeviceReference: Updating general gist with ID: ${referenceGist.id}`
			);
			await gistService.updateGist(referenceGist.id, filesToUpdate);
			logger.debug(
				'updateDeviceReference: General gist updated successfully.'
			);
		} catch (error) {
			logger.error(`Failed to update references file: ${error}`, true);
			throw error; // Re-throw the error to be caught by the caller (e.g., push function)
		}
	};

	const updateSettingsProfile = async (settingsGist: IGist) => {
		logger.debug('Starting updateDeviceProfile.');
		try {
			logger.debug(
				`updateDeviceProfile: Updating file: Settings gist with ID: ${settingsGist.id}`
			);
			await gistService.updateGist(settingsGist.id, settingsGist.files);
			logger.debug(
				'updateDeviceProfile: Device gist updated successfully.'
			);
		} catch (error) {
			logger.error(
				`Failed to update device profile file: ${error}`,
				true
			);
			throw error; // Re-throw
		}
	};

	const loadLocalSettings = async () => {
		logger.debug('Starting loadLocalSettings.');
		// Load settings from local file using the settingsPath from stateService
		const settingsPath = stateService.getState('settingsPath');
		logger.debug(
			`loadLocalSettings: Settings path from state: ${settingsPath}`
		);
		if (!settingsPath) {
			logger.debug('loadLocalSettings: Settings path not found.');
			throw new Error('Settings path not found in state.');
		}
		const settings = await loadSettings(settingsPath);
		logger.debug(
			`loadLocalSettings: Successfully loaded settings. Settings: ${JSON.stringify(
				settings
			)}`
		);
		return settings;
	};

	const getRemoteSettings = async (deviceGist: IGist) => {
		logger.debug('Starting getRemoteSettings.');
		// Extract settings from device gist
		logger.debug(
			`getRemoteSettings: Getting device gist with ID: ${deviceGist.id} to ensure full content.`
		);
		deviceGist = await gistService.getGist({
			id: deviceGist.id
		});
		logger.debug('getRemoteSettings: Successfully retrieved device gist.');

		logger.debug(`getRemoteSettings: Extracting settings`);
		const deviceProfile = deviceGist.files[
			stateService.getState('deviceProfile')
		]?.content as ISettingsProfile;
		const settings = deviceProfile?.settings;
		logger.debug(
			`getRemoteSettings: Extracted settings. Settings: ${JSON.stringify(
				settings
			)}`
		);
		return settings;
	};

	const applySettings = async (settings: any) => {
		logger.debug(
			`Starting applySettings. Settings: ${JSON.stringify(settings)}`
		);
		// Replace 'any' with actual settings type
		// Apply settings to local file
		// This likely involves using VS Code's configuration API or a dedicated save function
		console.log('Applying settings:', settings); // Placeholder
		logger.debug('applySettings: Finished (placeholder).');
	};

	return {
		push,
		pull,
		sync: async () => {
			logger.debug('Starting two-way sync.');
			// Two-way sync
			logger.debug('Sync: Starting pull.');
			const pullResult = await pull();
			logger.debug([
				`Sync: Pull result: ${pullResult.success}`,
				pullResult
			]);
			if (!pullResult.success) {
				logger.debug('Sync: Pull failed, stopping sync.');
				return pullResult;
			}

			logger.debug('Sync: Pull successful, starting push.');
			const pushResult = await push();
			logger.debug([
				`Sync: Push result: ${pushResult.success}`,
				pushResult
			]);
			return pushResult;
		}
	};
};

// TODO: Refactor to with the remote IGist and the local profile.json
// ? Identify Differences
// ? Handle Conflicts between the remote Extension Profile & Settings Profile associated the with local profile configuration
export const createConflictService = (logger: ILogger) => {
	logger.debug('Creating conflict service.');
	const detectConflicts = (
		local: any, // todo: annotate type
		remote: any // todo: annotate type
	): IConflict[] => {
		logger.debug(
			`Starting detectConflicts (in createConflictService). Local: ${JSON.stringify(
				local
			)}, Remote: ${JSON.stringify(remote)}`
		);
		const conflicts: IConflict[] = [];

		const compare = (
			localObj: any, // todo: annotate type
			remoteObj: any, // todo: annotate type
			path: string[] = []
		) => {
			logger.debug(
				`detectConflicts (in createConflictService): compare function called. Path: ${JSON.stringify(
					path
				)}, LocalObj: ${JSON.stringify(
					localObj
				)}, RemoteObj: ${JSON.stringify(remoteObj)}`
			);
			if (!localObj || !remoteObj) {
				logger.debug(
					'detectConflicts (in createConflictService): compare - one of the objects is null or undefined.'
				);
				return;
			}

			// Get all keys from both objects
			const keys = new Set([
				...Object.keys(localObj),
				...Object.keys(remoteObj)
			]);
			logger.debug(
				`detectConflicts (in createConflictService): compare - keys found. Keys: ${JSON.stringify(
					Array.from(keys)
				)}`
			);

			for (const key of keys) {
				const localValue = localObj[key];
				const remoteValue = remoteObj[key];
				const currentPath = [...path, key];
				logger.debug(
					`detectConflicts (in createConflictService): compare - checking key. Key: ${key}, CurrentPath: ${JSON.stringify(
						currentPath
					)}, LocalValue: ${JSON.stringify(
						localValue
					)}, RemoteValue: ${JSON.stringify(remoteValue)}`
				);

				// If values are different
				if (
					JSON.stringify(localValue) !== JSON.stringify(remoteValue)
				) {
					logger.debug(
						'detectConflicts (in createConflictService): compare - values are different.'
					);
					if (
						typeof localValue === 'object' &&
						typeof remoteValue === 'object' &&
						localValue !== null && // Ensure they are not null
						remoteValue !== null
					) {
						// Recurse into nested objects
						logger.debug(
							'detectConflicts (in createConflictService): compare - recursing into nested objects.'
						);
						compare(localValue, remoteValue, currentPath);
					} else {
						// Add to conflicts
						logger.debug(
							`detectConflicts (in createConflictService): compare - adding conflict. Conflict: ${JSON.stringify(
								{ currentPath, localValue, remoteValue }
							)}`
						);
						conflicts.push({
							path: currentPath,
							localValue,
							remoteValue,
							localTimestamp: localObj._timestamp,
							remoteTimestamp: remoteObj._timestamp
						});
					}
				}
			}
		};

		compare(local, remote);
		logger.debug(
			`detectConflicts (in createConflictService): Finished. Found ${
				conflicts.length
			} conflicts. Conflicts: ${JSON.stringify(conflicts)}`
		);
		return conflicts;
	};

	// Resolve conflicts automatically based on strategy
	const resolveAutomatically = (
		conflicts: IConflict[],
		strategy: ConflictResolutionStrategy
	): any => {
		// todo: annotate return type
		logger.debug(
			`Starting resolveAutomatically (in createConflictService). Conflicts: ${JSON.stringify(
				conflicts
			)}, Strategy: ${ConflictResolutionStrategy[strategy]}`
		);
		// Create a copy of the settings
		const result = {};

		conflicts.forEach((conflict) => {
			logger.debug(
				`resolveAutomatically (in createConflictService): Processing conflict. Conflict: ${JSON.stringify(
					conflict
				)}`
			);
			let value;

			switch (strategy) {
				case ConflictResolutionStrategy.UseLocal:
					logger.debug(
						'resolveAutomatically (in createConflictService): Using local value.'
					);
					value = conflict.localValue;
					break;
				case ConflictResolutionStrategy.UseRemote:
					logger.debug(
						'resolveAutomatically (in createConflictService): Using remote value.'
					);
					value = conflict.remoteValue;
					break;
				case ConflictResolutionStrategy.UseNewer:
					logger.debug(
						'resolveAutomatically (in createConflictService): Using newer value.'
					);
					value =
						(conflict.localTimestamp || 0) >
						(conflict.remoteTimestamp || 0)
							? conflict.localValue
							: conflict.remoteValue;
					break;
				default:
					// Manual strategy shouldn't reach here
					logger.debug(
						'resolveAutomatically (in createConflictService): Using default local value for manual strategy (should not happen).'
					);
					value = conflict.localValue;
			}

			// Set value in result
			logger.debug(
				`resolveAutomatically (in createConflictService): Setting nested value. Path: ${JSON.stringify(
					conflict.path
				)}, Value: ${JSON.stringify(value)}`
			);
			setNestedValue(result, conflict.path, value);
		});
		logger.debug(
			`resolveAutomatically (in createConflictService): Finished. Result: ${JSON.stringify(
				result
			)}`
		);
		return result;
	};

	// Resolve conflicts with user input
	const resolveConflicts = async (
		conflicts: IConflict[]
	): Promise<IResult<any>> => {
		// todo: annotate return type
		logger.debug(
			`Starting resolveConflicts (user input, in createConflictService). Conflicts: ${JSON.stringify(
				conflicts
			)}`
		);
		// Ask user which strategy to use
		const selection = await window.showQuickPick(
			[
				{
					label: 'Use Local Settings',
					strategy: ConflictResolutionStrategy.UseLocal
				},
				{
					label: 'Use Remote Settings',
					strategy: ConflictResolutionStrategy.UseRemote
				},
				{
					label: 'Use Newer Settings',
					strategy: ConflictResolutionStrategy.UseNewer
				},
				{
					label: 'Resolve Manually',
					strategy: ConflictResolutionStrategy.Manual
				}
			],
			{ placeHolder: 'How would you like to resolve conflicts?' }
		);

		logger.debug(
			`resolveConflicts (in createConflictService): User selection. Selection: ${JSON.stringify(
				selection
			)}`
		);

		if (!selection) {
			logger.debug(
				'resolveConflicts (in createConflictService): User cancelled conflict resolution.'
			);
			return { success: false, error: 'Conflict resolution cancelled' };
		}

		if (selection.strategy === ConflictResolutionStrategy.Manual) {
			logger.debug(
				'resolveConflicts (in createConflictService): Starting manual resolution.'
			);
			// Show conflict resolution UI
			return await resolveManually(conflicts);
		} else {
			logger.debug(
				`resolveConflicts (in createConflictService): Starting automatic resolution with strategy: ${
					ConflictResolutionStrategy[selection.strategy]
				}.`
			);
			// Resolve automatically
			const resolved = resolveAutomatically(
				conflicts,
				selection.strategy
			);
			logger.debug(
				`resolveConflicts (in createConflictService): Automatic resolution finished. Resolved: ${JSON.stringify(
					resolved
				)}`
			);
			return { success: true, data: resolved };
		}
	};

	// Resolve conflicts manually
	const resolveManually = async (
		conflicts: IConflict[]
	): Promise<IResult<any>> => {
		// todo: annotate return type
		logger.debug(
			`Starting resolveManually (in createConflictService). Conflicts: ${JSON.stringify(
				conflicts
			)}`
		);
		// This would show a UI for resolving each conflict
		// For now, we'll just use a simple loop with quick picks
		const result = {};
		logger.debug(
			`resolveManually (in createConflictService): Initial result object. Result: ${JSON.stringify(
				result
			)}`
		);

		for (const conflict of conflicts) {
			logger.debug(
				`resolveManually (in createConflictService): Processing conflict. Conflict: ${JSON.stringify(
					conflict
				)}`
			);
			const selection = await window.showQuickPick(
				[
					{ label: 'Use Local Value', value: conflict.localValue },
					{ label: 'Use Remote Value', value: conflict.remoteValue }
				],
				{
					placeHolder: `Resolve conflict for ${conflict.path.join(
						'.'
					)}`,
					title: `Local: ${JSON.stringify(
						conflict.localValue
					)}][ Remote: ${JSON.stringify(conflict.remoteValue)}`, // Added closing bracket
					canPickMany: false,
					ignoreFocusOut: true
				}
			);

			logger.debug(
				`resolveManually (in createConflictService): User selection for conflict. Selection: ${JSON.stringify(
					selection
				)}`
			);

			if (!selection) {
				logger.debug(
					'resolveManually (in createConflictService): User cancelled manual resolution.'
				);
				return {
					success: false,
					error: 'Conflict resolution cancelled'
				};
			}

			logger.debug(
				`resolveManually (in createConflictService): Setting nested value. Path: ${JSON.stringify(
					conflict.path
				)}, Value: ${JSON.stringify(selection.value)}`
			);
			setNestedValue(result, conflict.path, selection.value);
		}

		logger.debug(
			`resolveManually (in createConflictService): Finished. Result: ${JSON.stringify(
				result
			)}`
		);
		return { success: true, data: result };
	};

	// Helper to set a nested value in an object
	const setNestedValue = (obj: any, path: string[], value: any) => {
		let current = obj;

		for (let i = 0; i < path.length - 1; i++) {
			const key = path[i];
			current[key] = current[key] || {};
			current = current[key];
		}

		current[path[path.length - 1]] = value;
		logger.debug('setNestedValue (in createConflictService): Value set.');
	};

	return {
		detectConflicts,
		resolveConflicts,
		resolveAutomatically
	};
};
