import { ExtensionContext, Uri, workspace } from 'vscode';

import { exists } from '../../utils/utils';

const createLocalService = async (ctx: ExtensionContext) => {
	// Create Local Files
	const parentDir = ctx.globalStorageUri;
	if (!exists(parentDir)) {
		await workspace.fs.createDirectory(parentDir);
	}
	const deviceProfile = Uri.parse(`${parentDir.fsPath}/profile.json`);
};
