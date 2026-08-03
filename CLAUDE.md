# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
npm install

# Run as interactive CLI simulator
npm start

# Run with custom server/ID via env vars
OCPP_SERVER_URL=ws://my-server:9000 CHARGE_POINT_ID=CP002 npm start

# Run a programmatic example
node examples/basic-usage.js
```

There is no test suite or linter configured in this project.

## Architecture

This is a Node.js OCPP 1.6J (JSON over WebSocket) charge point simulator with two usage modes: an interactive CLI and a programmatic library.

### Source files

- **`src/config.js`** — Single source of truth for connection/charger/simulator settings. All values can be overridden via env vars (`OCPP_SERVER_URL`, `CHARGE_POINT_ID`, `LOG_LEVEL`). The `chargePointId` is appended to the server URL at connection time (e.g. `ws://server/ocpp/CP001`).

- **`src/ocppClient.js`** — Low-level WebSocket layer. Extends `EventEmitter`. Handles OCPP message framing (CALL=2, CALLRESULT=3, CALLERROR=4), pending-call tracking with 30s timeouts, and automatic reconnection (up to 10 attempts, 5s delay). Emits `connected`, `disconnected`, `call`, and `error` events.

- **`src/chargerSimulator.js`** — Business logic layer. Holds connector state (indexed by `connectorId`, where 0 = the charger itself and 1..N = physical connectors), active transactions per connector, meter values (Wh), and pending remote starts. Manages per-connector charging simulation intervals (incrementing Wh every second) and a shared MeterValues broadcast interval. Handles inbound server calls: `RemoteStartTransaction`, `RemoteStopTransaction`, `ChangeConfiguration` (only `MeterValueSampleInterval` is supported), and `DataTransfer`.

- **`src/lib.js`** — Public API for programmatic use. Exports `createSimulator(options)`, which merges caller options over the defaults from `config.js`. Supports both flat shorthand properties (`serverUrl`, `chargePointId`, `numberOfConnectors`, `logLevel`) and nested object form.

- **`src/index.js`** — Interactive CLI entry point. Wraps `ChargerSimulator` with a readline REPL exposing `plug`, `unplug`, `start`, `stop`, `status`, `help`, and `exit` commands. Command syntax adapts based on `numberOfConnectors` (single vs. multi-connector mode).

### Key design decisions

**Connector state machine**: Valid transitions are `Available → Preparing → Charging → Finishing → Available`. The `simulatePlugVehicle` call automatically detects pending `RemoteStartTransaction` requests and triggers `StartTransaction` after the vehicle connects.

**Dual usage**: `src/lib.js` (`main: "src/lib.js"` in package.json) is the library entry point; `src/index.js` is the CLI binary. The library re-exports `ChargerSimulator`, `OCPPClient`, and `createDefaultLogger` for advanced usage.

**Per-connector parallelism**: `chargingSimulationIntervals` and `activeTransactions` are both keyed by `connectorId`, allowing simultaneous charging on connectors 1 and 2 independently.

## Configuration

Edit `src/config.js` directly to change the target server, charger identity, or simulation parameters. The `chargePointId` at the top of `config.js` is hardcoded as the active identity — commented-out alternatives are preserved as examples.
