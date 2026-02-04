const { createSimulator } = require('../src/lib');

async function main() {
    // Crear simulador
    const simulator = createSimulator({
        serverUrl: 'ws://localhost:8080/ocpp/',
        chargePointId: 'EXAMPLE-CP-001',
        numberOfConnectors: 1,
        logLevel: 'info'
    });

    console.log('🔌 Iniciando simulador...\n');

    try {
        // Conectar al servidor
        await simulator.start();
        
        console.log('✅ Conectado al servidor OCPP\n');
        
        // Esperar 2 segundos
        await sleep(2000);
        
        // Simular flujo completo de carga
        console.log('📱 Simulando conexión de vehículo...');
        await simulator.simulatePlugVehicle(1);
        await sleep(1000);
        
        console.log('⚡ Iniciando transacción de carga...');
        await simulator.simulateLocalStartTransaction(1, 'EXAMPLE-CARD-001');
        await sleep(1000);
        
        // Dejar cargando por 10 segundos
        console.log('🔋 Cargando durante 10 segundos...\n');
        await sleep(10000);
        
        console.log('🛑 Deteniendo carga...');
        await simulator.simulateLocalStopTransaction();
        await sleep(1000);
        
        console.log('🔌 Desconectando vehículo...');
        await simulator.simulateUnplugVehicle(1);
        await sleep(1000);
        
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

main();
