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
    const hasMultipleConnectors = config.chargePoint.numberOfConnectors > 1;
    const plugCmd = hasMultipleConnectors 
        ? '  plug [connectorId]  - Conectar vehículo al conector                '
        : '  plug           - Conectar vehículo al conector                 ';
    const unplugCmd = hasMultipleConnectors
        ? '  unplug [connectorId] - Desconectar vehículo del conector           '
        : '  unplug         - Desconectar vehículo del conector             ';
    const startCmd = hasMultipleConnectors 
        ? '  start [connectorId] [idTag] - Iniciar carga local               '
        : '  start [idTag]  - Iniciar carga local (default: TESTCARD001)   ';
    const stopCmd = hasMultipleConnectors
        ? '  stop [connectorId]  - Detener carga en conector específico       '
        : '  stop           - Detener carga actual                         ';
    
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║              OCPP Charger Simulator - Comandos                 ║
╠════════════════════════════════════════════════════════════════╣
║${plugCmd}║
║${unplugCmd}║
║${startCmd}║
║${stopCmd}║
║  status         - Mostrar estado del cargador                  ║
║  help           - Mostrar esta ayuda                           ║
║  exit           - Salir del simulador                          ║
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
    
    // Configurar interfaz de línea de comandos
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // Manejar cierre graceful
    const cleanup = () => {
        console.log('\n');
        logger.info('Cerrando simulador...');
        simulator.stop();
        rl.close();
        process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    try {
        await simulator.start();
        
        console.log('\n');
        showHelp();
        
        const promptUser = () => {
            rl.question('\n> ', async (input) => {
                const [command, ...args] = input.trim().toLowerCase().split(' ');
                
                switch (command) {
                    case 'plug':
                    case 'connect':
                        if (config.chargePoint.numberOfConnectors > 1) {
                            const connectorId = args[0] ? parseInt(args[0]) : 1;
                            if (isNaN(connectorId)) {
                                console.log('ConnectorId debe ser un número. Uso: plug [connectorId]');
                            } else {
                                await simulator.simulatePlugVehicle(connectorId);
                            }
                        } else {
                            await simulator.simulatePlugVehicle(1);
                        }
                        break;

                    case 'unplug':
                    case 'disconnect':
                        if (config.chargePoint.numberOfConnectors > 1) {
                            const connectorId = args[0] ? parseInt(args[0]) : 1;
                            if (isNaN(connectorId)) {
                                console.log('ConnectorId debe ser un número. Uso: unplug [connectorId]');
                            } else {
                                await simulator.simulateUnplugVehicle(connectorId);
                            }
                        } else {
                            await simulator.simulateUnplugVehicle(1);
                        }
                        break;

                    case 'start':
                        if (config.chargePoint.numberOfConnectors > 1) {
                            // Modo múltiples conectores: start [connectorId] [idTag]
                            const connectorId = args[0] ? parseInt(args[0]) : 1;
                            const idTag = args[1] || 'TESTCARD001';
                            if (isNaN(connectorId)) {
                                console.log('ConnectorId debe ser un número. Uso: start [connectorId] [idTag]');
                            } else {
                                await simulator.simulateLocalStartTransaction(connectorId, idTag.toUpperCase());
                            }
                        } else {
                            // Modo un solo conector: start [idTag]
                            const idTag = args[0] || 'TESTCARD001';
                            await simulator.simulateLocalStartTransaction(1, idTag.toUpperCase());
                        }
                        break;
                        
                    case 'stop':
                        if (config.chargePoint.numberOfConnectors > 1 && args[0]) {
                            // Modo múltiples conectores: stop [connectorId]
                            const connectorId = parseInt(args[0]);
                            if (isNaN(connectorId)) {
                                console.log('ConnectorId debe ser un número. Uso: stop [connectorId]');
                            } else {
                                await simulator.simulateLocalStopTransaction(connectorId);
                            }
                        } else {
                            // Modo un solo conector o sin especificar: stop
                            await simulator.simulateLocalStopTransaction();
                        }
                        break;
                        
                    case 'status':
                        showStatus(simulator);
                        break;
                        
                    case 'help':
                        showHelp();
                        break;
                        
                    case 'exit':
                    case 'quit':
                        cleanup();
                        return;
                        
                    case '':
                        break;
                        
                    default:
                        console.log(`Comando desconocido: ${command}. Escribe 'help' para ver los comandos disponibles.`);
                }
                
                promptUser();
            });
        };
        
        promptUser();
        
    } catch (error) {
        logger.error(`No se pudo conectar al servidor OCPP: ${error.message}`);
        logger.info('El simulador intentará reconectar automáticamente cuando el servidor esté disponible.');
        logger.info('Presiona Ctrl+C para salir.\n');
        
        // Esperar eventos de reconexión
        simulator.client.on('connected', () => {
            console.log('\n');
            showHelp();
            
            const promptUser = () => {
                rl.question('\n> ', async (input) => {
                    const [command, ...args] = input.trim().toLowerCase().split(' ');
                    
                    switch (command) {
                        case 'plug':
                        case 'connect':
                            if (config.chargePoint.numberOfConnectors > 1) {
                                const connectorId = args[0] ? parseInt(args[0]) : 1;
                                if (isNaN(connectorId)) {
                                    console.log('ConnectorId debe ser un número. Uso: plug [connectorId]');
                                } else {
                                    await simulator.simulatePlugVehicle(connectorId);
                                }
                            } else {
                                await simulator.simulatePlugVehicle(1);
                            }
                            break;

                        case 'unplug':
                        case 'disconnect':
                            if (config.chargePoint.numberOfConnectors > 1) {
                                const connectorId = args[0] ? parseInt(args[0]) : 1;
                                if (isNaN(connectorId)) {
                                    console.log('ConnectorId debe ser un número. Uso: unplug [connectorId]');
                                } else {
                                    await simulator.simulateUnplugVehicle(connectorId);
                                }
                            } else {
                                await simulator.simulateUnplugVehicle(1);
                            }
                            break;

                        case 'start':
                            if (config.chargePoint.numberOfConnectors > 1) {
                                // Modo múltiples conectores: start [connectorId] [idTag]
                                const connectorId = args[0] ? parseInt(args[0]) : 1;
                                const idTag = args[1] || 'TESTCARD001';
                                if (isNaN(connectorId)) {
                                    console.log('ConnectorId debe ser un número. Uso: start [connectorId] [idTag]');
                                } else {
                                    await simulator.simulateLocalStartTransaction(connectorId, idTag.toUpperCase());
                                }
                            } else {
                                // Modo un solo conector: start [idTag]
                                const idTag = args[0] || 'TESTCARD001';
                                await simulator.simulateLocalStartTransaction(1, idTag.toUpperCase());
                            }
                            break;
                            
                        case 'stop':
                            if (config.chargePoint.numberOfConnectors > 1 && args[0]) {
                                // Modo múltiples conectores: stop [connectorId]
                                const connectorId = parseInt(args[0]);
                                if (isNaN(connectorId)) {
                                    console.log('ConnectorId debe ser un número. Uso: stop [connectorId]');
                                } else {
                                    await simulator.simulateLocalStopTransaction(connectorId);
                                }
                            } else {
                                // Modo un solo conector o sin especificar: stop
                                await simulator.simulateLocalStopTransaction();
                            }
                            break;
                            
                        case 'status':
                            showStatus(simulator);
                            break;
                            
                        case 'help':
                            showHelp();
                            break;
                            
                        case 'exit':
                        case 'quit':
                            cleanup();
                            return;
                            
                        case '':
                            break;
                            
                        default:
                            console.log(`Comando desconocido: ${command}. Escribe 'help' para ver los comandos disponibles.`);
                    }
                    
                    promptUser();
                });
            };
            
            promptUser();
        });
    }
}

main();
