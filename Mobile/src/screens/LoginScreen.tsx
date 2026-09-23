import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { extractApiError } from '../api/client';
import { authApi } from '../api/services';
import { useAccess } from '../access/AccessProvider';
import { Banner, Button, Field, IconButton, Screen } from '../components/Ui';
import { APP_NAME, APP_TAGLINE } from '../config';
import { getDeviceName, getOrCreateDeviceId, setSession } from '../storage/session';
import { useTheme } from '../theme/ThemeProvider';
import { cardShadow, fonts, gradient, radii, space } from '../theme/tokens';

const logo = require('../../assets/brand/taskmanagement-logo.png');

type Mode = 'login' | 'request' | 'code' | 'reset';

export function LoginScreen() {
  const { colors, toggle, theme } = useTheme();
  const access = useAccess();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [reason, setReason] = useState('');
  const [publicToken, setPublicToken] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const submitLogin = async () => {
    if (!email.trim() || !password) {
      setError('أدخل البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const deviceId = await getOrCreateDeviceId();
      const response = await authApi.login({
        email: email.trim(),
        password,
        deviceId,
        deviceName: getDeviceName()
      });

      await setSession(response.token, {
        userId: response.userId,
        fullName: response.fullName,
        email: response.email,
        expiresAt: response.expiresAt,
        sessionId: response.sessionId
      });

      await access.setAuthenticatedUser({
        userId: response.userId,
        fullName: response.fullName,
        email: response.email,
        expiresAt: response.expiresAt,
        sessionId: response.sessionId
      });
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  };

  const submitRecovery = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const status = await authApi.requestPasswordRecovery({
        accountEmail: email.trim(),
        recoveryEmail: recoveryEmail.trim(),
        reason: reason.trim()
      });

      setPublicToken(status.publicToken);
      setSuccess(status.message || 'تم إرسال طلب استعادة كلمة المرور.');
      setMode(status.canEnterCode ? 'code' : 'request');
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await authApi.verifyRecoveryCode({
        publicToken,
        code: code.trim()
      });

      setResetToken(result.resetToken);
      setMode('reset');
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  };

  const submitReset = async () => {
    setLoading(true);
    setError('');

    try {
      await authApi.resetForgottenPassword({
        publicToken,
        resetToken,
        newPassword,
        confirmNewPassword: confirmPassword
      });

      setSuccess('تم تعيين كلمة المرور. يمكنك تسجيل الدخول الآن.');
      setMode('login');
      setPassword('');
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen>
      <View style={styles.topRow}>
        <IconButton
          icon={theme === 'light' ? 'moon-outline' : 'sunny-outline'}
          label="تغيير المظهر"
          onPress={toggle}
        />
      </View>

      <LinearGradient
        colors={[...gradient.colors]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.logoWrap}>
          <Image source={logo} style={styles.logo} resizeMode="contain" />
        </View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>{APP_NAME}</Text>
          <Text style={styles.brandTag}>{APP_TAGLINE}</Text>
        </View>
      </LinearGradient>

      <View style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }, cardShadow(theme)]}>
        <Text style={[styles.welcome, { color: colors.primary }]}>أهلًا بعودتك</Text>
        <Text style={[styles.heading, { color: colors.text }]}>
          {mode === 'login' ? 'تسجيل الدخول' : 'استعادة كلمة المرور'}
        </Text>
        <Text style={[styles.copy, { color: colors.textSecondary }]}>
          {mode === 'login'
            ? 'أدخل بيانات حسابك للوصول إلى مساحة العمل.'
            : 'اتبع الخطوات لإعادة تعيين كلمة المرور.'}
        </Text>

        <Banner text={error} />
        <Banner text={success} kind="success" />

        {mode === 'login' ? (
          <View style={styles.form}>
            <Field
              label="البريد الإلكتروني"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="name@example.com"
            />
            <Field
              label="كلمة المرور"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
            />
            <Button
              label={loading ? 'جارٍ الدخول...' : 'دخول'}
              icon="log-in-outline"
              onPress={() => void submitLogin()}
              disabled={loading}
            />
            <Pressable onPress={() => { setMode('request'); setError(''); }}>
              <Text style={[styles.link, { color: colors.primary }]}>نسيت كلمة المرور؟</Text>
            </Pressable>
          </View>
        ) : null}

        {mode === 'request' ? (
          <View style={styles.form}>
            <Field label="بريد الحساب" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Field label="بريد الاستعادة" value={recoveryEmail} onChangeText={setRecoveryEmail} autoCapitalize="none" />
            <Field label="السبب" value={reason} onChangeText={setReason} />
            <Button label={loading ? 'جارٍ الإرسال...' : 'إرسال الطلب'} onPress={() => void submitRecovery()} disabled={loading} />
          </View>
        ) : null}

        {mode === 'code' ? (
          <View style={styles.form}>
            <Field label="رمز التحقق" value={code} onChangeText={setCode} />
            <Button label={loading ? 'جارٍ التحقق...' : 'تحقق من الرمز'} onPress={() => void submitCode()} disabled={loading} />
          </View>
        ) : null}

        {mode === 'reset' ? (
          <View style={styles.form}>
            <Field label="كلمة المرور الجديدة" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
            <Field label="تأكيد كلمة المرور" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
            <Button label={loading ? 'جارٍ الحفظ...' : 'تعيين كلمة المرور'} onPress={() => void submitReset()} disabled={loading} />
          </View>
        ) : null}

        {mode !== 'login' ? (
          <Pressable onPress={() => { setMode('login'); setError(''); }}>
            <Text style={[styles.link, { color: colors.primary }]}>العودة لتسجيل الدخول</Text>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topRow: {
    alignItems: 'flex-start'
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingStart: 28,
    paddingEnd: 20,
    minHeight: 84,
    overflow: 'hidden'
  },
  brandCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0
  },
  logoWrap: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0
  },
  logo: {
    width: 56,
    height: 56
  },
  brandName: {
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'right',
    color: '#fff'
  },
  brandTag: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right',
    color: 'rgba(255,255,255,0.78)'
  },
  formCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: space[5],
    gap: space[3]
  },
  welcome: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right'
  },
  heading: {
    fontFamily: fonts.bold,
    fontSize: 26,
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  copy: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  form: {
    gap: space[4],
    marginTop: space[2]
  },
  link: {
    fontFamily: fonts.semibold,
    fontSize: 15,
    textAlign: 'center',
    marginTop: space[1]
  }
});
