const { createSimulator } = require('../src/lib');

async function main() {
    // Crear simulador con 2 conectores
    const simulator = createSimulator({
        serverUrl: 'ws://localhost:8080/ocpp/',
        chargePointId: 'EXAMPLE-CP-002',
        numberOfConnectors: 2,
        logLevel: 'info'
    });

    console.log('🔌 Iniciando simulador con 2 conectores...\n');

    try {
        // Conectar al servidor
        await simulator.start();
        
        console.log('✅ Conectado al servidor OCPP\n');
        
        await sleep(2000);
        
        // ========== Escenario 1: Carga simultánea en ambos conectores ==========
        console.log('📱 Escenario 1: Conectando vehículos en ambos conectores...');
        
        // Conectar vehículo en conector 1
        console.log('  → Conectando vehículo en conector 1');
        await simulator.simulatePlugVehicle(1);
        await sleep(500);
        
        // Conectar vehículo en conector 2
        console.log('  → Conectando vehículo en conector 2');
        await simulator.simulatePlugVehicle(2);
        await sleep(1000);
        
        // Iniciar carga en conector 1
        console.log('\n⚡ Iniciando carga en conector 1...');
        await simulator.simulateLocalStartTransaction(1, 'CARD-001');
        await sleep(1000);
        
        // NOTA: El simulador actual solo soporta una transacción activa a la vez
        // En un escenario real con 2 conectores, necesitarías modificar el estado
        // para soportar múltiples transacciones simultáneas
        console.log('\n⚠️  Nota: Este simulador soporta una transacción a la vez');
        console.log('    Para cargas simultáneas, considera crear múltiples instancias\n');
        
        // Dejar cargando en conector 1 por 5 segundos
        console.log('🔋 Cargando en conector 1 durante 5 segundos...\n');
        await sleep(5000);
        
        // Detener carga en conector 1
        console.log('🛑 Deteniendo carga en conector 1...');
        await simulator.simulateLocalStopTransaction(1);
        await sleep(500);
        
        // Desconectar vehículo del conector 1
        console.log('🔌 Desconectando vehículo del conector 1...');
        await simulator.simulateUnplugVehicle(1);
        await sleep(1000);
        
        // ========== Escenario 2: Ahora cargar en conector 2 ==========
        console.log('\n⚡ Iniciando carga en conector 2...');
        await simulator.simulateLocalStartTransaction(2, 'CARD-002');
        await sleep(1000);
        
        // Dejar cargando en conector 2 por 5 segundos
        console.log('🔋 Cargando en conector 2 durante 5 segundos...\n');
        await sleep(5000);
        
        // Detener carga en conector 2
        console.log('🛑 Deteniendo carga en conector 2...');
        await simulator.simulateLocalStopTransaction(2);
        await sleep(500);
        
        // Desconectar vehículo del conector 2
        console.log('🔌 Desconectando vehículo del conector 2...');
        await simulator.simulateUnplugVehicle(2);
        await sleep(1000);
        
        // ========== Escenario 3: RemoteStart en conector reservado ==========
        console.log('\n📱 Escenario 3: Simulando flujo con RemoteStart...');
        console.log('  1. Backend enviará RemoteStart');
        console.log('  2. Conector cambia a Reserved');
        console.log('  3. Usuario conecta vehículo');
        console.log('  4. Carga inicia automáticamente\n');
        
        console.log('  → Esperando RemoteStart del backend...');
        console.log('  → (En un test real, tu backend enviaría RemoteStart aquí)');
        console.log('  → Simulando conexión de vehículo en 3 segundos...\n');
        
        await sleep(3000);
        
        // Simular que el usuario conecta el vehículo después del RemoteStart
        await simulator.simulatePlugVehicle(1);
        console.log('  → Si había RemoteStart pendiente, la carga iniciaría ahora\n');
        
        await sleep(2000);
        
        // ========== Estado final ==========
        console.log('📊 Estado final del simulador:');
        console.log('  Conector 1:', simulator.state.connectors[1].status);
        console.log('  Conector 2:', simulator.state.connectors[2].status);
        console.log('  Transacción activa:', simulator.state.activeTransaction ? 'Sí' : 'No');
        console.log('  MeterValue:', Math.round(simulator.state.meterValue), 'Wh');
        
        console.log('\n✅ Ejemplo completado exitosamente');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        // Detener simulador
        simulator.stop();
        process.exit(0);
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Información adicional
console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║  Ejemplo de simulador OCPP con 2 conectores                   ║');
console.log('╠═══════════════════════════════════════════════════════════════╣');
console.log('║  Este ejemplo demuestra:                                      ║');
console.log('║  • Conexión/desconexión de vehículos en diferentes conectores ║');
console.log('║  • Inicio de transacciones en conectores específicos          ║');
console.log('║  • Flujo secuencial de cargas (una a la vez)                  ║');
console.log('║  • Gestión de estados de múltiples conectores                 ║');
console.log('╠═══════════════════════════════════════════════════════════════╣');
console.log('║  Para cargas simultáneas reales, considera:                   ║');
console.log('║  • Crear múltiples instancias del simulador                   ║');
console.log('║  • Modificar el estado para soportar N transacciones activas  ║');
console.log('╚═══════════════════════════════════════════════════════════════╝\n');

main();
