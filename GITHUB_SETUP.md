# Pasos para publicar en GitHub

## 1. Crear repositorio en GitHub

1. Ve a https://github.com/new
2. Nombre del repositorio: `ocpp-charger-simulator`
3. Descripción: "Simulador de punto de carga OCPP 1.6J para testing"
4. Público o Privado (según prefieras)
5. **NO** inicialices con README, .gitignore o licencia (ya los tienes)
6. Crea el repositorio

## 2. Conectar tu proyecto local con GitHub

```bash
# Inicializar git si no lo has hecho
git init

# Añadir todos los archivos
git add .

# Hacer el primer commit
git commit -m "Initial commit: OCPP 1.6J Charger Simulator"

# Añadir el repositorio remoto (reemplaza TU_USUARIO con tu usuario de GitHub)
git remote add origin https://github.com/TU_USUARIO/ocpp-charger-simulator.git

# Subir al repositorio
git branch -M main
git push -u origin main
```

## 3. Actualizar URLs en el código

Después de crear el repositorio, actualiza estas referencias en tu código:

**En package.json**: Reemplaza `TU_USUARIO` con tu usuario real de GitHub
**En README.md**: Reemplaza todas las instancias de `TU_USUARIO`

## 4. Crear releases (opcional pero recomendado)

Para versionar tu simulador y facilitar su uso:

```bash
# Crear un tag para la primera versión
git tag -a v1.0.0 -m "Primera versión estable"
git push origin v1.0.0
```

En GitHub, ve a "Releases" → "Create a new release" y selecciona el tag v1.0.0

## 5. Usar el simulador en otros proyectos

### Opción A: Instalar desde GitHub (Recomendado)

En tu proyecto de backend OCPP:

```bash
npm install github:TU_USUARIO/ocpp-charger-simulator
```

O en package.json:

```json
{
  "devDependencies": {
    "ocpp-charger-simulator": "github:TU_USUARIO/ocpp-charger-simulator#v1.0.0"
  }
}
```

### Opción B: Git Submodule (para desarrollo acoplado)

Si quieres tener el código fuente dentro de tu proyecto:

```bash
cd tu-proyecto-backend
git submodule add https://github.com/TU_USUARIO/ocpp-charger-simulator.git test/simulators/ocpp-simulator
cd test/simulators/ocpp-simulator
npm install
```

### Opción C: npm link (para desarrollo local)

Para desarrollo simultáneo de ambos proyectos:

```bash
# En el directorio del simulador
cd ocpp-charger-simulator
npm link

# En tu proyecto backend
cd ../tu-proyecto-backend
npm link ocpp-charger-simulator
```

## 6. Ejemplo de uso en tests

**test/integration/ocpp.test.js**:

```javascript
const { createSimulator } = require('ocpp-charger-simulator');
const request = require('supertest');
const app = require('../src/app');

describe('OCPP Backend Integration Tests', () => {
    let simulator;

    beforeAll(async () => {
        // Iniciar tu servidor OCPP
        await app.startOCPPServer();
    });

    beforeEach(async () => {
        simulator = createSimulator({
            serverUrl: 'ws://localhost:8080/ocpp/',
            chargePointId: `TEST-CP-${Date.now()}`,
            logLevel: 'warn'
        });
        await simulator.start();
    });

    afterEach(() => {
        if (simulator) {
            simulator.stop();
        }
    });

    afterAll(async () => {
        await app.stopOCPPServer();
    });

    it('should handle RemoteStartTransaction', async () => {
        // Conectar vehículo
        await simulator.simulatePlugVehicle(1);

        // Tu backend envía RemoteStartTransaction
        await request(app)
            .post('/api/chargers/TEST-CP/remote-start')
            .send({ connectorId: 1, idTag: 'CARD123' })
            .expect(200);

        // Esperar que el simulador inicie la transacción
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Verificar estado
        expect(simulator.state.activeTransactions[1]).toBeTruthy();
        expect(simulator.state.activeTransactions[1].idTag).toBe('CARD123');
    });

    it('should send MeterValues during charging', (done) => {
        let meterValuesReceived = false;

        simulator.client.on('call', ({ action }) => {
            if (action === 'MeterValues') {
                meterValuesReceived = true;
            }
        });

        // Iniciar carga
        simulator.simulatePlugVehicle(1);
        simulator.simulateLocalStartTransaction(1, 'TEST');

        // Esperar MeterValues
        setTimeout(() => {
            expect(meterValuesReceived).toBe(true);
            done();
        }, 65000); // Esperar más del intervalo de MeterValues
    });
});
```

## Recomendaciones

1. **Usa versiones específicas** en producción: `github:user/repo#v1.0.0`
2. **En desarrollo local** usa `npm link` para cambios rápidos
3. **Documenta cambios** en releases de GitHub
4. **Mantén compatibilidad** hacia atrás o incrementa versión major
5. **Tests del simulador**: Considera añadir tests al propio simulador
