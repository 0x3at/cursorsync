import { IResult } from '../../shared/schemas/api.git';
import { IProfile, ISettings } from '../../shared/schemas/profile';
import { ILogger } from '../../utils/logger';
import { IgetProfileOpts, IupdateProfileOpts } from './gist';
import { ILocalService } from './local';
import { IRemoteService } from './remote';
import { IStateValues } from './state';

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
	deleteProfile(profileName: string): Promise<void>;

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
	// Live Profile State
	let liveProfile: IProfile = {
		profileName: stateValues.activeProfile.get(),
		settings: (await localService.readLocalSettings()).data,
		extensions: localService.getInstalledExtensions()
	} as IProfile;
	// Get all available profiles from remote
	const getAvailableProfiles = async (
		full: boolean = false
	): Promise<IResult<IProfile[] | string[]>> =>
		!full
			? remoteService.pullProfileList()
			: await remoteService.pullRemote();

	// Get current profile
	const getCurrentProfile = async (): Promise<
		IResult<{ localProfile: IProfile; remoteProfile: IProfile }>
	> => {
		try {
			logger.debug('Getting current profile');

			// Get local profile
			const localProfile: IProfile = (
				await localService.refreshLocalProfile()
			).data!;

			// Get device reference from remote
			const remoteProfile: IProfile = (
				await remoteService.pullProfile({
					id: stateValues.collectionID.get()
				} as IgetProfileOpts)
			).data!;

			return {
				success: true,
				data: {
					localProfile,
					remoteProfile
				}
			};
		} catch (error) {
			logger.error(`Failed to get current profile: ${error}`, false);
			return { success: false, error };
		}
	};

	// Switch to a different profile
	const switchProfile = async (
		profileName: string
	): Promise<IResult<any>> => {
		try {
			logger.debug(`Switching to profile: ${profileName}`);

			// Get all available profiles
			const profilesResult = await getAvailableProfiles(true);
			if (!profilesResult.success) {
				return profilesResult;
			}

			// Find the requested profile
			const profile = (profilesResult.data! as IProfile[]).find(
				(p) => p.profileName === profileName
			);
			if (!profile) {
				return {
					success: false,
					error: `Profile '${profileName}' not found`
				};
			}

			//TODO Implement Extension Cycling

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
			// Update Active Profile References
			stateValues.activeProfile.set(profileName);
			liveProfile = profile;
			await localService.updateLocalRecord(profile);
			return { success: true, data: liveProfile };
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
	) => {
		tags = setDefault ? tags.concat(['default']) : tags;
		const timestamp = Date.now();
		const exts = localService.getInstalledExtensions();
		const settings: ISettings = (await localService.readLocalSettings())
			.data!;
		const profile: IProfile = {
			default: setDefault,
			profileName: profileName,
			tags: tags,
			createdAt: timestamp,
			modifiedAt: timestamp,
			settings: settings,
			extensions: exts
		};
		const local = await localService.createLocalProfile(profile);
		const remote = await remoteService.createProfile(profile, {
			profileListID: stateValues.collectionID.get()
		} as IupdateProfileOpts);

		if (local.success && remote.success) {
			return { success: true, data: { local, remote } };
		} else {
			return { success: false, data: { local, remote } };
		}
	};

	// Sync current profile (push local changes to remote)
	const syncProfile = async (): Promise<IResult<IProfile>> => {
		const settings = await localService.readLocalSettings();
		if (!settings.success) {
			return { success: false, error: settings.error };
		}
		liveProfile.extensions = localService.getInstalledExtensions();
		liveProfile.settings = settings.data!;
		stateValues.activeProfile.set(liveProfile.profileName);
		const profile: IResult<IProfile> = await remoteService.pushProfile(
			liveProfile,
			{
				profileListID: stateValues.collectionID.get()
			} as IupdateProfileOpts
		);
		if (!profile.success) {
			return { success: false, error: profile.error };
		}
		return { success: false, data: profile.data! };
	};
	// Delete a profile

	const deleteProfile = async (profileName: string) => {
		return;
	};

	return {
		getAvailableProfiles,
		getCurrentProfile,
		switchProfile,
		createProfile,
		deleteProfile,
		syncProfile
	};
};
