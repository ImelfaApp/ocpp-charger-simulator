const ChargerSimulator = require('./chargerSimulator');
const config = require('./config');
const readline = require('readline');

// ==================== Logger ====================
const logger = {
    _log(level, message) {
        const timestamp = config.logging.showTimestamp ? `[${new Date().toISOString()}] ` : '';
        const prefix = `${timestamp}[${level.toUpperCase()}]`;

        if (level === 'error') {
            console.error(`${prefix} ${message}`);
        } else {
            console.log(`${prefix} ${message}`);
        }
    },

    debug(message) {
        if (['debug'].includes(config.logging.level)) {
            this._log('debug', message);
        }
    },

    info(message) {
        if (['debug', 'info'].includes(config.logging.level)) {
            this._log('info', message);
        }
    },

    warn(message) {
        if (['debug', 'info', 'warn'].includes(config.logging.level)) {
            this._log('warn', message);
        }
    },

    error(message) {
        this._log('error', message);
    }
};

// ==================== Interfaz de comandos ====================
function showHelp() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║              OCPP Charger Simulator - Comandos                 ║
╠════════════════════════════════════════════════════════════════╣
║  plug [connectorId]         - Conectar vehículo               ║
║  unplug [connectorId]       - Desconectar vehículo            ║
║  start [connectorId] [idTag]- Iniciar carga local             ║
║  stop [connectorId]         - Detener carga                   ║
║  suspend ev [connectorId]   - Pausar carga (detenido por EV)  ║
║  suspend evse [connectorId] - Pausar carga (detenido por EVSE)║
║  resume [connectorId]       - Reanudar carga pausada          ║
║  fault [connectorId]        - Forzar estado Faulted           ║
║  unavailable [connectorId]  - Forzar estado Unavailable       ║
║  available [connectorId]    - Restaurar conector a Available  ║
║  status                     - Mostrar estado del cargador     ║
║  help                       - Mostrar esta ayuda              ║
║  exit                       - Salir del simulador             ║
╚════════════════════════════════════════════════════════════════╝
    `);
}

function showStatus(simulator) {
    const state = simulator.state;

    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    Estado del Cargador                         ║
╠════════════════════════════════════════════════════════════════╣
║  Charge Point ID: ${config.chargePoint.id.padEnd(42)}║
║  Conectores:                                                   ║`);

    for (let i = 0; i <= config.chargePoint.numberOfConnectors; i++) {
        const conn = state.connectors[i];
        const connType = i === 0 ? 'Cargador' : `Conector ${i}`;
        console.log(`║    ${connType}: ${conn.status.padEnd(47)}║`);
    }

    console.log(`╠════════════════════════════════════════════════════════════════╣`);

    // Mostrar transacciones activas
    const activeTransactions = Object.entries(state.activeTransactions);
    if (activeTransactions.length > 0) {
        console.log(`║  Transacciones Activas:                                        ║`);
        activeTransactions.forEach(([connId, tx]) => {
            const duration = Math.round((new Date() - tx.startTime) / 1000);
            const energyWh = state.meterValues[connId] - tx.meterStart;
            const energyKWh = (energyWh / 1000).toFixed(2);

            console.log(`║                                                                ║`);
            console.log(`║    Conector ${connId}:                                                ║`);
            console.log(`║      ID: ${tx.transactionId.toString().padEnd(52)}║`);
            console.log(`║      IdTag: ${tx.idTag.padEnd(49)}║`);
            console.log(`║      Duración: ${duration.toString().padEnd(46)}s ║`);
            console.log(`║      Energía: ${energyKWh.padEnd(45)}kWh ║`);
        });
    } else {
        console.log(`║  No hay transacciones activas                                  ║`);
    }

    console.log(`╠════════════════════════════════════════════════════════════════╣`);
    console.log(`║  MeterValues:                                                  ║`);
    for (let i = 1; i <= config.chargePoint.numberOfConnectors; i++) {
        const meterValue = Math.round(state.meterValues[i] || 0);
        console.log(`║    Conector ${i}: ${meterValue.toString().padEnd(46)}Wh ║`);
    }
    console.log(`║  MeterValueSampleInterval: ${state.configuration.MeterValueSampleInterval.padEnd(33)}s ║`);
    console.log(`╚════════════════════════════════════════════════════════════════╝`);
}

// ==================== Command handler ====================
async function handleCommand(input, simulator, cleanup) {
    const [command, ...args] = input.trim().toLowerCase().split(' ');
    const multiConnector = config.chargePoint.numberOfConnectors > 1;

    switch (command) {
        case 'plug':
        case 'connect': {
            const connectorId = multiConnector ? (args[0] ? parseInt(args[0]) : 1) : 1;
            if (isNaN(connectorId)) {
                console.log('ConnectorId debe ser un número. Uso: plug [connectorId]');
            } else {
                await simulator.simulatePlugVehicle(connectorId);
            }
            break;
        }

        case 'unplug':
        case 'disconnect': {
            const connectorId = multiConnector ? (args[0] ? parseInt(args[0]) : 1) : 1;
            if (isNaN(connectorId)) {
                console.log('ConnectorId debe ser un número. Uso: unplug [connectorId]');
            } else {
                await simulator.simulateUnplugVehicle(connectorId);
            }
            break;
        }

        case 'start': {
            if (multiConnector) {
                const connectorId = args[0] ? parseInt(args[0]) : 1;
                const idTag = args[1] || 'TESTCARD001';
                if (isNaN(connectorId)) {
                    console.log('ConnectorId debe ser un número. Uso: start [connectorId] [idTag]');
                } else {
                    await simulator.simulateLocalStartTransaction(connectorId, idTag.toUpperCase());
                }
            } else {
                const idTag = args[0] || 'TESTCARD001';
                await simulator.simulateLocalStartTransaction(1, idTag.toUpperCase());
            }
            break;
        }

        case 'stop': {
            if (multiConnector && args[0]) {
                const connectorId = parseInt(args[0]);
                if (isNaN(connectorId)) {
                    console.log('ConnectorId debe ser un número. Uso: stop [connectorId]');
                } else {
                    await simulator.simulateLocalStopTransaction(connectorId);
                }
            } else {
                await simulator.simulateLocalStopTransaction();
            }
            break;
        }

        case 'suspend': {
            const subCommand = args[0];
            if (subCommand !== 'ev' && subCommand !== 'evse') {
                console.log('Uso: suspend ev [connectorId] | suspend evse [connectorId]');
                break;
            }
            const connectorId = multiConnector ? (args[1] ? parseInt(args[1]) : 1) : 1;
            if (isNaN(connectorId)) {
                console.log(`ConnectorId debe ser un número. Uso: suspend ${subCommand} [connectorId]`);
            } else if (subCommand === 'ev') {
                await simulator.simulateSuspendEV(connectorId);
            } else {
                await simulator.simulateSuspendEVSE(connectorId);
            }
            break;
        }

        case 'resume': {
            const connectorId = multiConnector ? (args[0] ? parseInt(args[0]) : 1) : 1;
            if (isNaN(connectorId)) {
                console.log('ConnectorId debe ser un número. Uso: resume [connectorId]');
            } else {
                await simulator.simulateResume(connectorId);
            }
            break;
        }

        case 'fault': {
            const connectorId = multiConnector ? (args[0] ? parseInt(args[0]) : 1) : 1;
            if (isNaN(connectorId)) {
                console.log('ConnectorId debe ser un número. Uso: fault [connectorId]');
            } else {
                await simulator.simulateFault(connectorId);
            }
            break;
        }

        case 'unavailable': {
            const connectorId = multiConnector ? (args[0] ? parseInt(args[0]) : 1) : 1;
            if (isNaN(connectorId)) {
                console.log('ConnectorId debe ser un número. Uso: unavailable [connectorId]');
            } else {
                await simulator.simulateUnavailable(connectorId);
            }
            break;
        }

        case 'available': {
            const connectorId = multiConnector ? (args[0] ? parseInt(args[0]) : 1) : 1;
            if (isNaN(connectorId)) {
                console.log('ConnectorId debe ser un número. Uso: available [connectorId]');
            } else {
                await simulator.simulateAvailable(connectorId);
            }
            break;
        }

        case 'status':
            showStatus(simulator);
            break;

        case 'help':
            showHelp();
            break;

        case 'exit':
        case 'quit':
            cleanup();
            break;

        case '':
            break;

        default:
            console.log(`Comando desconocido: ${command}. Escribe 'help' para ver los comandos disponibles.`);
    }
}

// ==================== Main ====================
async function main() {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║             🔌 OCPP 1.6J Charger Simulator 🔌                  ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
    `);

    logger.info(`Configuración cargada:`);
    logger.info(`  Servidor OCPP: ${config.server.url}`);
    logger.info(`  ChargePoint ID: ${config.chargePoint.id}`);
    logger.info(`  Vendor: ${config.chargePoint.vendor}`);
    logger.info(`  Model: ${config.chargePoint.model}`);

    const simulator = new ChargerSimulator(config, logger);

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const cleanup = () => {
        console.log('\n');
        logger.info('Cerrando simulador...');
        simulator.stop();
        rl.close();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    const promptUser = () => {
        rl.question('\n> ', async (input) => {
            await handleCommand(input, simulator, cleanup);
            if (input.trim().toLowerCase() !== 'exit' && input.trim().toLowerCase() !== 'quit') {
                promptUser();
            }
        });
    };

    try {
        await simulator.start();

        console.log('\n');
        showHelp();
        promptUser();

    } catch (error) {
        logger.error(`No se pudo conectar al servidor OCPP: ${error.message}`);
        logger.info('El simulador intentará reconectar automáticamente cuando el servidor esté disponible.');
        logger.info('Presiona Ctrl+C para salir.\n');

        simulator.client.on('connected', () => {
            console.log('\n');
            showHelp();
            promptUser();
        });
    }
}

main();
