import { OperationOptions, operation } from 'retry';
import { v4 as uuid } from 'uuid';
import {
  AxiosAdapter,
  AxiosError,
  AxiosInstance,
  AxiosPromise,
  AxiosRequestConfig,
  AxiosResponse,
  getAdapter,
  InternalAxiosRequestConfig,
} from 'axios';
import { NonFunctionProperties } from './types';

type StorableAxiosRequestConfig = NonFunctionProperties<AxiosRequestConfig>;

export type StorageInstance = {
  prefix?: string;
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<any>;
  removeItem(key: string): Promise<any>;
  keys(): Promise<readonly string[]>;
};

export type AxiosOfflineOptions = {
  axiosInstance: AxiosInstance;
  storageInstance: StorageInstance;
  getRequestToStore?: (request: InternalAxiosRequestConfig) => StorableAxiosRequestConfig | undefined;
  getResponsePlaceholder?: (request: InternalAxiosRequestConfig, err: AxiosError) => AxiosResponse;
  sendFromStorageFirst?: boolean;
  retryOptions?: OperationOptions;
};

type AxiosOfflineAdapter = ((config: InternalAxiosRequestConfig, fromStorage: boolean) => AxiosPromise) & AxiosAdapter;

export class AxiosOffline {
  private readonly axiosInstance: AxiosInstance;

  private readonly storageInstance: Required<StorageInstance>;

  private readonly defaultAdapter: AxiosAdapter;

  private readonly options: Required<Pick<AxiosOfflineOptions, 'getRequestToStore'>> &
    Pick<AxiosOfflineOptions, 'getResponsePlaceholder' | 'sendFromStorageFirst' | 'retryOptions'>;

  constructor({
    axiosInstance,
    storageInstance,
    // Requests props as transformRequest and transformResponse are not supported since they can't get hydrated.
    getRequestToStore = ({ baseURL, method, url, headers, data }) => ({
      baseURL,
      method,
      url,
      headers,
      data,
    }),
    getResponsePlaceholder,
    sendFromStorageFirst,
    retryOptions,
  }: AxiosOfflineOptions) {
    this.storageInstance = {
      ...storageInstance,
      prefix: storageInstance.prefix ?? AxiosOffline.STORAGE_PREFIX,
    };
    this.options = {
      getRequestToStore,
      getResponsePlaceholder,
      sendFromStorageFirst,
      retryOptions: {
        retries: 3,
        factor: 1,
        minTimeout: 500,
        maxTimeout: 1000,
        randomize: false,
        ...retryOptions,
      },
    };

    this.defaultAdapter = getAdapter(axiosInstance.defaults.adapter);
    this.axiosInstance = axiosInstance;
    this.axiosInstance.defaults.adapter = this.adapter;
  }

  private async storeRequest(request: StorableAxiosRequestConfig) {
    const num = (await this.storageInstance.keys()).length;
    await this.storageInstance.setItem(`${this.storageInstance.prefix}_${num}_${uuid()}`, JSON.stringify(request));
  }

  private removeRequest(key: string) {
    return this.storageInstance.removeItem(key);
  }

  private adapter: AxiosOfflineAdapter = async (request) => {
    const fromStorage = Boolean(request.headers[AxiosOffline.STORAGE_HEADER] || false);

    try {
      if (this.options.sendFromStorageFirst && !fromStorage) {
        await this.sendRequestsFromStore();
      }

      return await this.defaultAdapter(request);
    } catch (err) {
      const isOffline = AxiosOffline.checkIfOfflineError(err as AxiosError);
      const requestToStore = this.options.getRequestToStore(request);

      if (!fromStorage && isOffline && requestToStore) {
        await this.storeRequest(requestToStore);

        if (this.options.getResponsePlaceholder) {
          return this.options.getResponsePlaceholder(request, err as AxiosError);
        }
      }

      throw err;
    }
  };

  async sendRequestsFromStore() {
    const keys = (await this.storageInstance.keys())
      .filter((key) => key.startsWith(this.storageInstance.prefix))
      .sort();

    const requests: Record<string, AxiosRequestConfig> = {};
    await Promise.all(
      keys.map(async (key) => {
        const request = await this.storageInstance.getItem(key);
        if (request) {
          requests[key] = JSON.parse(request) as AxiosRequestConfig;
        }
      }),
    );

    await Promise.all(
      Object.entries(requests).map(async ([key, request]) => {
        await this.sendRequest(key, request);
      }),
    );
  }

  async sendRequest<D>(key: string, request: AxiosRequestConfig<D>) {
    const fn = operation(this.options.retryOptions);

    return new Promise((resolve, reject) => {
      fn.attempt(async () => {
        try {
          const response = await this.axiosInstance.request({
            ...request,
            headers: {
              ...request.headers,
              [AxiosOffline.STORAGE_HEADER]: true,
            },
          });
          await this.removeRequest(key);
          resolve(response);
        } catch (e: unknown) {
          if (!fn.retry(e as Error)) {
            reject(e as Error);
          }
        }
      });
    });
  }

  static checkIfOfflineError(error: AxiosError): boolean {
    const { code, response } = error;
    return response === undefined && (code === AxiosError.ERR_NETWORK || code === AxiosError.ECONNABORTED);
  }

  static STORAGE_HEADER = 'x-from-storage';

  static STORAGE_PREFIX = '@axios-offline';
}
