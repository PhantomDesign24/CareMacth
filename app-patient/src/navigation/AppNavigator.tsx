import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View } from 'react-native';
import { authService } from '../services/auth';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import HomeScreen from '../screens/HomeScreen';
import CareRequestScreen from '../screens/CareRequestScreen';
import CaregiverListScreen from '../screens/CaregiverListScreen';
import CareStatusScreen from '../screens/CareStatusScreen';
import MyPageScreen from '../screens/MyPageScreen';
import ReviewScreen from '../screens/ReviewScreen';
import PaymentScreen from '../screens/PaymentScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  홈: undefined;
  간병요청: undefined;
  내간병: undefined;
  마이페이지: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  CaregiverList: { requestId: string };
  CareStatus: { careId: string };
  Review: { careId: string; caregiverName: string };
  Payment: { requestId: string; amount: number };
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          switch (route.name) {
            case '홈':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case '간병요청':
              iconName = focused ? 'add-circle' : 'add-circle-outline';
              break;
            case '내간병':
              iconName = focused ? 'heart' : 'heart-outline';
              break;
            case '마이페이지':
              iconName = focused ? 'person' : 'person-outline';
              break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#4A90D9',
        tabBarInactiveTintColor: '#999',
        tabBarStyle: {
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F0F0F0',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#4A90D9',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      })}
    >
      <MainTab.Screen name="홈" component={HomeScreen} />
      <MainTab.Screen name="간병요청" component={CareRequestScreen} />
      <MainTab.Screen name="내간병" component={CareStatusScreen} />
      <MainTab.Screen name="마이페이지" component={MyPageScreen} />
    </MainTab.Navigator>
  );
}

export default function AppNavigator() {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const authenticated = await authService.isAuthenticated();
    setIsAuthenticated(authenticated);
    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#4A90D9" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <RootStack.Screen name="Main" component={MainTabNavigator} />
            <RootStack.Screen
              name="CaregiverList"
              component={CaregiverListScreen}
              options={{
                headerShown: true,
                title: '지원 간병인 목록',
                headerStyle: { backgroundColor: '#4A90D9' },
                headerTintColor: '#FFFFFF',
              }}
            />
            <RootStack.Screen
              name="CareStatus"
              component={CareStatusScreen}
              options={{
                headerShown: true,
                title: '간병 현황',
                headerStyle: { backgroundColor: '#4A90D9' },
                headerTintColor: '#FFFFFF',
              }}
            />
            <RootStack.Screen
              name="Review"
              component={ReviewScreen}
              options={{
                headerShown: true,
                title: '리뷰 작성',
                headerStyle: { backgroundColor: '#4A90D9' },
                headerTintColor: '#FFFFFF',
              }}
            />
            <RootStack.Screen
              name="Payment"
              component={PaymentScreen}
              options={{
                headerShown: true,
                title: '결제',
                headerStyle: { backgroundColor: '#4A90D9' },
                headerTintColor: '#FFFFFF',
              }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
