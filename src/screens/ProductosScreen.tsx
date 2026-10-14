import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, TextInput, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { FloatingActionButton } from '../components/FloatingActionButton';
import { ModalContainer } from '../components/ModalContainer';
import { SelectPicker } from '../components/SelectPicker';
import { commonStyles } from '../styles/common';
import { colors, spacing } from '../styles/theme';
import type { Producto, ProductoTipo, StatusActivo } from '../db/types';
import { createProducto, listProductos, updateProducto } from '../repositories/productosRepository';
import { parseDecimal } from '../utils/format';

const statusOptions: StatusActivo[] = ['Activo', 'Inactivo'];
const tipoOptions: ProductoTipo[] = ['Entrada', 'Bebidas', 'Postres', 'Principal'];

export const ProductosScreen = () => {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [tipo, setTipo] = useState<ProductoTipo>('Principal');
  const [status, setStatus] = useState<StatusActivo>('Activo');
  const [precio, setPrecio] = useState('');

  const loadData = useCallback(async () => {
    const data = await listProductos();
    setProductos(data);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const openModal = (producto?: Producto) => {
    if (producto) {
      setEditing(producto);
      setNombre(producto.nombre);
      setTipo(producto.tipo);
      setStatus(producto.status);
      setPrecio(producto.precio.toString());
    } else {
      setEditing(null);
      setNombre('');
      setTipo('Principal');
      setStatus('Activo');
      setPrecio('');
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!nombre.trim() || !precio.trim()) return;
    const precioNum = parseDecimal(precio);
    if (precioNum === null || precioNum < 0) {
      Alert.alert('Precio inválido', 'El precio debe ser un número mayor o igual a 0.');
      return;
    }
    if (editing) {
      await updateProducto(editing.id, { nombre, tipo, status, precio: precioNum });
    } else {
      await createProducto({ nombre, tipo, status, precio: precioNum });
    }
    setShowModal(false);
    await loadData();
  };

  return (
    <View style={commonStyles.screen}>
      <View style={commonStyles.card}>
        <Text style={commonStyles.title}>Productos</Text>
        <FlatList
          data={productos}
          keyExtractor={(producto) => producto.id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openModal(item)}>
              <View>
                <Text style={styles.rowTitle}>{item.nombre}</Text>
                <Text style={commonStyles.mutedText}>{item.tipo}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.price}>${item.precio.toFixed(2)}</Text>
                <Text style={styles.status}>{item.status}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text style={commonStyles.mutedText}>No hay productos registrados.</Text>}
        />
      </View>

      <FloatingActionButton onPress={() => openModal()} />

      <ModalContainer
        visible={showModal}
        title={editing ? 'Editar producto' : 'Agregar producto'}
        onClose={() => setShowModal(false)}
        footer={
          <TouchableOpacity style={commonStyles.button} onPress={handleSave}>
            <Text style={commonStyles.buttonText}>Guardar</Text>
          </TouchableOpacity>
        }
      >
        <Text style={commonStyles.label}>Nombre</Text>
        <TextInput
          style={commonStyles.input}
          value={nombre}
          onChangeText={setNombre}
          maxLength={30}
        />
        <Text style={commonStyles.label}>Tipo</Text>
        <SelectPicker options={tipoOptions} value={tipo} onChange={setTipo} />
        <Text style={commonStyles.label}>Precio (USD)</Text>
        <TextInput
          style={commonStyles.input}
          value={precio}
          onChangeText={setPrecio}
          keyboardType="decimal-pad"
        />
        <Text style={commonStyles.label}>Status</Text>
        <SelectPicker options={statusOptions} value={status} onChange={setStatus} />
      </ModalContainer>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  status: {
    color: colors.primary,
    fontWeight: '600',
  },
  price: {
    fontWeight: '600',
  },
});
