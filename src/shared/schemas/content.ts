import { IFiles } from './api.git';

// ? Remote Legend: Should be kept up to date
export interface IReferenceFiles {
	[key: string]: IFiles<IReferenceContent>;
	['references.json']: IFiles<IReferenceContent>;
}

// ? Remote Settings Record
export interface ISettingsFiles {
	[key: string]: IFiles<ISettingsProfile>; // filename{key} is the settings profile name
}
// ? Remote Extension Record
export interface IExtensionFiles {
	[key: string]: IFiles<IExtensionProfile>; // filename{key} is the esxtenison profile name
}

// ? Extension Profile Content Schema
export interface IExtensionProfile {
	created: number;
	profile: string;
	tags: string[];
	extensions: any[];
}

// ? Settings Profile Content Schema
export interface ISettingsProfile {
	created: number;
	profile: string;
	tags: string[];
	modified: number;
	settings: string | ISettings;
}

// ? Simple Vscode Settings interface
interface ISettings {
	[key: string]: any;
}
// ? Root Object of the reference file
export interface IReferenceContent {
	created: number;
	modified: number;

	masterid: string;
	devices: IDeviceReference[];
}

// ? Record of new devices, connections, and configs
export interface IDeviceReference {
	deviceID: string;
	deviceLabel: string;
	targetMaster: boolean;
	extensionProfile: string;
	settingsProfile: string;
	lastSync: number;
}

//? meant to be managed/watched/handles by our local service
export interface ILocalProfile {
	synced: number;
	targetMaster: boolean;
	extensionProfile: string;
	settingsProfile: string;
	settings: string | ISettings;
	extensions: any[];
}
