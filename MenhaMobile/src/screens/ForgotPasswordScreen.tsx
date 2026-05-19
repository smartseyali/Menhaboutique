import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, ScrollView, SafeAreaView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/theme';
import { MainAPI } from '../services/api';

const ForgotPasswordScreen = () => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation<any>();

  const handleReset = async () => {
    if (!identifier) {
      Alert.alert('Error', 'Please enter your email or phone number');
      return;
    }

    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));

      Alert.alert(
        'Success', 
        'If an account with that email/phone exists, we have sent a password reset link.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error(error);
      Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#555" />
        </TouchableOpacity>
        <Text style={styles.topBarBrand}>Menha Boutique</Text>
      </View>

      <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
      >
          <ScrollView 
              contentContainerStyle={{ flexGrow: 1, padding: 20 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
          >
              <View style={styles.formContainer}>
                  {/* Header Icon */}
                  <View style={styles.iconCircle}>
                    <Ionicons name="lock-closed" size={40} color={COLORS.primary} />
                  </View>

                  <Text style={styles.title}>Forgot Password</Text>
                  <Text style={styles.subtitle}>Enter your email or phone number to reset your password</Text>

                  <View style={styles.inputGroup}>
                      <Text style={styles.label}>Email or Mobile Number</Text>
                      <TextInput
                          style={styles.input}
                          placeholder="Email or Phone Number"
                          placeholderTextColor="#999"
                          value={identifier}
                          onChangeText={setIdentifier}
                          autoCapitalize="none"
                      />
                  </View>

                  <TouchableOpacity 
                      onPress={handleReset} 
                      disabled={loading}
                      style={styles.loginBtnContainer}
                  >
                      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Reset Link</Text>}
                  </TouchableOpacity>
              </View>
          </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    padding: 5,
    marginRight: 10,
  },
  topBarBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.primary,
  },
  formContainer: {

    paddingTop: 20,
    alignItems: 'center',
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    backgroundColor: '#f5f5f5',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.primaryDark || '#00251a',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
    textAlign: 'center',
  },
  inputGroup: {
    width: '100%',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primaryDark || '#00251a',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    height: 55,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
  },
  loginBtnContainer: {
    width: '100%',
    height: 55,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  }
});

export default ForgotPasswordScreen;
