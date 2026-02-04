/**
 * Módulo principal para uso programático del simulador OCPP
 * Permite importar el simulador en otros proyectos
 */

const ChargerSimulator = require('./chargerSimulator');
const OCPPClient = require('./ocppClient');
const config = require('./config');

/**
 * Crear un logger básico si no se proporciona uno
 */
function createDefaultLogger(level = 'info') {
    return {
        _log(level, message) {
            const timestamp = `[${new Date().toISOString()}]`;
            const prefix = `${timestamp} [${level.toUpperCase()}]`;
            
            if (level === 'error') {
                console.error(`${prefix} ${message}`);
            } else {
                console.log(`${prefix} ${message}`);
            }
        },
        
        debug(message) {
            if (['debug'].includes(level)) {
                this._log('debug', message);
            }
        },
        
        info(message) {
            if (['debug', 'info'].includes(level)) {
                this._log('info', message);
            }
        },
        
        warn(message) {
            if (['debug', 'info', 'warn'].includes(level)) {
                this._log('warn', message);
            }
        },
        
        error(message) {
            this._log('error', message);
        }
    };
}

/**
 * Crear una nueva instancia del simulador
 * @param {Object} options - Opciones de configuración
 * 
 * @param {string} [options.serverUrl] - URL del servidor OCPP (ej: 'ws://localhost:8080/ocpp/')
 * @param {string} [options.chargePointId] - ID del punto de carga
 * @param {number} [options.numberOfConnectors] - Número de conectores (1 o 2)
 * @param {string} [options.logLevel] - Nivel de log ('debug', 'info', 'warn', 'error')
 * @param {Object} [options.logger] - Logger personalizado (opcional)
 * 
 * @param {Object} [options.server] - Configuración del servidor
 * @param {string} [options.server.url] - URL del servidor OCPP
 * 
 * @param {Object} [options.chargePoint] - Configuración del punto de carga
 * @param {string} [options.chargePoint.id] - ID del punto de carga
 * @param {string} [options.chargePoint.vendor] - Fabricante del cargador
 * @param {string} [options.chargePoint.model] - Modelo del cargador
 * @param {string} [options.chargePoint.serialNumber] - Número de serie
 * @param {string} [options.chargePoint.firmwareVersion] - Versión del firmware
 * @param {number} [options.chargePoint.numberOfConnectors] - Número de conectores
 * 
 * @param {Object} [options.simulator] - Configuración del simulador
 * @param {number} [options.simulator.heartbeatInterval] - Intervalo de heartbeat en segundos
 * @param {number} [options.simulator.meterValueSampleInterval] - Intervalo de MeterValues en segundos
 * @param {Object} [options.simulator.charging] - Configuración de carga
 * @param {number} [options.simulator.charging.chargingPower] - Potencia de carga en W
 * @param {number} [options.simulator.charging.initialMeterValue] - Valor inicial del medidor en Wh
 * 
 * @param {Object} [options.logging] - Configuración de logging
 * @param {string} [options.logging.level] - Nivel de log
 * @param {boolean} [options.logging.showTimestamp] - Mostrar timestamp en logs
 * 
 * @returns {ChargerSimulator}
 * 
 * @example
 * // Uso básico
 * const simulator = createSimulator({
 *     serverUrl: 'ws://localhost:8080/ocpp/',
 *     chargePointId: 'CP001'
 * });
 * 
 * @example
 * // Configuración completa
 * const simulator = createSimulator({
 *     server: {
 *         url: 'ws://localhost:8080/ocpp/'
 *     },
 *     chargePoint: {
 *         id: 'CP001',
 *         vendor: 'MyVendor',
 *         model: 'MyModel',
 *         serialNumber: 'SN-12345',
 *         firmwareVersion: '2.0.0',
 *         numberOfConnectors: 2
 *     },
 *     simulator: {
 *         heartbeatInterval: 30,
 *         meterValueSampleInterval: 30,
 *         charging: {
 *             chargingPower: 22000,
 *             initialMeterValue: 1000
 *         }
 *     },
 *     logging: {
 *         level: 'debug',
 *         showTimestamp: true
 *     }
 * });
 */
function createSimulator(options = {}) {
    // Mezclar opciones con la configuración por defecto
    const simulatorConfig = {
        server: {
            ...config.server,
            ...(options.server || {}),
            // Soportar serverUrl como atajo
            url: options.serverUrl || options.server?.url || config.server.url
        },
        chargePoint: {
            ...config.chargePoint,
            ...(options.chargePoint || {}),
            // Soportar atajos para propiedades comunes
            id: options.chargePointId || options.chargePoint?.id || config.chargePoint.id,
            numberOfConnectors: options.numberOfConnectors || options.chargePoint?.numberOfConnectors || config.chargePoint.numberOfConnectors
        },
        simulator: {
            ...config.simulator,
            ...(options.simulator || {}),
            charging: {
                ...config.simulator.charging,
                ...(options.simulator?.charging || {})
            }
        },
        logging: {
            ...config.logging,
            ...(options.logging || {}),
            // Soportar logLevel como atajo
            level: options.logLevel || options.logging?.level || config.logging.level
        }
    };

    const logger = options.logger || createDefaultLogger(simulatorConfig.logging.level);
    
    return new ChargerSimulator(simulatorConfig, logger);
}

module.exports = {
    createSimulator,
    ChargerSimulator,
    OCPPClient,
    defaultConfig: config,
    createDefaultLogger
};
