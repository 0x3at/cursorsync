import { RequestMethod } from '../../domain/network/git';
import { IDeviceFiles, IExtensionFiles, IGeneralFiles } from './content';

export interface IGist {
	url: string;
	forksUrl: string;
	commitsUrl: string;
	id: string;
	nodeId: string;
	gitPullUrl: string;
	gitPushUrl: string;
	htmlUrl: string;
	files: IGeneralFiles | IDeviceFiles | IExtensionFiles;
	public: boolean;
	createdAt: number;
	updatedAt: string;
	description?: string;
	comments: number;
	user?: any;
	commentsEnabled: boolean;
	commentsUrl: string;
	owner: IOwner;
	truncated: boolean;
}

export interface IOwner {
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

export interface IFiles<T> {
	filename: string;
	type: string;
	language: string;
	raw_url: string;
	size: number;
	truncated: boolean;
	content: T;
	encoding: string;
}
export interface IRequestOpts {
	method?: RequestMethod;
	payload?: any;
	endpoint?: string;
}
