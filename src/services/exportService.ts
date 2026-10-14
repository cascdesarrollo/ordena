import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getDb } from '../db/connection';

export const exportDatabase = async () => {
  const db = getDb();
  // Vuelca el WAL al archivo principal para que la copia incluya los últimos cambios.
  await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');

  const dbPath = db.databasePath;
  const source = new File(dbPath.startsWith('file://') ? dbPath : `file://${dbPath}`);
  const target = new File(Paths.cache, 'ordena.db');
  if (target.exists) target.delete();
  source.copy(target);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target.uri, {
      mimeType: 'application/octet-stream',
      dialogTitle: 'Exportar base de datos',
    });
  }

  return target.uri;
};
