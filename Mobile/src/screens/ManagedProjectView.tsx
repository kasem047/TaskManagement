import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { projectsApi, tasksApi } from '../api/services';
import type { Project, ProjectMember, TaskItem } from '../api/types';
import { roleLabel } from '../access/AccessProvider';
import { Banner, Button, Loader, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { formatDate, formatDateTime, normalizeTaskStatus, statusColors } from './taskUi';

type TaskStats = {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  cancelled: number;
  completion: number;
};

const emptyStats: TaskStats = {
  total: 0,
  todo: 0,
  inProgress: 0,
  inReview: 0,
  done: 0,
  cancelled: 0,
  completion: 0
};

function toStats(tasks: TaskItem[]): TaskStats {
  const stats = {
    total: tasks.length,
    todo: tasks.filter((task) => normalizeTaskStatus(task.status) === 'Todo').length,
    inProgress: tasks.filter((task) => normalizeTaskStatus(task.status) === 'InProgress').length,
    inReview: tasks.filter((task) => normalizeTaskStatus(task.status) === 'PartiallyCompleted').length,
    done: tasks.filter((task) => task.status === 'Done').length,
    cancelled: tasks.filter((task) => task.status === 'Cancelled').length,
    completion: 0
  };

  stats.completion = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
  return stats;
}

export function ManagedProjectView({
  workspaceId,
  workspaceName,
  project,
  header
}: {
  workspaceId: number;
  workspaceName: string;
  project: Project;
  header?: ReactNode;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [stats, setStats] = useState<TaskStats>(emptyStats);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [nextMembers, tasks] = await Promise.all([
        projectsApi.getMembers(workspaceId, project.id).catch(() => [] as ProjectMember[]),
        tasksApi.getByProject(workspaceId, project.id).catch(() => [] as TaskItem[])
      ]);

      setMembers(nextMembers);
      setStats(toStats(tasks));
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [project.id, workspaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const meters = useMemo(
    () => [
      { key: 'todo', label: 'للبدء', value: stats.todo, color: statusColors.Todo.fg },
      { key: 'progress', label: 'قيد التنفيذ', value: stats.inProgress, color: statusColors.InProgress.fg },
      { key: 'partial', label: 'مكتملة جزئيًا', value: stats.inReview, color: statusColors.PartiallyCompleted.fg },
      { key: 'done', label: 'مكتملة', value: stats.done, color: statusColors.Done.fg },
      { key: 'cancelled', label: 'ملغاة', value: stats.cancelled, color: statusColors.Cancelled.fg }
    ],
    [stats]
  );

  const percent = (value: number) => (stats.total > 0 ? Math.round((value / stats.total) * 100) : 0);

  return (
    <Screen
      dense
      title={project.name}
      subtitle={`تفاصيل المشروع الذي تديره داخل مساحة ${workspaceName}: الفريق، المهام، وتاريخ العمل.`}
    >
      {header}
      <Banner text={error} />

      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.iconText, { color: colors.primary }]}>
            {project.name.trim().charAt(0)}
          </Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.kicker, { color: colors.primary }]}>المشروع الذي تديره</Text>
          <Text style={[styles.heroTitle, { color: colors.text }]}>{project.name}</Text>
          <Text style={[styles.heroLead, { color: colors.textSecondary }]}>
            {project.description || 'لا يوجد وصف مسجّل لهذا المشروع بعد.'}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: project.isArchived ? colors.violetSoft : colors.successSoft
            }
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              { color: project.isArchived ? colors.violet : colors.success }
            ]}
          >
            {project.isArchived ? 'مؤرشف' : 'نشط'}
          </Text>
        </View>
      </View>

      <View style={styles.kpis}>
        {[
          { label: 'أعضاء المشروع', value: members.length },
          { label: 'مهام المشروع', value: stats.total },
          { label: 'مكتملة', value: stats.done },
          { label: 'قيد التنفيذ', value: stats.inProgress },
          { label: 'نسبة الإنجاز', value: `${stats.completion}%` }
        ].map((item) => (
          <View
            key={item.label}
            style={[styles.kpi, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>{item.label}</Text>
            <Text style={[styles.kpiValue, { color: colors.text }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.facts}>
        {[
          { label: 'مدير المشروع', value: project.managerUserFullName || '—' },
          { label: 'مساحة العمل', value: workspaceName },
          { label: 'الحالة', value: project.isArchived ? 'مؤرشف' : 'نشط' },
          { label: 'أُنشئ في', value: formatDateTime(project.createdAt, '—') },
          { label: 'آخر تحديث', value: formatDateTime(project.updatedAt, '—') },
          { label: 'الوصف', value: project.description ? 'موثّق' : 'غير مضاف' }
        ].map((item) => (
          <View
            key={item.label}
            style={[styles.fact, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={[styles.factLabel, { color: colors.textMuted }]}>{item.label}</Text>
            <Text style={[styles.factValue, { color: colors.text }]}>{item.value}</Text>
          </View>
        ))}
      </View>

      {loading ? <Loader /> : null}

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>فريق المشروع</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              الأعضاء المعيّنون داخل المشروع الذي تديره.
            </Text>
          </View>
          <Text style={[styles.sectionCount, { color: colors.primary }]}>{members.length}</Text>
        </View>
        {members.length === 0 ? (
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
            لم يُضف مالك المساحة أعضاءً إلى هذا المشروع بعد.
          </Text>
        ) : (
          members.map((member) => (
            <View key={member.userId} style={styles.person}>
              <View style={[styles.personMark, { backgroundColor: colors.primarySoft }]}>
                <Text style={[styles.personMarkText, { color: colors.primary }]}>
                  {member.fullName.trim().charAt(0)}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.personName, { color: colors.text }]}>{member.fullName}</Text>
                <Text style={[styles.personMeta, { color: colors.textMuted }]}>{member.email}</Text>
              </View>
              <View>
                <Text style={[styles.personRole, { color: colors.primary }]}>
                  {roleLabel(member.roleName)}
                </Text>
                <Text style={[styles.personMeta, { color: colors.textMuted }]}>
                  انضم {formatDate(member.joinedAt)}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHead}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>حالة المهام</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              توزيع مهام المشروع حسب سير العمل الحالي.
            </Text>
          </View>
          <Text style={[styles.sectionCount, { color: colors.primary }]}>{stats.total}</Text>
        </View>
        {meters.map((item) => (
          <View key={item.key} style={styles.meterRow}>
            <Text style={[styles.meterLabel, { color: colors.textSecondary }]}>{item.label}</Text>
            <View style={[styles.meterTrack, { backgroundColor: colors.surface3 }]}>
              <View
                style={[
                  styles.meterFill,
                  { width: `${percent(item.value)}%`, backgroundColor: item.color }
                ]}
              />
            </View>
            <Text style={[styles.meterValue, { color: colors.text }]}>{item.value}</Text>
          </View>
        ))}
        <View style={styles.completion}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>تقدم الإنجاز</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
              {stats.done} مكتملة من {stats.total}
            </Text>
          </View>
          <Text style={[styles.sectionCount, { color: colors.primary }]}>{stats.completion}%</Text>
        </View>
        <View style={[styles.meterTrack, styles.meterLarge, { backgroundColor: colors.surface3 }]}>
          <View
            style={[
              styles.meterFill,
              { width: `${stats.completion}%`, backgroundColor: statusColors.Done.fg }
            ]}
          />
        </View>
      </View>

      {project.isArchived ? (
        <View style={[styles.section, { backgroundColor: colors.violetSoft, borderColor: colors.border }]}>
          <Text style={[styles.sectionHint, { color: colors.violet }]}>
            المشروع مؤرشف؛ يمكن استعراض محتواه، لكن تعديله متوقف.
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Button
          label="عرض مهام المشروع"
          size="sm"
          icon="arrow-back"
          onPress={() =>
            navigation.navigate('Tasks', {
              workspaceId,
              projectId: project.id,
              projectName: project.name
            })
          }
        />
        <Button
          label="أعضاء المشروع"
          size="sm"
          variant="secondary"
          icon="people-outline"
          onPress={() =>
            navigation.navigate('ProjectMembers', {
              workspaceId,
              projectId: project.id,
              projectName: project.name
            })
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  iconText: {
    fontFamily: fonts.bold,
    fontSize: 18
  },
  heroCopy: {
    flex: 1,
    gap: 2
  },
  kicker: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  heroTitle: {
    fontFamily: fonts.bold,
    fontSize: 20,
    textAlign: 'right'
  },
  heroLead: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right'
  },
  statusBadge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  statusBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 11
  },
  kpis: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  kpi: {
    width: '30%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 4
  },
  kpiLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  kpiValue: {
    fontFamily: fonts.bold,
    fontSize: 18,
    textAlign: 'right'
  },
  facts: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  fact: {
    width: '47%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 4
  },
  factLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  factValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'right'
  },
  section: {
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: 14,
    gap: 10
  },
  sectionHead: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right'
  },
  sectionHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right'
  },
  sectionCount: {
    fontFamily: fonts.bold,
    fontSize: 16
  },
  person: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10
  },
  personMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  personMarkText: {
    fontFamily: fonts.bold,
    fontSize: 13
  },
  personName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'right'
  },
  personMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'right'
  },
  personRole: {
    fontFamily: fonts.bold,
    fontSize: 11,
    textAlign: 'left'
  },
  meterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8
  },
  meterLabel: {
    width: 88,
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  meterTrack: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    overflow: 'hidden'
  },
  meterLarge: {
    height: 10
  },
  meterFill: {
    height: '100%',
    borderRadius: 999,
    alignSelf: 'flex-end'
  },
  meterValue: {
    width: 22,
    fontFamily: fonts.bold,
    fontSize: 12,
    textAlign: 'left'
  },
  completion: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 4
  },
  actions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8
  }
});
