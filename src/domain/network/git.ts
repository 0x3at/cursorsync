// import axios from 'axios';
// import {
// 	AuthenticationSession,
// 	Extension,
// 	extensions,
// 	MessageItem,
// 	window
// } from 'vscode';

// import { ExtensionKeys, machineId } from '../../shared/environment';
// import { IFiles, IGist, IRequestOpts } from '../../shared/schemas/api.git';
// import {
// 	IDeviceFiles,
// 	IDeviceProfile,
// 	IDeviceReference,
// 	IExtensionProfile,
// 	IGeneralContent,
// 	IGeneralFiles,
// 	IReferenceContent
// } from '../../shared/schemas/content';
// import { IResult } from '../../shared/schemas/state';
// import { ILogger } from '../../utils/logger';
// import { IValueStore } from '../../utils/stores';
// import { loadSettings } from '../../utils/utils';
// import { authSession } from '../services/api';

// export interface IController {
// 	session: AuthenticationSession;
// 	sync: {
// 		reference: (
// 			generalGist: IGist,
// 			deviceGist: IGist,
// 			_deviceLabel: IValueStore<string | undefined>
// 		) => Promise<IResult<any>>;
// 		device: (deviceGist: IGist) => Promise<IResult<any>>;
// 	};
// 	section: (opts: {
// 		key: ExtensionKeys;
// 		id?: string;
// 	}) => Promise<IGist | null>;

// 	call: (opts: IRequestOpts) => Promise<any>;
// 	initRemote: () => Promise<{ success: boolean; error?: any }[]>;
// 	initDeviceProfile: () => Promise<{ success: boolean; error?: any }>;
// 	initExtensionProfile: () => Promise<{ success: boolean; error?: any }>;
// }

// export type RequestMethod = 'G' | 'P' | 'U';

// const createApiRequest = async (options: IRequestOpts): Promise<any> => {
// 	const { method = 'G', payload, endpoint = 'gists' } = options;
// 	const url = `https://api.github.com/${endpoint}`;

// 	try {
// 		const token = (await authSession()).accessToken;
// 		const headers = {
// 			Authorization: `Bearer ${token}`,
// 			Accept: 'application/vnd.github.v3+json'
// 		};

// 		let response;
// 		switch (method) {
// 			case 'P':
// 				response = await axios.post(url, payload, { headers });
// 				break;
// 			case 'U':
// 				response = await axios.patch(url, payload, { headers });
// 				break;
// 			default:
// 				response = await axios.get(url, { headers });
// 		}

// 		if (!response.data) {
// 			throw new Error('Response data is undefined');
// 		}

// 		return response.data;
// 	} catch (error) {
// 		window.showErrorMessage(`CursorSync: API Error ${error}`);
// 		throw error;
// 	}
// };
// const getFileContent = async (
// 	file: Partial<IFiles<IGeneralContent | IReferenceContent | IDeviceProfile>>
// ): Promise<IGeneralContent | IReferenceContent | IDeviceProfile> => {
// 	const payload = await axios.get(file.raw_url!);
// 	return payload.data as IGeneralContent | IReferenceContent | IDeviceProfile;
// };
// const getGist = async (id: string): Promise<IGist> => {
// 	try {
// 		const res: IGist = await createApiRequest({
// 			method: 'G',
// 			endpoint: `gists/${id}`
// 		});
// 		await Object.keys(res.files).forEach(async (key: string) => {
// 			let f: IFiles<any> = (res.files as any)[key];
// 			if (f.truncated === true) {
// 				f.content = await getFileContent(f);
// 			}
// 		});
// 		return res;
// 	} catch (error) {
// 		const msg = `Failed to Capture Gist ${error}`;
// 		throw error;
// 	}
// };

// const getGists = async (): Promise<IGist[]> => {
// 	const allGists: IGist[] = await createApiRequest({});
// 	const targetGists: IGist[] = await Promise.all(
// 		Array.from(allGists)
// 			.filter(
// 				(_gist: IGist) =>
// 					_gist.description !== null &&
// 					_gist.description!.startsWith(ExtensionKeys.prefix)
// 			)
// 			.map(async (_gist) => await getGist(_gist.id))
// 	);

// 	return targetGists;
// };

// export const getSection = async (opts: {
// 	key: ExtensionKeys;
// 	id?: string;
// }): Promise<IGist | null> => {
// 	if (opts.id === undefined) {
// 		const list = await getGists();
// 		const tgtGist = list.find(
// 			(_gist: IGist) =>
// 				_gist.description !== null &&
// 				_gist.description!.startsWith(opts.key)
// 		);
// 		return tgtGist === undefined ? null : tgtGist;
// 	} else {
// 		const tgtGist = await getGist(opts.id);
// 		return tgtGist;
// 	}
// };

// const createSection = async (
// 	call: CallableFunction,
// 	opts: {
// 		key: ExtensionKeys;
// 		files: { [key: string]: { content: string } };
// 	}
// ) => {
// 	const payload = {
// 		description: opts.key,
// 		public: false,
// 		files: opts.files
// 	};
// 	const res: IGist = await call({
// 		method: 'P',
// 		payload: payload
// 	});
// 	return res;
// };
// const createGeneral = async (
// 	call: CallableFunction,
// 	deviceLabel: IValueStore<string>,
// 	generalGistID: IValueStore<string>
// ) => {
// 	try {
// 		const _machineId = machineId.get();
// 		const _label = deviceLabel.get();
// 		const _timestamp = Date.now();
// 		const genfiles = {
// 			['general.json']: {
// 				content: JSON.stringify({
// 					created: _timestamp
// 				} as IGeneralContent)
// 			},
// 			['references.json']: {
// 				content: JSON.stringify({
// 					created: _timestamp,
// 					lastUpdate: _timestamp,
// 					devices: [
// 						{
// 							deviceID: _machineId,
// 							isMaster: true,
// 							deviceLabel: _label,
// 							fileName: `${_machineId}.json`,
// 							lastSync: _timestamp
// 						} as Partial<IDeviceReference>
// 					]
// 				} as IReferenceContent)
// 			}
// 		};
// 		let res = await createSection(call, {
// 			key: ExtensionKeys.generalGist,
// 			files: genfiles
// 		});
// 		generalGistID.set(res.id);
// 		return { success: true };
// 	} catch (error) {
// 		return { success: false, error: error };
// 	}
// };

// const createDeviceProfile = async (
// 	call: CallableFunction,
// 	deviceLabel: IValueStore<string>,
// 	deviceProfileID: IValueStore<string>,
// 	settingsPath: IValueStore<string>
// ): Promise<{ success: boolean; error?: any }> => {
// 	try {
// 		const _machineId = machineId.get();
// 		const _label = deviceLabel.get();
// 		const _timestamp = Date.now();
// 		const settings = await loadSettings(settingsPath.get());
// 		const devfiles = {
// 			[`${machineId.get()}.json`]: {
// 				content: JSON.stringify({
// 					created: Date.now(),
// 					deviceId: _machineId,
// 					deviceLabel: _label,
// 					lastSync: _timestamp,
// 					settings: settings
// 				} as IDeviceProfile)
// 			}
// 		};

// 		const res = await createSection(call, {
// 			key: ExtensionKeys.deviceGist,
// 			files: devfiles
// 		});

// 		deviceProfileID.set(res.id);
// 		return { success: true };
// 	} catch (error) {
// 		return { success: false, error: error };
// 	}
// };
// const createExtensionProfile = async (
// 	call: CallableFunction,
// 	extensionsProfileID: IValueStore<string>
// ) => {
// 	try {
// 		const _timestamp = Date.now();
// 		const extensionList = extensions.all.map(
// 			(ext: Extension<any>) => ext.id
// 		);
// 		const files = {
// 			[`genesis.json`]: {
// 				content: JSON.stringify({
// 					created: _timestamp,
// 					profile: 'genesis',
// 					tags: ['genesis'],
// 					extensions: extensionList
// 				} as IExtensionProfile)
// 			}
// 		};

// 		const res = await createSection(call, {
// 			key: ExtensionKeys.extensionGist,
// 			files: files
// 		});

// 		extensionsProfileID.set(res.id);
// 		return { success: true };
// 	} catch (error) {
// 		return { success: false, error: error };
// 	}
// };
// export const createController = async (
// 	logger: ILogger,
// 	deviceLabel: IValueStore<string>,
// 	generalGistID: IValueStore<string>,
// 	deviceProfileID: IValueStore<string>,
// 	extensionsProfileID: IValueStore<string>,
// 	settingsPath: IValueStore<string>
// ): Promise<IController> => {
// 	const _api = createApiRequest;
// 	const _call = async (opts: IRequestOpts) => await _api(opts);
// 	try {
// 		const _session = await authSession();

// 		return {
// 			session: _session,
// 			sync: {
// 				reference: async (
// 					generalGist: IGist,
// 					deviceGist: IGist,
// 					_deviceLabel: IValueStore<string | undefined>
// 				): Promise<IResult<any>> => {
// 					try {
// 						const deviceList = (generalGist.files as IGeneralFiles)[
// 							'references.json'
// 						].content.devices;
// 						const deviceReference: Partial<IDeviceReference> = {
// 							gistID: deviceGist.id,
// 							deviceID: machineId.get(),
// 							isMaster: false,
// 							deviceLabel: _deviceLabel.get(),
// 							fileName: `${machineId.get()}.json`,
// 							...(deviceList.find(
// 								(reference) =>
// 									reference.deviceID === machineId.get()
// 							) || {})
// 						};
// 						deviceReference.lastSync = Date.now();
// 						const filteredList = deviceList.filter(
// 							(reference) =>
// 								reference.deviceID !== machineId.get()
// 						);
// 						filteredList.push(deviceReference as IDeviceReference);
// 						(generalGist.files as IGeneralFiles)[
// 							'references.json'
// 						].content.devices = filteredList;

// 						const files: {
// 							[key: string]: { content: string };
// 						} = {};
// 						for (const [fileName, file] of Object.entries(
// 							generalGist.files as IGeneralFiles
// 						)) {
// 							files[fileName] = {
// 								content: JSON.stringify(
// 									(
// 										file as IFiles<
// 											IGeneralContent | IReferenceContent
// 										>
// 									).content
// 								)
// 							};
// 						}

// 						const patchOpts: IRequestOpts = {
// 							method: 'U',
// 							endpoint: `gists/${generalGist.id}`,
// 							payload: {
// 								description: generalGist.description,
// 								files: files
// 							}
// 						};

// 						const head: IGist = await _call(patchOpts);
// 						return {
// 							success: true,
// 							data: head
// 						} as IResult<IGist>;
// 					} catch (error) {
// 						logger.error(
// 							`Failed to update references file: ${error}`,
// 							true
// 						);
// 						return {
// 							success: false,
// 							error: error
// 						} as IResult<IGist>;
// 					}
// 				},
// 				device: async (deviceGist: IGist): Promise<IResult<any>> => {
// 					try {
// 						const deviceProfiles = deviceGist.files as IDeviceFiles;
// 						const currentProfile: Partial<IDeviceProfile> = {
// 							created: Date.now(),
// 							deviceId: machineId.get(),
// 							deviceLabel: deviceLabel.get(),
// 							settings: await loadSettings(settingsPath.get()),
// 							...((deviceProfiles[`${machineId.get()}.json`]
// 								?.content as Partial<IDeviceProfile>) ||
// 								({} as Partial<IDeviceProfile>))
// 						};

// 						currentProfile.lastSync = Date.now();
// 						deviceProfiles[`${machineId.get()}.json`] =
// 							currentProfile as IFiles<IDeviceProfile>;

// 						const files: { [key: string]: { content: string } } =
// 							{};
// 						for (const [fileName, file] of Object.entries(
// 							deviceProfiles
// 						)) {
// 							files[fileName] = {
// 								content: JSON.stringify(
// 									file.content as IDeviceProfile
// 								)
// 							};
// 						}

// 						const patchOpts: IRequestOpts = {
// 							method: 'U',
// 							endpoint: `gists/${deviceGist.id}`,
// 							payload: {
// 								description: deviceGist.description,
// 								files: files
// 							}
// 						};

// 						const head: IGist = await _call(patchOpts);
// 						deviceProfileID.set(head.id);
// 						return {
// 							success: true,
// 							data: head
// 						} as IResult<IGist>;
// 					} catch (error) {
// 						logger.error(
// 							`Failed to update device profile file: ${error}`,
// 							true
// 						);
// 						return {
// 							success: false,
// 							error: error
// 						} as IResult<IGist>;
// 					}
// 				}
// 			},
// 			section: async (opts: { key: ExtensionKeys; id?: string }) =>
// 				await getSection(opts),
// 			call: async (opts: IRequestOpts) => await _call(opts),
// 			initRemote: async () => {
// 				logger.inform('Initializing Remote...', [
// 					{ title: 'Configuring CursorSync Gists' }
// 				] as MessageItem[]);
// 				const generalResult = await createGeneral(
// 					_call,
// 					deviceLabel,
// 					generalGistID
// 				);
// 				logger.debug(
// 					`General Gists Initialized : ${generalResult.success}`
// 				);
// 				const deviceResult = await createDeviceProfile(
// 					_call,
// 					deviceLabel,
// 					deviceProfileID,
// 					settingsPath
// 				);
// 				logger.debug(
// 					`Device Gists Initialized : ${deviceResult.success}`
// 				);
// 				const extensionResult = await createExtensionProfile(
// 					_call,
// 					extensionsProfileID
// 				);
// 				logger.debug(
// 					`Extension Gists Initialized : ${extensionResult.success}`
// 				);
// 				logger.debug(
// 					`General Result : ${generalResult}\nDevice Result: ${deviceResult}\nExtension Result: ${extensionResult}`
// 				);
// 				return [generalResult, deviceResult, extensionResult];
// 			},
// 			initDeviceProfile: async () => {
// 				logger.inform('Initializing Device Profile...', [
// 					{ title: 'Configuring CursorSync Gists' }
// 				] as MessageItem[]);
// 				const deviceResult = await createDeviceProfile(
// 					_call,
// 					deviceLabel,
// 					deviceProfileID,
// 					settingsPath
// 				);
// 				logger.debug(
// 					`Device Profile Initialized : ${deviceResult.success}`
// 				);
// 				return deviceResult;
// 			},
// 			initExtensionProfile: async () => {
// 				logger.inform('Initializing Extension Profile...', [
// 					{ title: 'Configuring CursorSync Gists' }
// 				] as MessageItem[]);
// 				const extensionResult = await createExtensionProfile(
// 					_call,
// 					extensionsProfileID
// 				);
// 				logger.debug(
// 					`Extenions Profile Initialized : ${extensionResult.success}`
// 				);
// 				return extensionResult;
// 			}
// 		};
// 	} catch (error) {
// 		logger.error(`Controller Failed To Obtain Auth ${error}`, false);
// 		throw error;
// 	}
// };
