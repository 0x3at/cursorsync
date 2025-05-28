import { commands, ExtensionContext, QuickPickItem, window } from 'vscode';

import { ExtensionKeys } from '../../shared/environment';
import { ILogger } from '../../utils/logger';
import { authSession } from '../services/api';
import { IExtensionCore } from '../services/core';

// Menu item interface for better type safety
interface CommandMenuItem extends QuickPickItem {
	id: string;
	action?: () => Promise<void>;
}

export const registerCommands = (
	context: ExtensionContext,
	core: IExtensionCore,
	logger: ILogger
) => {
	// Register main menu command
	const mainMenuCommand = commands.registerCommand(
		`${ExtensionKeys.prefix}.showMenu`,
		async () => {
			const mainMenuItems: CommandMenuItem[] = [
				{
					id: 'profile',
					label: '$(person) Profile Operations',
					description: 'Manage sync profiles',
					detail: 'Create, switch, sync or delete profiles'
				},
				{
					id: 'debug',
					label: '$(bug) Debug & Troubleshooting',
					description: 'Debugging operations',
					detail: 'View context, state, and session information'
				}
			];

			const selected = await window.showQuickPick(mainMenuItems, {
				placeHolder: 'CursorSync: Select a command category',
				ignoreFocusOut: true
			});

			if (!selected) {
				return;
			}

			// Execute submenu based on selection
			switch (selected.id) {
				case 'profile':
					await showProfileMenu(core, logger);
					break;
				case 'debug':
					await showDebugMenu(context, logger);
					break;
			}
		}
	);

	// Register all individual commands but make them accessible through the menu system
	context.subscriptions.push(mainMenuCommand);

	const profileMenuCommand = commands.registerCommand(
		`${ExtensionKeys.prefix}.showProfilMenu`,
		async () => {
			await showProfileMenu(core, logger);
		}
	);

	// Register all individual commands but make them accessible through the menu system
	context.subscriptions.push(profileMenuCommand);

	const debugMenuCommand = commands.registerCommand(
		`${ExtensionKeys.prefix}.showDebugMenu`,
		async () => {
			await showDebugMenu(context, logger);
		}
	);

	// Register all individual commands but make them accessible through the menu system
	context.subscriptions.push(debugMenuCommand);

	registerDirectCommands(context, core, logger);
};

// Profile Operations Menu
async function showProfileMenu(
	core: IExtensionCore,
	logger: ILogger
): Promise<void> {
	const profileMenuItems: CommandMenuItem[] = [
		{
			id: 'sync',
			label: '$(sync) Sync Now',
			description: 'Sync current profile',
			action: async () => {
				try {
					const result = await core.services.profile.syncProfile();
					if (result.success) {
						logger.inform('Profile synced successfully');
						commands.executeCommand('cursorsync.refreshView');
					} else {
						throw new Error(result.error);
					}
				} catch (error) {
					logger.error(`Sync failed: ${error}`, true);
				}
			}
		},
		{
			id: 'switch',
			label: '$(arrow-right) Switch Profile',
			description: 'Change active profile',
			action: async () => {
				await commands.executeCommand('cursorsync.switchProfile');
			}
		},
		{
			id: 'create',
			label: '$(add) Create Profile',
			description: 'Create a new profile',
			action: async () => {
				await commands.executeCommand('cursorsync.createProfile');
			}
		},
		{
			id: 'delete',
			label: '$(trash) Delete Profile',
			description: 'Delete an existing profile',
			action: async () => {
				await commands.executeCommand('cursorsync.deleteProfile');
			}
		},
		{
			id: 'reset',
			label: '$(refresh) Reset Local Profile',
			description: 'Reset local profile state',
			action: async () => {
				try {
					await core.services.local.resetLocalProfile();
					logger.inform('Local profile reset successfully');
				} catch (error) {
					logger.error(`Reset failed: ${error}`, true);
				}
			}
		}
	];

	const selected = await window.showQuickPick(profileMenuItems, {
		placeHolder: 'CursorSync: Select a profile operation',
		ignoreFocusOut: true
	});

	if (selected && selected.action) {
		await selected.action();
	}
}

// Debug & Troubleshooting Menu
async function showDebugMenu(
	context: ExtensionContext,
	logger: ILogger
): Promise<void> {
	const debugMenuItems: CommandMenuItem[] = [
		{
			id: 'context',
			label: '$(info) Show Context',
			description: 'Display extension context flags',
			action: async () => {
				await commands.executeCommand(
					`${ExtensionKeys.prefix}.debug.showcontext`
				);
			}
		},
		{
			id: 'refresh',
			label: '$(refresh) Refresh View',
			description: 'Refresh the profile view',
			action: async () => {
				await commands.executeCommand('cursorsync.refreshView');
				logger.inform('View refreshed');
			}
		},
		{
			id: 'state',
			label: '$(database) Show State',
			description: 'Display extension state',
			action: async () => {
				await commands.executeCommand(
					`${ExtensionKeys.prefix}.debug.showstate`
				);
			}
		},
		{
			id: 'session',
			label: '$(key) Show Auth Session',
			description: 'Display authentication session',
			action: async () => {
				await commands.executeCommand(
					`${ExtensionKeys.prefix}.debug.showsession`
				);
			}
		},
		{
			id: 'reset-state',
			label: '$(trash) Reset State',
			description: 'Reset all extension state',
			action: async () => {
				const confirm = await window.showWarningMessage(
					'Are you sure you want to reset all extension state? This will clear all saved settings.',
					'Reset',
					'Cancel'
				);

				if (confirm === 'Reset') {
					await commands.executeCommand(
						`${ExtensionKeys.prefix}.reset.state`
					);
					logger.inform('Extension state has been reset');
				}
			}
		}
	];

	const selected = await window.showQuickPick(debugMenuItems, {
		placeHolder: 'CursorSync: Select a debug operation',
		ignoreFocusOut: true
	});

	if (selected && selected.action) {
		await selected.action();
	}
}

// Register direct commands (these will still be accessible via their command IDs)
// but they're primarily accessed through the menu system
function registerDirectCommands(
	context: ExtensionContext,
	core: IExtensionCore,
	logger: ILogger
) {
	// Register individual profile commands
	const disposables = [
		// Switch Profile Command
		commands.registerCommand('cursorsync.switchProfile', async () => {
			try {
				// Get current active profile
				const activeProfileName = core.activeProfile.get();

				// Get available profiles
				const profilesResult =
					await core.services.profile.getAvailableProfiles();
				if (!profilesResult.success) {
					throw new Error(profilesResult.error);
				}

				// Filter out active profile and convert to QuickPickItems
				let profiles = profilesResult.data as string[];
				profiles = profiles.filter(
					(name) => name !== activeProfileName
				);

				if (profiles.length === 0) {
					window.showInformationMessage(
						'No other profiles available to switch to.'
					);
					return;
				}

				// Use simple string array to avoid any issues
				const selected = await window.showQuickPick(profiles, {
					placeHolder: 'Select a profile to switch to',
					ignoreFocusOut: true
				});

				if (!selected) {
					return; // User cancelled
				}

				logger.debug(`Switching to profile: ${selected}`);

				// Switch to the selected profile
				const result = await core.services.profile.switchProfile(
					selected
				);
				if (result.success) {
					window.showInformationMessage(
						`Switched to profile: ${selected}`
					);
					commands.executeCommand('cursorsync.refreshView');
				} else {
					throw new Error(result.error);
				}
			} catch (error) {
				logger.error(`Profile switch failed: ${error}`, true);
			}
		}),

		// Create Profile Command
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
					window.showInformationMessage(
						`Profile "${profileName}" created successfully`
					);
					commands.executeCommand('cursorsync.refreshView');
				} else {
					throw new Error('Profile creation failed');
				}
			} catch (error) {
				logger.error(`Create profile failed: ${error}`, true);
			}
		}),

		// Delete Profile Command
		commands.registerCommand('cursorsync.deleteProfile', async () => {
			try {
				const profilesResult =
					await core.services.profile.getAvailableProfiles();
				if (!profilesResult.success) {
					throw new Error(profilesResult.error);
				}

				const profiles = profilesResult.data as string[];
				if (profiles.length === 0) {
					window.showInformationMessage(
						'No profiles available to delete.'
					);
					return;
				}

				const selected = await window.showQuickPick(profiles, {
					placeHolder: 'Select a profile to delete'
				});

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
					window.showInformationMessage(
						`Profile "${selected}" deleted successfully`
					);
					commands.executeCommand('cursorsync.refreshView');
				} else {
					throw new Error(result.error);
				}
			} catch (error) {
				logger.error(`Delete profile failed: ${error}`, true);
			}
		}),

		// Debug commands
		commands.registerCommand(
			`${ExtensionKeys.prefix}.debug.showcontext`,
			() => {
				if (core.flags) {
					Object.keys(core.flags).forEach((key) => {
						logger.inform(
							`${key}: ${
								core.flags[key as string].methods.inspect ||
								'NOT SET'
							}`
						);
					});
				} else {
					logger.inform('No context flags available');
				}
			}
		),

		commands.registerCommand(
			`${ExtensionKeys.prefix}.debug.showstate`,
			() => {
				context.globalState.keys().forEach((key) => {
					logger.inform(
						`${key}: ${context.globalState.get(key) || 'NOT SET'}`
					);
				});
			}
		),

		commands.registerCommand(
			`${ExtensionKeys.prefix}.debug.showsession`,
			async () => {
				const s = await authSession();
				logger.inform(
					`Auth Account: ${s.account || 'Not Authenticated'}
                Auth ID: ${s.id || 'Not Authenticated'}
                Scopes: ${s.scopes || 'Not Authenticated'}`
				);
			}
		),

		commands.registerCommand(`${ExtensionKeys.prefix}.reset.state`, () => {
			context.globalState.keys().forEach((key) => {
				logger.inform(`${key}: resetting...`);
				context.globalState.update(key, undefined);
			});
		})
	];

	// Add all commands to context subscriptions
	disposables.forEach((d) => context.subscriptions.push(d));
}
