import React, { useState, useEffect, useRef } from 'react';
import { View, Image, Dimensions, FlatList, StyleSheet, TouchableOpacity, Text } from 'react-native';

const { width } = Dimensions.get('window');

interface BannerProps {
  data: any[]; // List of products to show in banner
  onPress: (item: any) => void;
}

import { resolveImageUrl } from '../utils/imageUtils';

const Banner: React.FC<BannerProps> = ({ data, onPress }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (data.length > 0) {
      const interval = setInterval(() => {
        let nextIndex = currentIndex + 1;
        if (nextIndex >= data.length) {
          nextIndex = 0;
        }
        flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
        setCurrentIndex(nextIndex);
      }, 5000); // Auto scroll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [currentIndex, data.length]);
  const renderItem = ({ item }: { item: any }) => {
    const rawImageUrl = item.image || (item.images && item.images[0]?.url);
    const imageUrl = resolveImageUrl(rawImageUrl);
    return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => onPress(item)}>
        <View style={styles.cardContainer}>
          <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          <View style={styles.overlay}>
            {Boolean(item.discount) && item.discount !== '' && <Text style={styles.discount}>{item.discount}% OFF</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!data || data.length === 0) return null;

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={data}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id.toString()}
        onMomentumScrollEnd={(event) => {
          const index = Math.floor(event.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
      />
      <View style={styles.pagination}>
        {data.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              { backgroundColor: index === currentIndex ? '#fff' : 'rgba(255,255,255,0.5)' },
            ]}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    backgroundColor: '#fff',
  },
  cardContainer: {
    width: width,
    height: 200,
    position: 'relative',
  },
  image: {
    width: width,
    height: 200,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  discount: {
    backgroundColor: '#E53935',
    color: '#fff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  pagination: {
    position: 'absolute',
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 3,
  },
});

export default Banner;
