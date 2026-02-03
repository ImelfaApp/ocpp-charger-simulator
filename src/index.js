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
║  start [idTag]  - Iniciar carga local (default: TESTCARD001)   ║
║  stop           - Detener carga actual                         ║
║  status         - Mostrar estado del cargador                  ║
║  help           - Mostrar esta ayuda                           ║
║  exit           - Salir del simulador                          ║
╚════════════════════════════════════════════════════════════════╝
    `);
}

function showStatus(simulator) {
    const state = simulator.state;
    const tx = state.activeTransaction;
    
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
    
    if (tx) {
        const duration = Math.round((new Date() - tx.startTime) / 1000);
        const energyWh = state.meterValue - tx.meterStart;
        const energyKWh = (energyWh / 1000).toFixed(2);
        
        console.log(`║  Transacción Activa:                                           ║`);
        console.log(`║    ID: ${tx.transactionId.toString().padEnd(54)}║`);
        console.log(`║    IdTag: ${tx.idTag.padEnd(51)}║`);
        console.log(`║    Duración: ${duration.toString().padEnd(48)}s ║`);
        console.log(`║    Energía: ${energyKWh.padEnd(47)}kWh ║`);
    } else {
        console.log(`║  No hay transacción activa                                     ║`);
    }
    
    console.log(`╠════════════════════════════════════════════════════════════════╣`);
    console.log(`║  MeterValue actual: ${Math.round(state.meterValue).toString().padEnd(40)}Wh ║`);
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
                    case 'start':
                        const idTag = args[0] || 'TESTCARD001';
                        await simulator.simulateLocalStartTransaction(idTag.toUpperCase());
                        break;
                        
                    case 'stop':
                        await simulator.simulateLocalStopTransaction();
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
                        case 'start':
                            const idTag = args[0] || 'TESTCARD001';
                            await simulator.simulateLocalStartTransaction(idTag.toUpperCase());
                            break;
                            
                        case 'stop':
                            await simulator.simulateLocalStopTransaction();
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
