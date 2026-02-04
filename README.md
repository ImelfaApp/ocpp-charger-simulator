# OCPP 1.6J Charger Simulator

Simulador de punto de carga OCPP 1.6J para testing de plataformas OCPP.

## Características

Este simulador implementa los siguientes mensajes OCPP 1.6:

### Mensajes iniciados por el Charge Point (Cliente → Servidor)
- **BootNotification** - Notificación de arranque del cargador
- **StatusNotification** - Notificación de cambio de estado del conector
- **Heartbeat** - Latido periódico para mantener la conexión
- **StartTransaction** - Inicio de una transacción de carga
- **StopTransaction** - Fin de una transacción de carga
- **MeterValues** - Valores del medidor durante la carga

### Mensajes iniciados por el Central System (Servidor → Cliente)
- **RemoteStartTransaction** - Inicio remoto de carga
- **RemoteStopTransaction** - Parada remota de carga
- **ChangeConfiguration** - Cambio de configuración (soporta `MeterValueSampleInterval`)

## Instalación

### Como aplicación standalone (CLI)

```bash
git clone https://github.com/TU_USUARIO/ocpp-charger-simulator.git
cd ocpp-charger-simulator
npm install
```

### Como dependencia en otro proyecto

Puedes instalar este simulador directamente desde GitHub en tus proyectos:

```bash
# Instalar desde GitHub (última versión)
npm install github:TU_USUARIO/ocpp-charger-simulator

# O desde una rama específica
npm install github:TU_USUARIO/ocpp-charger-simulator#main

# O desde un tag/release específico
npm install github:TU_USUARIO/ocpp-charger-simulator#v1.0.0
```

O agregarlo directamente en tu `package.json`:

```json
{
  "dependencies": {
    "ocpp-charger-simulator": "github:TU_USUARIO/ocpp-charger-simulator#main"
  }
}
```

## Uso

### Como aplicación standalone (CLI)

```bash
npm start
```

### Como librería en otro proyecto

```javascript
const { createSimulator } = require('ocpp-charger-simulator');

// Crear y conectar simulador
const simulator = createSimulator({
    serverUrl: 'ws://localhost:8080/ocpp/',
    chargePointId: 'TEST-CP-001',
    numberOfConnectors: 1
});

await simulator.start();

// Simular carga
await simulator.simulatePlugVehicle(1);
await simulator.simulateLocalStartTransaction(1, 'CARD123');

// Detener
simulator.stop();
```

Ver más ejemplos en [examples/README.md](examples/README.md).

## Configuración

Edita el archivo `src/config.js` para configurar:

```javascript
module.exports = {
    server: {
        url: 'ws://localhost:9000'  // URL del servidor OCPP
    },
    chargePoint: {
        id: 'CP001',                // ID del punto de carga
        vendor: 'SimulatorVendor',  // Fabricante
        model: 'VirtualCharger',    // Modelo
        numberOfConnectors: 1       // Número de conectores (1 o 2)
    },
    simulator: {
        meterValueSampleInterval: 60,  // Intervalo de MeterValues (segundos)
        charging: {
            chargingPower: 11000,      // Potencia de carga (W)
            initialMeterValue: 0       // Valor inicial del medidor (Wh)
        }
    }
};
```

También puedes usar variables de entorno:
- `OCPP_SERVER_URL` - URL del servidor OCPP
- `CHARGE_POINT_ID` - ID del punto de carga
- `LOG_LEVEL` - Nivel de log (`debug`, `info`, `warn`, `error`)

## Uso

### Iniciar el simulador

```bash
npm start
```

O con variables de entorno:

```bash
OCPP_SERVER_URL=ws://tu-servidor:9000 CHARGE_POINT_ID=CP002 npm start
```

### Comandos interactivos

Una vez conectado, puedes usar los siguientes comandos:

#### Con 1 conector configurado:

| Comando | Descripción |
|---------|-------------|
| `plug` | Conectar vehículo al conector (Available → Preparing) |
| `unplug` | Desconectar vehículo del conector (Preparing/Finishing → Available) |
| `start [idTag]` | Iniciar transacción de carga (auto-conecta si es necesario, default idTag: TESTCARD001) |
| `stop` | Detener la carga actual (Charging → Finishing) |
| `status` | Mostrar el estado actual del cargador |
| `help` | Mostrar ayuda |
| `exit` | Salir del simulador |

#### Con 2 conectores configurados:

| Comando | Descripción |
|---------|-------------|
| `plug [connectorId]` | Conectar vehículo al conector especificado (Available → Preparing) |
| `unplug [connectorId]` | Desconectar vehículo del conector especificado (Preparing/Finishing → Available) |
| `start [connectorId] [idTag]` | Iniciar transacción en el conector (auto-conecta si es necesario, defaults: connectorId=1, idTag=TESTCARD001) |
| `stop [connectorId]` | Detener la carga en el conector especificado (Charging → Finishing) |
| `status` | Mostrar el estado actual del cargador |
| `help` | Mostrar ayuda |
| `exit` | Salir del simulador |

### Ejemplo de sesión

#### Flujo completo con comandos separados (1 conector):

```
> plug
[INFO] Simulando conexión de vehículo en conector 1
[INFO] StatusNotification enviado para conector 1: Preparing

> start CARD123
[INFO] Iniciando transacción con IdTag: CARD123
[INFO] Transacción iniciada. ID: 12345
[INFO] StatusNotification enviado para conector 1: Charging

> status
╔════════════════════════════════════════════════════════════════╗
║                    Estado del Cargador                         ║
╠════════════════════════════════════════════════════════════════╣
║  Charge Point ID: CP001                                        ║
║  Conectores:                                                   ║
║    Cargador: Available                                         ║
║    Conector 1: Charging                                        ║
╠════════════════════════════════════════════════════════════════╣
║  Transacción Activa:                                           ║
║    ID: 12345                                                   ║
║    Conector: 1                                                 ║
║    IdTag: CARD123                                              ║
║    Duración: 120s                                              ║
║    Energía: 0.61 kWh                                           ║
╚════════════════════════════════════════════════════════════════╝

> stop
[INFO] Simulando fin de carga local
[INFO] Transacción 12345 detenida. Energía entregada: 0.61 kWh
[INFO] StatusNotification enviado para conector 1: Finishing

> unplug
[INFO] Simulando desconexión de vehículo en conector 1
[INFO] StatusNotification enviado para conector 1: Available
```

#### Flujo simplificado (auto-conexión):

```
> start CARD123
[INFO] Conectando vehículo en conector 1...
[INFO] StatusNotification enviado para conector 1: Preparing
[INFO] Iniciando transacción con IdTag: CARD123
[INFO] Transacción iniciada. ID: 12345

> stop
[INFO] Transacción 12345 detenida. Energía entregada: 0.45 kWh
```

#### Con 2 conectores:

```
> plug 1
[INFO] Simulando conexión de vehículo en conector 1
[INFO] StatusNotification enviado para conector 1: Preparing

> plug 2
[INFO] Simulando conexión de vehículo en conector 2
[INFO] StatusNotification enviado para conector 2: Preparing

> start 1 CARD123
[INFO] Iniciando transacción con IdTag: CARD123
[INFO] Transacción iniciada. ID: 12345

> status
╔════════════════════════════════════════════════════════════════╗
║                    Estado del Cargador                         ║
╠════════════════════════════════════════════════════════════════╣
║  Charge Point ID: CP001                                        ║
║  Conectores:                                                   ║
║    Cargador: Available                                         ║
║    Conector 1: Charging                                        ║
║    Conector 2: Preparing                                       ║
╠════════════════════════════════════════════════════════════════╣
║  Transacción Activa:                                           ║
║    ID: 12345                                                   ║
║    Conector: 1                                                 ║
║    IdTag: CARD123                                              ║
║    Duración: 45s                                               ║
║    Energía: 0.25 kWh                                           ║
╚════════════════════════════════════════════════════════════════╝

> stop 1
[INFO] Transacción 12345 detenida. Energía entregada: 0.25 kWh

> unplug 1
[INFO] Simulando desconexión de vehículo en conector 1
[INFO] StatusNotification enviado para conector 1: Available
```

## Flujo de comunicación

### Secuencia de inicio
1. El simulador conecta al servidor OCPP via WebSocket
2. Envía `BootNotification` con información del cargador
3. Si es aceptado, envía `StatusNotification` para cada conector
4. Inicia el envío periódico de `Heartbeat`

### Secuencia de carga completa (paso a paso)
1. Usuario ejecuta comando `plug [connectorId]`
2. Se envía `StatusNotification` (Available → Preparing)
3. Usuario ejecuta comando `start [connectorId] [idTag]`
4. Se envía `StartTransaction`
5. Si es aceptado, se envía `StatusNotification` (Preparing → Charging)
6. Se envían `MeterValues` periódicamente
7. Usuario ejecuta comando `stop [connectorId]`
8. Se envía `StopTransaction`
9. Se envía `StatusNotification` (Charging → Finishing)
10. Usuario ejecuta comando `unplug [connectorId]`
11. Se envía `StatusNotification` (Finishing → Available)

### Secuencia de carga simplificada (auto-conexión)
1. Usuario ejecuta comando `start [idTag]`
2. Si el conector está Available, automáticamente se envía `StatusNotification` (Available → Preparing)
3. Se envía `StartTransaction`
4. Continúa como en el flujo completo desde el paso 5

### Secuencia de carga (iniciada remotamente)
1. Servidor envía `RemoteStartTransaction`
2. Simulador responde con status `Accepted`
3. Se envía `StatusNotification` (Available → Preparing)
4. Se envía `StartTransaction`
5. Se sigue la misma secuencia que la carga local

## Estructura del proyecto

```
ocppClient/
├── package.json
├── README.md
├── schemas/              # Schemas JSON de OCPP 1.6
│   ├── BootNotification.json
│   ├── StatusNotification.json
│   └── ...
└── src/
    ├── index.js          # Punto de entrada
    ├── config.js         # Configuración
    ├── ocppClient.js     # Cliente WebSocket OCPP
    └── chargerSimulator.js # Lógica del simulador
```

## Notas técnicas

- El simulador usa el protocolo OCPP 1.6J (JSON sobre WebSocket)
- La URL de conexión sigue el formato: `ws://servidor:puerto/chargePointId`
- Se envía el subprotocolo `ocpp1.6` en el handshake WebSocket
- El simulador simula el consumo de energía incrementando el medidor basándose en la potencia configurada

## Licencia

MIT
