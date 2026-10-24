import { StyleSheet } from 'react-native';
import { colors, radius, spacing } from './theme';

export const commonStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.md,
  },
  // Deja libre la zona del FloatingActionButton para que no tape el final de la lista.
  screenWithFab: {
    paddingBottom: 88,
  },
  // Contenido de un ScrollView de pantalla con FloatingActionButton.
  scrollContentWithFab: {
    paddingBottom: 88,
  },
  // Card con lista que se encoge y hace scroll si no cabe en la pantalla.
  listCard: {
    flexShrink: 1,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 14,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.card,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.primary,
  },
  badgeText: {
    color: '#fff',
    fontWeight: '600',
  },
  dangerText: {
    color: colors.danger,
    fontWeight: '600',
  },
  mutedText: {
    color: colors.muted,
  },
});
