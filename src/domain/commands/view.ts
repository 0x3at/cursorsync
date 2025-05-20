import * as vscode from 'vscode';

import { IProfile } from '../../shared/schemas/profile';
import { IExtensionCore } from '../services/core';
import { IgetProfileOpts } from '../services/gist';

// Tree item types
type ProfileItemType = 'profile-list' | 'profile' | 'section' | 'property';

// Tree item with additional metadata
interface ProfileTreeItem extends vscode.TreeItem {
	type: ProfileItemType;
	profileId?: string;
	profileName?: string;
	sectionType?: 'settings' | 'extensions' | 'metadata';
	contextValue?: string;
}

// Create the tree data provider using a closure
export const createProfileTreeProvider = (core: IExtensionCore) => {
	// Internal storage for profiles data
	let profileList: string[] = [];
	let profileData: Map<string, IProfile> = new Map();
	let profileListId: string = '';

	// Create event emitter for refreshing the tree
	const onDidChangeTreeDataEmitter = new vscode.EventEmitter<
		ProfileTreeItem | undefined | null | void
	>();

	// Create the provider object
	const treeDataProvider: vscode.TreeDataProvider<ProfileTreeItem> = {
		// Implement the onDidChangeTreeData as a getter
		get onDidChangeTreeData() {
			return onDidChangeTreeDataEmitter.event;
		},

		// Get display information for a tree item
		getTreeItem(element: ProfileTreeItem): vscode.TreeItem {
			return element;
		},

		// Get children for a given element (or root if no element provided)
		async getChildren(
			element?: ProfileTreeItem
		): Promise<ProfileTreeItem[]> {
			// If no element, return the list of profiles
			if (!element) {
				await refreshProfileData();
				return getRootItems();
			}

			// For profile items, return their sections
			if (element.type === 'profile') {
				return getSectionsForProfile(element.profileName!);
			}

			// For section items, return their properties
			if (element.type === 'section') {
				return getPropertiesForSection(
					element.profileName!,
					element.sectionType!
				);
			}

			// Property items have no children
			return [];
		}
	};

	// Refresh profile data
	const refreshProfileData = async () => {
		try {
			// Get profile collection ID
			profileListId = core.collectionID?.get() || '';
			if (!profileListId) {
				return;
			}

			// Get profile list
			const profileListResult =
				await core.services.remote.pullProfileList();
			if (profileListResult.success) {
				profileList = profileListResult.data || [];
			} else {
				profileList = [];
				vscode.window.showErrorMessage(
					`Error fetching profiles: ${profileListResult.error}`
				);
				return;
			}

			// Get active profile
			const activeProfileName = core.activeProfile?.get();

			// Fetch profile data for each profile
			for (const profileName of profileList) {
				try {
					// Only fetch the active profile data for performance
					// Other profiles will be lazy-loaded when expanded
					if (profileName === activeProfileName) {
						const profileResult =
							await core.services.remote.pullProfile(
								{ id: profileListId } as IgetProfileOpts,
								profileName
							);
						if (profileResult.success) {
							profileData.set(profileName, profileResult.data!);
						}
					}
				} catch (error) {
					vscode.window.showErrorMessage(
						`Error fetching profile ${profileName}: ${error}`
					);
				}
			}
		} catch (error) {
			vscode.window.showErrorMessage(
				`Error fetching profile data: ${error}`
			);
		}
	};

	// Get root-level items (list of profiles)
	const getRootItems = (): ProfileTreeItem[] => {
		const items: ProfileTreeItem[] = [];
		const activeProfileName = core.activeProfile?.get();

		// Add each profile
		for (const profileName of profileList) {
			const isActive = profileName === activeProfileName;

			items.push({
				label: profileName,
				description: isActive ? '(Active)' : '',
				tooltip: `Profile: ${profileName}`,
				iconPath: new vscode.ThemeIcon(
					isActive ? 'check' : 'file-directory'
				),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				type: 'profile',
				profileName: profileName,
				contextValue: isActive ? 'activeProfile' : 'profile'
			});
		}

		// Add a "Create New Profile" item at the end
		items.push({
			label: '+ Create New Profile',
			tooltip: 'Create a new settings profile',
			iconPath: new vscode.ThemeIcon('add'),
			collapsibleState: vscode.TreeItemCollapsibleState.None,
			type: 'profile-list',
			contextValue: 'createProfile',
			command: {
				title: 'Create Profile',
				command: 'cursorsync.createProfile'
			}
		});

		return items;
	};

	// Get sections for a profile
	const getSectionsForProfile = async (
		profileName: string
	): Promise<ProfileTreeItem[]> => {
		// Lazy-load profile data if not already loaded
		if (!profileData.has(profileName)) {
			try {
				const profileResult = await core.services.remote.pullProfile(
					{ id: profileListId } as IgetProfileOpts,
					profileName
				);
				if (profileResult.success) {
					profileData.set(profileName, profileResult.data!);
				} else {
					return [
						{
							label: 'Error loading profile',
							tooltip: profileResult.error,
							iconPath: new vscode.ThemeIcon('error'),
							collapsibleState:
								vscode.TreeItemCollapsibleState.None,
							type: 'property'
						}
					];
				}
			} catch (error) {
				return [
					{
						label: 'Error loading profile',
						tooltip: String(error),
						iconPath: new vscode.ThemeIcon('error'),
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'property'
					}
				];
			}
		}

		const profile = profileData.get(profileName)!;
		const isActive = profileName === core.activeProfile?.get();

		return [
			{
				label: 'Metadata',
				tooltip: 'Profile metadata',
				iconPath: new vscode.ThemeIcon('info'),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				type: 'section',
				profileName: profileName,
				sectionType: 'metadata',
				contextValue: isActive ? 'activeSection' : 'section'
			},
			{
				label: 'Settings',
				tooltip: 'Editor settings',
				iconPath: new vscode.ThemeIcon('settings-gear'),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				type: 'section',
				profileName: profileName,
				sectionType: 'settings',
				contextValue: isActive ? 'activeSection' : 'section'
			},
			{
				label: `Extensions (${profile.extensions?.length || 0})`,
				tooltip: 'VS Code extensions',
				iconPath: new vscode.ThemeIcon('extensions'),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				type: 'section',
				profileName: profileName,
				sectionType: 'extensions',
				contextValue: isActive ? 'activeSection' : 'section'
			}
		];
	};

	// Get properties for a section
	const getPropertiesForSection = (
		profileName: string,
		sectionType: 'settings' | 'extensions' | 'metadata'
	): ProfileTreeItem[] => {
		if (!profileData.has(profileName)) {
			return [];
		}

		const profile = profileData.get(profileName)!;

		// Return properties based on section type
		switch (sectionType) {
			case 'metadata':
				return [
					{
						label: 'File name',
						description: `${profile.profileName}.json`,
						iconPath: new vscode.ThemeIcon('file-code'),
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'property'
					},
					{
						label: 'Created',
						description: new Date(
							profile.createdAt
						).toLocaleString(),
						iconPath: new vscode.ThemeIcon('calendar'),
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'property'
					},
					{
						label: 'Modified',
						description: new Date(
							profile.modifiedAt
						).toLocaleString(),
						iconPath: new vscode.ThemeIcon('history'),
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'property'
					},
					{
						label: 'Default',
						description: profile.default ? 'Yes' : 'No',
						iconPath: new vscode.ThemeIcon(
							profile.default ? 'star-full' : 'star-empty'
						),
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'property'
					},
					...profile.tags.map((tag) => ({
						label: tag,
						iconPath: new vscode.ThemeIcon('tag'),
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'property' as ProfileItemType
					}))
				];

			case 'settings':
				// If settings is a string, parse it
				const settings =
					typeof profile.settings === 'string'
						? JSON.parse(profile.settings)
						: profile.settings;

				// Return simplified view of settings - just show count
				return [
					{
						label: `${Object.keys(settings).length} settings`,
						description: 'Click to view full settings',
						iconPath: new vscode.ThemeIcon('file-text'),
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'property',
						command: {
							title: 'View Settings',
							command: 'cursorsync.viewSettings',
							arguments: [profileName]
						}
					}
				];

			case 'extensions':
				if (!profile.extensions || profile.extensions.length === 0) {
					return [
						{
							label: 'No extensions',
							iconPath: new vscode.ThemeIcon('info'),
							collapsibleState:
								vscode.TreeItemCollapsibleState.None,
							type: 'property'
						}
					];
				}

				// Return first 10 extensions to avoid UI overload
				const extensions = profile.extensions.slice(0, 10);
				const remainingCount = profile.extensions.length - 10;

				return [
					...extensions.map((ext) => ({
						label: ext,
						iconPath: new vscode.ThemeIcon('package'),
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'property' as ProfileItemType
					})),
					...(remainingCount > 0
						? [
								{
									label: `... and ${remainingCount} more`,
									iconPath: new vscode.ThemeIcon('ellipsis'),
									collapsibleState:
										vscode.TreeItemCollapsibleState.None,
									type: 'property' as ProfileItemType,
									command: {
										title: 'View All Extensions',
										command: 'cursorsync.viewExtensions',
										arguments: [profileName]
									}
								}
						  ]
						: [])
				];

			default:
				return [];
		}
	};

	// Method to refresh the tree view
	const refresh = () => {
		profileData.clear();
		onDidChangeTreeDataEmitter.fire(undefined);
	};

	return {
		treeDataProvider,
		refresh
	};
};

// Register commands for the tree view
const registerProfileViewCommands = (
	context: vscode.ExtensionContext,
	core: IExtensionCore
) => {
	// Command to view full settings for a profile
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'cursorsync.viewSettings',
			async (profileName: string) => {
				try {
					const profile = await core.services.remote.pullProfile(
						{ id: core.collectionID.get() } as IgetProfileOpts,
						profileName
					);

					if (!profile.success) {
						throw new Error(
							`Failed to fetch profile: ${profile.error}`
						);
					}

					const settings =
						typeof profile.data!.settings === 'string'
							? JSON.parse(profile.data!.settings)
							: profile.data!.settings;

					// Create document with settings
					const document = await vscode.workspace.openTextDocument({
						content: JSON.stringify(settings, null, 2),
						language: 'json'
					});

					await vscode.window.showTextDocument(document);
				} catch (error) {
					vscode.window.showErrorMessage(
						`Error viewing settings: ${error}`
					);
				}
			}
		)
	);

	// Command to view all extensions for a profile
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'cursorsync.viewExtensions',
			async (profileName: string) => {
				try {
					const profile = await core.services.remote.pullProfile(
						{ id: core.collectionID.get() } as IgetProfileOpts,
						profileName
					);

					if (!profile.success) {
						throw new Error(
							`Failed to fetch profile: ${profile.error}`
						);
					}

					// Create document with extensions list
					const document = await vscode.workspace.openTextDocument({
						content: profile.data!.extensions.join('\n'),
						language: 'text'
					});

					await vscode.window.showTextDocument(document);
				} catch (error) {
					vscode.window.showErrorMessage(
						`Error viewing extensions: ${error}`
					);
				}
			}
		)
	);

	// Command to switch to a profile
	context.subscriptions.push(
		vscode.commands.registerCommand(
			'cursorsync.switchToProfile',
			async (profileName: string) => {
				try {
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: `Switching to profile ${profileName}...`,
							cancellable: false
						},
						async () => {
							const result =
								await core.services.profile.switchProfile(
									profileName
								);
							if (!result.success) {
								throw new Error(
									`Failed to switch profile: ${result.error}`
								);
							}
						}
					);

					vscode.window.showInformationMessage(
						`Successfully switched to profile: ${profileName}`
					);
					// Refresh the tree view
					vscode.commands.executeCommand('cursorsync.refreshView');
				} catch (error) {
					vscode.window.showErrorMessage(
						`Error switching profile: ${error}`
					);
				}
			}
		)
	);
};

// Helper function to register tree view
export function registerProfileTreeView(
	context: vscode.ExtensionContext,
	core: IExtensionCore
) {
	const { treeDataProvider, refresh } = createProfileTreeProvider(core);

	// Create and register the tree view
	const treeView = vscode.window.createTreeView('cursorsync.profileView', {
		treeDataProvider
	});

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand(
		'cursorsync.refreshView',
		() => {
			refresh();
		}
	);

	// Register other commands
	registerProfileViewCommands(context, core);

	// Add to disposables
	context.subscriptions.push(treeView, refreshCommand);

	return treeView;
}
