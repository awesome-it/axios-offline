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
import axios, { AxiosAdapter } from 'axios';
import { AxiosOffline } from '@awesome-it/axios-offline';
import NetInfo from '@react-native-community/netinfo';
import LocalForage from 'localforage';

const offlineUrls = ['/list', '/profile'];

export const axiosOfflineInstance = new AxiosOffline({
  defaultAdapter: axios.defaults.adapter as AxiosAdapter, // require, basic adapter
  storageOptions: {
    name: 'axios-offline', // optional, default: "axios-stack"
    driver: LocalForage.LOCALSTORAGE, // optional, default: LocalForage.LOCALSTORAGE
  },
  shouldStoreRequest: config => {
    return config.method === 'POST' && offlineUrls.includes(config.url as string);
  },
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
