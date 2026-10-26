// Fecha local del dispositivo en formato YYYY-MM-DD (toISOString usaría UTC).
export const localDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const validarRangoFechas = (fechaInicio: string, fechaFin: string): void => {
  for (const fecha of [fechaInicio, fechaFin]) {
    const parsed = new Date(`${fecha}T12:00:00`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        !Number.isFinite(parsed.getTime()) || localDateString(parsed) !== fecha) {
      throw new Error('Ingrese fechas válidas en formato YYYY-MM-DD.');
    }
  }
  if (fechaInicio > fechaFin) {
    throw new Error('La fecha inicial no puede ser posterior a la fecha final.');
  }
};

// Convierte texto a número aceptando coma o punto decimal. Devuelve null si no es válido.
export const parseDecimal = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};
