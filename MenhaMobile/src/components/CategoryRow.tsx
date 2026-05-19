import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet } from 'react-native';

interface Category {
  id: string;
  name: string;
  image?: string;
}

interface CategoryRowProps {
  data: Category[];
  onPress: (category: Category) => void;
}

import { resolveImageUrl } from '../utils/imageUtils';

const CategoryRow: React.FC<CategoryRowProps> = ({ data, onPress }) => {
  if (!data || data.length === 0) return null;

  const renderItem = ({ item }: { item: Category }) => (
    <TouchableOpacity 
      style={styles.item} 
      onPress={() => onPress(item)}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <Image 
          source={{ uri: resolveImageUrl(item.image) }} 
          style={styles.image} 
          resizeMode="cover" 
        />
      </View>
      <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
{/* Header removed for better composition */}
      <FlatList
        data={data}
        renderItem={renderItem}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        keyExtractor={(item) => item.id.toString()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 15,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a472a', // Deep green for section titles
    letterSpacing: 0.5,
  },
  highlight: {
    color: '#E53935', // Or brand color
  },
  listContent: {
    paddingHorizontal: 10,
  },
  item: {
    alignItems: 'center',
    marginHorizontal: 10,
    width: 80, 
  },
  imageContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: '#eee',
    overflow: 'hidden',
    marginBottom: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  name: {
    fontSize: 12,
    color: '#3d4750',
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default CategoryRow;
