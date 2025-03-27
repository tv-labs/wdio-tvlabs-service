<p align="center">
  <a href="https://tvlabs.ai">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="assets/tvlabs_dark.png">
      <source media="(prefers-color-scheme: light)" srcset="assets/tvlabs_light.png">
      <img alt="TV Labs Logo" width="400">
    </picture>
  </a>
</p>

# wdio-tvlabs-service

`wdio-tvlabs-service` is a WebdriverIO test runner service that provides a better integration into TV Labs. When using this service, the WebdriverIO test runner will use a websocket to connect to the TV Labs platform before a session begins, logging events relating to TV Labs session creation as they occur. This offloads the responsibility of creating the TV Labs session from the `POST /session` Webdriver endpoint, leading to more reliable session requests and creation.

The service first makes a session request, and then subscribes to events for that request. Once the session has been filled and is ready for the Webdriver script to begin, the service receives a ready event with the TV Labs session ID. This session ID is injected into the capabilities as `tvlabs:session_id` on the `POST /session` Webdriver session create request.

## Installation

In your WebdriverIO project, run one of the following commands to install:

### NPM

```
npm i --save-dev wdio-tvlabs-service
```

### Yarn
```
yarn add -D wdio-tvlabs-service
```

## Usage

### WebdriverIO Test Runner

To use this as a WebdriverIO test runner service, include the service in your WebdriverIO configuration file (e.g. `wdio.conf.ts`) with your TV Labs API key set in the options.

```javascript
import TVLabsService from 'wdio-tvlabs-service';

export const config = {
    // ...
    services: [
        [TVLabsService, apiKey: process.env.TVLABS_API_KEY]
    ],
    // ...
}
```

### WebdriverIO Remote

To use this with WebdriverIO remote but without the test runner, call the beforeSession hook before instantiating the remote.

```javascript
import { remote } from 'webdriverio';

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
