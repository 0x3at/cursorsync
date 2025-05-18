import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { Uri, window, workspace } from 'vscode';
import JSON5 from 'json5';

export function exists(path: Uri) {
	return existsSync(path.fsPath);
}

export const settingsJSON = async (): Promise<Uri[]> => {
	const path: Uri[] | undefined = await window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		defaultUri: Uri.parse(
			process.env.XDG_CONFIG_HOME ||
				process.env.APPDATA ||
				process.env.LOCALAPPDATA ||
				'~/.config/'
		),
		filters: { JSON: ['json', 'JSON'] },
		openLabel: 'Save Path',
		title: 'Choose Editor Settings Path'
	});
	if (
		path === undefined ||
		!path[0].fsPath.toLowerCase().endsWith('settings.json') ||
		!exists(path[0])
	) {
		await window.showErrorMessage('Invalid Path Selected');
		return settingsJSON();
	} else {
		return path;
	}
};

export async function loadSettings(path: string) {
	try {
		const data = await readFile(path, 'utf-8');
		return JSON5.parse(data);
	} catch (error) {
		console.error(`Error reading JSON file: ${error}`);
		throw error;
	}
}

export async function updateSettings(path: string, newSettings: {}) {
	try {
		const settings = await loadSettings(path);
		const updatedSettings = { ...settings, ...newSettings };
		await writeFile(path, JSON5.stringify(updatedSettings));
	} catch (error) {
		console.error(`Error reading JSON file: ${error}`);
		throw error;
	}
}

// Utility function to safely stringify objects
export const safeStringify = (obj: any) => {
	const seen = new WeakSet();
	return JSON.stringify(
		obj,
		(key, value) => {
			if (typeof value === 'object' && value !== null) {
				if (seen.has(value)) {
					return; // Circular reference found, discard key
				}
				seen.add(value);
			}
			return value;
		},
		2
	); // Indentation for readability
};
