const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');
const ts = require('typescript');

// Usa el compilador ya instalado, sin cargar módulos nativos en Node.
const cargar = (archivo, dependencias = {}, temporizador = setTimeout) => {
  const codigo = ts.transpileModule(
    readFileSync(path.join(__dirname, '..', archivo), 'utf8'),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  const modulo = { exports: {} };
  vm.runInNewContext(codigo, {
    module: modulo,
    exports: modulo.exports,
    setTimeout: temporizador,
    require: (nombre) => {
      assert.ok(Object.hasOwn(dependencias, nombre), `Dependencia sin simular: ${nombre}`);
      return dependencias[nombre];
    },
  }, { filename: archivo });
  return modulo.exports;
};

const ticket = cargar('src/utils/ticket.ts');
const configuracion = {
  direccion: '00:11:22:33:44:55',
  nombre: 'DIG-P501A',
  columnas: 32,
  encabezado: 'Restaurante El Refugio\nTeléfono: 123456',
};
const pedido = {
  id: 125,
  mesa_nombre: 'Terraza',
  status: 'Activo',
  created_at: '2026-10-22T20:45:00-04:00',
};
const detalle = [
  { producto_nombre: 'Hamburguesa especial', cantidad: 2, precio: 8, monto: 16, status: 'Activa' },
  { producto_nombre: 'Agua mineral', cantidad: 2, precio: 1.5, monto: 3, status: 'Activa' },
  { producto_nombre: 'PRODUCTO ANULADO', cantidad: 1, precio: 20, monto: 20, status: 'Anulada' },
  { producto_nombre: 'PRODUCTO MOVIDO', cantidad: 1, precio: 20, monto: 20, status: 'Movida' },
];
const totales = {
  totalUsd: 19, totalCop: 76000, totalBs: 950,
  tasaCop: 4000, tasaBs: 50, propinaPct: 10, historico: false,
};

for (const columnas of [32, 48]) {
  test(`Ticket de ${columnas} columnas: contenido, ancho y líneas excluidas`, () => {
    const texto = ticket.crearTicketPedido(pedido, detalle, totales, { ...configuracion, columnas });
    for (const linea of texto.split('\n')) {
      assert.ok(linea.length <= columnas, `${linea.length} > ${columnas}: ${linea}`);
    }
    assert.match(texto, /ORDEN #125/);
    assert.match(texto, /Mesa: Terraza/);
    const fecha = new Date(pedido.created_at);
    const fechaLocal = [fecha.getDate(), fecha.getMonth() + 1, fecha.getFullYear()]
      .map((valor) => String(valor).padStart(2, '0')).join('/');
    assert.ok(texto.includes(fechaLocal));
    assert.match(texto, /2 x 8\.00 +16\.00/);
    assert.match(texto, /TOTAL USD +19\.00/);
    assert.match(texto, /TOTAL COP +76000\.00/);
    assert.match(texto, /TOTAL Bs +950\.00/);
    assert.match(texto, /no\s+incluida/);
    assert.doesNotMatch(texto, /PRODUCTO ANULADO|PRODUCTO MOVIDO/);
  });

  test(`Nombres e importes largos no pierden contenido (${columnas} columnas)`, () => {
    const nombre = 'A'.repeat(100) + ' con acompañamiento y bebida';
    const texto = ticket.crearTicketPedido(
      { ...pedido, mesa_nombre: 'Mesa '.repeat(25) },
      [{ ...detalle[0], producto_nombre: nombre, cantidad: 123456789, precio: 123456.78,
        monto: 15241577639079.42 }],
      totales,
      { ...configuracion, columnas, encabezado: 'Restaurante '.repeat(30) }
    );
    assert.ok(texto.split('\n').every((linea) => linea.length <= columnas));
    assert.ok(texto.replaceAll('\n', '').includes(nombre));
    assert.match(texto, /15241577639079\.42/);
    assert.match(texto, /123456789 x 123456\.78/);
  });

  test(`Prueba de ancho: regla exacta de ${columnas} columnas y CP850`, () => {
    const texto = ticket.crearTicketPrueba({ ...configuracion, columnas });
    assert.ok(texto.split('\n').every((linea) => linea.length <= columnas));
    assert.ok(texto.split('\n').some((linea) =>
      linea === Array.from({ length: columnas }, (_, i) => (i + 1) % 10).join('')));
    assert.doesNotThrow(() => ticket.codificarTicketEscPos(texto));
  });
}

test('Fecha y hora de creación se imprimen en hora local', () => {
  const fecha = new Date(pedido.created_at);
  const dos = (numero) => String(numero).padStart(2, '0');
  const texto = ticket.crearTicketPedido(pedido, detalle, totales, configuracion);
  assert.ok(texto.includes(`${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`));
});

test('Pedido anulado y sin productos se identifica sin alterar totales', () => {
  const texto = ticket.crearTicketPedido(
    { ...pedido, status: 'Anulado' }, [], { ...totales, historico: true }, configuracion
  );
  assert.match(texto, /Estado: Anulado/);
  assert.match(texto, /Sin productos/);
  assert.match(texto, /Tasas al finalizar/);
});

test('CP850: acentos españoles, fuente A, página 2 y avance sin corte automático', () => {
  const datos = ticket.codificarTicketEscPos('áéíóúñÑü¿¡\n');
  const prefijo = '\x1b@\x1b!\x00\x1d!\x00\x1ba\x00\x1bt\x02';
  assert.ok(datos.startsWith(prefijo));
  const bytes = Array.from(datos.slice(prefijo.length, -4), (c) => c.charCodeAt(0));
  assert.deepEqual(bytes, [160, 130, 161, 162, 163, 164, 165, 129, 168, 173]);
  assert.ok(datos.endsWith('\n\n\n\n'));
  assert.ok(!datos.includes('\x1dV'));
});

test('Unicode descompuesto se normaliza; caracteres no soportados fallan explícitamente', () => {
  assert.equal(ticket.codificarTicketEscPos('n\u0303'), ticket.codificarTicketEscPos('ñ'));
  assert.throws(() => ticket.codificarTicketEscPos('🍔'), /no es compatible/);
  assert.throws(() => ticket.codificarTicketEscPos('\x1b@'), /no es compatible/);
});

test('Los textos de usuario no pueden inyectar comandos ESC/POS', () => {
  const texto = ticket.crearTicketPedido(
    { ...pedido, mesa_nombre: 'Mesa\x1b@' },
    [{ ...detalle[0], producto_nombre: 'Producto\x1dV\x00' }],
    totales,
    { ...configuracion, encabezado: 'Restaurante\x1b!\x10' }
  );
  assert.doesNotMatch(texto, /[\x00-\x09\x0b-\x1f\x7f]/);
});

test('Se rechazan formatos, fechas, cantidades e importes inválidos', () => {
  assert.throws(() => ticket.crearTicketPrueba({ ...configuracion, columnas: 40 }), /32 o 48/);
  assert.throws(() => ticket.crearTicketPedido(
    { ...pedido, created_at: 'incorrecta' }, detalle, totales, configuracion
  ), /fecha/);
  assert.throws(() => ticket.crearTicketPedido(
    pedido, [{ ...detalle[0], cantidad: 0 }], totales, configuracion
  ), /cantidad/);
  assert.throws(() => ticket.crearTicketPedido(
    pedido, detalle, { ...totales, totalUsd: NaN }, configuracion
  ), /importe/);
});

const cargarTotales = (getTasasActuales) => cargar('src/services/totalesService.ts', {
  '../repositories/parametrosRepository': { getTasasActuales },
  '../repositories/pedidoDetalleRepository': {},
  '../repositories/pedidosRepository': {},
});

test('El snapshot histórico prevalece aunque hayan cambiado las tasas y las líneas', async () => {
  const servicio = cargarTotales(() => { throw new Error('No debe consultar tasas actuales'); });
  const historicos = await servicio.getTotalesPedido({
    ...pedido, total_usd: 12, total_cop: 48000, total_bs: 600,
    tasa_cop: 4000, tasa_bs: 50, propina_pct: 5,
  }, detalle);
  assert.equal(historicos.totalUsd, 12);
  assert.equal(historicos.totalCop, 48000);
  assert.equal(historicos.totalBs, 600);
  const texto = ticket.crearTicketPedido(pedido, detalle, historicos, configuracion);
  assert.match(texto, /TOTAL USD +12\.00/);
  assert.match(texto, /TOTAL COP +48000\.00/);
  assert.match(texto, /TOTAL Bs +600\.00/);
  assert.match(texto, /Tasas al finalizar/);
});

test('Pedido activo calcula con las tasas actuales y excluye líneas no activas', async () => {
  const servicio = cargarTotales(async () => ({ tasaCop: 4100, tasaBs: 60, propinaPct: 0 }));
  const calculados = await servicio.getTotalesPedido({ ...pedido, total_usd: null }, detalle);
  assert.equal(calculados.totalUsd, 19);
  assert.equal(calculados.totalCop, 77900);
  assert.equal(calculados.totalBs, 1140);
  assert.equal(calculados.historico, false);
});

const crearBluetooth = ({ plataforma = 'android', version = 36, modulo = true, permiso = 'granted' } = {}) => {
  const llamadas = [];
  const dispositivo = {
    isConnected: async () => true,
    write: async (datos, codificacion) => { llamadas.push([datos, codificacion]); return true; },
  };
  const bluetooth = {
    isBluetoothAvailable: async () => true,
    isBluetoothEnabled: async () => true,
    isDeviceConnected: async () => false,
    connectToDevice: async () => dispositivo,
    getConnectedDevice: async () => dispositivo,
    getBondedDevices: async () => [
      { address: configuracion.direccion, name: 'DIG-P501A', type: 'CLASSIC' },
      { address: 'otro', name: 'Solo BLE', type: 'LOW_ENERGY' },
    ],
  };
  let solicitudes = 0;
  const servicio = cargar('src/services/bluetoothPrinterService.ts', {
    'react-native': {
      Platform: { OS: plataforma, Version: version },
      NativeModules: { RNBluetoothClassic: modulo },
      PermissionsAndroid: {
        PERMISSIONS: { BLUETOOTH_CONNECT: 'connect', BLUETOOTH_SCAN: 'scan' },
        RESULTS: { GRANTED: 'granted' },
        requestMultiple: async () => { solicitudes++; return { connect: permiso, scan: permiso }; },
      },
    },
    'react-native-bluetooth-classic': { default: bluetooth },
  }, (resolver) => resolver());
  return { servicio, bluetooth, dispositivo, llamadas, solicitudes: () => solicitudes };
};

test('Bluetooth: permisos, filtro de vinculados y envío exacto en bloques latin1', async () => {
  const entorno = crearBluetooth();
  const impresoras = await entorno.servicio.listarImpresorasVinculadas();
  assert.equal(impresoras.length, 1);
  assert.equal(impresoras[0].nombre, 'DIG-P501A');
  assert.equal(entorno.solicitudes(), 1);
  const datos = ticket.codificarTicketEscPos(ticket.crearTicketPrueba(configuracion));
  await entorno.servicio.enviarTicketBluetooth(configuracion.direccion, datos);
  assert.equal(entorno.llamadas.map(([bloque]) => bloque).join(''), datos);
  assert.ok(entorno.llamadas.every(([bloque, codificacion]) =>
    bloque.length <= 256 && codificacion === 'latin1'));
});

test('Bluetooth: iOS, build antiguo y permiso denegado fallan antes de conectar', async () => {
  for (const [opciones, mensaje] of [
    [{ plataforma: 'ios' }, /solo en Android/],
    [{ modulo: false }, /Recompile/],
    [{ permiso: 'denied' }, /permiso de dispositivos cercanos/],
  ]) {
    const entorno = crearBluetooth(opciones);
    await assert.rejects(entorno.servicio.comprobarConexionImpresora(configuracion.direccion), mensaje);
  }
});

test('Bluetooth: Android anterior a 12 no solicita permisos modernos', async () => {
  const entorno = crearBluetooth({ version: 30 });
  await entorno.servicio.comprobarConexionImpresora(configuracion.direccion);
  assert.equal(entorno.solicitudes(), 0);
});

test('Bluetooth: reutiliza la conexión sin abrir otro socket', async () => {
  const entorno = crearBluetooth();
  entorno.bluetooth.isDeviceConnected = async () => true;
  entorno.bluetooth.connectToDevice = () => { throw new Error('No debe reconectar'); };
  await entorno.servicio.comprobarConexionImpresora(configuracion.direccion);
});

test('Bluetooth: evita envíos simultáneos y libera el bloqueo tras un fallo', async () => {
  const entorno = crearBluetooth();
  let liberar;
  entorno.dispositivo.write = () => new Promise((resolve) => { liberar = resolve; });
  const primero = entorno.servicio.enviarTicketBluetooth(configuracion.direccion, 'ticket');
  while (!liberar) await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    entorno.servicio.enviarTicketBluetooth(configuracion.direccion, 'otro'),
    /operación de impresora en curso/
  );
  liberar(false);
  await assert.rejects(primero, /no aceptó/);
  entorno.dispositivo.write = async () => true;
  await entorno.servicio.enviarTicketBluetooth(configuracion.direccion, 'reintento explícito');
});

test('Bluetooth: no reintenta automáticamente una escritura parcial', async () => {
  const entorno = crearBluetooth();
  let bloques = 0;
  entorno.dispositivo.write = async () => {
    if (++bloques === 2) throw new Error('Conexión perdida');
    return true;
  };
  await assert.rejects(
    entorno.servicio.enviarTicketBluetooth(configuracion.direccion, 'a'.repeat(800)),
    /Conexión perdida/
  );
  assert.equal(bloques, 2);
});

test('Bluetooth: ausencia de adaptador, activación cancelada y socket fallido se propagan', async () => {
  const sinAdaptador = crearBluetooth();
  sinAdaptador.bluetooth.isBluetoothAvailable = async () => false;
  await assert.rejects(sinAdaptador.servicio.listarImpresorasVinculadas(), /no dispone/);

  const apagado = crearBluetooth();
  apagado.bluetooth.isBluetoothEnabled = async () => false;
  apagado.bluetooth.requestBluetoothEnabled = async () => false;
  await assert.rejects(apagado.servicio.listarImpresorasVinculadas(), /Active Bluetooth/);

  const desconectado = crearBluetooth();
  desconectado.dispositivo.isConnected = async () => false;
  await assert.rejects(
    desconectado.servicio.comprobarConexionImpresora(configuracion.direccion), /No se pudo conectar/
  );
  await assert.rejects(
    desconectado.servicio.comprobarConexionImpresora(''), /Seleccione una impresora/
  );
});

const schema = cargar('src/db/schema.ts');
const crearRepositorio = (valor = configuracion, changes = 1) => {
  const escrituras = [];
  let parametro = { valor: JSON.stringify(valor) };
  const repositorio = cargar('src/repositories/impresoraRepository.ts', {
    '../db/connection': {
      nowIso: () => '2026-10-23T01:00:00.000Z',
      executeSql: async (sql, params) => { escrituras.push({ sql, params }); return { changes }; },
    },
    '../db/schema': schema,
    './parametrosRepository': { getParametro: async () => parametro },
  });
  return { repositorio, escrituras, setParametro: (nuevo) => { parametro = nuevo; } };
};

test('Configuración: seed por defecto, lectura tipada y guardado con pending_sync', async () => {
  const inicial = JSON.parse(schema.parametroImpresoraSeed.valor);
  assert.equal(inicial.columnas, 32);
  assert.equal(inicial.encabezado, 'ORDENA');
  assert.equal(inicial.direccion, '');
  const entorno = crearRepositorio();
  const guardada = await entorno.repositorio.getConfiguracionImpresora();
  assert.equal(JSON.stringify(guardada), JSON.stringify(configuracion));
  await entorno.repositorio.saveConfiguracionImpresora({ ...configuracion, columnas: 48 });
  assert.equal(entorno.escrituras.length, 1);
  const { sql, params } = entorno.escrituras[0];
  assert.match(sql, /pending_sync = 1/);
  assert.equal(params[1], '2026-10-23T01:00:00.000Z');
  assert.equal(params[2], schema.parametroImpresoraSeed.codigo);
  assert.equal(JSON.parse(params[0]).columnas, 48);
});

test('Configuración: rechaza datos dañados, campos inválidos y escrituras sin efecto', async () => {
  const entorno = crearRepositorio();
  entorno.setParametro(null);
  await assert.rejects(entorno.repositorio.getConfiguracionImpresora(), /No se encontró/);
  entorno.setParametro({ valor: 'no es json' });
  await assert.rejects(entorno.repositorio.getConfiguracionImpresora(), /dañada/);
  for (const invalida of [
    null,
    { ...configuracion, direccion: 'incorrecta' },
    { ...configuracion, nombre: '' },
    { ...configuracion, encabezado: ' ' },
    { ...configuracion, encabezado: 'A'.repeat(241) },
    { ...configuracion, columnas: 40 },
  ]) {
    await assert.rejects(entorno.repositorio.saveConfiguracionImpresora(invalida));
  }
  assert.equal(entorno.escrituras.length, 0);
  const sinCambios = crearRepositorio(configuracion, 0);
  await assert.rejects(
    sinCambios.repositorio.saveConfiguracionImpresora(configuracion), /No se pudo guardar/
  );
});

const crearServicioImpresion = (pedidoGuardado = pedido, config = configuracion) => {
  const envios = [];
  const servicio = cargar('src/services/printService.ts', {
    '../repositories/impresoraRepository': { getConfiguracionImpresora: async () => config },
    '../repositories/pedidoDetalleRepository': { listPedidoDetalle: async () => detalle },
    '../repositories/pedidosRepository': { getPedido: async () => pedidoGuardado },
    '../utils/ticket': ticket,
    './bluetoothPrinterService': {
      enviarTicketBluetooth: async (...argumentos) => { envios.push(argumentos); },
    },
    './totalesService': { getTotalesPedido: async () => totales },
  });
  return { servicio, envios };
};

test('Imprimir pedido usa configuración guardada, datos del pedido y bytes ESC/POS', async () => {
  const entorno = crearServicioImpresion();
  await entorno.servicio.printOrderTicket(pedido.id);
  assert.equal(entorno.envios.length, 1);
  assert.equal(entorno.envios[0][0], configuracion.direccion);
  assert.equal(entorno.envios[0][1],
    ticket.codificarTicketEscPos(ticket.crearTicketPedido(pedido, detalle, totales, configuracion)));
});

test('Impresión inválida no envía bytes y la prueba usa los cambios del formulario', async () => {
  const ausente = crearServicioImpresion(null);
  await assert.rejects(ausente.servicio.printOrderTicket(999), /no existe/);
  assert.equal(ausente.envios.length, 0);
  const emoji = crearServicioImpresion(pedido, { ...configuracion, encabezado: '🍔' });
  await assert.rejects(emoji.servicio.printOrderTicket(pedido.id), /no es compatible/);
  assert.equal(emoji.envios.length, 0);
  const prueba = crearServicioImpresion();
  await prueba.servicio.imprimirTicketPrueba({ ...configuracion, encabezado: 'Encabezado nuevo' });
  assert.ok(prueba.envios[0][1].includes('Encabezado nuevo'));
});
