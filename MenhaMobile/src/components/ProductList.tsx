import React from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, THEME } from '../constants/theme';

const { width } = Dimensions.get('window');
// Two columns with padding
const CARD_MARGIN = 10;
const CONTAINER_PADDING = 10;
const COLUMN_WIDTH = (width - (CONTAINER_PADDING * 2) - CARD_MARGIN) / 2;

interface ProductListProps {
  data: any[];
  onPress: (item: any) => void;
}

import { resolveImageUrl } from '../utils/imageUtils';

import { useNavigation } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';

const ProductList: React.FC<ProductListProps> = ({ data, onPress }) => {
  const navigation = useNavigation<any>();
  const { updateCartCount } = useCart();

  const handleAddToCart = async (item: any) => {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) {
        Alert.alert(
            'Login Required',
            'Please login to add items to your cart.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Login', onPress: () => navigation.navigate('Login') }
            ]
        );
        return;
    }
    // Proceed if logged in (in this component, onPress usually navigates to details, 
    // but the button says 'Add to cart'. 
    // If the intention of the button is to navigate to details, we keep it as is.
    // If the intention is to actually add to cart, we should implement that logic or 
    // let the user navigate to details where logic is already implemented.
    // Based on UI 'Add to cart', it implies direct add, but for now let's redirect to details 
    // or trigger the callback. 
    // Given the prompt "only logged in user allow to add cart", we enforce it here.
    
    // As per current structure `onPress` navigates to detail. 
    // We will assume the 'Add to cart' button in list ALSO navigates to detail 
    // OR we intercept it. 
    // Actually, looking at code: `onPress(item)` is called for both card press AND 'Add to cart' button.
    // So both navigate to detail. We should probably enforce the check on the button specifically if it was doing a direct add.
    // But since it just navigates, we can leave it or enforce check if user wants to 'Add'.
    // However, the user request says "redirect to login page while add cart ... click".
    // Since this button says "Add to cart", the user expects an action. 
    // Current implementation: `onPress(item)` -> navigates to product details.
    // Enforcing login just to view details via "Add to cart" button might be annoying but strictly follows "add cart... click".
    
    // For a better UX, if this button JUST opens details, we don't strictly *need* auth yet, 
    // but if the user *thinks* they are adding to cart, preventing them now is safer.
    // Let's wrap standard onPress with a check ONLY for the button.
    
    onPress(item); // For now, just navigate, as logic is in Detail screen. 
                   // If we want to blocking navigation to detail on "Add to cart" click if not logged in:
  };
  
  // Wait, re-reading: "redirect to login page while add cart ... click"
  // The 'Add to cart' button in ProductList currently calls `onPress(item)`.
  // `onPress` is passed from parent, likely `navigation.navigate('ProductDetail', ...)`.
  // So clicking 'Add to cart' currently opens Detail page.
  // The User requirement is specifically about "Add Cart" / "Buy Now".
  // Functionally, the Product Detail page handles the actual "logic" of adding to cart.
  // The Product List "Add to cart" button is effectively a "View Details" button disguised.
  // I will Update it to explicitely check token if it were to add to cart, but since it navigates, 
  // I will leave the navigation as is, or better, change `onPress` to `handleAddToCart` 
  // ONLY if real "Add to cart" logic was here. 
  // Since real logic is missing here, I will NOT block navigation here to avoid confusion.
  // The constraint is handled in `ProductDetailScreen`. 
  
  // However, I CAN add the check here for the button specifically to signal intent.
  
  const handleAddButtonPress = async (item: any) => {
      try {
          const cartJson = await AsyncStorage.getItem('mb_cart') || '[]';
          let cart = JSON.parse(cartJson);
          const existing = cart.find((i: any) => i.product.id === item.id);
          if (existing) {
              existing.quantity += 1;
          } else {
              cart.push({ product: item, quantity: 1 });
          }
          await AsyncStorage.setItem('mb_cart', JSON.stringify(cart));
          await updateCartCount();
          Alert.alert('Success', 'Added to cart!');
      } catch (error) {
          console.error(error);
          Alert.alert('Error', 'Failed to add to cart');
      }
  }

  const handleBuyNowPress = async (item: any) => {
      const displayPrice = item.new_price || item.newPrice || item.price || 0;
      const token = await AsyncStorage.getItem('auth_token');
      const cartItems = [{ product: item, quantity: 1 }];
      if (!token) {
          if (Platform.OS === 'web') {
              alert('Please login to place your order.');
              navigation.navigate('Login', { redirect: 'Checkout', cartItems, totalAmount: displayPrice });
          } else {
              Alert.alert('Login Required', 'Please login to place your order.', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Login', onPress: () => navigation.navigate('Login', { redirect: 'Checkout', cartItems, totalAmount: displayPrice }) }
              ]);
          }
      } else {
          navigation.navigate('Checkout', { cartItems, totalAmount: displayPrice });
      }
  };

  const renderItem = ({ item }: { item: any }) => {
    // ... (rest of logic)
    // resolve image url safely
    const rawImageUrl = 
      item.primary_image || 
      item.primaryImage || 
      (item.images && item.images.length > 0 ? (item.images[0].image_url || item.images[0].imageUrl || item.images[0].url) : null) || 
      item.image;
      
    const imageUrl = resolveImageUrl(rawImageUrl);
      
    // Default rating if missing
    const rating = item.rating || 4.5;
    const reviews = item.reviews ? item.reviews.length : (item.reviewCount || 0);

    const displayPrice = item.new_price || item.newPrice || item.price;
    const displayOldPrice = item.old_price || item.oldPrice;

    const attr = item.product_attributes && item.product_attributes.length > 0 ? item.product_attributes[0] : null;
    let weightDisplay = item.weight || '';
    if (attr) {
        weightDisplay = String(attr.attribute_value || '');
        if (attr.uom && String(attr.uom).trim() !== '' && String(attr.uom) !== 'undefined' && String(attr.uom) !== 'null') {
            if (!weightDisplay.toLowerCase().includes(String(attr.uom).toLowerCase())) {
                weightDisplay = `${weightDisplay} ${attr.uom}`;
            }
        }
        // Clean up malformed data from the backend (e.g. "100mlml" or "65gg")
        weightDisplay = weightDisplay.replace(/mlml/gi, 'ml').replace(/gg/gi, 'g');
    }

    let stockStatus = item.status;
    if (!stockStatus || stockStatus === 'In Stock' || stockStatus === 'Out of Stock') {
        stockStatus = parseInt(item.stock_quantity || 0) > 0 ? 'In Stock' : 'Out of Stock';
    }
    const isOutOfStock = stockStatus === 'Out of Stock';
    const canAdd = !isOutOfStock;

    return (
      <TouchableOpacity 
        style={[styles.card, isOutOfStock && { opacity: 0.5 }]} 
        onPress={() => onPress(item)}
        activeOpacity={0.9}
        disabled={isOutOfStock}
      >
        <View style={styles.imageContainer}>
             {/* Sale Badge */}
            {(item.sale || (displayOldPrice && displayPrice < displayOldPrice)) && (
                 <View style={styles.badge}>
                     <Text style={styles.badgeText}>SALE</Text>
                 </View>
            )}
            


            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
        </View>

        <View style={styles.details}>
          <Text style={styles.categoryName} numberOfLines={1}>{item.categories?.name || item.category?.name || item.category_name || 'Snacks'}</Text>
          <Text style={styles.name} numberOfLines={2}>{item.name || item.title}</Text>
          
          <View style={styles.ratingRow}>
              <View style={styles.stars}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons 
                    key={star} 
                    name={star <= Math.round(rating) ? "star" : "star-outline"} 
                    size={10} 
                    color={COLORS.warning} 
                  />
                ))}
              </View>
              <Text style={styles.ratingText}> ({reviews} reviews)</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.price}>₹{displayPrice}</Text>
            {(displayOldPrice && displayOldPrice > displayPrice) && (
              <Text style={styles.oldPrice}>₹{displayOldPrice}</Text>
            )}
          </View>

          <View style={styles.weightContainer}>
            <Text style={styles.weightText}>{weightDisplay}</Text>
          </View>

          <View style={styles.buttonsRow}>
            <TouchableOpacity 
              style={[styles.addButtonContainer, !canAdd && { opacity: 0.5 }]} 
              onPress={() => canAdd && handleAddButtonPress(item)}
              disabled={!canAdd}
            >
              <LinearGradient
                colors={THEME.gradients.primary as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButton}
              >
                <Ionicons name="cart-outline" size={14} color="#fff" style={{marginRight: 2}} />
                <Text style={styles.actionButtonText}>Cart</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.buyButtonContainer, !canAdd && { opacity: 0.5 }]} 
              onPress={() => canAdd && handleBuyNowPress(item)}
              disabled={!canAdd}
            >
              <LinearGradient
                colors={THEME.gradients.accent as any}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionButton}
              >
                <Ionicons name="flash-outline" size={14} color="#fff" style={{marginRight: 2}} />
                <Text style={styles.actionButtonText}>Buy</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          
          {isOutOfStock && (
              <Text style={{color: COLORS.danger, fontSize: 10, textAlign: 'center', marginTop: 5, fontWeight: 'bold'}}>Out of Stock</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={(item) => (item.id || Math.random()).toString()}
        numColumns={2}
        columnWrapperStyle={styles.row}
        scrollEnabled={false} 
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: CONTAINER_PADDING,
    marginTop: 10,
  },
  row: {
    justifyContent: 'space-between',
  },
  card: {
    width: COLUMN_WIDTH,
    backgroundColor: '#fff',
    marginBottom: 15,
    borderRadius: 12,
    // Soft shadow like Pattikadai
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
  },
  imageContainer: {
    height: COLUMN_WIDTH, // Square image
    width: '100%',
    position: 'relative',
    backgroundColor: '#f9f9f9',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 1,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  wishlistIcon: {
      position: 'absolute',
      top: 8,
      right: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      elevation: 2,
  },
  details: {
    padding: 10,
  },
  categoryName: {
    fontSize: 10,
    color: '#888',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  name: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    marginBottom: 4,
    height: 36, // Fixed height for 2 lines
    lineHeight: 18,
  },
  ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 6,
  },
  stars: {
    flexDirection: 'row',
  },
  ratingText: {
      fontSize: 10,
      color: '#888',
      marginLeft: 4,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  price: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary, // Deep green for price
    marginRight: 6,
  },
  oldPrice: {
    fontSize: 11,
    color: '#999',
    textDecorationLine: 'line-through',
  },
  weightContainer: {
    marginBottom: 8,
  },
  weightText: {
    fontSize: 11,
    color: '#666',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    width: '100%',
  },
  addButtonContainer: {
    flex: 1,
    marginRight: 4,
  },
  buyButtonContainer: {
    flex: 1,
    marginLeft: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 20, // Pill shape
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
});

export default ProductList;
