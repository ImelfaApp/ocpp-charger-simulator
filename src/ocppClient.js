const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const EventEmitter = require('events');

// Tipos de mensaje OCPP
const CALL = 2;
const CALLRESULT = 3;
const CALLERROR = 4;

class OCPPClient extends EventEmitter {
    constructor(config, logger) {
        super();
        this.config = config;
        this.logger = logger;
        this.ws = null;
        this.pendingCalls = new Map();
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 10;
        this.reconnectDelay = 5000;
        this.isReconnecting = false;
    }

    /**
     * Conectar al servidor OCPP
     */
    connect() {
        return new Promise((resolve, reject) => {
            const url = `${this.config.server.url}/${this.config.chargePoint.id}`;
            this.logger.info(`Conectando a ${url}...`);

            try {
                this.ws = new WebSocket(url, ['ocpp1.6'], {
                    headers: {
                        'Sec-WebSocket-Protocol': 'ocpp1.6'
                    }
                });
            } catch (error) {
                this.logger.error(`Error al crear WebSocket: ${error.message}`);
                if (this.isReconnecting) {
                    this.attemptReconnect();
                    return;
                }
                reject(error);
                return;
            }

            let settled = false;

            this.ws.on('open', () => {
                settled = true;
                this.connected = true;
                this.reconnectAttempts = 0;
                this.isReconnecting = false;
                this.logger.info('Conexión WebSocket establecida');
                this.emit('connected');
                resolve();
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });

            this.ws.on('close', (code, reason) => {
                const wasConnected = this.connected;
                this.connected = false;
                this.logger.warn(`Conexión cerrada: ${code} - ${reason}`);
                this.emit('disconnected', { code, reason });
                
                // Solo intentar reconectar si estábamos conectados previamente
                // o si ya estábamos en modo reconexión
                if (wasConnected || this.isReconnecting) {
                    this.attemptReconnect();
                }
            });

            this.ws.on('error', (error) => {
                this.logger.error(`Error WebSocket: ${error.message}`);
                
                // Si estamos reconectando, no rechazar la promesa ni emitir error
                // El evento 'close' se disparará después y manejará la reconexión
                if (this.isReconnecting) {
                    return;
                }
                
                if (!settled) {
                    settled = true;
                    reject(error);
                    // No emitir evento 'error' si rechazamos la promesa
                    // El error se maneja a través de la promesa rechazada
                    return;
                }
                
                // Solo emitir el evento si ya estábamos conectados
                this.emit('error', error);
            });
        });
    }

    /**
     * Intentar reconexión automática
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error('Máximo número de intentos de reconexión alcanzado');
            this.isReconnecting = false;
            return;
        }

        this.isReconnecting = true;
        this.reconnectAttempts++;
        this.logger.info(`Intentando reconexión ${this.reconnectAttempts}/${this.maxReconnectAttempts} en ${this.reconnectDelay/1000}s...`);
        
        setTimeout(() => {
            this.connect().catch((error) => {
                // Error durante reconexión - el ciclo continuará desde el evento 'close'
                this.logger.debug(`Error en reconexión: ${error.message}`);
            });
        }, this.reconnectDelay);
    }

    /**
     * Desconectar del servidor
     */
    disconnect() {
        if (this.ws) {
            this.maxReconnectAttempts = 0; // Evitar reconexión automática
            this.ws.close();
            this.ws = null;
        }
    }

    /**
     * Manejar mensajes entrantes
     */
    handleMessage(data) {
        this.logger.debug(`Mensaje recibido: ${data}`);

        try {
            const message = JSON.parse(data);
            const messageType = message[0];

            switch (messageType) {
                case CALL:
                    this.handleCall(message);
                    break;
                case CALLRESULT:
                    this.handleCallResult(message);
                    break;
                case CALLERROR:
                    this.handleCallError(message);
                    break;
                default:
                    this.logger.warn(`Tipo de mensaje desconocido: ${messageType}`);
            }
        } catch (error) {
            this.logger.error(`Error parseando mensaje: ${error.message}`);
        }
    }

    /**
     * Manejar CALL (peticiones del servidor)
     */
    handleCall(message) {
        const [, messageId, action, payload] = message;
        this.logger.info(`<-- Recibido CALL: ${action}`);
        this.logger.debug(`    Payload: ${JSON.stringify(payload)}`);

        // Emitir evento para que el simulador maneje la acción
        this.emit('call', { messageId, action, payload });
    }

    /**
     * Manejar CALLRESULT (respuestas del servidor)
     */
    handleCallResult(message) {
        const [, messageId, payload] = message;
        
        const pendingCall = this.pendingCalls.get(messageId);
        if (pendingCall) {
            this.logger.info(`<-- Recibido CALLRESULT para: ${pendingCall.action}`);
            this.logger.debug(`    Payload: ${JSON.stringify(payload)}`);
            pendingCall.resolve(payload);
            this.pendingCalls.delete(messageId);
        } else {
            this.logger.warn(`Recibido CALLRESULT para mensaje desconocido: ${messageId}`);
        }
    }

    /**
     * Manejar CALLERROR (errores del servidor)
     */
    handleCallError(message) {
        const [, messageId, errorCode, errorDescription, errorDetails] = message;
        
        const pendingCall = this.pendingCalls.get(messageId);
        if (pendingCall) {
            this.logger.error(`<-- Recibido CALLERROR para: ${pendingCall.action}`);
            this.logger.error(`    Error: ${errorCode} - ${errorDescription}`);
            pendingCall.reject(new Error(`${errorCode}: ${errorDescription}`));
            this.pendingCalls.delete(messageId);
        } else {
            this.logger.warn(`Recibido CALLERROR para mensaje desconocido: ${messageId}`);
        }
    }

    /**
     * Enviar CALL al servidor
     */
    call(action, payload, timeout = 30000) {
        return new Promise((resolve, reject) => {
            if (!this.connected) {
                reject(new Error('No conectado al servidor'));
                return;
            }

            const messageId = uuidv4();
            const message = [CALL, messageId, action, payload];
            
            this.logger.info(`--> Enviando CALL: ${action}`);
            this.logger.debug(`    Payload: ${JSON.stringify(payload)}`);

            // Guardar la llamada pendiente
            const timeoutId = setTimeout(() => {
                this.pendingCalls.delete(messageId);
                reject(new Error(`Timeout esperando respuesta para ${action}`));
            }, timeout);

            this.pendingCalls.set(messageId, {
                action,
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            this.ws.send(JSON.stringify(message));
        });
    }

    /**
     * Enviar CALLRESULT al servidor
     */
    callResult(messageId, payload) {
        if (!this.connected) {
            this.logger.error('No conectado al servidor');
            return;
        }

        const message = [CALLRESULT, messageId, payload];
        this.logger.info(`--> Enviando CALLRESULT`);
        this.logger.debug(`    Payload: ${JSON.stringify(payload)}`);
        this.ws.send(JSON.stringify(message));
    }

    /**
     * Enviar CALLERROR al servidor
     */
    callError(messageId, errorCode, errorDescription, errorDetails = {}) {
        if (!this.connected) {
            this.logger.error('No conectado al servidor');
            return;
        }

        const message = [CALLERROR, messageId, errorCode, errorDescription, errorDetails];
        this.logger.error(`--> Enviando CALLERROR: ${errorCode}`);
        this.ws.send(JSON.stringify(message));
    }
}

module.exports = OCPPClient;
