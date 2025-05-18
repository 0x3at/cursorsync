import { Uri } from 'vscode';

const settingsPath: Uri = Uri.joinPath(
	Uri.parse(
		process.env.XDG_CONFIG_HOME ||
			process.env.APPDATA ||
			process.env.LOCALAPPDATA ||
			'~/.config'
	),
	'Cursor',
	'User',
	'settings.json'
);

const Fallbacks = {
	settings: settingsPath,
};

export default Fallbacks;
