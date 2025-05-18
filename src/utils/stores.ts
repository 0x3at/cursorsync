import { Disposable, workspace as ws } from 'vscode';

export interface IValueStore<T> {
	get: (...args: any[]) => T;
	set: (...args: any[]) => void;
	call: any;
}

export const createValueStore = (context: {
	val: any;
	getter?: (...args: any[]) => any;
	setter?: (...args: any[]) => any;
	expose?: any;
}) => {
	let val = context.val;
	context.getter =
		context.getter === undefined
			? () => {
					return context.val;
			  }
			: context.getter;
	return {
		get: (...args: any[]): ReturnType<typeof context.getter> => {
			val = context.getter!(...args);
			return val;
		},
		set: (...args: any[]) => {
			if (context.setter !== null || context.setter !== undefined) {
				context.setter!(...args);
			}
		},
		call: context.expose
	};
};
/** @format */

export const Preference = (name: string, extName: string) => {
	let prefMap = () => ws.getConfiguration(extName);
	let value: string = prefMap().get(name)!;

	const _disposable: Disposable = ws.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration(`${extName}.${name}`)) {
			value = prefMap().get(name)!;
			console.log(
				`Value of ${name.toString()} changed to ${value!.toString()}`
			);
		}
	});

	return {
		get: (): string => prefMap().get(name)!,
		set: async (newValue: string) => {
			await prefMap().update(`${name}`, `${newValue}`, 1);
			return prefMap().get(name)!;
		},
		getInt: () => parseInt(value),
		getTime: () => {
			switch (true) {
				case value === '15 minutes':
					return 15 * 60000;
				case value === '30 minutes':
					return 30 * 60000;
				case value === '60 minutes':
					return 60 * 60000;
				default:
					return 15 * 60000;
			}
		},
		getTimeScale: () => {
			switch (true) {
				case value === '1 minute':
					return 60;
				case value === '5 minutes':
					return 300;
				case value === '10 minutes':
					return 600;
				case value === '30 minutes':
					return 1800;
				case value === '60 minutes':
					return 3600;
				default:
					return 300;
			}
		},
		disposable: () => _disposable
	};
};
