import axios from 'axios';
import { authentication, AuthenticationSession } from 'vscode';

import { IRequestOpts } from '../../shared/schemas/api.git';
import { ILogger } from '../../utils/logger';

interface IAuthService {
	getSession: () => Promise<AuthenticationSession>;
	isAuthenticated: () => Promise<boolean>;
}

export interface IApiService {
	get: <T>(endpoint?: string, invalidateCache?: boolean) => Promise<T>;
	post: <T>(endpoint: string, payload: any) => Promise<T>;
	update: <T>(endpoint: string, payload: any) => Promise<T>;
	request: <T>(
		options: IRequestOpts,
		invalidateCache?: boolean
	) => Promise<T>;
}
export const authSession = async (): Promise<AuthenticationSession> => {
	try {
		const session = await authentication.getSession('github', ['gist'], {
			createIfNone: true
		});

		return {
			...session
		};
	} catch (error) {
		throw error;
	}
};

export const createAuthService = (logger: ILogger): IAuthService => {
	const getSession = async (): Promise<AuthenticationSession> => {
		try {
			return await authentication.getSession('github', ['gist'], {
				createIfNone: true
			});
		} catch (error) {
			logger.error(`Authentication failed: ${error}`, true);
			throw error;
		}
	};
	return {
		getSession,
		isAuthenticated: async (): Promise<boolean> => {
			try {
				const session = await getSession();
				return !!session;
			} catch {
				return false;
			}
		}
	};
};

export const createApiService = (
	authService: {
		getSession: () => Promise<AuthenticationSession>;
		isAuthenticated: () => Promise<boolean>;
	},
	logger: ILogger
): IApiService => {
	// Simple request cache
	const cache = new Map<string, { data: any; timestamp: number }>();

	const request = async <T>(
		options: IRequestOpts,
		invalidateCache: boolean = false
	): Promise<T> => {
		const { method = 'G', payload, endpoint = 'gists' } = options;
		const url = `https://api.github.com/${endpoint}`;
		const cacheKey = `${method}-${url}-${JSON.stringify(payload || {})}`;

		if (invalidateCache) {
			cache.clear();
			logger.debug('Cache invalidated.');
		}

		if (method === 'G' && cache.has(cacheKey)) {
			const cached = cache.get(cacheKey)!;
			if (Date.now() - cached.timestamp < 1 * 60 * 1000) {
				logger.debug(`Cache hit for ${url}`);
				return cached.data;
			} else {
				logger.debug(`Cache expired for ${url}`);
				cache.delete(cacheKey);
			}
		}

		logger.debug(`Making API request to ${url}`);
		try {
			const session = await authService.getSession();
			const headers = {
				Authorization: `Bearer ${session.accessToken}`,
				Accept: 'application/vnd.github.v3+json'
			};

			let response;
			switch (method) {
				case 'P':
					response = await axios.post(url, payload, { headers });
					break;
				case 'U':
					response = await axios.patch(url, payload, { headers });
					break;
				default:
					response = await axios.get(url, { headers });
			}

			if (!response.data) {
				throw new Error('Response data is undefined');
			}

			if (method === 'G' && !invalidateCache) {
				cache.set(cacheKey, {
					data: response.data,
					timestamp: Date.now()
				});
				logger.debug(`Cached response for ${url}`);
			}

			return response.data as T;
		} catch (error) {
			logger.error(`API request failed to ${url}: ${error}`, false);
			throw error;
		}
	};

	return {
		get: async <T>(endpoint?: string, invalidateCache?: boolean) =>
			request<T>({ method: 'G', endpoint }, invalidateCache),
		post: async <T>(endpoint: string, payload: any) =>
			request<T>({ method: 'P', endpoint, payload }),
		update: async <T>(endpoint: string, payload: any) =>
			request<T>({ method: 'U', endpoint, payload }),
		request
	};
};
