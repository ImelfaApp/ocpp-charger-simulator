# Ejemplo de uso programático del simulador OCPP

Este directorio contiene ejemplos de cómo usar el simulador OCPP como librería en tus propios proyectos.

## Ejemplos disponibles

- **[basic-usage.js](basic-usage.js)** - Ejemplo básico con un conector
- **[two-connectors.js](two-connectors.js)** - Ejemplo con 2 conectores

### Ejecutar ejemplos

```bash
# Desde la raíz del proyecto
node examples/basic-usage.js
node examples/two-connectors.js
```

## Ejemplo básico

```javascript
const { createSimulator } = require('ocpp-charger-simulator');

// Crear simulador con configuración mínima
const simulator = createSimulator({
    serverUrl: 'ws://localhost:8080/ocpp/',
    chargePointId: 'TEST-CP-001',
    numberOfConnectors: 2,
    logLevel: 'info'
});

// Conectar al servidor
await simulator.start();

// Simular conexión de vehículo
await simulator.simulatePlugVehicle(1);

// Iniciar carga
await simulator.simulateLocalStartTransaction(1, 'TESTCARD001');

// Esperar un tiempo...
await new Promise(resolve => setTimeout(resolve, 10000));

// Detener carga
await simulator.simulateLocalStopTransaction();

// Desconectar vehículo
await simulator.simulateUnplugVehicle(1);

// Detener simulador
simulator.stop();
```

## Configuración completa

```javascript
const { createSimulator } = require('ocpp-charger-simulator');

// Crear simulador con todas las opciones personalizadas
const simulator = createSimulator({
    // Configuración del servidor
    server: {
        url: 'ws://localhost:8080/ocpp/'
    },
    
    // Configuración del punto de carga
    chargePoint: {
        id: 'CUSTOM-CP-001',
        vendor: 'MyCompany',
        model: 'SuperCharger3000',
        serialNumber: 'SC3000-12345',
        firmwareVersion: '2.5.1',
        numberOfConnectors: 2
    },
    
    // Configuración del simulador
    simulator: {
        heartbeatInterval: 30,           // Heartbeat cada 30 segundos
        meterValueSampleInterval: 20,    // MeterValues cada 20 segundos
        charging: {
            chargingPower: 22000,        // 22 kW
            initialMeterValue: 5000      // Empezar con 5 kWh en el medidor
        }
    },
    
    // Configuración de logging
    logging: {
        level: 'debug',                  // Nivel de detalle máximo
        showTimestamp: true
    }
});

await simulator.start();
```

## Usando atajos de configuración

```javascript
// Forma corta para configuraciones comunes
const simulator = createSimulator({
    serverUrl: 'ws://localhost:8080/ocpp/',  // Atajo para server.url
    chargePointId: 'CP001',                   // Atajo para chargePoint.id
    numberOfConnectors: 2,                    // Atajo para chargePoint.numberOfConnectors
    logLevel: 'info'                          // Atajo para logging.level
});
```

## Mezclar atajos con configuración detallada

```javascript
const simulator = createSimulator({
    serverUrl: 'ws://localhost:8080/ocpp/',
    chargePointId: 'CP001',
    
    // Personalizar otras propiedades del chargePoint
    chargePoint: {
        vendor: 'CustomVendor',
        firmwareVersion: '3.0.0'
    },
    
    // Personalizar configuración de carga
    simulator: {
        charging: {
            chargingPower: 50000  // Cargador rápido de 50 kW
        }
    }
});
```

## Ejemplo para tests automatizados

```javascript
const { createSimulator } = require('ocpp-charger-simulator');

describe('OCPP Backend Tests', () => {
    let simulator;

    beforeEach(async () => {
        simulator = createSimulator({
            serverUrl: 'ws://localhost:8080/ocpp/',
            chargePointId: `TEST-${Date.now()}`,
            logLevel: 'warn' // Menos verbose en tests
        });
        await simulator.start();
    });

    afterEach(() => {
        simulator.stop();
    });

    it('debería iniciar una transacción', async () => {
        await simulator.simulatePlugVehicle(1);
        await simulator.simulateLocalStartTransaction(1, 'CARD123');
        
        // Verificar que la transacción esté activa en el conector 1
        expect(simulator.state.activeTransactions[1]).toBeTruthy();
        expect(simulator.state.activeTransactions[1].idTag).toBe('CARD123');
    });

    it('debería responder a RemoteStartTransaction', (done) => {
        // Escuchar eventos
        simulator.client.on('call', ({ action, payload }) => {
            if (action === 'StartTransaction') {
                expect(payload.idTag).toBe('REMOTE123');
                done();
            }
        });

        // Tu backend envía RemoteStartTransaction aquí
        // El simulador responderá automáticamente
    });
});
```

## Acceder al estado del simulador

```javascript
// Estado de los conectores
console.log(simulator.state.connectors);
// { 0: { status: 'Available', errorCode: 'NoError' }, 
//   1: { status: 'Charging', errorCode: 'NoError' },
//   2: { status: 'Available', errorCode: 'NoError' } }

// Transacciones activas (indexadas por connectorId)
console.log(simulator.state.activeTransactions);
// { 1: { transactionId: 12345, connectorId: 1, idTag: 'CARD123', ... },
//   2: { transactionId: 12346, connectorId: 2, idTag: 'CARD456', ... } }

// Valores del medidor por conector (en Wh)
console.log(simulator.state.meterValues);
// { 1: 1500, 2: 2300 }
```
## Ejemplo con 2 conectores

```javascript
const { createSimulator } = require('ocpp-charger-simulator');

const simulator = createSimulator({
    serverUrl: 'ws://localhost:8080/ocpp/',
    chargePointId: 'TEST-CP-002',
    numberOfConnectors: 2
});

await simulator.start();

// Conectar vehículo en conector 1
await simulator.simulatePlugVehicle(1);
await simulator.simulateLocalStartTransaction(1, 'CARD-001');

// Después de terminar con conector 1...
await simulator.simulateLocalStopTransaction(1);
await simulator.simulateUnplugVehicle(1);

// Usar conector 2
await simulator.simulatePlugVehicle(2);
await simulator.simulateLocalStartTransaction(2, 'CARD-002');

// Nota: El simulador actual soporta una transacción a la vez
// Para transacciones simultáneas, considera múltiples instancias
```

Ver ejemplo completo en [two-connectors.js](two-connectors.js)
## Eventos del cliente OCPP

```javascript
// Conectado al servidor
simulator.client.on('connected', () => {
    console.log('Conectado');
});

// Desconectado
simulator.client.on('disconnected', ({ code, reason }) => {
    console.log(`Desconectado: ${code} - ${reason}`);
});

// Mensaje recibido del servidor
simulator.client.on('call', ({ messageId, action, payload }) => {
    console.log(`Servidor llamó: ${action}`, payload);
});
```

## Logger personalizado

```javascript
const simulator = createSimulator({
    serverUrl: 'ws://localhost:8080/ocpp/',
    chargePointId: 'CP001',
    logger: {
        debug: (msg) => customLogger.debug(msg),
        info: (msg) => customLogger.info(msg),
        warn: (msg) => customLogger.warn(msg),
        error: (msg) => customLogger.error(msg)
    }
});
```
