import { commands, window } from 'vscode';

import { machineId } from '../../shared/environment';
import Fallbacks from '../../shared/fallbacks';
import { ILogger } from '../../utils/logger';
import { IValueStore } from '../../utils/stores';
import { exists, settingsJSON } from '../../utils/utils';

const UpdateLabel = async (
	deviceLabel: IValueStore<string>,
	logger: ILogger
) => {
	try {
		var _label: string | undefined = await window.showInputBox({
			ignoreFocusOut: true,
			placeHolder: `${machineId.get().substring(0, 12)}....`,
			title: 'Create Unique Device Label',
			prompt: `Create A unique label to associate this device with. [default: ${machineId
				.get()
				.substring(0, 12)}....}]`
		});
	} catch (error) {
		logger.error(
			`Error Encountered Setting Custom Device Label. ${error}\nFalling Back to machineId`,
			true
		);
		var _label: string | undefined = `${machineId.get()}`;
	}
	deviceLabel.set(_label === undefined ? machineId.get() : _label);
	logger.inform(
		`CursorSync: Updated Device Label!\n  Device Label:${_label}`
	);
};

export const registerUpdateLabel = (
	deviceLabel: IValueStore<string>,
	logger: ILogger
) => {
	return commands.registerCommand(
		'cursorsync.update.deviceLabel',
		async () => await UpdateLabel(deviceLabel, logger)
	);
};

const UpdateSettingsLocations = async (settingsPath: IValueStore<string>) => {
	const path: string = exists(Fallbacks.settings)
		? Fallbacks.settings.fsPath
		: (await settingsJSON())[0].fsPath;
	settingsPath.set(path);
};

export const registerUpdateSettingsLocation = (
	settingsPath: IValueStore<string>
) =>
	commands.registerCommand(
		'cursorsync.scaffolding.settings',
		async () => await UpdateSettingsLocations(settingsPath)
	);
