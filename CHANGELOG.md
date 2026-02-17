# Changelog

Todos los cambios notables en este proyecto serán documentados en este archivo.

El formato está basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/),
y este proyecto adhiere a [Semantic Versioning](https://semver.org/lang/es/).

## [1.1.0] - 2026-02-17

### ✨ Añadido
- Soporte completo para transacciones simultáneas en múltiples conectores
- Medidores independientes por conector (`meterValues`)
- Simulación de carga independiente por cada conector
- Ejecutable CLI via configuración `bin` en package.json
- Requisito de Node.js >= 14.0.0 especificado en `engines`

### 🔄 Cambiado
- **BREAKING:** `state.activeTransaction` → `state.activeTransactions` (objeto indexado por connectorId)
- **BREAKING:** `state.meterValue` → `state.meterValues` (objeto indexado por connectorId)
- **BREAKING:** `sendStopTransaction()` ahora requiere `connectorId` como primer parámetro
- `sendMeterValues()` ahora opera por conector específico
- `startChargingSimulation()` ahora opera por conector específico
- Comando `status` actualizado para mostrar múltiples transacciones
- Estructura de intervalos de simulación ahora es por conector

### 🐛 Corregido
- **Bug crítico:** RemoteStartTransaction ya no se rechaza incorrectamente cuando hay carga activa en otro conector
- Validación de transacciones activas ahora es por conector específico, no global

### 📚 Documentación
- Actualizado `examples/README.md` con ejemplos de múltiples transacciones
- Actualizado `GITHUB_SETUP.md` con tests para múltiples conectores
- Actualizado `examples/two-connectors.js` con demostración de cargas simultáneas
- Añadida guía de migración de v1.0.x a v1.1.0

## [1.0.0] - 2026-02-XX

### ✨ Añadido
- Implementación inicial del simulador OCPP 1.6J
- Soporte para puntos de carga con 1 o 2 conectores
- Mensajes OCPP implementados:
  - BootNotification
  - Heartbeat
  - StatusNotification
  - StartTransaction
  - StopTransaction
  - MeterValues
  - Authorize
- Comandos del servidor soportados:
  - RemoteStartTransaction
  - RemoteStopTransaction
  - ChangeConfiguration
  - Reset
  - UnlockConnector
  - GetConfiguration
  - ChangeAvailability
  - TriggerMessage
- Simulación realista de carga con incremento de medidor
- Interfaz de línea de comandos interactiva
- Estados de conector según OCPP 1.6J
- Validación de esquemas JSON
- Sistema de logging configurable
- Documentación completa y ejemplos

### 🔧 Configuración
- Configuración via archivo `config.js` o variables de entorno
- Intervalos configurables de Heartbeat y MeterValues
- Potencia de carga configurable
- Puerto y URL del servidor OCPP configurables

---

[1.1.0]: https://github.com/osbarciela/ocpp-charger-simulator/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/osbarciela/ocpp-charger-simulator/releases/tag/v1.0.0
