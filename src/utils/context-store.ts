export interface ContextStore<T> {
	get: (...args: any[]) => T;
	set: (...args: any[]) => void;
	call: any;
}

export const contextStore = (context: {
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
