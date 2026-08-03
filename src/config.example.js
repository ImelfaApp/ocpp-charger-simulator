const chargePointId = process.env.CHARGE_POINT_ID || '123456789d';

module.exports = {
  // Configuración de conexión al servidor OCPP
  server: {
    url: process.env.OCPP_SERVER_URL || "ws://localhost:8080/ocpp/",
    // El chargePointId se añadirá al final de la URL
  },

  // Identificación del punto de carga
  chargePoint: {
    id: chargePointId,
    vendor: "SimulatorVendor",
    model: "VirtualCharger",
    serialNumber: chargePointId,
    firmwareVersion: "1.0.0",
    numberOfConnectors: 2, // Número de conectores (1 o 2)
  },

  // Configuración del simulador
  simulator: {
    // Intervalo de heartbeat en segundos
    heartbeatInterval: 60,

    // Intervalo de envío de MeterValues en segundos (puede ser cambiado via ChangeConfiguration)
    meterValueSampleInterval: 60,

    // Simulación de carga
    charging: {
      // Potencia de carga en W
      chargingPower: 110000,
      // Valor inicial del medidor en Wh
      initialMeterValue: 0,
    },
  },

  // Configuración de logging
  logging: {
    level: process.env.LOG_LEVEL || "info", // 'debug', 'info', 'warn', 'error'
    showTimestamp: true,
  },
};
