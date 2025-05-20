import axios from 'axios';

import { ExtensionKeys } from '../../shared/environment';
import { IGist, IResult } from '../../shared/schemas/api.git';
import { IProfile } from '../../shared/schemas/profile';
import { ILogger } from '../../utils/logger';
import { IApiService } from './api';

export interface IgetProfileOpts {
	id: string;
}

export interface IgetProfileOpts {
	gist: IGist;
}

export interface IgetGistOpts {
	id: string;
	invalidateCache?: boolean;
}

export interface IgetGistOpts {
	prefix: ExtensionKeys;
	invalidateCache?: boolean;
}
export interface IupdateProfileOpts {
	profileListID: string;
	invalidateCache?: boolean;
}
export interface IupdateProfileOpts {
	profileList: IGist;
	invalidateCache?: boolean;
}

export interface IGistService {
	getProfile(
		profileName: string,
		opts: IgetProfileOpts
	): Promise<IResult<IProfile>>;
	findProfileList(id: string): Promise<IResult<IGist>>;
	getGist(opts: IgetGistOpts): Promise<IResult<IGist | undefined>>;
	createProfileList(profile: IProfile): Promise<IResult<IGist>>;
	createProfile(
		profile: IProfile,
		opts: {
			profileListID: string;
			invalidateCache?: boolean;
		}
	): Promise<IResult<IProfile>>;
	updateProfile(
		profile: IProfile,
		opts: IupdateProfileOpts
	): Promise<IResult<IProfile>>;
}

export const createGistService = (
	apiService: IApiService,
	logger: ILogger
): IGistService => {
	const getProfile = async (
		profileName: string,
		opts: IgetProfileOpts
	): Promise<IResult<IProfile>> => {
		try {
			const gist: IGist =
				opts.gist || (await apiService.get<IGist>(`gists/${opts.id}`));
			const file = gist!.files[`${profileName}.json`];

			const response = await axios.get<IProfile>(file!.raw_url);
			return { success: true, data: response.data! };
		} catch (error) {
			logger.error(
				`Failed to fetch profile ${profileName}: ${error}`,
				false
			);
			return { success: true, error: error };
		}
	};
	const findProfileList = async (id?: string): Promise<IResult<IGist>> =>
		await getGist({
			id: id,
			prefix: ExtensionKeys.collectionIdentifier
		});
	const getGist = async (opts: {
		id?: string;
		prefix?: ExtensionKeys;
		invalidateCache?: boolean;
	}): Promise<IResult<IGist>> => {
		try {
			// If id is provided, fetch that specific gist
			if (opts.id) {
				const gist = await apiService.get<IGist>(
					`gists/${opts.id}`,
					opts.invalidateCache || true
				);
				return { success: true, data: gist };
			}

			// If prefix is provided, search for gist by description prefix
			if (opts.prefix) {
				const gistsList = await apiService.get<IGist[]>(
					'gists',
					opts.invalidateCache || true
				);

				const targetGist = gistsList.find((gist: IGist) =>
					gist.description?.startsWith(opts.prefix!)
				);

				if (targetGist) {
					return { success: true, data: targetGist };
				}

				return {
					success: false,
					error: `No gist found with prefix ${opts.prefix}`
				};
			}

			// Default: look for collection identifier
			const gistsList = await apiService.get<IGist[]>(
				'gists',
				opts.invalidateCache || true
			);

			const targetGist = gistsList.find((gist: IGist) =>
				gist.description?.startsWith(ExtensionKeys.collectionIdentifier)
			);

			if (targetGist) {
				return { success: true, data: targetGist };
			}

			return {
				success: false,
				error: 'No profile collection gist found'
			};
		} catch (error) {
			logger.error(
				`Failed to fetch gists with prefix ${JSON.stringify(
					opts
				)}: ${error}`,
				false
			);
			return { success: false, error: error };
		}
	};

	return {
		getGist,
		getProfile,
		findProfileList,
		createProfileList: async (
			profile: IProfile
		): Promise<IResult<IGist>> => {
			try {
				const profileList: IGist = await apiService.post('gists', {
					description: ExtensionKeys.collectionIdentifier,
					files: {
						[`default.json`]: {
							content: JSON.stringify(profile as IProfile)
						},
						[`${profile.profileName}}.json`]: {
							content: JSON.stringify(profile as IProfile)
						}
					}
				});
				return { success: true, data: profileList };
			} catch (error) {
				logger.error('Failed to create profile list', false);
				return { success: true, error: error };
			}
		},

		createProfile: async (
			profile: IProfile,
			opts: {
				profileListID: string;
				invalidateCache?: boolean;
			}
		): Promise<IResult<IProfile>> => {
			try {
				const result: IGist = await apiService.post<IGist>(
					`gists/${opts.profileListID}`,
					{
						description: ExtensionKeys.collectionIdentifier,
						public: false,
						files: {
							[`${profile.profileName}.json`]: {
								content: JSON.stringify(profile)
							}
						}
					}
				);
				const _profile = await getProfile(profile.profileName, {
					gist: result
				} as IgetProfileOpts);
				return { success: true, data: _profile.data! };
			} catch (error) {
				logger.error(`Failed to create new profile: ${error}`, true);
				return { success: true, error: error };
			}
		},
		updateProfile: async (
			profile: IProfile,
			opts: {
				profileListID?: string;
				profileList?: IGist;
				invalidateCache?: boolean;
			}
		): Promise<IResult<IProfile>> => {
			try {
				const profileListID: string =
					opts?.profileListID || (await findProfileList()).data!.id;

				const result: IGist = await apiService.post<IGist>(
					`gists/${profileListID}`,
					{
						description: ExtensionKeys.collectionIdentifier,
						public: false,
						files: {
							[profile.profileName]: {
								content: JSON.stringify(profile)
							}
						}
					}
				);
				const _profile = await getProfile(profile.profileName, {
					gist: result
				} as IgetProfileOpts);
				if (!_profile.success) {
					return { success: false, error: `failed to parse profile` };
				}
				return { success: true, data: _profile.data! };
			} catch (error) {
				logger.error(`Failed to update profile: ${error}`, true);
				return { success: false, error: error };
			}
		}
	};
};
