import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { adminApi } from '../api/services';
import type { AdminDashboard } from '../api/types';
import { Icon } from '../components/Icon';
import { Banner, Loader, MenuRow, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

const chartItems = [
  { key: 'todoTasks', label: 'للعمل', color: '#8B8BA3' },
  { key: 'inProgressTasks', label: 'قيد التنفيذ', color: '#FBBF24' },
  { key: 'inReviewTasks', label: 'جزئيًا', color: '#7B5CFF' },
  { key: 'doneTasks', label: 'مكتملة', color: '#4ADE80' },
  { key: 'cancelledTasks', label: 'ملغاة', color: '#F87171' }
] as const;

function rate(part: number, total: number) {
  if (total < 1) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

export function AdminHomeDashboard() {
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setDashboard(await adminApi.getDashboard());
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const maxTaskCount = useMemo(() => {
    if (!dashboard) {
      return 1;
    }

    return Math.max(
      dashboard.todoTasks,
      dashboard.inProgressTasks,
      dashboard.inReviewTasks,
      dashboard.doneTasks,
      dashboard.cancelledTasks,
      1
    );
  }, [dashboard]);

  if (loading && !dashboard) {
    return <Loader />;
  }

  return (
    <Screen dense>
      <View style={styles.top}>
        <View style={styles.topCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>إدارة النظام</Text>
          <Text style={[styles.title, { color: colors.text }]}>لوحة تحكم المسؤول</Text>
          <Text style={[styles.lead, { color: colors.textSecondary }]}>
            نظرة شاملة على المستخدمين ومساحات العمل والمشاريع والمهام.
          </Text>
        </View>
        <Pressable
          onPress={() => void loadDashboard()}
          style={[styles.roundBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
        >
          <Icon name="refresh-outline" size={20} color={colors.text} />
        </Pressable>
      </View>

      <Banner text={error} />

      {dashboard ? (
        <>
          <View style={styles.stats}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>المستخدمون</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{dashboard.totalUsers}</Text>
              <Text style={[styles.statHint, { color: colors.textMuted }]}>
                {dashboard.activeUsers} نشط · {dashboard.inactiveUsers} غير نشط
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.surface3 }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${rate(dashboard.activeUsers, dashboard.totalUsers)}%` }
                  ]}
                />
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>مساحات العمل</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{dashboard.totalWorkspaces}</Text>
              <Text style={[styles.statHint, { color: colors.textMuted }]}>
                إجمالي المساحات المسجلة في النظام
              </Text>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>المشاريع</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{dashboard.totalProjects}</Text>
              <Text style={[styles.statHint, { color: colors.textMuted }]}>
                {dashboard.activeProjects} نشط · {dashboard.archivedProjects} مؤرشف
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.surface3 }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${rate(dashboard.activeProjects, dashboard.totalProjects)}%` }
                  ]}
                />
              </View>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>المهام</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{dashboard.totalTasks}</Text>
              <Text style={[styles.statHint, { color: colors.textMuted }]}>
                الإنجاز {rate(dashboard.doneTasks, dashboard.totalTasks)}%
              </Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.surface3 }]}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${rate(dashboard.doneTasks, dashboard.totalTasks)}%` }
                  ]}
                />
              </View>
            </View>
          </View>

          <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.panelHead}>
              <View style={styles.panelCopy}>
                <Text style={[styles.panelEyebrow, { color: colors.primary }]}>حالة المهام</Text>
                <Text style={[styles.panelTitle, { color: colors.text }]}>توزيع سير العمل</Text>
              </View>
              <View style={[styles.totalBadge, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.totalBadgeText, { color: colors.primary }]}>{dashboard.totalTasks}</Text>
              </View>
            </View>

            <View style={styles.chart}>
              {chartItems.map((item) => {
                const value = dashboard[item.key];
                const height = Math.max(6, Math.round((value / maxTaskCount) * 84));

                return (
                  <View key={item.key} style={styles.chartCol}>
                    <Text style={[styles.chartValue, { color: colors.text }]}>{value}</Text>
                    <View style={styles.chartBarWrap}>
                      <View style={[styles.chartBar, { height, backgroundColor: item.color }]} />
                    </View>
                    <Text style={[styles.chartLabel, { color: colors.textMuted }]}>{item.label}</Text>
                  </View>
                );
              })}
            </View>

            <View style={styles.statusGrid}>
              {chartItems.map((item) => (
                <View key={`status-${item.key}`} style={[styles.statusCard, { backgroundColor: colors.surface2 }]}>
                  <View style={[styles.statusDot, { backgroundColor: item.color }]} />
                  <Text style={[styles.statusLabel, { color: colors.textMuted }]}>{item.label}</Text>
                  <Text style={[styles.statusValue, { color: colors.text }]}>{dashboard[item.key]}</Text>
                </View>
              ))}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>إجراءات سريعة</Text>
          <MenuRow
            title="إدارة المستخدمين"
            subtitle="الحسابات وحالات المستخدمين"
            icon="people-outline"
            onPress={() => navigation.navigate('AdminUsers')}
          />
          <MenuRow
            title="مساحات العمل"
            subtitle="عرض المساحات ومالكيها وإنشاء مساحات جديدة"
            icon="briefcase-outline"
            onPress={() => navigation.navigate('AdminWorkspaces')}
          />
          <MenuRow
            title="مساحة عمل جديدة"
            subtitle="إنشاء مساحة وتعيين مالك"
            icon="grid-outline"
            onPress={() => navigation.navigate('CreateWorkspace')}
          />
          <MenuRow
            title="الحساب"
            subtitle="الاسم وكلمة المرور والجلسات"
            icon="person-circle-outline"
            onPress={() => navigation.navigate('Account')}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10
  },
  topCopy: {
    flex: 1,
    gap: 2
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  title: {
    fontFamily: fonts.bold,
    fontSize: 22,
    lineHeight: 30,
    textAlign: 'right'
  },
  lead: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right'
  },
  roundBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  stats: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  statCard: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 4
  },
  statLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'right'
  },
  statHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right'
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#7B5CFF',
    alignSelf: 'flex-end'
  },
  panel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 12
  },
  panelHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10
  },
  panelCopy: {
    flex: 1,
    gap: 2
  },
  panelEyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  panelTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right'
  },
  totalBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  totalBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 15
  },
  chart: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    height: 132,
    gap: 6
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6
  },
  chartValue: {
    fontFamily: fonts.bold,
    fontSize: 13
  },
  chartBarWrap: {
    height: 84,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  chartBar: {
    width: '70%',
    maxWidth: 28,
    borderRadius: 10
  },
  chartLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    textAlign: 'center'
  },
  statusGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  statusCard: {
    width: '30%',
    flexGrow: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 4
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999
  },
  statusLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center'
  },
  statusValue: {
    fontFamily: fonts.bold,
    fontSize: 16
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right',
    marginTop: 2
  }
});
