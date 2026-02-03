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

```bash
npm install
```

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
        numberOfConnectors: 1       // Número de conectores
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

| Comando | Descripción |
|---------|-------------|
| `start [idTag]` | Iniciar una carga local con el idTag especificado (default: TESTCARD001) |
| `stop` | Detener la carga actual |
| `status` | Mostrar el estado actual del cargador |
| `help` | Mostrar ayuda |
| `exit` | Salir del simulador |

### Ejemplo de sesión

```
> start CARD123
[INFO] Simulando inicio de carga local con IdTag: CARD123
[INFO] StatusNotification enviado para conector 1: Preparing
[INFO] Transacción iniciada. ID: 12345
[INFO] StatusNotification enviado para conector 1: Charging

> status
╔════════════════════════════════════════════════════════════════╗
║                    Estado del Cargador                         ║
╠════════════════════════════════════════════════════════════════╣
║  Charge Point ID: CP001                                        ║
║  Conectores:                                                   ║
║    Cargador: Charging                                          ║
║    Conector 1: Charging                                        ║
╠════════════════════════════════════════════════════════════════╣
║  Transacción Activa:                                           ║
║    ID: 12345                                                   ║
║    IdTag: CARD123                                              ║
║    Duración: 120s                                              ║
║    Energía: 0.61 kWh                                           ║
╚════════════════════════════════════════════════════════════════╝

> stop
[INFO] Simulando fin de carga local
[INFO] Transacción 12345 detenida. Energía entregada: 0.61 kWh
```

## Flujo de comunicación

### Secuencia de inicio
1. El simulador conecta al servidor OCPP via WebSocket
2. Envía `BootNotification` con información del cargador
3. Si es aceptado, envía `StatusNotification` para cada conector
4. Inicia el envío periódico de `Heartbeat`

### Secuencia de carga (iniciada localmente)
1. Usuario ejecuta comando `start`
2. Se envía `StatusNotification` (Preparing)
3. Se envía `StartTransaction`
4. Si es aceptado, se envía `StatusNotification` (Charging)
5. Se envían `MeterValues` periódicamente
6. Usuario ejecuta comando `stop`
7. Se envía `StopTransaction`
8. Se envía `StatusNotification` (Finishing → Available)

### Secuencia de carga (iniciada remotamente)
1. Servidor envía `RemoteStartTransaction`
2. Simulador responde con status `Accepted`
3. Se sigue la misma secuencia que la carga local

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
