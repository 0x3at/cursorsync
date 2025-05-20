import { IResult } from '../../shared/schemas/api.git';
import { IProfile, ISettings } from '../../shared/schemas/profile';
import { ILogger } from '../../utils/logger';
import { IStateValues } from './core';
import { IgetProfileOpts, IupdateProfileOpts } from './gist';
import { ILocalService } from './local';
import { IRemoteService } from './remote';

export interface IProfileService {
	// Get available profiles
	getAvailableProfiles(
		full?: boolean
	): Promise<IResult<IProfile[] | string[]>>;

	// Get current profile
	getCurrentProfile(): Promise<
		IResult<{ localProfile: IProfile; remoteProfile: IProfile }>
	>;

	// Switch to a different profile
	switchProfile(profileName: string): Promise<IResult<any>>;

	// Create a new profile
	createProfile(
		profileName: string,
		setDefault?: boolean,
		tags?: string[]
	): Promise<{
		success: boolean;
		data: { local: IResult<IProfile>; remote: IResult<IProfile> };
	}>;

	// Delete a profile
	deleteProfile(profileName: string): Promise<IResult<void>>;

	// Sync current profile
	syncProfile(): Promise<IResult<IProfile>>;

	// Import profile from another device
	// importProfileFromDevice(deviceId: string): Promise<IResult<any>>; // Not implemented

	// Export profile to all devices
	// exportProfileToAllDevices(profileName: string): Promise<IResult<any>>; // Not implemented
}
export const createProfileService = async (
	localService: ILocalService,
	remoteService: IRemoteService,
	stateValues: IStateValues,
	logger: ILogger
): Promise<IProfileService> => {
	// Get all available profiles from remote
	const getAvailableProfiles = async (
		full: boolean = false
	): Promise<IResult<IProfile[] | string[]>> => {
		try {
			logger.debug(`Getting available profiles (full=${full})`);
			return full
				? await remoteService.pullRemote()
				: await remoteService.pullProfileList();
		} catch (error) {
			logger.error(`Failed to get available profiles: ${error}`, false);
			return { success: false, error };
		}
	};

	// Switch to a different profile
	const switchProfile = async (
		profileName: string
	): Promise<IResult<any>> => {
		try {
			logger.debug(
				`Call made to switch profile with profile ${profileName}`
			);

			// Get all available profiles
			const profilesResult = await getAvailableProfiles(true);
			if (!profilesResult.success) {
				return profilesResult;
			}

			// Find the requested profile
			const profile = (profilesResult.data! as IProfile[]).find((p) => {
				logger.self.trace(
					`Comparing ${profileName} against ${p.profileName}`
				);
				return p.profileName === profileName;
			});

			if (!profile) {
				return {
					success: false,
					error: `Profile '${profileName}' not found`
				};
			}

			// Update local reference first
			stateValues.activeProfile.set(profileName);
			await localService.updateLocalRecord(profile);

			// Apply settings locally
			const applyResult = await localService.applyToSettings(
				profile.settings as ISettings
			);

			if (!applyResult.success) {
				logger.error(
					`Failed to apply settings: ${applyResult.error}`,
					true
				);
				return applyResult;
			}

			// Handle extension management here
			// This could involve installing/uninstalling extensions
			// based on the profile, but that would require extension API
			// and is often best left to the user to manage

			logger.inform(`Successfully switched to profile: ${profileName}`);
			return { success: true, data: profile };
		} catch (error) {
			logger.error(`Failed to switch profile: ${error}`, true);
			return { success: false, error };
		}
	};

	// Create a new profile based on current settings
	const createProfile = async (
		profileName: string,
		setDefault: boolean = false,
		tags: string[] = []
	): Promise<{
		success: boolean;
		data: { local: IResult<IProfile>; remote: IResult<IProfile> };
	}> => {
		try {
			logger.debug(`Creating new profile: ${profileName}`);

			// Check if profile name already exists
			const profilesResult = await getAvailableProfiles();
			if (profilesResult.success) {
				const profiles = profilesResult.data as string[];
				if (profiles.includes(profileName)) {
					return {
						success: false,
						data: {
							local: {
								success: false,
								error: `Profile name '${profileName}' already exists`
							},
							remote: {
								success: false,
								error: `Profile name '${profileName}' already exists`
							}
						}
					};
				}
			}

			// If setting as default, include default tag
			tags = setDefault ? [...tags, 'default'] : tags;
			const timestamp = Date.now();

			// Get current settings and extensions
			const settingsResult = await localService.readLocalSettings();
			if (!settingsResult.success) {
				return {
					success: false,
					data: {
						local: {
							success: false,
							error: `Failed to read settings: ${settingsResult.error}`
						},
						remote: {
							success: false,
							error: `Failed to read settings: ${settingsResult.error}`
						}
					}
				};
			}

			const exts = localService.getInstalledExtensions();

			// Build profile object
			const profile: IProfile = {
				default: setDefault,
				profileName: profileName,
				tags: tags,
				createdAt: timestamp,
				modifiedAt: timestamp,
				settings: settingsResult.data!,
				extensions: exts
			};

			// Create locally
			const local = await localService.createLocalProfile(profile);

			// Push to remote
			const remote = await remoteService.createProfile(profile, {
				profileListID: stateValues.collectionID.get()
			} as IupdateProfileOpts);

			if (local.success && remote.success) {
				logger.inform(`Profile '${profileName}' created successfully`);
				return { success: true, data: { local, remote } };
			} else {
				logger.error(
					`Partial failure creating profile: Local=${local.success}, Remote=${remote.success}`,
					true
				);
				return { success: false, data: { local, remote } };
			}
		} catch (error) {
			logger.error(`Failed to create profile: ${error}`, true);
			return {
				success: false,
				data: {
					local: { success: false, error },
					remote: { success: false, error }
				}
			};
		}
	};

	// Sync current profile (push local changes to remote)
	const syncProfile = async (): Promise<IResult<IProfile>> => {
		try {
			logger.debug('Syncing current profile');

			// Get current active profile name
			const profileName = stateValues.activeProfile.get();
			if (!profileName) {
				return {
					success: false,
					error: 'No active profile to sync'
				};
			}

			// Get local profile data
			const localProfileResult = await localService.refreshLocalProfile();
			if (!localProfileResult.success) {
				return {
					success: false,
					error: `Failed to get local profile: ${localProfileResult.error}`
				};
			}

			// Update with latest settings and extensions
			const profile = localProfileResult.data!;
			profile.profileName = profileName;
			profile.modifiedAt = Date.now();

			// Save locally
			await localService.updateLocalRecord(profile);

			// Push to remote
			const result = await remoteService.pushProfile(profile, {
				profileListID: stateValues.collectionID.get()
			} as IupdateProfileOpts);

			if (result.success) {
				logger.inform(`Profile '${profileName}' synced successfully`);
				return { success: true, data: profile };
			} else {
				return {
					success: false,
					error: `Failed to sync profile: ${result.error}`
				};
			}
		} catch (error) {
			logger.error(`Failed to sync profile: ${error}`, false);
			return { success: false, error };
		}
	};

	// Delete a profile
	const deleteProfile = async (
		profileName: string
	): Promise<IResult<void>> => {
		try {
			logger.debug(`Deleting profile: ${profileName}`);

			// Check if trying to delete active profile
			const activeProfile = stateValues.activeProfile.get();
			if (activeProfile === profileName) {
				return {
					success: false,
					error: 'Cannot delete the active profile. Switch to another profile first.'
				};
			}

			// Check if profile exists remotely
			const profilesResult = await getAvailableProfiles();
			if (!profilesResult.success) {
				return {
					success: false,
					error: `Failed to get profiles: ${profilesResult.error}`
				};
			}

			const profiles = profilesResult.data as string[];
			if (!profiles.includes(profileName)) {
				return {
					success: false,
					error: `Profile '${profileName}' not found`
				};
			}

			// TODO: Implement actual deletion from remote gist
			// This would involve updating the gist to remove the profile file

			logger.inform(`Profile '${profileName}' deleted successfully`);
			return { success: true };
		} catch (error) {
			logger.error(`Failed to delete profile: ${error}`, true);
			return { success: false, error };
		}
	};

	return {
		getAvailableProfiles,
		getCurrentProfile: async () => {
			try {
				logger.debug('Getting current profile');

				// Get local profile
				const localProfileResult =
					await localService.refreshLocalProfile();
				if (!localProfileResult.success) {
					return {
						success: false,
						error: `Failed to get local profile: ${localProfileResult.error}`
					};
				}

				// Get remote profile
				const profileName = stateValues.activeProfile.get();
				const remoteProfileResult = await remoteService.pullProfile(
					{
						id: stateValues.collectionID.get()
					} as IgetProfileOpts,
					profileName
				);

				if (!remoteProfileResult.success) {
					return {
						success: false,
						error: `Failed to get remote profile: ${remoteProfileResult.error}`
					};
				}

				return {
					success: true,
					data: {
						localProfile: localProfileResult.data!,
						remoteProfile: remoteProfileResult.data!
					}
				};
			} catch (error) {
				logger.error(`Failed to get current profile: ${error}`, false);
				return { success: false, error };
			}
		},
		switchProfile,
		createProfile,
		deleteProfile,
		syncProfile
	};
};
