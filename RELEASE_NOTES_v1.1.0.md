# Release Notes - v1.1.0

**Fecha de lanzamiento:** 17 de febrero de 2026

## 🎯 Resumen

Esta versión introduce soporte completo para **transacciones simultáneas en múltiples conectores**, permitiendo que cada conector opere de forma independiente con su propio medidor y simulación de carga.

## ✨ Nuevas Características

### Soporte para Múltiples Transacciones Simultáneas

- **Transacciones independientes por conector**: Ahora cada conector puede tener su propia transacción activa simultáneamente
- **Medidores independientes**: Cada conector mantiene su propio valor de medidor (`meterValues`)
- **Simulación de carga por conector**: La simulación de consumo energético es independiente para cada conector
- **MeterValues optimizado**: Envío periódico de valores para todos los conectores con transacciones activas

### Mejoras en Package

- Añadido ejecutable CLI via `bin` configuration
- Especificado requisito de Node.js >= 14.0.0

## 🐛 Correcciones de Bugs

### Bug Crítico: RemoteStartTransaction rechazado incorrectamente

**Problema anterior:** El simulador rechazaba comandos `RemoteStartTransaction` en el conector 2 cuando había una carga activa en el conector 1.

**Solución:** La validación ahora verifica solo si hay una transacción activa en el conector específico solicitado, no globalmente.

```javascript
// Antes (incorrecto)
if (this.state.activeTransaction) {
    this.logger.warn('Ya hay una transacción activa');
    return 'Rejected';
}

// Ahora (correcto)
if (this.state.activeTransactions[connectorId]) {
    this.logger.warn(`Ya hay una transacción activa en conector ${connectorId}`);
    return 'Rejected';
}
```

## 🔄 Cambios en la API

### Breaking Changes

⚠️ **Importante:** Esta versión incluye cambios en la estructura del estado que pueden afectar integraciones existentes.

#### Estructura del Estado

**Cambio 1: activeTransaction → activeTransactions**
```javascript
// v1.0.x
simulator.state.activeTransaction
// { transactionId: 123, connectorId: 1, idTag: 'CARD', ... }

// v1.1.0
simulator.state.activeTransactions
// { 1: { transactionId: 123, connectorId: 1, idTag: 'CARD', ... },
//   2: { transactionId: 124, connectorId: 2, idTag: 'CARD2', ... } }
```

**Cambio 2: meterValue → meterValues**
```javascript
// v1.0.x
simulator.state.meterValue  // Valor único en Wh

// v1.1.0
simulator.state.meterValues  // Objeto indexado por connectorId
// { 1: 1500, 2: 2300 }
```

### Métodos Actualizados

#### `sendStopTransaction(connectorId, reason)`
Ahora requiere `connectorId` como primer parámetro:
```javascript
// v1.0.x
await simulator.sendStopTransaction('Local');

// v1.1.0
await simulator.sendStopTransaction(1, 'Local');
```

## 📚 Documentación Actualizada

- Actualizado `examples/README.md` con ejemplos de múltiples transacciones
- Actualizado `GITHUB_SETUP.md` con nuevos tests de integración
- Actualizado `examples/two-connectors.js` para demostrar cargas simultáneas

## 🔧 Guía de Migración

### Para usuarios que acceden al estado del simulador:

1. **Verificar transacciones activas:**
   ```javascript
   // Antes
   if (simulator.state.activeTransaction) {
       console.log('Hay carga activa');
   }
   
   // Ahora
   if (Object.keys(simulator.state.activeTransactions).length > 0) {
       console.log('Hay cargas activas');
   }
   
   // O para un conector específico
   if (simulator.state.activeTransactions[1]) {
       console.log('Hay carga activa en conector 1');
   }
   ```

2. **Acceder a valores del medidor:**
   ```javascript
   // Antes
   const energy = simulator.state.meterValue;
   
   // Ahora
   const energyConnector1 = simulator.state.meterValues[1];
   const energyConnector2 = simulator.state.meterValues[2];
   ```

3. **Actualizar tests:**
   ```javascript
   // Antes
   expect(simulator.state.activeTransaction).toBeTruthy();
   expect(simulator.state.activeTransaction.idTag).toBe('CARD123');
   
   // Ahora
   expect(simulator.state.activeTransactions[1]).toBeTruthy();
   expect(simulator.state.activeTransactions[1].idTag).toBe('CARD123');
   ```

## 📦 Archivos Modificados

- `src/chargerSimulator.js` - Refactorización completa para soporte multi-transacción
- `src/index.js` - Actualizado comando `status` para mostrar múltiples transacciones
- `src/config.js` - Mejoras de formato
- `examples/two-connectors.js` - Actualizado ejemplo
- `examples/README.md` - Documentación actualizada
- `GITHUB_SETUP.md` - Tests actualizados
- `package.json` - Añadido bin y engines

## 🎉 Casos de Uso Ahora Soportados

✅ Dos vehículos cargando simultáneamente en diferentes conectores  
✅ RemoteStartTransaction independiente por conector  
✅ RemoteStopTransaction buscando la transacción en cualquier conector  
✅ MeterValues independientes por cada transacción activa  
✅ Simulación realista de estaciones de carga multi-conector  

## 🔗 Recursos

- [Documentación completa](README.md)
- [Ejemplos de uso](examples/README.md)
- [Guía de integración con backend](GITHUB_SETUP.md)

## 👥 Contribuciones

Gracias a todos los que reportaron el issue original sobre el rechazo incorrecto de RemoteStartTransaction en múltiples conectores.

---

**Instalación:**
```bash
npm install ocpp-charger-simulator@1.1.0
```

**Actualización desde v1.0.x:**
```bash
npm update ocpp-charger-simulator
```
