import { useFonts } from 'expo-font';
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessProvider } from './src/access/AccessProvider';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  document.documentElement.dir = 'rtl';
  document.documentElement.lang = 'ar';
}

function ThemedApp() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold
  });

  useEffect(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    const style = document.createElement('style');
    style.textContent = `
      html, body, #root {
        min-height: 100%;
        direction: rtl;
        background: #0D0D17;
      }
      * {
        font-family: IBMPlexSansArabic_400Regular, "IBM Plex Sans Arabic", "Segoe UI", Tahoma, sans-serif;
        box-sizing: border-box;
      }
      textarea, input, button {
        font-family: inherit;
        outline: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AccessProvider>
          <ThemedApp />
        </AccessProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
