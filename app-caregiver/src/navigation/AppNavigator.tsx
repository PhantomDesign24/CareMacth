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
import JobListScreen from '../screens/JobListScreen';
import WorkScreen from '../screens/WorkScreen';
import MyPageScreen from '../screens/MyPageScreen';
import EarningsScreen from '../screens/EarningsScreen';
import EducationScreen from '../screens/EducationScreen';

export type AuthStackParamList = {
  Login: undefined;
  Register: undefined;
};

export type MainTabParamList = {
  홈: undefined;
  공고: undefined;
  근무: undefined;
  마이페이지: undefined;
};

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Earnings: undefined;
  Education: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
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
            case '공고':
              iconName = focused ? 'briefcase' : 'briefcase-outline';
              break;
            case '근무':
              iconName = focused ? 'clipboard' : 'clipboard-outline';
              break;
            case '마이페이지':
              iconName = focused ? 'person' : 'person-outline';
              break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2ECC71',
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
          backgroundColor: '#2ECC71',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
      })}
    >
      <MainTab.Screen name="홈" component={HomeScreen} />
      <MainTab.Screen name="공고" component={JobListScreen} />
      <MainTab.Screen name="근무" component={WorkScreen} />
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
        <ActivityIndicator size="large" color="#2ECC71" />
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
              name="Earnings"
              component={EarningsScreen}
              options={{
                headerShown: true,
                title: '수익 관리',
                headerStyle: { backgroundColor: '#2ECC71' },
                headerTintColor: '#FFFFFF',
              }}
            />
            <RootStack.Screen
              name="Education"
              component={EducationScreen}
              options={{
                headerShown: true,
                title: '간병 교육',
                headerStyle: { backgroundColor: '#2ECC71' },
                headerTintColor: '#FFFFFF',
              }}
            />
          </>
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
