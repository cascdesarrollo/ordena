import type {
  ColumnasTicket,
  ConfiguracionImpresora,
  Pedido,
  PedidoDetalleView,
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
    throw new Error('La fecha del pedido no es válida.');
  }
  const dos = (numero: number) => String(numero).padStart(2, '0');
  return `${dos(valor.getDate())}/${dos(valor.getMonth() + 1)}/${valor.getFullYear()} ` +
    `${dos(valor.getHours())}:${dos(valor.getMinutes())}`;
};

export const crearTicketPedido = (
  pedido: Pedido,
  detalle: PedidoDetalleView[],
  totales: TotalesPedido,
  configuracion: ConfiguracionImpresora
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
  if (activas.length === 0) lineas.push('Sin productos.');
  lineas.push(
    separador,
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
          'Revise el encabezado y los nombres del pedido.'
        );
      }
      datos += String.fromCharCode(indice + 128);
    }
  }
  // Inicializar, fuente A normal, alineación izquierda y página PC850 (ESC t 2).
  return '\x1b@\x1b!\x00\x1d!\x00\x1ba\x00\x1bt\x02' + datos + '\n\n\n';
};
