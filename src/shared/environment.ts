import { commands, env } from 'vscode';

import { createValueStore, IValueStore } from '../utils/stores';

export enum ExtensionKeys {
	prefix = 'cursorsync',
	collectionIdentifier = 'cursorsync.profiles'
}

export type StateKey =
	| 'referenceID'
	| 'settingsCollection'
	| 'extensionCollection'
	| 'settingsProfile'
	| 'extensionProfile';

interface IFlagStore {
	inspect: boolean;
	activate: () => void;
	deactivate: () => void;
	toggle: () => void;
}
export interface IFlags {
	[key: string]: { name: string; methods: IFlagStore };
	SetupPending: { name: string; methods: IFlagStore };
	LabelConflict: { name: string; methods: IFlagStore };
	DevMode: { name: string; methods: IFlagStore };
}

export const rootPath: IValueStore<string> = createValueStore({
	val: env.appRoot
});

export const appName: IValueStore<string> = createValueStore({
	val: env.appName
});

export const machineId: IValueStore<string> = createValueStore({
	val: env.machineId
});

const createFlagStore = (name: string, state?: boolean): IFlagStore => {
	let _state = state !== undefined ? state : false;
	return {
		inspect: _state,
		activate: async () => {
			_state = true;
			return await commands.executeCommand('setContext', name, _state);
		},
		deactivate: async () => {
			_state = false;
			return await commands.executeCommand('setContext', name, _state);
		},
		toggle: async () =>
			await commands.executeCommand('setContext', name, !_state)
	};
};

export const contextFlags: IFlags = {
	SetupPending: {
		name: 'cursorsync.setupIsPending',
		methods: createFlagStore('cursorsync.setupIsPending')
	},
	LabelConflict: {
		name: 'cursorsync.labelConflictExists',
		methods: createFlagStore('cursorsync.labelConflictExists')
	},
	DevMode: {
		name: 'cursorsync.inDevMode',
		methods: createFlagStore('cursorsync.inDevMode')
	}
};
