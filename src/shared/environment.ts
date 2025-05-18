import { commands, env } from 'vscode';

import { ContextStore, contextStore } from '../utils/context-store';

export enum ExtensionKeys {
	prefix = 'cursorsync',
	generalGist = 'cursorsync.Conf',
	deviceGist = 'cursorsync.Devices',
	extensionGist = 'cursorsync.Exts'
}
export const rootPath: ContextStore<string> = contextStore({
	val: env.appRoot
});

export const appName: ContextStore<string> = contextStore({
	val: env.appName
});

export const machineId: ContextStore<string> = contextStore({
	val: env.machineId
});

interface ContextCommand {
	inspect: boolean;
	activate: () => void;
	deactivate: () => void;
	toggle: () => void;
}

const contextCommand = (name: string, state?: boolean): ContextCommand => {
	let _state = state !== undefined ? state : false;
	return {
		inspect: _state,
		activate: () => {
			_state = true;
			commands.executeCommand('setContext', name, _state);
		},
		deactivate: () => {
			_state = false;
			commands.executeCommand('setContext', name, _state);
		},
		toggle: () => commands.executeCommand('setContext', name, !_state)
	};
};

export interface ContextFlags {
	SetupPending: { name: string; methods: ContextCommand };
	LabelConflict: { name: string; methods: ContextCommand };
	DevMode: { name: string; methods: ContextCommand };
}

export const contextFlags: ContextFlags = {
	SetupPending: {
		name: 'cursorsync.setupIsPending',
		methods: contextCommand('cursorsync.setupIsPending')
	},
	LabelConflict: {
		name: 'cursorsync.labelConflictExists',
		methods: contextCommand('cursorsync.labelConflictExists')
	},
	DevMode: {
		name: 'cursorsync.inDevMode',
		methods: contextCommand('cursorsync.inDevMode')
	}
};
