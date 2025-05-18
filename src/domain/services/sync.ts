import { machineId } from '../../shared/environment';
import { IGist } from '../../shared/schemas/api.git';
import { IDeviceProfile } from '../../shared/schemas/content';
import { IResult } from '../../shared/schemas/state';
import { ILogger } from '../../utils/logger';
import { IGistService } from './gist';

// src/domain/services/sync.ts
export const createSyncService = (
	gistService: IGistService,
	stateService: any, //todo: annotate state service
	conflictService: unknown,
	logger: ILogger
) => {
	// Push local settings to remote
	const push = async (): Promise<IResult<any>> => {
		try {
			const deviceLabel = stateService.getState('deviceLabel');
			const generalGistID = stateService.getState('generalGistID');
			const deviceGistID = stateService.getState('devicesGistID');

			if (!generalGistID || !deviceGistID) {
				throw new Error('Missing gist IDs');
			}

			// Get remote state
			const generalGist = await gistService.getGist({
				id: generalGistID
			});
			const deviceGist = await gistService.getGist({ id: deviceGistID });

			// Update device reference
			await updateDeviceReference(generalGist, deviceGist, deviceLabel);

			// Update device profile
			await updateDeviceProfile(deviceGist);

			return { success: true };
		} catch (error) {
			logger.error(`Push failed: ${error}`, true);
			return { success: false, error };
		}
	};

	// Pull remote settings to local
	const pull = async (): Promise<IResult<any>> => {
		try {
			const generalGistID = stateService.getState('generalGistID');
			const deviceGistID = stateService.getState('devicesGistID');

			if (!generalGistID || !deviceGistID) {
				throw new Error('Missing gist IDs');
			}

			// Get remote state
			const generalGist = await gistService.getGist(generalGistID);
			const deviceGist = await gistService.getGist(deviceGistID);

			// Check for conflicts
			const conflicts = conflictService.detectConflicts(
				await loadLocalSettings(),
				getRemoteSettings(deviceGist)
			);

			if (conflicts.length > 0) {
				// Handle conflicts
				const resolution = await conflictService.resolveConflicts(
					conflicts
				);
				if (!resolution.success) {
					return {
						success: false,
						error: 'Conflict resolution failed'
					};
				}

				// Apply resolved settings
				await applySettings(resolution.data);
			} else {
				// No conflicts, apply remote settings
				await applySettings(getRemoteSettings(deviceGist));
			}

			return { success: true };
		} catch (error) {
			logger.error(`Pull failed: ${error}`, true);
			return { success: false, error };
		}
	};

	// Helper functions for sync operations
	const updateDeviceReference = async (
		generalGist: IGist,
		deviceGist: IGist,
		deviceLabel: IGist
	) => {
		// Implementation similar to your existing sync.reference
	};

	const updateDeviceProfile = async (deviceGist: IGist) => {
		const filename = `${machineId.get()}.json`;
		await gistService.updateGist(deviceGist.id, {
			[filename]: {
				content: JSON.stringify(
					deviceGist.files[filename]?.content as IDeviceProfile
				)
			}
		});
	};

	const loadLocalSettings = async () => {
		// Load settings from local file
	};

	const getRemoteSettings = (deviceGist) => {
		// Extract settings from device gist
	};

	const applySettings = async (settings) => {
		// Apply settings to local file
	};

	return {
		push,
		pull,
		sync: async () => {
			// Two-way sync
			const pullResult = await pull();
			if (!pullResult.success) return pullResult;

			return await push();
		}
	};
};
