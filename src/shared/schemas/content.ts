import { IFiles } from './api.git';

export interface IGeneralFiles {
	[key: string]: IFiles<IGeneralContent> | IFiles<IReferenceContent>;
	['general.json']: IFiles<IGeneralContent>;
	['references.json']: IFiles<IReferenceContent>;
}
export interface IDeviceFiles {
	[key: string]: IFiles<IDeviceProfile>;
}
export interface IExtensionFiles {
	[key: string]: IFiles<IExtensionProfile>;
}

export interface IExtensionProfile {
	created: number;
	profile: string;
	tags: string[];
	extensions: any[];
}
export interface IDeviceProfile {
	created: number;
	deviceId: string;
	deviceLabel: string;
	lastSync: number;
	settings: string | ISettings;
}
interface ISettings {
	[key: string]: any;
}

export interface IGeneralContent {
	created: number;
}
export interface IReferenceContent {
	created: number;
	lastUpdate: number;
	devices: IDeviceReference[];
}
export interface IDeviceReference {
	gistID: string;
	deviceID: string;
	isMaster: boolean;
	deviceLabel: string;
	fileName: string;
	lastSync: number;
}
