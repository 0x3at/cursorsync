import { IGist, IResult } from '../../shared/schemas/api.git';
import { IProfile } from '../../shared/schemas/profile';
import { ILogger } from '../../utils/logger';
import { IgetProfileOpts, IGistService, IupdateProfileOpts } from './gist';
import { IStateValues } from './state';

export interface IRemoteService {
	// Get reference gist
	pullProfileList(): Promise<IResult<string[]>>;

	// Get device settings gist
	// Update reference gist
	createProfile(
		profile: IProfile,
		opts: IupdateProfileOpts
	): Promise<IResult<IProfile>>;
	pushProfile(
		profile: IProfile,
		opts: IupdateProfileOpts
	): Promise<IResult<IProfile>>;

	// Update device settings
	pullProfile(
		opts: IgetProfileOpts,
		profileName?: string
	): Promise<IResult<IProfile>>;
	// Update device extensions
	initializeRemote(profile: IProfile): Promise<IResult<IGist>>;
	pullRemote(): Promise<IResult<IProfile[] | string[]>>;
	isInitialized(): Promise<boolean>;
	gistService: IGistService;
}

export const createRemoteService = (
	gistService: IGistService,
	logger: ILogger,
	stateValues: IStateValues
): IRemoteService => {
	// Get reference gist (contains list of devices)

	// Get device settings gist
	const pullProfileList = async (): Promise<IResult<string[]>> => {
		try {
			const profileCollectionID = stateValues.collectionID.get();

			const result = await gistService.findProfileList(
				profileCollectionID
			);
			if (!result.success) {
				logger.error(
					`failed to pull profile list ${result.error!}`,
					false
				);
				return { success: false, error: result.error };
			}
			if (!profileCollectionID) {
				stateValues.collectionID.set(result.data!.id);
			}
			return {
				success: true,
				data: Object.keys(result.data!.files).map((key: string) =>
					key.substring(0, key.length - 5)
				)
			} as IResult<string[]>;
		} catch (error) {
			logger.error(`failed to pull profile list ${error}`, false);
			return { success: false, error: error };
		}
	};

	// Update device settings in the device gist
	const initializeDefault = async (
		profile: IProfile,
		opts: IupdateProfileOpts
	): Promise<IResult<IProfile>> => {
		logger.debug('Updating Profile settings');

		const updateResult = await gistService.createProfile(profile, opts);
		return updateResult;
	};
	// Update device settings in the device gist
	const createProfile = async (
		profile: IProfile,
		opts: IupdateProfileOpts
	): Promise<IResult<IProfile>> => {
		logger.debug('Updating Profile settings');

		const updateResult = await gistService.createProfile(profile, opts);
		return updateResult;
	};
	// Update device settings in the device gist
	const pushProfile = async (
		profile: IProfile,
		opts: IupdateProfileOpts
	): Promise<IResult<IProfile>> => {
		logger.debug('Updating Profile settings');

		const updateResult = await gistService.updateProfile(profile, opts);
		return updateResult;
	};

	// Get device reference from reference gist
	const pullProfile = async (
		opts: IgetProfileOpts,
		profileName?: string
	): Promise<IResult<IProfile>> => {
		logger.debug('Pulling profile from remote');
		profileName = profileName || `default`;
		return await gistService.getProfile(profileName, opts);
	};

	// Initialize remote gists
	const initializeRemote = async (
		profile: IProfile
	): Promise<IResult<IGist>> => {
		logger.debug('Initializing remote gists');
		logger.debug('Creating default profile');
		const result = await gistService.createProfileList(profile);
		if (!result.success) {
			return result;
		}
		logger.debug('Storing Profile List ID');
		stateValues.collectionID.set(result.data!.id);
		return result;
	};
	// Check if remote is initialized
	const isInitialized = async (): Promise<boolean> => {
		logger.debug('Checking if remote is initialized');
		return (await pullProfileList()).success;
	};

	// Get all remote data
	const pullRemote = async (): Promise<IResult<IProfile[] | string[]>> => {
		try {
			logger.debug('Getting all remote data');
			const listResult = await pullProfileList();
			if (!listResult.success) {
				return listResult;
			}
			const gistResult = await gistService.findProfileList(
				stateValues.collectionID.get()
			);
			if (!gistResult.success) {
				return { success: false, error: gistResult.error! };
			}
			const fullList: IProfile[] = (
				await Promise.all(
					listResult.data!.map(async (name: string) => {
						const result = await pullProfile({
							gist: gistResult.data!
						} as IgetProfileOpts);
						if (result.success) {
							return result.data;
						}
					})
				)
			).filter((index: IProfile | undefined) => index !== undefined);
			return {
				success: true,
				data: fullList
			};
		} catch (error) {
			logger.error(`Failed to get all remote data: ${error}`, false);
			return { success: false, error };
		}
	};

	return {
		pullProfileList,
		pushProfile,
		pullProfile,
		isInitialized,
		initializeRemote,
		createProfile,
		pullRemote,
		gistService: gistService
	};
};
