import * as vscode from 'vscode';

import { ExtensionKeys } from '../../shared/environment';
import { IFiles, IGist } from '../../shared/schemas/api.git';
import { ICore } from '../../shared/schemas/state';

// Gist tree item types
type GistItemType = 'section' | 'file' | 'content';

// Tree item with additional metadata
interface GistTreeItem extends vscode.TreeItem {
	type: GistItemType;
	gistId?: string;
	fileName?: string;
	contentKey?: string;
}

// Create the tree data provider using a closure
export const createGistTreeProvider = (core: ICore) => {
	// Internal storage for section data
	let sections: { [key: string]: IGist | null } = {
		general: core.generalGist,
		device: core.deviceGist,
		extensions: core.extensionsGist
	};

	// Create event emitter outside the provider object
	const onDidChangeTreeDataEmitter = new vscode.EventEmitter<
		GistTreeItem | undefined | null | void
	>();

	// Create the actual provider object
	const treeDataProvider: vscode.TreeDataProvider<GistTreeItem> = {
		// Implement the onDidChangeTreeData as a getter that returns the event
		get onDidChangeTreeData() {
			return onDidChangeTreeDataEmitter.event;
		},

		// Get display information for a tree item
		getTreeItem(element: GistTreeItem): vscode.TreeItem {
			return element;
		},

		// Get children for a given element (or root if no element provided)
		async getChildren(element?: GistTreeItem): Promise<GistTreeItem[]> {
			// Refresh section data to ensure we have the latest
			if (!element) {
				await refreshSections();
				return getRootItems();
			}

			// For section items, return their files
			if (element.type === 'section') {
				return getFilesForSection(
					element.label!.toString(),
					element.gistId!
				);
			}

			// For file items, return their content entries
			if (element.type === 'file') {
				return getContentForFile(element.gistId!, element.fileName!);
			}

			// Content items have no children
			return [];
		}
	};

	// Refresh section data from controller
	const refreshSections = async () => {
		try {
			// Ensure we have the latest section data
			if (!sections.general && core.generalGistID.get()) {
				sections.general = await core.controller.section({
					key: ExtensionKeys.referenceGist,
					id: core.generalGistID.get()
				});
			}

			if (!sections.device && core.devicesGistID.get()) {
				sections.device = await core.controller.section({
					key: ExtensionKeys.settingsCollection,
					id: core.devicesGistID.get()
				});
			}

			if (!sections.extensions && core.extensionsGistID.get()) {
				sections.extensions = await core.controller.section({
					key: ExtensionKeys.extensionCollection,
					id: core.extensionsGistID.get()
				});
			}
		} catch (error) {
			vscode.window.showErrorMessage(
				`Error fetching gist data: ${error}`
			);
		}
	};

	// Get root-level items (gist sections)
	const getRootItems = (): GistTreeItem[] => {
		const items: GistTreeItem[] = [];

		// Add general section
		if (sections.general) {
			items.push({
				label: 'General Configuration',
				tooltip: 'General configuration and references',
				iconPath: new vscode.ThemeIcon('settings-gear'),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				type: 'section',
				gistId: sections.general.id
			});
		}

		// Add device section
		if (sections.device) {
			items.push({
				label: 'Device Profiles',
				tooltip: 'Device-specific profiles and settings',
				iconPath: new vscode.ThemeIcon('device-desktop'),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				type: 'section',
				gistId: sections.device.id
			});
		}

		// Add extensions section
		if (sections.extensions) {
			items.push({
				label: 'Extensions',
				tooltip: 'VS Code extension configurations',
				iconPath: new vscode.ThemeIcon('extensions'),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				type: 'section',
				gistId: sections.extensions.id
			});
		}

		return items;
	};

	// Get files for a specific section
	const getFilesForSection = (
		sectionName: string,
		gistId: string
	): GistTreeItem[] => {
		const sectionKey =
			sectionName === 'General Configuration'
				? 'general'
				: sectionName === 'Device Profiles'
				? 'device'
				: 'extensions';

		const gist = sections[sectionKey];
		if (!gist) {
			return [];
		}

		return Object.entries(gist.files).map(([fileName, file]) => {
			return {
				label: fileName,
				tooltip: `File: ${fileName}`,
				iconPath: new vscode.ThemeIcon('file'),
				collapsibleState: vscode.TreeItemCollapsibleState.Collapsed,
				type: 'file',
				gistId: gistId,
				fileName: fileName
			};
		});
	};

	// Get content entries for a specific file
	const getContentForFile = (
		gistId: string,
		fileName: string
	): GistTreeItem[] => {
		// Find the corresponding gist
		let gist: IGist | null = null;
		for (const [_, sectionGist] of Object.entries(sections)) {
			if (sectionGist && sectionGist.id === gistId) {
				gist = sectionGist;
				break;
			}
		}

		if (!gist || !gist.files[fileName]) {
			return [];
		}

		const fileContent = (gist.files[fileName] as IFiles<any>).content;

		// If content is a string, it hasn't been parsed yet
		if (typeof fileContent === 'string') {
			try {
				// Try to parse as JSON
				const parsed = JSON.parse(fileContent);
				return getContentItemsFromObject(parsed);
			} catch (e) {
				// If parsing fails, show raw content
				return [
					{
						label: 'Raw Content',
						tooltip: 'Raw file content',
						description:
							fileContent.length > 50
								? `${fileContent.substring(0, 50)}...`
								: fileContent,
						collapsibleState: vscode.TreeItemCollapsibleState.None,
						type: 'content'
					}
				];
			}
		} else {
			// Content is already parsed
			return getContentItemsFromObject(fileContent);
		}
	};

	// Convert an object into tree items based on its content
	const getContentItemsFromObject = (obj: any): GistTreeItem[] => {
		if (!obj) {
			return [];
		}

		// Handle different content types based on structure
		if (obj.created) {
			// For content with a creation timestamp
			const items: GistTreeItem[] = [
				{
					label: 'Created',
					description: new Date(obj.created).toLocaleString(),
					iconPath: new vscode.ThemeIcon('calendar'),
					collapsibleState: vscode.TreeItemCollapsibleState.None,
					type: 'content'
				}
			];

			// Add device-specific fields
			if ('deviceId' in obj) {
				items.push({
					label: 'Device ID',
					description: obj.deviceId,
					iconPath: new vscode.ThemeIcon('key'),
					collapsibleState: vscode.TreeItemCollapsibleState.None,
					type: 'content'
				});
				items.push({
					label: 'Device Label',
					description: obj.deviceLabel,
					iconPath: new vscode.ThemeIcon('tag'),
					collapsibleState: vscode.TreeItemCollapsibleState.None,
					type: 'content'
				});
			}

			// Add reference-specific fields
			if ('devices' in obj) {
				items.push({
					label: `Devices (${obj.devices.length})`,
					tooltip: 'List of registered devices',
					iconPath: new vscode.ThemeIcon('device-desktop'),
					collapsibleState: vscode.TreeItemCollapsibleState.None,
					type: 'content'
				});
			}

			// Add extension-specific fields
			if ('extensions' in obj) {
				items.push({
					label: `Extensions (${obj.extensions.length})`,
					tooltip: 'List of tracked extensions',
					iconPath: new vscode.ThemeIcon('extensions'),
					collapsibleState: vscode.TreeItemCollapsibleState.None,
					type: 'content'
				});
			}

			// Add last sync time if available
			if ('lastSync' in obj) {
				items.push({
					label: 'Last Sync',
					description: new Date(obj.lastSync).toLocaleString(),
					iconPath: new vscode.ThemeIcon('sync'),
					collapsibleState: vscode.TreeItemCollapsibleState.None,
					type: 'content'
				});
			}

			return items;
		}

		// For other objects, create generic property items
		return Object.entries(obj).map(([key, value]) => {
			const stringValue =
				typeof value === 'object'
					? JSON.stringify(value).substring(0, 50) + '...'
					: String(value);

			return {
				label: key,
				description: stringValue,
				collapsibleState: vscode.TreeItemCollapsibleState.None,
				type: 'content'
			};
		});
	};

	// Method to refresh the tree view
	const refresh = () => {
		sections = {
			general: core.generalGist,
			device: core.deviceGist,
			extensions: core.extensionsGist
		};
		onDidChangeTreeDataEmitter.fire();
	};

	return {
		treeDataProvider,
		refresh
	};
};

// Helper function to register tree view
export function registerGistTreeView(
	context: vscode.ExtensionContext,
	core: ICore
) {
	const { treeDataProvider, refresh } = createGistTreeProvider(core);

	// Create and register the tree view
	const treeView = vscode.window.createTreeView('cursorsync.gistView', {
		treeDataProvider
	});

	// Register refresh command
	const refreshCommand = vscode.commands.registerCommand(
		'cursorsync.refreshGistView',
		() => {
			refresh();
		}
	);

	// Add to disposables
	context.subscriptions.push(treeView, refreshCommand);

	return treeView;
}
