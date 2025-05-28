import { commands } from 'vscode';

import Fallbacks from '../../shared/fallbacks';
import { IValueStore } from '../../utils/stores';
import { exists, settingsJSON } from '../../utils/utils';

const updateSettingsLocations = async (settingsPath: IValueStore<string>) => {
	const path: string = exists(Fallbacks.settings)
		? Fallbacks.settings.fsPath
		: (await settingsJSON())[0].fsPath;
	settingsPath.set(path);
};

export const registerUpdateSettingsLocation = (
	settingsPath: IValueStore<string>
) =>
	commands.registerCommand(
		'cursorsync.update.settingspath',
		async () => await updateSettingsLocations(settingsPath)
	);
