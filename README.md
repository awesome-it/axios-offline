# @awesome-it/axios-offline

[![npm package](https://badgen.net/npm/v/@awesome-it/axios-offline)](https://www.npmjs.com/package/@awesome-it/axios-offline)
[![License: MIT](https://badgen.net/npm/license/@awesome-it/axios-offline)](https://opensource.org/licenses/MIT)

[//]: # ([![npm downloads]&#40;https://badgen.net/npm/dw/@awesome-it/axios-offline&#41;]&#40;https://www.npmjs.com/package/@awesome-it/axios-offline&#41;)

Remembering failed requests and repeating when an internet connection is available

## Credentials  
This package is based on a work of [appello](https://github.com/appello-software/axios-offline) and [jonkofee](https://github.com/jonkofee).

## Installation
### Using npm
```bash
npm install axios localforage # install peer dependencies
npm install @awesome-it/axios-offline
```

### Using yarn
```bash
yarn add axios localforage # install peer dependencies
yarn add @awesome-it/axios-offline
```

## Usage example

```typescript
import { AxiosOffline } from '@awesome-it/axios-offline';
import axios, { AxiosAdapter, HttpStatusCode } from 'axios';
import LocalForage from 'localforage';

const offlineUrls = ['/list', '/profile'];

export const axiosOfflineInstance = new AxiosOffline({
  axiosInstance: axios,
  storageInstance: LocalForage.createInstance({
    name: 'axios-offline',
    driver: LocalForage.LOCALSTORAGE,
  }),
  getRequestToStore: (request) => (request.method === 'put' || request.method === 'post' ? request : undefined),
  getResponsePlaceholder: config => ({
    config,
    headers: {},
    data: undefined,
    status: HttpStatusCode.Ok,
    statusText: 'Request successfully stored till back online!',
  }),
});

export const Api = axios.create({
  adapter: axiosOfflineInstance.adapter,
});

window.addEventListener('online', (event) => {
  axiosOfflineInstance.sendRequestsFromStore();
});
```
