export type FileSchema = GeneralFiles | DeviceFiles | ExtensionFiles;
export interface GetGistPayload {
	getGistPayload: GistOverview[];
}

export interface GistOverview {
	url: string;
	forksUrl: string;
	commitsUrl: string;
	id: string;
	nodeId: string;
	gitPullUrl: string;
	gitPushUrl: string;
	htmlUrl: string;
	files: FileSchema;
	public: boolean;
	createdAt: number;
	updatedAt: string;
	description?: string;
	comments: number;
	user?: any;
	commentsEnabled: boolean;
	commentsUrl: string;
	owner: Owner;
	truncated: boolean;
}

export interface Owner {
	login: string;
	id: number;
	nodeId: string;
	avatarUrl: string;
	gravatarId: string;
	url: string;
	htmlUrl: string;
	followersUrl: string;
	followingUrl: string;
	gistsUrl: string;
	starredUrl: string;
	subscriptionsUrl: string;
	organizationsUrl: string;
	reposUrl: string;
	eventsUrl: string;
	receivedEventsUrl: string;
	type: string;
	userViewType: string;
	siteAdmin: boolean;
}

export interface FileOverview<T> {
	filename: string;
	type: string;
	language: string;
	raw_url: string;
	size: number;
	truncated: boolean;
	content: T;
	encoding: string;
}
export interface GeneralFiles {
	['general.json']: FileOverview<GeneralSchema>;
	['references.json']: FileOverview<ReferenceSchema>;
}

export interface GeneralSchema {
	created: number;
}
export interface ReferenceSchema {
	created: number;
	lastUpdate: number;
	devices: DeviceRefSchema[];
}
export interface DeviceRefSchema {
	gistID: string;
	deviceID: string;
	isMaster: boolean;
	deviceLabel: string;
	fileName: string;
	lastSync: number;
}
export interface DeviceFiles {
	[key: string]: FileOverview<DeviceProfileSchema>;
}
export interface DeviceProfileSchema {
	created: number;
	deviceId: string;
	deviceLabel: string;
	lastSync: number;
	settings: string | SettingsSchema;
}

interface SettingsSchema {
	[key: string]: any;
}

export interface ExtensionFiles {
	[key: string]: FileOverview<ExtensionProfileSchema>;
}

export interface ExtensionProfileSchema {
	created: number;
	profile: string;
	tags: string[];
	extensions: any[];
}
