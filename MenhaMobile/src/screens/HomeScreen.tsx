import React, { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, RefreshControl, StyleSheet, SafeAreaView, Platform, StatusBar as RNStatusBar, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import api, { MainAPI } from '../services/api';

import { COLORS } from '../constants/theme';

// Components
import Header from '../components/Header';
import Banner from '../components/Banner';
import CategoryRow from '../components/CategoryRow';
import ProductList from '../components/ProductList';
import SectionHeader from '../components/SectionHeader';
import Loader from '../components/Loader';

interface Product {
  id: string;
  name: string;
  title?: string;
  price: number;
  newPrice?: number;
  oldPrice?: number;
  description: string;
  image?: string;
  images?: { url: string }[];
  rating?: number;
  reviews?: number;
  sale?: string;
  category?: string;
  weight?: string;
  location?: string;
}

interface Category {
  id: string;
  name: string;
  image?: string;
}

const HomeScreen = () => {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [banners, setBanners] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [bestSelling, setBestSelling] = useState<Product[]>([]);

  const fetchData = async () => {
    try {
      // Fetch Banners
      const bannersData = await MainAPI.fetchBanners();
      const mappedBanners = bannersData.map((b: any) => ({
          id: b.id,
          image: b.image_url || b.imageUrl || b.image,
          name: b.title || '',
          link: b.link
      }));
      setBanners(mappedBanners);

      // Fetch Categories
      const categoriesList = await MainAPI.fetchCategories();
      setCategories(categoriesList);

      // Fetch Products
      const productsData = await MainAPI.fetchProducts();
      setProducts(productsData);
      setFilteredProducts(productsData);

      // Best Selling (Mock for now or filter)
      setBestSelling(productsData.slice(0, 4));

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, []);

  const handleProductPress = (item: Product) => {
    navigation.navigate('ProductDetail', { productId: item.id });
  };

  const handleCategoryPress = (item: Category) => {
      navigation.navigate('CategoryProducts', { categoryId: item.id, categoryName: item.name });
  };

  const handleSearch = (query: string) => {
      if (!query.trim()) {
          setFilteredProducts(products);
      } else {
          const lowerQuery = query.toLowerCase();
          setFilteredProducts(
              products.filter(p => 
                  p.name?.toLowerCase().includes(lowerQuery) || 
                  p.title?.toLowerCase().includes(lowerQuery)
              )
          );
      }
  };

  if (loading) {
    return <Loader fullScreen />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Header onSearch={handleSearch} />
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Banners */}
          {banners.length > 0 && <Banner data={banners} onPress={() => {}} />}

          {/* Categories */}
          <SectionHeader 
            title="Shop By Category" 
            onSeeAll={() => navigation.navigate('Category')}
          />
          <CategoryRow data={categories} onPress={handleCategoryPress} />

          {/* Best Selling Section */}
          {bestSelling.length > 0 && (
            <>
               <SectionHeader 
                 title="Best Selling" 
                 onSeeAll={() => navigation.navigate('Products')}
               />
               <ProductList data={bestSelling} onPress={handleProductPress} />
            </>
          )}

          {/* All Products Section */}
          <SectionHeader 
             title={filteredProducts.length < products.length ? "Search Results" : "All Items"} 
             onSeeAll={filteredProducts.length < products.length ? undefined : () => navigation.navigate('Products')}
          />
          <ProductList data={filteredProducts} onPress={handleProductPress} />
          
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 20,
  },
});

export default HomeScreen;
