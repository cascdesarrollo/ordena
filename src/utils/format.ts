// Fecha local del dispositivo en formato YYYY-MM-DD (toISOString usaría UTC).
export const localDateString = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Convierte texto a número aceptando coma o punto decimal. Devuelve null si no es válido.
export const parseDecimal = (value: string): number | null => {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
};
