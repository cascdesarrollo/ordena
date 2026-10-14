import { Alert } from 'react-native';

export const printOrderTicket = async (orderId: number) => {
  Alert.alert('Imprimir', `Módulo en construcción. El ticket del pedido #${orderId} aún no se puede imprimir.`);
};
