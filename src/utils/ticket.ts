import type {
  ColumnasTicket,
  ConfiguracionImpresora,
  Pedido,
  PedidoDescuentoView,
  PedidoDetalleView,
  PresentacionReportePagos,
  PresentacionReporte,
  RangoReporte,
  ReportePagos,
  ReportePedidos,
  ReporteVentas,
  TotalesPedido,
} from '../db/types';

const caracteresCp850 =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒ' +
  'áíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐' +
  '└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀' +
  'ÓßÔÒõÕµþÞÚÛÙýÝ¯´≡±‗¾¶§÷¸°¨·¹³²■\u00a0';

const textoSeguro = (texto: string): string =>
  texto.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim();

const dividirLineas = (texto: string, columnas: ColumnasTicket): string[] => {
  let resto = textoSeguro(texto);
  const lineas: string[] = [];
  while (resto.length > columnas) {
    const espacio = resto.lastIndexOf(' ', columnas);
    const corte = espacio > 0 ? espacio : columnas;
    lineas.push(resto.slice(0, corte));
    resto = resto.slice(corte).trimStart();
  }
  lineas.push(resto);
  return lineas;
};

const centrar = (texto: string, columnas: ColumnasTicket): string[] =>
  dividirLineas(texto, columnas).map((linea) =>
    ' '.repeat(Math.floor((columnas - linea.length) / 2)) + linea
  );

const importe = (etiqueta: string, valor: string, columnas: ColumnasTicket): string[] => {
  const izquierda = textoSeguro(etiqueta);
  const derecha = textoSeguro(valor);
  if (izquierda.length + derecha.length + 1 <= columnas) {
    return [izquierda + ' '.repeat(columnas - izquierda.length - derecha.length) + derecha];
  }
  return [
    ...dividirLineas(izquierda, columnas),
    ...dividirLineas(derecha, columnas).map((linea) => linea.padStart(columnas)),
  ];
};

const monto = (valor: number): string => {
  if (!Number.isFinite(valor) || valor < 0) {
    throw new Error('El ticket contiene un importe no válido.');
  }
  return valor.toFixed(2);
};

const fechaHora = (fecha: string): string => {
  const valor = new Date(fecha);
  if (!Number.isFinite(valor.getTime())) {
    throw new Error('La fecha del ticket no es válida.');
  }
  const dos = (numero: number) => String(numero).padStart(2, '0');
  return `${dos(valor.getDate())}/${dos(valor.getMonth() + 1)}/${valor.getFullYear()} ` +
    `${dos(valor.getHours())}:${dos(valor.getMinutes())}`;
};

export const crearTicketPedido = (
  pedido: Pedido,
  detalle: PedidoDetalleView[],
  totales: TotalesPedido,
  configuracion: ConfiguracionImpresora,
  descuentos: PedidoDescuentoView[] = []
): string => {
  const { columnas, encabezado } = configuracion;
  if (columnas !== 32 && columnas !== 48) {
    throw new Error('El formato del ticket debe ser de 32 o 48 columnas.');
  }
  const separador = '-'.repeat(columnas);
  const lineas = [
    ...encabezado.split(/\r?\n/).flatMap((linea) => centrar(linea, columnas)),
    ...centrar(`ORDEN #${pedido.id}`, columnas),
    ...dividirLineas(`Mesa: ${pedido.mesa_nombre}`, columnas),
    ...dividirLineas(`Fecha y hora: ${fechaHora(pedido.created_at)}`, columnas),
    `Estado: ${pedido.status}`,
    separador,
    'Producto',
    ...importe('Cant. x precio USD', 'Importe USD', columnas),
    separador,
  ];
  const activas = detalle.filter((item) => item.status === 'Activa');
  for (const item of activas) {
    if (!Number.isFinite(item.cantidad) || item.cantidad <= 0) {
      throw new Error('El ticket contiene una cantidad no válida.');
    }
    lineas.push(
      ...dividirLineas(item.producto_nombre, columnas),
      ...importe(`${item.cantidad} x ${monto(item.precio)}`, monto(item.monto), columnas)
    );
  }
  const descuentosActivos = descuentos.filter((descuento) => descuento.status === 'Activo');
  for (const descuento of descuentosActivos) {
    const importeDescuento = monto(descuento.monto_usd);
    lineas.push(
      ...dividirLineas(
        descuento.producto_nombre
          ? `${descuento.descripcion} (${descuento.producto_nombre}${
              descuento.producto_linea !== null &&
              descuento.producto_linea !== undefined &&
              descuento.producto_cantidad !== null &&
              descuento.producto_cantidad !== undefined &&
              descuento.producto_precio !== null &&
              descuento.producto_precio !== undefined
                ? `, linea ${descuento.producto_linea}: ${descuento.producto_cantidad} x ${monto(descuento.producto_precio)}`
                : ''
            })`
          : descuento.descripcion,
        columnas
      ),
      ...importe('Descuento USD', `-${importeDescuento}`, columnas),
      ...importe(
        'Descuento COP',
        `-${monto(descuento.monto_usd * totales.tasaCop)}`,
        columnas
      ),
      ...importe(
        'Descuento Bs',
        `-${monto(descuento.monto_usd * totales.tasaBs)}`,
        columnas
      )
    );
  }
  if (activas.length === 0) lineas.push('Sin productos.');
  lineas.push(
    separador,
    ...importe('SUBTOTAL USD', monto(totales.subtotalUsd), columnas),
    ...importe(
      'SUBTOTAL COP',
      monto(totales.subtotalUsd * totales.tasaCop),
      columnas
    ),
    ...importe(
      'SUBTOTAL Bs',
      monto(totales.subtotalUsd * totales.tasaBs),
      columnas
    ),
    ...(totales.descuentoUsd > 0
      ? [
          ...importe('DESCUENTOS USD', `-${monto(totales.descuentoUsd)}`, columnas),
          ...importe(
            'DESCUENTOS COP',
            `-${monto(totales.descuentoUsd * totales.tasaCop)}`,
            columnas
          ),
          ...importe(
            'DESCUENTOS Bs',
            `-${monto(totales.descuentoUsd * totales.tasaBs)}`,
            columnas
          ),
        ]
      : []),
    ...importe('TOTAL USD', monto(totales.totalUsd), columnas),
    ...importe('TOTAL COP', monto(totales.totalCop), columnas),
    ...importe('TOTAL Bs', monto(totales.totalBs), columnas),
    separador,
    ...dividirLineas(
      totales.historico ? 'Tasas al finalizar (por 1 USD):' : 'Tasas actuales (por 1 USD):',
      columnas
    ),
    ...importe('COP', String(totales.tasaCop), columnas),
    ...importe('Bs', String(totales.tasaBs), columnas)
  );
  if (totales.propinaPct > 0) {
    lineas.push(
      separador,
      ...dividirLineas(`Propina sugerida ${totales.propinaPct}% (no incluida):`, columnas),
      ...importe('USD', monto(totales.totalUsd * totales.propinaPct / 100), columnas),
      ...importe('COP', monto(totales.totalCop * totales.propinaPct / 100), columnas),
      ...importe('Bs', monto(totales.totalBs * totales.propinaPct / 100), columnas)
    );
  }
  lineas.push(separador, ...centrar('Gracias por su visita', columnas));
  return lineas.join('\n') + '\n';
};

export const crearTicketReportePagos = (
  reporte: ReportePagos,
  presentacion: PresentacionReportePagos,
  configuracion: ConfiguracionImpresora
): string => {
  const { columnas, encabezado } = configuracion;
  if (columnas !== 32 && columnas !== 48) {
    throw new Error('El formato del ticket debe ser de 32 o 48 columnas.');
  }
  if (!['Consolidado', 'Detallado', 'Ambos'].includes(presentacion)) {
    throw new Error('La presentación del reporte de pagos no es válida.');
  }
  const separador = '-'.repeat(columnas);
  const lineas = [
    ...encabezado.split(/\r?\n/).flatMap((linea) => centrar(linea, columnas)),
    ...centrar('REPORTE DE PAGOS', columnas),
    ...dividirLineas(`Presentación: ${presentacion}`, columnas),
    ...dividirLineas(`Desde: ${reporte.filtro.fechaInicio}`, columnas),
    ...dividirLineas(`Hasta: ${reporte.filtro.fechaFin}`, columnas),
    ...dividirLineas(`Forma de pago: ${reporte.formaPagoNombre}`, columnas),
    ...dividirLineas(`Consultado: ${fechaHora(reporte.consultadoEn)}`, columnas),
    ...dividirLineas('Por fecha del pago. Solo pagos vigentes.', columnas),
    separador,
  ];
  if (reporte.pagosPedidosAnulados > 0) {
    lineas.push(
      ...dividirLineas(
        `ATENCIÓN: ${reporte.pagosPedidosAnulados} pagos de pedidos anulados incluidos en los totales.`,
        columnas
      ),
      separador
    );
  }
  if (reporte.cantidadPagos === 0) {
    lineas.push(...dividirLineas('Sin pagos vigentes en el período.', columnas));
  }
  if (presentacion !== 'Detallado') {
    lineas.push(...centrar('CONSOLIDADO', columnas), separador);
    for (const grupo of reporte.grupos) {
      lineas.push(
        ...dividirLineas(`${grupo.nombre} (${grupo.divisa})`, columnas),
        ...importe('Cantidad de pagos', String(grupo.pagos.length), columnas),
        ...importe(`Total ${grupo.divisa}`, monto(grupo.monto), columnas),
        ...importe('Equivalente USD', monto(grupo.montoUsd), columnas),
        separador
      );
    }
  }
  if (presentacion !== 'Consolidado') {
    lineas.push(...centrar('DETALLADO', columnas), separador);
    for (const grupo of reporte.grupos) {
      lineas.push(...dividirLineas(`${grupo.nombre} (${grupo.divisa})`, columnas));
      for (const pago of grupo.pagos) {
        lineas.push(
          ...dividirLineas(`Pago #${pago.id} / Pedido #${pago.pedido_id}`, columnas),
          ...dividirLineas(`Mesa: ${pago.mesa_nombre}`, columnas),
          ...dividirLineas(`Fecha: ${fechaHora(pago.created_at)}`, columnas),
          ...dividirLineas(`Pedido ${pago.pedido_status}`, columnas),
          ...importe(`Importe ${pago.divisa}`, monto(pago.monto), columnas),
          ...importe('Tasa por USD', String(pago.tasa), columnas),
          ...importe('Equivalente USD', monto(pago.monto_usd), columnas),
          ''
        );
      }
      lineas.push(
        ...importe('Cantidad de pagos', String(grupo.pagos.length), columnas),
        ...importe(`Subtotal ${grupo.divisa}`, monto(grupo.monto), columnas),
        ...importe('Equivalente USD', monto(grupo.montoUsd), columnas),
        separador
      );
    }
  }
  lineas.push(
    ...centrar('TOTALES RECIBIDOS', columnas),
    ...importe('Cantidad de pagos', String(reporte.cantidadPagos), columnas),
    ...importe('TOTAL USD', monto(reporte.totalesPorDivisa.USD), columnas),
    ...importe('TOTAL COP', monto(reporte.totalesPorDivisa.COP), columnas),
    ...importe('TOTAL Bs', monto(reporte.totalesPorDivisa.BS), columnas),
    ...importe('EQUIVALENTE USD', monto(reporte.equivalenteUsd), columnas),
    ...dividirLineas('Equivalentes USD guardados en cada pago. No usa tasas actuales.', columnas),
    ...dividirLineas('Reporte de cobros, no cierre de caja.', columnas),
    separador
  );
  return lineas.join('\n') + '\n';
};

const encabezadoReporte = (
  titulo: string,
  filtro: RangoReporte,
  consultadoEn: string,
  presentacion: PresentacionReporte,
  configuracion: ConfiguracionImpresora
): string[] => {
  const { columnas, encabezado } = configuracion;
  if (columnas !== 32 && columnas !== 48) {
    throw new Error('El formato del ticket debe ser de 32 o 48 columnas.');
  }
  if (presentacion !== 'Consolidado' && presentacion !== 'Detallado') {
    throw new Error('La presentación del reporte no es válida.');
  }
  return [
    ...encabezado.split(/\r?\n/).flatMap((linea) => centrar(linea, columnas)),
    ...centrar(titulo, columnas),
    ...dividirLineas(`Presentación: ${presentacion}`, columnas),
    ...dividirLineas(`Desde: ${filtro.fechaInicio}`, columnas),
    ...dividirLineas(`Hasta: ${filtro.fechaFin}`, columnas),
    ...dividirLineas(`Consultado: ${fechaHora(consultadoEn)}`, columnas),
    ...dividirLineas('Por fecha de creación del pedido.', columnas),
    '-'.repeat(columnas),
  ];
};

export const crearTicketReportePedidos = (
  reporte: ReportePedidos,
  presentacion: PresentacionReporte,
  configuracion: ConfiguracionImpresora
): string => {
  const { columnas } = configuracion;
  const lineas = encabezadoReporte(
    'REPORTE DE PEDIDOS', reporte.filtro, reporte.consultadoEn, presentacion, configuracion
  );
  const separador = '-'.repeat(columnas);
  lineas.push(...dividirLineas(`Estado: ${reporte.filtro.status}`, columnas), separador);
  if (!reporte.pedidos.length) lineas.push('Sin pedidos en el período.');
  for (const { pedido, detalle, descuentos, pagos, totales } of reporte.pedidos) {
    lineas.push(
      ...importe(`#${pedido.id} ${pedido.mesa_nombre}`, `${monto(totales.totalUsd)} USD`, columnas),
      ...dividirLineas(`${fechaHora(pedido.created_at)} / ${pedido.status}`, columnas)
    );
    if (presentacion === 'Detallado') {
      lineas.push('Productos (USD):');
      for (const item of detalle.filter((d) => d.status === 'Activa')) {
        lineas.push(
          ...dividirLineas(item.producto_nombre, columnas),
          ...importe(`${item.cantidad} x ${monto(item.precio)}`, monto(item.monto), columnas)
        );
      }
      if (!detalle.some((d) => d.status === 'Activa')) lineas.push('Sin productos.');
      for (const descuento of descuentos.filter((d) => d.status === 'Activo')) {
        lineas.push(
          ...dividirLineas(`Descuento: ${descuento.descripcion}${
            descuento.producto_nombre ? ` (${descuento.producto_nombre})` : ''
          }`, columnas),
          ...importe('USD', `-${monto(descuento.monto_usd)}`, columnas)
        );
      }
      lineas.push(
        ...importe('Subtotal USD', monto(totales.subtotalUsd), columnas),
        ...importe('Descuentos USD', monto(totales.descuentoUsd), columnas),
        ...importe('Total USD', monto(totales.totalUsd), columnas),
        ...importe('Total COP', monto(totales.totalCop), columnas),
        ...importe('Total Bs', monto(totales.totalBs), columnas),
        ...dividirLineas(totales.historico ? 'Tasas al finalizar:' : 'Tasas actuales:', columnas),
        ...importe('COP por USD', String(totales.tasaCop), columnas),
        ...importe('Bs por USD', String(totales.tasaBs), columnas),
        'Pagos vigentes:'
      );
      const activos = pagos.filter((p) => p.status === 'Activo');
      for (const pago of activos) {
        lineas.push(
          ...dividirLineas(`#${pago.id} ${pago.forma_pago_nombre} / ${fechaHora(pago.created_at)}`, columnas),
          ...importe(pago.divisa, monto(pago.monto), columnas),
          ...importe('Equivalente USD', monto(pago.monto_usd), columnas)
        );
      }
      if (!activos.length) lineas.push('Sin pagos vigentes.');
      lineas.push(...importe('Pagado USD', monto(activos.reduce((s, p) => s + p.monto_usd, 0)), columnas));
    }
    lineas.push(separador);
  }
  if (reporte.pedidos.some((item) => item.pedido.status === 'Anulado')) {
    lineas.push(...dividirLineas(
      'Incluye importes de pedidos anulados. Este total no representa ventas netas.', columnas
    ));
  }
  lineas.push(
    ...importe('Cantidad de pedidos', String(reporte.pedidos.length), columnas),
    ...importe('TOTAL GENERAL USD', monto(reporte.totalUsd), columnas),
    separador
  );
  return lineas.join('\n') + '\n';
};

export const crearTicketReporteVentas = (
  reporte: ReporteVentas,
  presentacion: PresentacionReporte,
  configuracion: ConfiguracionImpresora
): string => {
  const { columnas } = configuracion;
  const lineas = encabezadoReporte(
    'ANÁLISIS DE VENTAS', reporte.filtro, reporte.consultadoEn, presentacion, configuracion
  );
  const separador = '-'.repeat(columnas);
  lineas.push(...dividirLineas('Solo pedidos finalizados. Importes originales en USD.', columnas));
  if (!reporte.cantidadPedidos) lineas.push('Sin ventas en el período.');
  for (const grupo of reporte.grupos) {
    if (!grupo.productos.length) continue;
    lineas.push(separador, ...centrar(grupo.tipo, columnas));
    for (const producto of grupo.productos) {
      lineas.push(...dividirLineas(producto.nombre, columnas));
      if (presentacion === 'Detallado') {
        for (const linea of producto.lineas) {
          lineas.push(
            ...dividirLineas(`Pedido #${linea.pedido_id} / ${linea.mesa_nombre}`, columnas),
            ...dividirLineas(`Fecha pedido: ${fechaHora(linea.fecha_pedido)}`, columnas),
            ...importe(
              `L${linea.linea}: ${linea.cantidad} x ${monto(linea.precio)}`,
              monto(linea.monto), columnas
            )
          );
        }
      }
      lineas.push(...importe(
        `${producto.cantidad} unidades / Total USD`, monto(producto.montoUsd), columnas
      ));
    }
  }
  lineas.push(separador, ...centrar('RESUMEN POR TIPO', columnas));
  for (const grupo of reporte.grupos) {
    lineas.push(
      ...dividirLineas(`${grupo.tipo}: ${grupo.cantidad} unidades`, columnas),
      ...importe('Importe USD', monto(grupo.montoUsd), columnas)
    );
  }
  lineas.push(
    separador,
    ...importe('Pedidos finalizados', String(reporte.cantidadPedidos), columnas),
    ...importe('Total unidades', String(reporte.cantidad), columnas),
    ...importe('VENTA BRUTA USD', monto(reporte.brutoUsd), columnas),
    ...importe('DESCUENTOS USD', monto(reporte.descuentosUsd), columnas),
    ...importe('TOTAL NETO USD', monto(reporte.netoUsd), columnas),
    ...dividirLineas('Descuentos del conjunto de pedidos, sin repartir entre productos o tipos.', columnas),
    ...dividirLineas('Sin propina. No es un reporte de cobros.', columnas),
    separador
  );
  return lineas.join('\n') + '\n';
};

export const crearTicketPrueba = (configuracion: ConfiguracionImpresora): string => {
  const columnas = configuracion.columnas;
  if (columnas !== 32 && columnas !== 48) {
    throw new Error('El formato del ticket debe ser de 32 o 48 columnas.');
  }
  return [
    ...configuracion.encabezado.split(/\r?\n/).flatMap((linea) => centrar(linea, columnas)),
    ...centrar('PRUEBA DE IMPRESIÓN', columnas),
    `Formato: ${columnas} columnas`,
    Array.from({ length: columnas }, (_, i) => (i + 1) % 10).join(''),
    '-'.repeat(columnas),
    ...dividirLineas('Acentos: á é í ó ú ü ñ Ñ ¿ ¡', columnas),
    ...importe('TOTAL USD', '19.00', columnas),
    ...importe('TOTAL COP', '76000.00', columnas),
    ...importe('TOTAL Bs', '950.00', columnas),
    '-'.repeat(columnas),
    ...dividirLineas('Verifique ancho, alineación y acentos.', columnas),
  ].join('\n') + '\n';
};

export const codificarTicketEscPos = (ticket: string): string => {
  let datos = '';
  for (const caracter of ticket.normalize('NFC')) {
    const codigo = caracter.charCodeAt(0);
    if (caracter === '\n' || (codigo >= 32 && codigo <= 126)) {
      datos += caracter;
    } else {
      const indice = caracteresCp850.indexOf(caracter);
      if (indice < 0) {
        throw new Error(
          `El carácter "${caracter}" no es compatible con la impresora (CP850). ` +
          'Revise el encabezado y los textos del ticket o reporte.'
        );
      }
      datos += String.fromCharCode(indice + 128);
    }
  }
  // Inicializar, fuente A normal, alineación izquierda y página PC850 (ESC t 2).
  return '\x1b@\x1b!\x00\x1d!\x00\x1ba\x00\x1bt\x02' + datos + '\n\n\n';
};
