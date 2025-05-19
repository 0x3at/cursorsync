import { IFiles } from './api.git';

export interface IProfiles {
	[key: string]: IFiles<IProfile>;
}

export interface IProfile {
	default: boolean;
	profileName: string;
	tags: string[];
	createdAt: number;
	modifiedAt: number;
	settings: string | ISettings;
	extensions: any[];
}

export interface ISettings {
	[key: string]: any;
}
