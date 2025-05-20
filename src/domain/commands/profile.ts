import { commands, ExtensionContext, window } from 'vscode';

import { ILogger } from '../../utils/logger';
import { ILocalService } from '../services/local';
import { IExtensionCore } from '../services/core';

export const registerCommands = (
	context: ExtensionContext,
	core: IExtensionCore,
	logger: ILogger
) => {
	// Register profile commands
	const profileCommands = [
		commands.registerCommand('cursorsync.syncNow', async () => {
			try {
				const result = await core.services.profile.syncProfile();
				if (result.success) {
					logger.inform('Profile synced successfully');
					commands.executeCommand('cursorsync.refreshGistView');
				} else {
					throw new Error(result.error);
				}
			} catch (error) {
				logger.error(`Sync failed: ${error}`, true);
			}
		}),
		commands.registerCommand('cursorsync.resetLocalProfile', async () => {
			try {
				await (
					core.services.local as ILocalService
				).resetLocalProfile();
			} catch (error) {
				logger.error(`Reset failed: ${error}`, true);
			}
		}),
		commands.registerCommand('cursorsync.switchProfile', async () => {
			try {
				const profilesResult =
					await core.services.profile.getAvailableProfiles();
				if (!profilesResult.success) {
					throw new Error(profilesResult.error);
				}

				const profiles = profilesResult.data!;
				if (profiles.length === 0) {
					window.showInformationMessage(
						'No profiles available. Create one first.'
					);
					return;
				}

				const selected = await window.showQuickPick(
					profiles as string[],
					{
						placeHolder: 'Select a profile to switch to'
					}
				);

				if (!selected) {
					return;
				}

				const result = await core.services.profile.switchProfile(
					selected
				);
				if (result.success) {
					logger.inform(`Switched to profile: ${selected}`);
					commands.executeCommand('cursorsync.refreshGistView');
				} else {
					throw new Error(result.error);
				}
			} catch (error) {
				logger.error(`Profile switch failed: ${error}`, true);
			}
		}),

		commands.registerCommand('cursorsync.createProfile', async () => {
			try {
				const profileName = await window.showInputBox({
					placeHolder: 'Enter a name for the new profile',
					prompt: 'Choose a descriptive name for this configuration'
				});

				if (!profileName) {
					return;
				}

				const isDefault = await window.showQuickPick(['Yes', 'No'], {
					placeHolder: 'Set as default profile?'
				});

				if (!isDefault) {
					return;
				}

				const tagsInput = await window.showInputBox({
					placeHolder: 'Optional: Enter tags separated by commas',
					prompt: 'Tags help you organize profiles (e.g., "work,development")'
				});

				const tags = tagsInput
					? tagsInput.split(',').map((t) => t.trim())
					: [];

				const result = await core.services.profile.createProfile(
					profileName,
					isDefault === 'Yes',
					tags
				);

				if (result.success) {
					logger.inform(
						`Profile "${profileName}" created successfully`
					);
					commands.executeCommand('cursorsync.refreshGistView');
				} else {
					throw new Error('Profile creation failed');
				}
			} catch (error) {
				logger.error(`Create profile failed: ${error}`, true);
			}
		}),

		commands.registerCommand('cursorsync.deleteProfile', async () => {
			try {
				const profilesResult =
					await core.services.profile.getAvailableProfiles();
				if (!profilesResult.success) {
					throw new Error(profilesResult.error);
				}

				const profiles = profilesResult.data!;
				if (profiles.length === 0) {
					window.showInformationMessage(
						'No profiles available to delete.'
					);
					return;
				}

				const selected = await window.showQuickPick(
					profiles as string[],
					{
						placeHolder: 'Select a profile to delete'
					}
				);

				if (!selected) {
					return;
				}

				const confirm = await window.showWarningMessage(
					`Are you sure you want to delete profile "${selected}"?`,
					'Delete',
					'Cancel'
				);

				if (confirm !== 'Delete') {
					return;
				}

				const result = await core.services.profile.deleteProfile(
					selected
				);
				if (result.success) {
					logger.inform(`Profile "${selected}" deleted successfully`);
					commands.executeCommand('cursorsync.refreshGistView');
				} else {
					throw new Error(result.error);
				}
			} catch (error) {
				logger.error(`Delete profile failed: ${error}`, true);
			}
		}),

		commands.registerCommand('cursorsync.showMenu', async () => {
			const options = [
				'Sync Now',
				'Switch Profile',
				'Create Profile',
				'Delete Profile',
				'View Gists'
			];

			const selected = await window.showQuickPick(options, {
				placeHolder: 'CursorSync: Select an action'
			});

			if (!selected) {
				return;
			}

			switch (selected) {
				case 'Sync Now':
					await commands.executeCommand('cursorsync.syncNow');
					break;
				case 'Switch Profile':
					await commands.executeCommand('cursorsync.switchProfile');
					break;
				case 'Create Profile':
					await commands.executeCommand('cursorsync.createProfile');
					break;
				case 'Delete Profile':
					await commands.executeCommand('cursorsync.deleteProfile');
					break;
				case 'View Gists':
					await commands.executeCommand('cursorsync.refreshGistView');
					break;
			}
		})
	];

	// Add all commands to context subscriptions
	profileCommands.forEach((cmd) => context.subscriptions.push(cmd));
};
