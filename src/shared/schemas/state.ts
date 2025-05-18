import { Disposable } from 'vscode';

import { IController } from '../../domain/network/git';
import { IValueStore } from '../../utils/stores';
import { IFlags } from '../environment';
import { IGist } from './api.git';

export interface IResult<T = any> {
	success: boolean;
	data?: T;
	error?: any;
}
export interface IDependencies {
	generalGistID: IValueStore<string | undefined>;
	devicesGistID: IValueStore<string | undefined>;
	extensionsGistID: IValueStore<string | undefined>;
	deviceLabel: IValueStore<string | undefined>;
	settingsPath: IValueStore<string | undefined>;
	flags: IFlags;
	commands: Disposable[];
	controller: IController;
}
export interface IRemoteStore {
	generalGist: IGist | null;
	deviceGist: IGist | null;
	extensionsGist: IGist | null;
}
export interface ICore {
	controller: IController;
	deviceLabel: IValueStore<string | undefined>;
	settingsPath: IValueStore<string | undefined>;
	generalGistID: IValueStore<string | undefined>;
	generalGist: IGist | null;
	devicesGistID: IValueStore<string | undefined>;
	deviceGist: IGist | null;
	extensionsGistID: IValueStore<string | undefined>;
	extensionsGist: IGist | null;
	disposables: Disposable[];
	flags: IFlags;
}
