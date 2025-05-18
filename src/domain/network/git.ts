import axios from 'axios';
import {
	authentication,
	AuthenticationSession,
	Extension,
	extensions,
	MessageItem,
	window
} from 'vscode';

import { ExtensionKeys, machineId } from '../../shared/environment';
import {
	DeviceProfileSchema,
	DeviceRefSchema,
	ExtensionProfileSchema,
	FileOverview,
	GeneralSchema,
	GistOverview,
	ReferenceSchema
} from '../../shared/schemas/api.git';
import { ContextStore } from '../../utils/context-store';
import { loadSettings } from '../../utils/file.utils';
import { LogInterface } from '../../utils/logging';

export const session = async (): Promise<AuthenticationSession> => {
	// Request a GitHub session with the 'gist' scope
	try {
		const session = await authentication.getSession('github', ['gist'], {
			createIfNone: true
		});

		return {
			...session
		};
	} catch (error) {
		throw error;
	}
};

const __request = async (
	method?: string,
	payload?: {},
	endpoint?: string
): Promise<any> => {
	const urlRoot: string = 'https://api.github.com/';
	payload = payload !== undefined ? payload : undefined;
	endpoint = endpoint !== undefined ? endpoint : 'gists';
	const _method =
		method === 'P' ? axios.post : method === 'U' ? axios.patch : axios.get;
	try {
		const token = (await session()).accessToken;

		const response =
			payload === undefined
				? await _method(`${urlRoot}${endpoint}`, {
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: 'application/vnd.github.v3+json'
						}
				  })
				: await _method(`${urlRoot}${endpoint}`, payload, {
						headers: {
							Authorization: `Bearer ${token}`,
							Accept: 'application/vnd.github.v3+json'
						}
				  });
		if (response.data === undefined) {
			throw Error(`Response is undefined`);
		}
		return response.data;
	} catch (error) {
		window.showErrorMessage(`CursorSync: API Error ${error}`);
		throw error;
	}
};
const fileContent = async (
	file: Partial<
		FileOverview<GeneralSchema | ReferenceSchema | DeviceProfileSchema>
	>
): Promise<GeneralSchema | ReferenceSchema | DeviceProfileSchema> => {
	const payload = await axios.get(file.raw_url!);
	return payload.data as
		| GeneralSchema
		| ReferenceSchema
		| DeviceProfileSchema;
};
const gist = async (id: string): Promise<GistOverview> => {
	try {
		const res: GistOverview = await __request('G', {}, `gists/${id}`);
		await Object.keys(res.files).forEach(async (key: string) => {
			let f: FileOverview<any> = (res.files as any)[key];
			if (f.truncated === true) {
				f.content = await fileContent(f);
			}
		});
		return res;
	} catch (error) {
		const msg = `Failed to Capture Gist ${error}`;
		throw error;
	}
};

const gists = async (): Promise<GistOverview[]> => {
	const allGists: GistOverview[] = await __request();
	const targetGists: GistOverview[] = await Promise.all(
		Array.from(allGists)
			.filter(
				(_gist: GistOverview) =>
					_gist.description !== null &&
					_gist.description!.startsWith(ExtensionKeys.prefix)
			)
			.map(async (_gist) => await gist(_gist.id))
	);

	return targetGists;
};

export const section = async (opts: {
	key: ExtensionKeys;
	id?: string;
}): Promise<GistOverview | null> => {
	if (opts.id === undefined) {
		const list = await gists();
		const tgtGist = list.find(
			(_gist: GistOverview) =>
				_gist.description !== null &&
				_gist.description!.startsWith(opts.key)
		);
		return tgtGist === undefined ? null : tgtGist;
	} else {
		const tgtGist = await gist(opts.id);
		return tgtGist;
	}
};

export interface GistController {
	session: AuthenticationSession;
	section: (opts: {
		key: ExtensionKeys;
		id?: string;
	}) => Promise<GistOverview | null>;
	call: (opts: {
		method?: 'P' | 'G';
		payload?: {};
		endpoint?: string;
	}) => Promise<any>;
	initRemote: () => Promise<{ success: boolean; error?: any }[]>;
	initDeviceProfile: () => Promise<{ success: boolean; error?: any }>;
	initExtensionProfile: () => Promise<{ success: boolean; error?: any }>;
}
const createSection = async (
	call: CallableFunction,
	opts: {
		key: ExtensionKeys;
		files: { [key: string]: { content: string } };
	}
) => {
	const payload = {
		description: opts.key,
		public: false,
		files: opts.files
	};
	const res: GistOverview = await call({
		method: 'P',
		payload: payload
	});
	return res;
};
const createGeneral = async (
	call: CallableFunction,
	deviceLabel: ContextStore<string>,
	generalGistID: ContextStore<string>
) => {
	try {
		const _machineId = machineId.get();
		const _label = deviceLabel.get();
		const _timestamp = Date.now();
		const genfiles = {
			['general.json']: {
				content: JSON.stringify({
					created: _timestamp
				} as GeneralSchema)
			},
			['references.json']: {
				content: JSON.stringify({
					created: _timestamp,
					lastUpdate: _timestamp,
					devices: [
						{
							deviceID: _machineId,
							isMaster: true,
							deviceLabel: _label,
							fileName: `${_machineId}.json`,
							lastSync: _timestamp
						} as Partial<DeviceRefSchema>
					]
				} as ReferenceSchema)
			}
		};
		let res = await createSection(call, {
			key: ExtensionKeys.generalGist,
			files: genfiles
		});
		generalGistID.set(res.id);
		return { success: true };
	} catch (error) {
		return { success: false, error: error };
	}
};

const createDeviceProfile = async (
	call: CallableFunction,
	deviceLabel: ContextStore<string>,
	deviceProfileID: ContextStore<string>,
	settingsPath: ContextStore<string>
): Promise<{ success: boolean; error?: any }> => {
	try {
		const _machineId = machineId.get();
		const _label = deviceLabel.get();
		const _timestamp = Date.now();
		const settings = loadSettings(settingsPath.get());
		const devfiles = {
			[`${machineId.get()}.json`]: {
				content: JSON.stringify({
					created: Date.now(),
					deviceId: _machineId,
					deviceLabel: _label,
					lastSync: _timestamp,
					settings: JSON.stringify(settings)
				} as DeviceProfileSchema)
			}
		};

		const res = await createSection(call, {
			key: ExtensionKeys.deviceGist,
			files: devfiles
		});

		deviceProfileID.set(res.id);
		return { success: true };
	} catch (error) {
		return { success: false, error: error };
	}
};
const createExtensionProfile = async (
	call: CallableFunction,
	extensionsProfileID: ContextStore<string>
) => {
	try {
		const _timestamp = Date.now();
		const extensionList = extensions.all.map(
			(ext: Extension<any>) => ext.id
		);
		const files = {
			[`genesis.json`]: {
				content: JSON.stringify({
					created: _timestamp,
					profile: 'genesis',
					tags: ['genesis'],
					extensions: extensionList
				} as ExtensionProfileSchema)
			}
		};

		const res = await createSection(call, {
			key: ExtensionKeys.extensionGist,
			files: files
		});

		extensionsProfileID.set(res.id);
		return { success: true };
	} catch (error) {
		return { success: false, error: error };
	}
};
export const Controller = async (
	logger: LogInterface,
	deviceLabel: ContextStore<string>,
	generalGistID: ContextStore<string>,
	deviceProfileID: ContextStore<string>,
	extensionsProfileID: ContextStore<string>,
	settingsPath: ContextStore<string>
): Promise<GistController> => {
	const _api = __request;
	const _call = async (opts: {
		method?: 'P' | 'G';
		payload?: {};
		endpoint?: string;
	}) => await _api(opts.method, opts.payload, opts.endpoint);
	try {
		const _session = await session();

		return {
			session: _session,
			section: async (opts: { key: ExtensionKeys; id?: string }) =>
				await section(opts),
			call: async (opts: {
				method?: 'P' | 'G';
				payload?: {};
				endpoint?: string;
			}) => await _call(opts),
			initRemote: async () => {
				logger.inform('Initializing Remote...', [
					{ title: 'Configuring CursorSync Gists' }
				] as MessageItem[]);
				const generalResult = await createGeneral(
					_call,
					deviceLabel,
					generalGistID
				);
				logger.debug(
					`General Gists Initialized : ${generalResult.success}`
				);
				const deviceResult = await createDeviceProfile(
					_call,
					deviceLabel,
					deviceProfileID,
					settingsPath
				);
				logger.debug(
					`Device Gists Initialized : ${deviceResult.success}`
				);
				const extensionResult = await createExtensionProfile(
					_call,
					extensionsProfileID
				);
				logger.debug(
					`Extension Gists Initialized : ${extensionResult.success}`
				);
				logger.debug(
					`General Result : ${generalResult}\nDevice Result: ${deviceResult}\nExtension Result: ${extensionResult}`
				);
				return [generalResult, deviceResult, extensionResult];
			},
			initDeviceProfile: async () => {
				logger.inform('Initializing Device Profile...', [
					{ title: 'Configuring CursorSync Gists' }
				] as MessageItem[]);
				const deviceResult = await createDeviceProfile(
					_call,
					deviceLabel,
					deviceProfileID,
					settingsPath
				);
				logger.debug(
					`Device Profile Initialized : ${deviceResult.success}`
				);
				return deviceResult;
			},
			initExtensionProfile: async () => {
				logger.inform('Initializing Extension Profile...', [
					{ title: 'Configuring CursorSync Gists' }
				] as MessageItem[]);
				const extensionResult = await createExtensionProfile(
					_call,
					extensionsProfileID
				);
				logger.debug(
					`Extenions Profile Initialized : ${extensionResult.success}`
				);
				return extensionResult;
			}
		};
	} catch (error) {
		logger.error(`Controller Failed To Obtain Auth ${error}`, false);
		throw error;
	}
};
