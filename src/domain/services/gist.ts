import axios from 'axios';

import { ExtensionKeys } from '../../shared/environment';
import { IGist } from '../../shared/schemas/api.git';
import {
	IExtensionFiles,
	IExtensionProfile,
	IReferenceContent,
	IReferenceFiles,
	ISettingsFiles,
	ISettingsProfile
} from '../../shared/schemas/content';
import { ILogger } from '../../utils/logger';
import { IApiService } from './api';

export interface IGistService {
	getGist(opts: { id?: string; gist?: IGist }): Promise<IGist>;
	getGistsByPrefix(prefix: ExtensionKeys): Promise<IGist[]>;
	createGist<T = IReferenceFiles | ISettingsFiles | IExtensionFiles>(
		description: string,
		files: T
	): Promise<IGist>;
	updateGist<T = Partial<IReferenceFiles> | ISettingsFiles | IExtensionFiles>(
		id: string,
		files: T
	): Promise<IGist>;
	getSection(opts: {
		key: ExtensionKeys;
		id?: string;
	}): Promise<IGist | null>;
}

export const createGistService = (
	apiService: IApiService,
	logger: ILogger
): IGistService => {
	const getGist = async <
		T = IReferenceContent | ISettingsProfile | IExtensionProfile
	>(opts: {
		id?: string;
		gist?: IGist;
	}): Promise<IGist> => {
		try {
			const gist =
				opts.gist || (await apiService.get(`gists/${opts.id}`));

			// Process file content
			await Promise.all(
				Object.keys(gist!.files).map(async (key) => {
					const file = gist!.files[key];
					if (file.content === undefined || file.truncated) {
						const content = await axios.get(file.raw_url);
						file.content = content.data as T;
					}
				})
			);

			return gist;
		} catch (error) {
			logger.error(
				`Failed to fetch gist ${opts.id || ``}: ${error}`,
				false
			);
			throw error;
		}
	};

	const getGistsByPrefix = async (
		prefix: ExtensionKeys
	): Promise<IGist[]> => {
		try {
			const allGists: IGist[] = await apiService.get();
			const filteredGists: IGist[] = allGists.filter((gist: IGist) =>
				gist.description?.startsWith(prefix)
			);

			return await Promise.all(
				filteredGists.map((gist: IGist) => getGist({ id: gist.id }))
			);
		} catch (error) {
			logger.error(
				`Failed to fetch gists with prefix ${prefix}: ${error}`,
				false
			);
			throw error;
		}
	};

	return {
		getGist,
		getGistsByPrefix,
		createGist: async <
			T = IReferenceFiles | ISettingsFiles | IExtensionFiles
		>(
			description: string,
			files: T
		): Promise<IGist> => {
			const g: IGist = await apiService.post('gists', {
				description,
				public: false,
				files
			});
			return await getGist({ gist: g });
		},
		updateGist: async <
			T = Partial<IReferenceFiles> | ISettingsFiles | IExtensionFiles
		>(
			id: string,
			files: T
		): Promise<IGist> => {
			const g = await apiService.update(`gists/${id}`, {
				files
			});
			return await getGist({ gist: g });
		},
		getSection: async (opts: { key: ExtensionKeys; id?: string }) => {
			if (opts.id) {
				return await getGist({ id: opts.id });
			}

			const gists = await getGistsByPrefix(opts.key);
			return gists.length > 0 ? gists[0] : null;
		}
	};
};
