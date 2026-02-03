const OCPPClient = require('./ocppClient');

// Estados del conector
const ConnectorStatus = {
    AVAILABLE: 'Available',
    PREPARING: 'Preparing',
    CHARGING: 'Charging',
    SUSPENDED_EVSE: 'SuspendedEVSE',
    SUSPENDED_EV: 'SuspendedEV',
    FINISHING: 'Finishing',
    RESERVED: 'Reserved',
    UNAVAILABLE: 'Unavailable',
    FAULTED: 'Faulted'
};

class ChargerSimulator {
    constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.client = new OCPPClient(config, logger);
        
        // Estado del cargador
        this.state = {
            // Estado de los conectores (indexado por connectorId)
            connectors: {},
            // Transacción activa (si existe)
            activeTransaction: null,
            // Valor actual del medidor en Wh
            meterValue: config.simulator.charging.initialMeterValue,
            // Configuración
            configuration: {
                MeterValueSampleInterval: config.simulator.meterValueSampleInterval.toString()
            }
        };

        // Intervalos activos
        this.heartbeatInterval = null;
        this.meterValueInterval = null;
        this.chargingSimulationInterval = null;

        // Inicializar conectores
        for (let i = 0; i <= config.chargePoint.numberOfConnectors; i++) {
            this.state.connectors[i] = {
                status: ConnectorStatus.AVAILABLE,
                errorCode: 'NoError'
            };
        }

        // Configurar manejadores de eventos
        this.setupEventHandlers();
    }

    /**
     * Configurar manejadores de eventos del cliente OCPP
     */
    setupEventHandlers() {
        this.client.on('connected', () => {
            this.onConnected();
        });

        this.client.on('disconnected', () => {
            this.onDisconnected();
        });

        this.client.on('call', ({ messageId, action, payload }) => {
            this.handleServerCall(messageId, action, payload);
        });
    }

    /**
     * Iniciar el simulador
     */
    async start() {
        this.logger.info('Iniciando simulador de cargador OCPP...');
        try {
            await this.client.connect();
        } catch (error) {
            this.logger.error(`Error al conectar: ${error.message}`);
            // Iniciar el proceso de reconexión automática
            this.client.isReconnecting = true;
            this.client.attemptReconnect();
            throw error;
        }
    }

    /**
     * Detener el simulador
     */
    stop() {
        this.logger.info('Deteniendo simulador...');
        this.stopIntervals();
        this.client.disconnect();
    }

    /**
     * Callback cuando se establece conexión
     */
    async onConnected() {
        try {
            // Enviar BootNotification
            await this.sendBootNotification();
            
            // Enviar StatusNotification para cada conector
            for (let i = 0; i <= this.config.chargePoint.numberOfConnectors; i++) {
                await this.sendStatusNotification(i);
            }
        } catch (error) {
            this.logger.error(`Error en secuencia de inicio: ${error.message}`);
        }
    }

    /**
     * Callback cuando se pierde la conexión
     */
    onDisconnected() {
        this.stopIntervals();
    }

    /**
     * Detener todos los intervalos
     */
    stopIntervals() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this.meterValueInterval) {
            clearInterval(this.meterValueInterval);
            this.meterValueInterval = null;
        }
        if (this.chargingSimulationInterval) {
            clearInterval(this.chargingSimulationInterval);
            this.chargingSimulationInterval = null;
        }
    }

    /**
     * Manejar llamadas del servidor
     */
    handleServerCall(messageId, action, payload) {
        switch (action) {
            case 'RemoteStartTransaction':
                this.handleRemoteStartTransaction(messageId, payload);
                break;
            case 'RemoteStopTransaction':
                this.handleRemoteStopTransaction(messageId, payload);
                break;
            case 'ChangeConfiguration':
                this.handleChangeConfiguration(messageId, payload);
                break;
            default:
                this.logger.warn(`Acción no soportada: ${action}`);
                this.client.callError(messageId, 'NotImplemented', `Action ${action} is not implemented`);
        }
    }

    // ==================== Mensajes salientes ====================

    /**
     * Enviar BootNotification
     */
    async sendBootNotification() {
        const payload = {
            chargePointVendor: this.config.chargePoint.vendor,
            chargePointModel: this.config.chargePoint.model,
            chargePointSerialNumber: this.config.chargePoint.serialNumber,
            firmwareVersion: this.config.chargePoint.firmwareVersion
        };

        try {
            const response = await this.client.call('BootNotification', payload);
            
            if (response.status === 'Accepted') {
                this.logger.info(`BootNotification aceptado. Intervalo de heartbeat: ${response.interval}s`);
                
                // Iniciar heartbeat con el intervalo indicado por el servidor
                this.startHeartbeat(response.interval);
            } else if (response.status === 'Pending') {
                this.logger.warn('BootNotification pendiente. Reintentando...');
                setTimeout(() => this.sendBootNotification(), response.interval * 1000);
            } else {
                this.logger.error(`BootNotification rechazado: ${response.status}`);
            }

            return response;
        } catch (error) {
            this.logger.error(`Error en BootNotification: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enviar StatusNotification
     */
    async sendStatusNotification(connectorId, status = null, errorCode = 'NoError') {
        if (status) {
            this.state.connectors[connectorId].status = status;
            this.state.connectors[connectorId].errorCode = errorCode;
        }

        const payload = {
            connectorId: connectorId,
            errorCode: this.state.connectors[connectorId].errorCode,
            status: this.state.connectors[connectorId].status,
            timestamp: new Date().toISOString()
        };

        try {
            const response = await this.client.call('StatusNotification', payload);
            this.logger.info(`StatusNotification enviado para conector ${connectorId}: ${payload.status}`);
            return response;
        } catch (error) {
            this.logger.error(`Error en StatusNotification: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enviar Heartbeat
     */
    async sendHeartbeat() {
        try {
            const response = await this.client.call('Heartbeat', {});
            this.logger.debug(`Heartbeat enviado. Hora del servidor: ${response.currentTime}`);
            return response;
        } catch (error) {
            this.logger.error(`Error en Heartbeat: ${error.message}`);
        }
    }

    /**
     * Iniciar envío periódico de Heartbeat
     */
    startHeartbeat(intervalSeconds) {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }

        this.heartbeatInterval = setInterval(() => {
            this.sendHeartbeat();
        }, intervalSeconds * 1000);

        this.logger.info(`Heartbeat iniciado cada ${intervalSeconds} segundos`);
    }

    /**
     * Enviar StartTransaction
     */
    async sendStartTransaction(connectorId, idTag) {
        const payload = {
            connectorId: connectorId,
            idTag: idTag,
            meterStart: Math.round(this.state.meterValue),
            timestamp: new Date().toISOString()
        };

        try {
            const response = await this.client.call('StartTransaction', payload);
            
            if (response.idTagInfo.status === 'Accepted') {
                this.state.activeTransaction = {
                    transactionId: response.transactionId,
                    connectorId: connectorId,
                    idTag: idTag,
                    meterStart: payload.meterStart,
                    startTime: new Date()
                };

                this.logger.info(`Transacción iniciada. ID: ${response.transactionId}`);
                
                // Cambiar estado a Charging
                await this.sendStatusNotification(connectorId, ConnectorStatus.CHARGING);
                
                // Iniciar simulación de carga y envío de MeterValues
                this.startChargingSimulation();
                this.startMeterValueInterval();
            } else {
                this.logger.warn(`StartTransaction rechazado: ${response.idTagInfo.status}`);
                await this.sendStatusNotification(connectorId, ConnectorStatus.AVAILABLE);
            }

            return response;
        } catch (error) {
            this.logger.error(`Error en StartTransaction: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enviar StopTransaction
     */
    async sendStopTransaction(reason = 'Local') {
        if (!this.state.activeTransaction) {
            this.logger.warn('No hay transacción activa para detener');
            return null;
        }

        const transaction = this.state.activeTransaction;
        const payload = {
            transactionId: transaction.transactionId,
            idTag: transaction.idTag,
            meterStop: Math.round(this.state.meterValue),
            timestamp: new Date().toISOString(),
            reason: reason
        };

        try {
            // Detener simulación de carga
            this.stopChargingSimulation();
            this.stopMeterValueInterval();

            const response = await this.client.call('StopTransaction', payload);
            
            const energyDelivered = (payload.meterStop - transaction.meterStart) / 1000;
            this.logger.info(`Transacción ${transaction.transactionId} detenida. Energía entregada: ${energyDelivered.toFixed(2)} kWh`);
            
            // Cambiar estado a Finishing y luego a Available
            await this.sendStatusNotification(transaction.connectorId, ConnectorStatus.FINISHING);
            
            // Simular desconexión del vehículo
            setTimeout(async () => {
                await this.sendStatusNotification(transaction.connectorId, ConnectorStatus.AVAILABLE);
            }, 2000);

            this.state.activeTransaction = null;

            return response;
        } catch (error) {
            this.logger.error(`Error en StopTransaction: ${error.message}`);
            throw error;
        }
    }

    /**
     * Enviar MeterValues
     */
    async sendMeterValues() {
        if (!this.state.activeTransaction) {
            return;
        }

        const payload = {
            connectorId: this.state.activeTransaction.connectorId,
            transactionId: this.state.activeTransaction.transactionId,
            meterValue: [{
                timestamp: new Date().toISOString(),
                sampledValue: [
                    {
                        value: Math.round(this.state.meterValue).toString(),
                        context: 'Sample.Periodic',
                        measurand: 'Energy.Active.Import.Register',
                        unit: 'Wh'
                    },
                    {
                        value: (this.config.simulator.charging.chargingPower / 1000).toString(),
                        context: 'Sample.Periodic',
                        measurand: 'Power.Active.Import',
                        unit: 'kW'
                    }
                ]
            }]
        };

        try {
            await this.client.call('MeterValues', payload);
            this.logger.debug(`MeterValues enviado: ${Math.round(this.state.meterValue)} Wh`);
        } catch (error) {
            this.logger.error(`Error en MeterValues: ${error.message}`);
        }
    }

    /**
     * Iniciar simulación de carga (incrementar medidor)
     */
    startChargingSimulation() {
        // Simular consumo cada segundo
        this.chargingSimulationInterval = setInterval(() => {
            // Incrementar el medidor basándose en la potencia de carga
            // Potencia en W / 3600 = Wh por segundo
            const whPerSecond = this.config.simulator.charging.chargingPower / 3600;
            this.state.meterValue += whPerSecond;
        }, 1000);

        this.logger.info('Simulación de carga iniciada');
    }

    /**
     * Detener simulación de carga
     */
    stopChargingSimulation() {
        if (this.chargingSimulationInterval) {
            clearInterval(this.chargingSimulationInterval);
            this.chargingSimulationInterval = null;
            this.logger.info('Simulación de carga detenida');
        }
    }

    /**
     * Iniciar envío periódico de MeterValues
     */
    startMeterValueInterval() {
        const interval = parseInt(this.state.configuration.MeterValueSampleInterval) || 60;
        
        if (this.meterValueInterval) {
            clearInterval(this.meterValueInterval);
        }

        this.meterValueInterval = setInterval(() => {
            this.sendMeterValues();
        }, interval * 1000);

        this.logger.info(`MeterValues iniciado cada ${interval} segundos`);
    }

    /**
     * Detener envío periódico de MeterValues
     */
    stopMeterValueInterval() {
        if (this.meterValueInterval) {
            clearInterval(this.meterValueInterval);
            this.meterValueInterval = null;
        }
    }

    // ==================== Manejadores de mensajes del servidor ====================

    /**
     * Manejar RemoteStartTransaction
     */
    async handleRemoteStartTransaction(messageId, payload) {
        const { connectorId = 1, idTag } = payload;

        this.logger.info(`RemoteStartTransaction recibido - Conector: ${connectorId}, IdTag: ${idTag}`);

        // Verificar si ya hay una transacción activa
        if (this.state.activeTransaction) {
            this.logger.warn('Ya hay una transacción activa');
            this.client.callResult(messageId, { status: 'Rejected' });
            return;
        }

        // Verificar si el conector está disponible
        if (this.state.connectors[connectorId].status !== ConnectorStatus.AVAILABLE) {
            this.logger.warn(`Conector ${connectorId} no disponible`);
            this.client.callResult(messageId, { status: 'Rejected' });
            return;
        }

        // Aceptar la petición
        this.client.callResult(messageId, { status: 'Accepted' });

        // Cambiar estado a Preparing
        await this.sendStatusNotification(connectorId, ConnectorStatus.PREPARING);

        // Simular conexión del cable (pequeño delay)
        setTimeout(async () => {
            await this.sendStartTransaction(connectorId, idTag);
        }, 1000);
    }

    /**
     * Manejar RemoteStopTransaction
     */
    async handleRemoteStopTransaction(messageId, payload) {
        const { transactionId } = payload;

        this.logger.info(`RemoteStopTransaction recibido - TransactionId: ${transactionId}`);

        // Verificar si la transacción existe
        if (!this.state.activeTransaction || this.state.activeTransaction.transactionId !== transactionId) {
            this.logger.warn(`Transacción ${transactionId} no encontrada`);
            this.client.callResult(messageId, { status: 'Rejected' });
            return;
        }

        // Aceptar la petición
        this.client.callResult(messageId, { status: 'Accepted' });

        // Detener la transacción
        await this.sendStopTransaction('Remote');
    }

    /**
     * Manejar ChangeConfiguration
     */
    handleChangeConfiguration(messageId, payload) {
        const { key, value } = payload;

        this.logger.info(`ChangeConfiguration recibido - Key: ${key}, Value: ${value}`);

        // Solo soportamos MeterValueSampleInterval
        if (key === 'MeterValueSampleInterval') {
            const interval = parseInt(value);
            if (isNaN(interval) || interval < 0) {
                this.client.callResult(messageId, { status: 'Rejected' });
                return;
            }

            this.state.configuration.MeterValueSampleInterval = value;
            this.logger.info(`MeterValueSampleInterval actualizado a ${value} segundos`);

            // Si hay una transacción activa, reiniciar el intervalo de MeterValues
            if (this.state.activeTransaction) {
                this.stopMeterValueInterval();
                this.startMeterValueInterval();
            }

            this.client.callResult(messageId, { status: 'Accepted' });
        } else {
            this.logger.warn(`Clave de configuración no soportada: ${key}`);
            this.client.callResult(messageId, { status: 'NotSupported' });
        }
    }

    // ==================== Métodos de utilidad para testing manual ====================

    /**
     * Simular inicio de carga local (para testing)
     */
    async simulateLocalStartTransaction(idTag = 'TESTCARD001') {
        const connectorId = 1;
        
        if (this.state.activeTransaction) {
            this.logger.warn('Ya hay una transacción activa');
            return;
        }

        if (this.state.connectors[connectorId].status !== ConnectorStatus.AVAILABLE) {
            this.logger.warn('Conector no disponible');
            return;
        }

        this.logger.info(`Simulando inicio de carga local con IdTag: ${idTag}`);
        await this.sendStatusNotification(connectorId, ConnectorStatus.PREPARING);
        
        setTimeout(async () => {
            await this.sendStartTransaction(connectorId, idTag);
        }, 1000);
    }

    /**
     * Simular fin de carga local (para testing)
     */
    async simulateLocalStopTransaction() {
        if (!this.state.activeTransaction) {
            this.logger.warn('No hay transacción activa');
            return;
        }

        this.logger.info('Simulando fin de carga local');
        await this.sendStopTransaction('Local');
    }
}

module.exports = ChargerSimulator;
