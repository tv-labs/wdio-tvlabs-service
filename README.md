<p align="center">
  <a href="https://tvlabs.ai">
    <img alt="TV Labs Logo" width="200" src="https://tvlabs.ai/images/tvlabs.svg" />
  </a>
</p>

<p align="center">
  <b>@tvlabs/wdio-service</b> is a <a href="https://webdriver.io/">WebdriverIO</a> service for seamless integration with the <a href="https://tvlabs.ai">TV Labs</a> platform.
</p>

## Introduction

The `@tvlabs/wdio-service` package uses a websocket to connect to the TV Labs platform before an Appium session begins, logging events relating to TV Labs session creation as they occur. This offloads the responsibility of creating the TV Labs session from the `POST /session` Webdriver endpoint, leading to more reliable session requests and creation.

The service first makes a session request, and then subscribes to events for that request. Once the session has been filled and is ready for the Webdriver script to begin, the service receives a ready event with the TV Labs session ID. This session ID is injected into the capabilities as `tvlabs:session_id` on the Webdriver session create request.

Additionally, the service adds a unique request ID for each request made. The service will generate and attach an `x-request-id` header before each request to the TV Labs platform. This can be used to correlate requests in the client side logs to the Appium server logs.

## Installation

In your WebdriverIO project, run one of the following commands to install:

### NPM

```
npm i --save @tvlabs/wdio-service
```

### Yarn

```
yarn add @tvlabs/wdio-service
```

## Usage

### WebdriverIO Test Runner

To use this as a WebdriverIO test runner service, include the service in your WebdriverIO configuration file (e.g. `wdio.conf.ts`) with your TV Labs API key set in the options.

```javascript
import { TVLabsService } from '@tvlabs/wdio-service';

export const config = {
  // ...
  services: [[TVLabsService, { apiKey: process.env.TVLABS_API_KEY }]],
  // ...
};
```

### WebdriverIO Remote

To use this with WebdriverIO remote but without the test runner, call the beforeSession hook before instantiating the remote.

```javascript
import { remote } from 'webdriverio';
import { TVLabsService } from '@tvlabs/wdio-service';

const capabilities = { ... };

const wdOpts = {
  capabilities,
  hostname: 'appium.tvlabs.ai',
  port: 4723,
  headers: {
    Authorization: `Bearer ${process.env.TVLABS_API_TOKEN}`,
  },
};

const serviceOpts = {
  apiKey: process.env.TVLABS_API_TOKEN,
}

async function run() {
  const service = new TVLabsService(serviceOpts, capabilities, {})

  // The TV Labs service does not use specs or a cid, pass default values.
  const cid = ""
  const specs = []

  await service.beforeSession(wdOpts, capabilities, specs, cid)

  const driver = await remote(wdOpts);

  try {
    // ...
  } finally {
    await driver.deleteSession();
  }
}

run();
```

## Options

### `apiKey`

- **Type:** `string`
- **Required:** Yes
- **Description:** TV Labs API key used for authentication to the platform

### `retries`

- **Type:** `number`
- **Required:** No
- **Default:** `3`
- **Description:** Maximum number of attempts to create a session before failing

### `reconnectRetries`

- **Type:** `number`
- **Required:** No
- **Default:** `5`
- **Description:** Maximum number of attempts to re-connect if the connection to TV Labs is lost.

### `attachRequestId`

- **Type:** `boolean`
- **Required:** No
- **Default:** `true`
- **Description:** Controls whether or not to attach an `x-request-id` header to each request made to the TV Labs platform.
