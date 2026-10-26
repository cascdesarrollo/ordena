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
  subtotalUsd: 19, descuentoUsd: 0,
  totalUsd: 19, totalCop: 76000, totalBs: 950,
  tasaCop: 4000, tasaBs: 50, propinaPct: 10, historico: false,
};

const filtroPedidos = { fechaInicio: '2026-10-01', fechaFin: '2026-10-31', status: 'Todos' };
const lineaVenta = {
  id: 101, pedido_id: 1, producto_id: 7, producto_nombre: 'Hamburguesa',
  producto_tipo: 'Principal', linea: 1, cantidad: 5, precio: 10, monto: 50,
  status: 'Activa', created_at: '2026-10-22T12:00:00.000Z',
};
const crearPedidoReporte = (id, estado, lineas, descuentos = []) => {
  const bruto = lineas.filter((d) => d.status === 'Activa').reduce((s, d) => s + d.monto, 0);
  const descuento = descuentos.filter((d) => d.status === 'Activo').reduce((s, d) => s + d.monto_usd, 0);
  return {
    pedido: {
      ...pedido, id, mesa_nombre: `Mesa ${id}`, status: estado,
      total_usd: bruto - descuento, total_cop: (bruto - descuento) * 4000,
      total_bs: (bruto - descuento) * 50, tasa_cop: 4000, tasa_bs: 50, propina_pct: 10,
    },
    detalle: lineas,
    descuentos,
    pagos: [],
    totales: { ...totales, subtotalUsd: bruto, descuentoUsd: descuento, totalUsd: bruto - descuento,
      totalCop: (bruto - descuento) * 4000, totalBs: (bruto - descuento) * 50, historico: true },
  };
};
const pedidosAnalisis = [
  crearPedidoReporte(1, 'Finalizado', [
    lineaVenta,
    { ...lineaVenta, id: 103, producto_id: 8, producto_nombre: 'Agua', producto_tipo: 'Bebidas',
      linea: 2, cantidad: 2, precio: 1.5, monto: 3 },
    { ...lineaVenta, id: 104, status: 'Anulada', monto: 999 },
    { ...lineaVenta, id: 105, status: 'Movida', monto: 999 },
  ], [
    { id: 1, descripcion: 'Cortesía', monto_usd: 5, status: 'Activo',
      pedido_detalle_id: 101, producto_nombre: 'Hamburguesa' },
    { id: 2, descripcion: 'General', monto_usd: 2, status: 'Activo', pedido_detalle_id: null },
    { id: 3, descripcion: 'DESC ANULADO', monto_usd: 999, status: 'Anulado' },
  ]),
  crearPedidoReporte(2, 'Finalizado', [
    { ...lineaVenta, id: 102, pedido_id: 2, cantidad: 2, precio: 12, monto: 24 },
  ]),
  crearPedidoReporte(3, 'Activo', [{ ...lineaVenta, id: 106, pedido_id: 3, monto: 20 }]),
  crearPedidoReporte(4, 'Anulado', [{ ...lineaVenta, id: 107, pedido_id: 4, monto: 30 }]),
];
const reportePedidosFixture = {
  filtro: filtroPedidos, consultadoEn: '2026-10-26T14:00:00Z', pedidos: pedidosAnalisis,
  totalUsd: pedidosAnalisis.reduce((sum, item) => sum + item.totales.totalUsd, 0),
};
const cargarVentas = (consultarReportePedidos = async () => reportePedidosFixture) =>
  cargar('src/services/reporteVentasService.ts', {
    './reportePedidosService': { consultarReportePedidos },
  });

test('Ventas: 5 y 2 unidades son 7 consolidadas pero exactamente dos líneas con sus precios originales', () => {
  const resultado = cargarVentas().construirReporteVentas(reportePedidosFixture);
  assert.equal(resultado.cantidadPedidos, 2);
  const principal = resultado.grupos.find((g) => g.tipo === 'Principal');
  assert.equal(principal.productos.length, 1);
  const producto = principal.productos[0];
  assert.equal(producto.cantidad, 7);
  assert.equal(producto.montoUsd, 74);
  assert.equal(producto.lineas.length, 2);
  assert.deepEqual(Array.from(producto.lineas, (l) => [l.cantidad, l.precio, l.monto]),
    [[5, 10, 50], [2, 12, 24]]);
  assert.equal(resultado.cantidad, 9);
  assert.equal(resultado.brutoUsd, 77);
  assert.equal(resultado.descuentosUsd, 7);
  assert.equal(resultado.netoUsd, 70);
  assert.equal(resultado.grupos.find((g) => g.tipo === 'Bebidas').montoUsd, 3);
  assert.equal(resultado.grupos.find((g) => g.tipo === 'Postres').montoUsd, 0);
});

test('Ventas: consulta exclusivamente finalizados y conserva el período solicitado', async () => {
  let filtroRecibido;
  const ventas = cargarVentas(async (filtro) => {
    filtroRecibido = filtro;
    return { ...reportePedidosFixture, filtro };
  });
  const resultado = await ventas.consultarReporteVentas({
    fechaInicio: '2026-10-20', fechaFin: '2026-10-26',
  });
  assert.equal(filtroRecibido.status, 'Finalizado');
  assert.equal(resultado.filtro.fechaInicio, '2026-10-20');
  assert.equal(resultado.filtro.fechaFin, '2026-10-26');
});

test('Ventas: productos con mismo nombre no se fusionan y cantidades fraccionarias no se expanden', () => {
  const resultado = cargarVentas().construirReporteVentas({
    ...reportePedidosFixture,
    pedidos: [crearPedidoReporte(1, 'Finalizado', [
      lineaVenta,
      { ...lineaVenta, id: 200, producto_id: 70, cantidad: 0.5, monto: 5 },
    ])],
  });
  assert.equal(resultado.grupos[0].productos.length, 2);
  assert.equal(resultado.cantidad, 5.5);
  assert.equal(resultado.brutoUsd, 55);
  assert.equal(resultado.grupos[0].productos[1].lineas.length, 1);
});

test('Pedidos: carga datos del período, valida antes de consultar y conserva snapshots históricos', async () => {
  const consultas = [];
  const totalesServicio = cargar('src/services/totalesService.ts', {
    '../repositories/parametrosRepository': {
      getTasasActuales: () => { throw new Error('No usar tasas actuales para finalizados'); },
    },
    '../repositories/pedidoDetalleRepository': {},
    '../repositories/pedidoDescuentosRepository': {},
    '../repositories/pedidosRepository': {},
  });
  const servicio = cargar('src/services/reportePedidosService.ts', {
    '../db/connection': { nowIso: () => '2026-10-26T14:00:00Z' },
    '../repositories/pedidosRepository': {
      listPedidosByFechaStatus: async (...args) => {
        consultas.push(args);
        return pedidosAnalisis.slice(0, 2).map((item) => item.pedido);
      },
    },
    '../repositories/pedidoDetalleRepository': {
      listPedidoDetalle: async (id) => pedidosAnalisis[id - 1].detalle,
    },
    '../repositories/pedidoDescuentosRepository': {
      listDescuentosPedido: async (id) => pedidosAnalisis[id - 1].descuentos,
    },
    '../repositories/pedidoPagosRepository': {
      listPagosPedido: async (id) => pedidosAnalisis[id - 1].pagos,
    },
    '../utils/format': cargar('src/utils/format.ts'),
    './totalesService': totalesServicio,
  });
  await assert.rejects(servicio.consultarReportePedidos({ ...filtroPedidos, fechaInicio: '2026-02-30' }));
  await assert.rejects(servicio.consultarReportePedidos({ ...filtroPedidos, fechaInicio: '2027-01-01' }));
  await assert.rejects(servicio.consultarReportePedidos({ ...filtroPedidos, status: 'Otro' }));
  assert.equal(consultas.length, 0);
  const filtro = { ...filtroPedidos, status: 'Finalizado' };
  const resultado = await servicio.consultarReportePedidos(filtro);
  filtro.status = 'Todos';
  assert.equal(resultado.filtro.status, 'Finalizado');
  assert.deepEqual(consultas[0], ['2026-10-01', '2026-10-31', 'Finalizado']);
  assert.equal(resultado.totalUsd, 70);
  assert.equal(resultado.pedidos[0].totales.totalCop, 184000);
  assert.equal(resultado.pedidos[0].totales.historico, true);
  await servicio.consultarReportePedidos(filtro);
  assert.equal(consultas[1][2], undefined);
  const sinAnulados = await servicio.consultarReportePedidos({ ...filtro, status: 'Sin anulados' });
  assert.equal(consultas[2][2], 'Sin anulados');
  assert.equal(sinAnulados.filtro.status, 'Sin anulados');
  assert.match(ticket.crearTicketReportePedidos(sinAnulados, 'Consolidado', configuracion),
    /Estado: Sin anulados/);
});

test('Home: indicadores excluyen pedidos anulados y suman solo unidades Principal de líneas activas', async () => {
  const consultas = [];
  const resultados = [2, 3, 7];
  const repo = cargar('src/repositories/pedidosRepository.ts', {
    '../db/connection': {
      executeSql: async (sql) => {
        const count = resultados[consultas.length];
        consultas.push(sql);
        return { rows: { item: () => ({ count }) } };
      },
    },
  });
  const indicadores = await repo.getPedidosIndicadores();
  assert.equal(indicadores.pedidosDia, 2);
  assert.equal(indicadores.pedidosActivos, 3);
  assert.equal(indicadores.principalesDia, 7);
  assert.match(consultas[0], /date\(created_at, 'localtime'\) = date\('now', 'localtime'\)/);
  assert.match(consultas[0], /status IN \('Activo', 'Finalizado'\)/);
  assert.match(consultas[1], /WHERE status = 'Activo'/);
  assert.doesNotMatch(consultas[1], /date\(/);
  assert.match(consultas[2], /SUM\(pd.cantidad\)/);
  assert.match(consultas[2], /date\(p.created_at, 'localtime'\) = date\('now', 'localtime'\)/);
  assert.match(consultas[2], /p.status IN \('Activo', 'Finalizado'\)/);
  assert.match(consultas[2], /pd.status = 'Activa'/);
  assert.match(consultas[2], /i.tipo = 'Principal'/);
});

test('Reporte Sin anulados: filtra Activo y Finalizado, conserva Todos y filtros individuales', async () => {
  const consultas = [];
  const repo = cargar('src/repositories/pedidosRepository.ts', {
    '../db/connection': {
      executeSql: async (sql, params) => {
        consultas.push({ sql, params: [...params] });
        return { rows: { _array: [] } };
      },
    },
  });
  for (const estado of ['Sin anulados', 'Todos', undefined, 'Activo', 'Finalizado', 'Anulado']) {
    await repo.listPedidosByFechaStatus('2026-10-26', '2026-10-26', estado);
  }
  assert.match(consultas[0].sql, /AND status IN \(\?, \?\)/);
  assert.deepEqual(consultas[0].params, ['2026-10-26', '2026-10-26', 'Activo', 'Finalizado']);
  for (const indice of [1, 2]) {
    assert.doesNotMatch(consultas[indice].sql, /AND status/);
    assert.deepEqual(consultas[indice].params, ['2026-10-26', '2026-10-26']);
  }
  for (const [indice, estado] of [[3, 'Activo'], [4, 'Finalizado'], [5, 'Anulado']]) {
    assert.match(consultas[indice].sql, /AND status = \?/);
    assert.deepEqual(consultas[indice].params, ['2026-10-26', '2026-10-26', estado]);
  }
});

for (const columnas of [32, 48]) {
  for (const presentacion of ['Consolidado', 'Detallado']) {
    test(`Ventas impresas ${presentacion} ${columnas}: dos filas, totales por tipo y neto al final`, () => {
      const reporte = cargarVentas().construirReporteVentas(reportePedidosFixture);
      const texto = ticket.crearTicketReporteVentas(reporte, presentacion, { ...configuracion, columnas });
      assert.ok(texto.split('\n').every((l) => l.length <= columnas));
      assert.match(texto, /VENTA BRUTA USD +77\.00/);
      assert.match(texto, /DESCUENTOS USD +7\.00/);
      assert.match(texto, /TOTAL NETO USD +70\.00/);
      assert.match(texto, /Principal: 7 unidades/);
      assert.match(texto, /Bebidas: 2 unidades/);
      assert.ok(texto.indexOf('RESUMEN POR TIPO') > texto.indexOf('Hamburguesa'));
      assert.doesNotMatch(texto, /999|Pedido #3|Pedido #4|DESC ANULADO/);
      if (presentacion === 'Detallado') {
        assert.equal((texto.match(/Pedido #/g) ?? []).length, 3); // Dos hamburguesas y una línea de agua.
        assert.match(texto, /L1: 5 x 10\.00 +50\.00/);
        assert.match(texto, /L1: 2 x 12\.00 +24\.00/);
        assert.match(texto, /Mesa 1/);
        assert.match(texto, /Fecha pedido:/);
      } else {
        assert.doesNotMatch(texto, /Pedido #|L1:/);
        assert.match(texto, /7 unidades \/ Total USD +74\.00/);
      }
      assert.doesNotThrow(() => ticket.codificarTicketEscPos(texto));
    });

    test(`Pedidos impresos ${presentacion} ${columnas}: filtros, total, descuentos y pagos`, () => {
      const datos = {
        ...reportePedidosFixture,
        pedidos: reportePedidosFixture.pedidos.map((p, i) => i ? p : {
          ...p,
          pagos: [
            { id: 1, forma_pago_nombre: 'Efectivo', divisa: 'USD', monto: 46, monto_usd: 46,
              status: 'Activo', created_at: '2026-10-22T12:00:00Z' },
            { id: 2, forma_pago_nombre: 'PAGO ANULADO', status: 'Anulado', monto: 999 },
          ],
        }),
      };
      const texto = ticket.crearTicketReportePedidos(datos, presentacion, { ...configuracion, columnas });
      assert.ok(texto.split('\n').every((l) => l.length <= columnas));
      assert.match(texto, /REPORTE DE PEDIDOS/);
      assert.match(texto, /Estado: Todos/);
      assert.match(texto, /TOTAL GENERAL USD +120\.00/);
      assert.match(texto, /Incluye importes de pedidos\s+anulados/);
      if (presentacion === 'Detallado') {
        assert.match(texto, /5 x 10\.00 +50\.00/);
        assert.match(texto, /Descuento: Cortesía/);
        assert.match(texto, /Efectivo/);
        assert.match(texto, /Pagado USD +46\.00/);
        assert.match(texto, /Total COP +184000\.00/);
      } else {
        assert.doesNotMatch(texto, /Cortesía|Efectivo|5 x 10\.00/);
      }
      assert.doesNotMatch(texto, /999|PAGO ANULADO|DESC ANULADO/);
      assert.doesNotThrow(() => ticket.codificarTicketEscPos(texto));
    });
  }
}

test('Ventas/pedidos: vacío, texto largo y controles, formatos e importes inválidos', () => {
  const pedidos = { ...reportePedidosFixture, pedidos: [], totalUsd: 0 };
  const ventas = cargarVentas().construirReporteVentas(pedidos);
  assert.match(ticket.crearTicketReporteVentas(ventas, 'Consolidado', configuracion), /TOTAL NETO USD +0\.00/);
  assert.match(ticket.crearTicketReportePedidos(pedidos, 'Detallado', configuracion), /Sin pedidos/);
  for (const [crear, reporte] of [
    [ticket.crearTicketReporteVentas, ventas], [ticket.crearTicketReportePedidos, pedidos],
  ]) {
    assert.throws(() => crear(reporte, 'Otro', configuracion), /presentación/);
    assert.throws(() => crear(reporte, 'Detallado', { ...configuracion, columnas: 40 }), /32 o 48/);
  }
  const largos = {
    ...reportePedidosFixture,
    pedidos: [crearPedidoReporte(1, 'Finalizado', [{
      ...lineaVenta, producto_nombre: 'Hamburguesa '.repeat(20) + '\x1b@',
    }])],
  };
  largos.pedidos[0].pedido.mesa_nombre = 'Mesa '.repeat(30) + '\x1dV';
  for (const texto of [
    ticket.crearTicketReporteVentas(cargarVentas().construirReporteVentas(largos), 'Detallado', configuracion),
    ticket.crearTicketReportePedidos(largos, 'Detallado', configuracion),
  ]) {
    assert.ok(texto.split('\n').every((l) => l.length <= 32));
    assert.doesNotMatch(texto, /[\x00-\x09\x0b-\x1f\x7f]/);
  }
  assert.throws(() => cargarVentas().construirReporteVentas({
    ...largos, pedidos: [crearPedidoReporte(1, 'Finalizado', [{ ...lineaVenta, monto: NaN }])],
  }), /no válidos/);
});

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
  '../repositories/pedidoDescuentosRepository': {},
  '../repositories/pedidosRepository': {},
});

test('El snapshot histórico prevalece aunque hayan cambiado las tasas y las líneas', async () => {
  const servicio = cargarTotales(() => { throw new Error('No debe consultar tasas actuales'); });
  const historicos = await servicio.getTotalesPedido({
    ...pedido, total_usd: 12, total_cop: 48000, total_bs: 600,
    tasa_cop: 4000, tasa_bs: 50, propina_pct: 5,
  }, detalle);
  assert.equal(historicos.subtotalUsd, 12);
  assert.equal(historicos.descuentoUsd, 0);
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

test('Los descuentos se restan del total y se imprimen asociados a su producto', () => {
  const servicio = cargarTotales(async () => ({ tasaCop: 4000, tasaBs: 50, propinaPct: 10 }));
  const calculados = servicio.calcularTotales(
    [
      { monto: 16, status: 'Activa' },
      { monto: 3, status: 'Activa' },
    ],
    { tasaCop: 4000, tasaBs: 50, propinaPct: 10 },
    [{ monto_usd: 4, status: 'Activo' }]
  );
  assert.equal(calculados.subtotalUsd, 19);
  assert.equal(calculados.descuentoUsd, 4);
  assert.equal(calculados.totalUsd, 15);
  assert.equal(calculados.totalCop, 60000);
  assert.equal(calculados.totalBs, 750);
  const descuentos = [{
      id: 1,
      pedido_id: pedido.id,
      pedido_detalle_id: 1,
      descripcion: 'Cortesía',
      producto_nombre: 'Hamburguesa especial',
      producto_linea: 1,
      producto_cantidad: 2,
      producto_precio: 8,
      monto_usd: 4,
      status: 'Activo',
      created_at: pedido.created_at,
      updated_at: pedido.created_at,
      pending_sync: 1,
  }];
  for (const columnas of [32, 48]) {
    const texto = ticket.crearTicketPedido(
      pedido,
      detalle,
      { ...calculados, historico: false },
      { ...configuracion, columnas },
      descuentos
    );
    assert.ok(texto.split('\n').every((linea) => linea.length <= columnas));
    assert.match(texto, /Cortesía \(Hamburguesa especial,\s*linea 1: 2 x\s*8\.00\)/);
    assert.match(texto, /Descuento USD +\-4\.00/);
    assert.match(texto, /Descuento COP +\-16000\.00/);
    assert.match(texto, /DESCUENTOS USD +\-4\.00/);
    assert.match(texto, /TOTAL USD +15\.00/);
  }
});

const crearServicioDescuentos = ({
  pedidoGuardado = pedido,
  pagos = [],
  importeLinea = 12,
  descuentos = [],
} = {}) => {
  const creados = [];
  const anulados = [];
  const servicio = cargar('src/services/descuentosService.ts', {
    '../db/connection': { runInTransaction: async (task) => task() },
    '../repositories/pedidoPagosRepository': { listPagosPedido: async () => pagos },
    '../repositories/pedidoDescuentosRepository': {
      createPedidoDescuento: async (descuento) => { creados.push(descuento); },
      listDescuentosPedido: async () => descuentos,
      updatePedidoDescuentoStatus: async (id, status) => { anulados.push({ id, status }); },
    },
    '../repositories/pedidosRepository': { getPedido: async () => pedidoGuardado },
    '../repositories/pedidoDetalleRepository': {
      listPedidoDetalle: async () => [{
        id: 4, pedido_id: pedido.id, status: 'Activa', monto: importeLinea,
      }],
    },
  });
  return { servicio, creados, anulados };
};

test('Descuento: solo pedido activo sin pagos, monto limitado al subtotal y línea asociada', async () => {
  const permitido = crearServicioDescuentos();
  await permitido.servicio.agregarDescuentoPedido({
    pedidoId: pedido.id,
    detalleId: 4,
    descripcion: 'Cortesía',
    montoUsd: 2,
  });
  assert.equal(permitido.creados.length, 1);

  const conPago = crearServicioDescuentos({
    pagos: [{ status: 'Activo' }],
  });
  await assert.rejects(conPago.servicio.agregarDescuentoPedido({
    pedidoId: pedido.id, detalleId: null, descripcion: 'Promo', montoUsd: 1,
  }), /Anule primero los pagos/);

  const finalizado = crearServicioDescuentos({
    pedidoGuardado: { ...pedido, status: 'Finalizado' },
  });
  await assert.rejects(finalizado.servicio.agregarDescuentoPedido({
    pedidoId: pedido.id, detalleId: null, descripcion: 'Promo', montoUsd: 1,
  }), /pedidos activos/);

  const exceso = crearServicioDescuentos({ importeLinea: 3 });
  await assert.rejects(exceso.servicio.agregarDescuentoPedido({
    pedidoId: pedido.id, detalleId: 4, descripcion: 'Promo', montoUsd: 4,
  }), /superar el subtotal/);

  const descuentoGuardado = {
    id: 9,
    pedido_id: pedido.id,
    pedido_detalle_id: 4,
    descripcion: 'Cortesía',
    monto_usd: 2,
    status: 'Activo',
  };
  const anulacionPermitida = crearServicioDescuentos({ descuentos: [descuentoGuardado] });
  await anulacionPermitida.servicio.anularDescuentoPedido(descuentoGuardado);
  assert.deepEqual(anulacionPermitida.anulados, [{ id: 9, status: 'Anulado' }]);

  const anulacionConPago = crearServicioDescuentos({
    pagos: [{ status: 'Activo' }],
    descuentos: [descuentoGuardado],
  });
  await assert.rejects(
    anulacionConPago.servicio.anularDescuentoPedido(descuentoGuardado),
    /Anule primero los pagos/
  );
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
    '../repositories/pedidoDescuentosRepository': { listDescuentosPedido: async () => [] },
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

const filtroPagos = {
  fechaInicio: '2026-10-24', fechaFin: '2026-10-24', formaPagoId: null,
};
const formasReporte = [
  { id: 1, nombre: 'Efectivo', divisa: 'USD', status: 'Activo' },
  { id: 2, nombre: 'Transferencia', divisa: 'BS', status: 'Activo' },
  { id: 3, nombre: 'Pago móvil', divisa: 'BS', status: 'Inactivo' },
];
const pagoReporteBase = {
  pedido_id: 125, mesa_nombre: 'Terraza', pedido_status: 'Activo',
  forma_pago_id: 1, forma_pago_nombre: 'Efectivo',
  divisa: 'USD', monto: 10, tasa: 1, monto_usd: 10, status: 'Activo',
  created_at: '2026-10-24T12:00:00.000Z', updated_at: '2026-10-24T12:00:00.000Z',
  pending_sync: 1,
};
const pagosReporte = [
  { ...pagoReporteBase, id: 1 },
  { ...pagoReporteBase, id: 2, forma_pago_id: 2, forma_pago_nombre: 'Transferencia',
    divisa: 'COP', monto: 40000, tasa: 4000, pedido_status: 'Finalizado' },
  { ...pagoReporteBase, id: 3, forma_pago_id: 2, forma_pago_nombre: 'Transferencia',
    divisa: 'COP', monto: 50000, tasa: 5000 },
  { ...pagoReporteBase, id: 4, forma_pago_id: 2, forma_pago_nombre: 'Transferencia',
    divisa: 'BS', monto: 1000, tasa: 100, pedido_status: 'Anulado' },
  { ...pagoReporteBase, id: 5, forma_pago_id: 3, forma_pago_nombre: 'Pago móvil',
    divisa: 'BS', monto: 500, tasa: 50, pedido_status: 'Finalizado' },
  { ...pagoReporteBase, id: 6, monto: 999, monto_usd: 999, status: 'Anulado' },
];
const crearServicioReportePagos = (pagos = pagosReporte) => {
  const consultas = [];
  const servicio = cargar('src/services/reportePagosService.ts', {
    '../db/connection': { nowIso: () => '2026-10-24T14:00:00.000Z' },
    '../repositories/formasPagoRepository': { listFormasPago: async () => formasReporte },
    '../repositories/pedidoPagosRepository': {
      listPagosReporte: async (filtro) => {
        consultas.push({ ...filtro });
        return pagos;
      },
    },
    '../utils/format': cargar('src/utils/format.ts'),
  });
  return { servicio, consultas };
};

test('Reporte: agrupa por forma y divisa histórica, excluye pagos anulados y suma USD guardados', async () => {
  const { servicio } = crearServicioReportePagos();
  const { reporte, formasPago } = await servicio.consultarReportePagos(filtroPagos);
  assert.equal(reporte.cantidadPagos, 5);
  assert.equal(reporte.grupos.length, 4);
  assert.equal(reporte.pagosPedidosAnulados, 1);
  assert.equal(reporte.totalesPorDivisa.USD, 10);
  assert.equal(reporte.totalesPorDivisa.COP, 90000);
  assert.equal(reporte.totalesPorDivisa.BS, 1500);
  assert.equal(reporte.equivalenteUsd, 50);
  const cop = reporte.grupos.find((g) => g.formaPagoId === 2 && g.divisa === 'COP');
  assert.equal(cop.pagos.length, 2);
  assert.equal(cop.montoUsd, 20);
  assert.ok(formasPago.some((f) => f.id === 3 && f.status === 'Inactivo'));
  assert.equal(reporte.formaPagoNombre, 'Todas');
});

test('Reporte: valida fechas reales, rango, selección y conserva el filtro consultado', async () => {
  const { servicio, consultas } = crearServicioReportePagos([]);
  for (const filtro of [
    { ...filtroPagos, fechaInicio: '2026-02-30' },
    { ...filtroPagos, fechaInicio: '2026-2-01' },
    { ...filtroPagos, fechaFin: '2026-10-23' },
    { ...filtroPagos, fechaFin: 'incorrecta' },
    { ...filtroPagos, formaPagoId: -1 },
    { ...filtroPagos, formaPagoId: 1.2 },
    { ...filtroPagos, formaPagoId: 999 },
  ]) {
    await assert.rejects(servicio.consultarReportePagos(filtro));
  }
  assert.equal(consultas.length, 0);
  assert.doesNotThrow(() => servicio.validarFiltroReportePagos({
    ...filtroPagos, fechaInicio: '2024-02-29', fechaFin: '2024-02-29',
  }));
  const filtro = { ...filtroPagos, formaPagoId: 3 };
  const { reporte } = await servicio.consultarReportePagos(filtro);
  filtro.fechaInicio = '2030-01-01';
  assert.equal(reporte.filtro.fechaInicio, '2026-10-24');
  assert.equal(reporte.formaPagoNombre, 'Pago móvil');
  assert.equal(reporte.cantidadPagos, 0);
  assert.equal(reporte.equivalenteUsd, 0);
});

test('Reporte: consulta SQL usa fecha local del pago y forma opcional sin excluir pedidos o formas inactivos', async () => {
  const consultas = [];
  const repo = cargar('src/repositories/pedidoPagosRepository.ts', {
    '../db/connection': {
      executeSql: async (sql, params) => {
        consultas.push({ sql, params: [...params] });
        return { rows: { _array: pagosReporte } };
      },
    },
  });
  assert.equal(await repo.listPagosReporte(filtroPagos), pagosReporte);
  await repo.listPagosReporte({ ...filtroPagos, formaPagoId: 3 });
  assert.deepEqual(consultas[0].params, ['2026-10-24', '2026-10-24']);
  assert.deepEqual(consultas[1].params, ['2026-10-24', '2026-10-24', 3]);
  assert.match(consultas[0].sql, /pp.status = 'Activo'/);
  assert.match(consultas[0].sql, /date\(pp.created_at, 'localtime'\) BETWEEN date\(\?\) AND date\(\?\)/);
  assert.doesNotMatch(consultas[0].sql, /fp.status|date\(p.created_at|AND p.status|forma_pago_id = \?/);
  assert.match(consultas[1].sql, /AND pp.forma_pago_id = \?/);
});

for (const columnas of [32, 48]) {
  for (const modo of ['Consolidado', 'Detallado', 'Ambos']) {
    test(`Reporte impreso ${modo}, ${columnas} columnas: importes, detalle y advertencias`, async () => {
      const { reporte } = await crearServicioReportePagos().servicio.consultarReportePagos(filtroPagos);
      const texto = ticket.crearTicketReportePagos(reporte, modo, { ...configuracion, columnas });
      assert.ok(texto.split('\n').every((linea) => linea.length <= columnas));
      assert.match(texto, /REPORTE DE PAGOS/);
      assert.match(texto, /2026-10-24/);
      assert.match(texto, /TOTAL USD +10\.00/);
      assert.match(texto, /TOTAL COP +90000\.00/);
      assert.match(texto, /TOTAL Bs +1500\.00/);
      assert.match(texto, /EQUIVALENTE USD +50\.00/);
      assert.match(texto, /ATENCIÓN: 1 pagos/);
      assert.match(texto, /Pago móvil/);
      assert.doesNotMatch(texto, /999\.00|Pago #6 /);
      if (modo === 'Consolidado') {
        assert.doesNotMatch(texto, /Pago #1|DETALLADO/);
        assert.match(texto, /CONSOLIDADO/);
      } else {
        assert.match(texto, /Pago #1 \/ Pedido #125/);
        assert.match(texto, /Mesa: Terraza/);
        assert.match(texto, /Pedido Anulado/);
        assert.match(texto, /Subtotal COP +90000\.00/);
        assert.match(texto, /Tasa por USD +5000/);
      }
      if (modo === 'Detallado') assert.doesNotMatch(texto, /CONSOLIDADO/);
      if (modo === 'Ambos') assert.match(texto, /CONSOLIDADO[\s\S]*DETALLADO/);
      assert.doesNotThrow(() => ticket.codificarTicketEscPos(texto));
    });
  }
}

test('Reporte: texto largo y controles se ajustan; vacío imprime ceros; inválidos fallan', async () => {
  const { reporte } = await crearServicioReportePagos([
    { ...pagoReporteBase, id: 1, forma_pago_nombre: 'Transferencia '.repeat(10) + '\x1b@',
      mesa_nombre: 'Salón principal '.repeat(10) + '\x1dV' },
  ]).servicio.consultarReportePagos(filtroPagos);
  const texto = ticket.crearTicketReportePagos(reporte, 'Ambos', configuracion);
  assert.ok(texto.split('\n').every((linea) => linea.length <= 32));
  assert.doesNotMatch(texto, /[\x00-\x09\x0b-\x1f\x7f]/);
  assert.doesNotThrow(() => ticket.codificarTicketEscPos(texto));
  const vacio = (await crearServicioReportePagos([]).servicio.consultarReportePagos(filtroPagos)).reporte;
  assert.match(ticket.crearTicketReportePagos(vacio, 'Detallado', configuracion), /Sin pagos vigentes/);
  assert.throws(() => ticket.crearTicketReportePagos(vacio, 'Otro', configuracion), /presentación/);
  assert.throws(() => ticket.crearTicketReportePagos(vacio, 'Ambos', { ...configuracion, columnas: 40 }), /32 o 48/);
  await assert.rejects(
    crearServicioReportePagos([{ ...pagoReporteBase, id: 1, monto_usd: NaN }])
      .servicio.consultarReportePagos(filtroPagos),
    /no válidos/
  );
});

test('Imprimir reporte utiliza el resultado consultado y configuración guardada sin consultar pagos otra vez', async () => {
  const { reporte } = await crearServicioReportePagos().servicio.consultarReportePagos(filtroPagos);
  const envios = [];
  const noConsultar = () => { throw new Error('No debe volver a consultar datos ni tasas'); };
  const servicio = cargar('src/services/printService.ts', {
    '../repositories/impresoraRepository': { getConfiguracionImpresora: async () => configuracion },
    '../repositories/pedidoDetalleRepository': { listPedidoDetalle: noConsultar },
    '../repositories/pedidoDescuentosRepository': { listDescuentosPedido: noConsultar },
    '../repositories/pedidosRepository': { getPedido: noConsultar },
    './totalesService': { getTotalesPedido: noConsultar },
    '../utils/ticket': ticket,
    './bluetoothPrinterService': {
      enviarTicketBluetooth: async (...args) => { envios.push(args); },
    },
  });
  await servicio.imprimirReportePagos(reporte, 'Detallado');
  assert.equal(envios.length, 1);
  assert.equal(envios[0][0], configuracion.direccion);
  assert.equal(envios[0][1],
    ticket.codificarTicketEscPos(ticket.crearTicketReportePagos(reporte, 'Detallado', configuracion)));
});

test('Impresión de pedidos y ventas reutiliza snapshot; errores Bluetooth se propagan sin reintento', async () => {
  const envios = [];
  let fallar = false;
  const noConsultar = () => { throw new Error('No volver a consultar pedidos ni tasas al imprimir'); };
  const servicio = cargar('src/services/printService.ts', {
    '../repositories/impresoraRepository': { getConfiguracionImpresora: async () => configuracion },
    '../repositories/pedidoDetalleRepository': { listPedidoDetalle: noConsultar },
    '../repositories/pedidoDescuentosRepository': { listDescuentosPedido: noConsultar },
    '../repositories/pedidosRepository': { getPedido: noConsultar },
    './totalesService': { getTotalesPedido: noConsultar },
    '../utils/ticket': ticket,
    './bluetoothPrinterService': {
      enviarTicketBluetooth: async (...args) => {
        envios.push(args);
        if (fallar) throw new Error('Fallo Bluetooth');
      },
    },
  });
  const ventas = cargarVentas().construirReporteVentas(reportePedidosFixture);
  for (const modo of ['Consolidado', 'Detallado']) {
    await servicio.imprimirReportePedidos(reportePedidosFixture, modo);
    assert.equal(envios.at(-1)[1], ticket.codificarTicketEscPos(
      ticket.crearTicketReportePedidos(reportePedidosFixture, modo, configuracion)
    ));
    await servicio.imprimirReporteVentas(ventas, modo);
    assert.equal(envios.at(-1)[1], ticket.codificarTicketEscPos(
      ticket.crearTicketReporteVentas(ventas, modo, configuracion)
    ));
    assert.equal(envios.at(-1)[0], configuracion.direccion);
  }
  fallar = true;
  await assert.rejects(servicio.imprimirReporteVentas(ventas, 'Detallado'), /Fallo Bluetooth/);
  assert.equal(envios.length, 5);
  await assert.rejects(servicio.imprimirReportePedidos(reportePedidosFixture, 'Consolidado'), /Fallo Bluetooth/);
  assert.equal(envios.length, 6);
});
