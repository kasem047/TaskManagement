import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { tasksApi } from '../api/services';
import type { TaskAssignee, TaskItem, TaskStatus } from '../api/types';
import { isManagerRole, isOwnerRole, useAccess } from '../access/AccessProvider';
import { FilterSelect } from '../components/FilterSelect';
import { Banner, Button, Card, Empty, Loader, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import {
  formatDateTime,
  isOverdue,
  normalizeTaskStatus,
  priorityColors,
  priorityLabel,
  statusColors,
  statusLabel,
  statusOptions
} from './taskUi';

type TaskCard = TaskItem & { assignees: TaskAssignee[] };

export function TaskBoard({
  workspaceId,
  projectId,
  projectName,
  projects,
  onSelectProject
}: {
  workspaceId: number;
  projectId: number;
  projectName: string;
  projects?: { id: number; name: string }[];
  onSelectProject?: (projectId: number) => void;
}) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const access = useAccess();
  const { colors } = useTheme();
  const role = access.roleIn(workspaceId);
  const [tasks, setTasks] = useState<TaskCard[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [openFilter, setOpenFilter] = useState<'project' | 'status' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const projectOptions = projects?.length
    ? projects
    : [{ id: projectId, name: projectName }];

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const items = await tasksApi.getByProject(workspaceId, projectId);
      const withAssignees = await Promise.all(
        items.map(async (task) => {
          try {
            const assignees = await tasksApi.getAssignees(workspaceId, projectId, task.id);
            return { ...task, assignees };
          } catch {
            return { ...task, assignees: [] as TaskAssignee[] };
          }
        })
      );

      setTasks(withAssignees);
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId, workspaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const canCreate = isManagerRole(role) && access.activeRoleMode !== 'owner';
  const subtitle =
    isOwnerRole(role) || access.activeRoleMode === 'owner'
      ? 'عرض ومتابعة المهام داخل المشروع.'
      : canCreate
        ? 'أنشئ المهام وأسندها وحدّث حالتها.'
        : 'المهام المسندة باسمك فقط.';

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length };

    for (const option of statusOptions) {
      counts[option.value] = 0;
    }

    for (const task of tasks) {
      const key = normalizeTaskStatus(task.status);
      counts[key] = (counts[key] ?? 0) + 1;
    }

    return counts;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    if (statusFilter === 'all') {
      return tasks;
    }

    return tasks.filter((task) => normalizeTaskStatus(task.status) === statusFilter);
  }, [statusFilter, tasks]);

  const filters: { value: 'all' | TaskStatus; label: string }[] = [
    { value: 'all', label: 'الكل' },
    ...statusOptions
  ];

  return (
    <Screen
      dense
      title={projectName}
      subtitle={subtitle}
      right={
        canCreate ? (
          <Button
            label="جديد"
            size="sm"
            icon="add"
            onPress={() => navigation.navigate('CreateTask', { workspaceId, projectId })}
          />
        ) : undefined
      }
    >
      <Banner text={error} />

      <View style={styles.filterRow}>
        <FilterSelect
          label="المشروع"
          value={projectId}
          style={styles.filterItem}
          options={projectOptions.map((project) => ({
            value: project.id,
            label: project.name
          }))}
          open={openFilter === 'project'}
          onOpenChange={(open) => setOpenFilter(open ? 'project' : null)}
          onChange={(id) => {
            setStatusFilter('all');
            onSelectProject?.(id);
          }}
        />
        <FilterSelect
          label="حالة المهمة"
          value={statusFilter}
          style={styles.filterItem}
          options={filters.map((item) => ({
            value: item.value,
            label: `${item.label} (${statusCounts[item.value] ?? 0})`
          }))}
          open={openFilter === 'status'}
          onOpenChange={(open) => setOpenFilter(open ? 'status' : null)}
          onChange={setStatusFilter}
        />
      </View>

      {loading ? <Loader /> : null}
      {!loading && tasks.length === 0 ? <Empty text="لا توجد مهام في هذا المشروع." /> : null}
      {!loading && tasks.length > 0 && visibleTasks.length === 0 ? (
        <Empty text="لا توجد مهام بهذه الحالة." />
      ) : null}
      {visibleTasks.map((task) => {
        const status = normalizeTaskStatus(task.status);
        const overdue = isOverdue(task.dueDate, status);
        const tone = statusColors[status] ?? statusColors.Todo;
        const priorityTone = priorityColors[task.priority] ?? priorityColors.Medium;
        const assigneeText =
          task.assignees.length === 0
            ? 'غير مسندة'
            : task.assignees.length === 1
              ? task.assignees[0].userFullName
              : `${task.assignees[0].userFullName} +${task.assignees.length - 1}`;

        return (
          <Card
            key={task.id}
            style={styles.taskCard}
            onPress={() =>
              navigation.navigate('TaskDetail', {
                workspaceId,
                projectId,
                taskId: task.id,
                projectName
              })
            }
          >
            <View style={styles.cardHead}>
              <Text style={[styles.taskTitle, { color: colors.text }]} numberOfLines={1}>
                {task.title}
              </Text>
              <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                <Text style={[styles.badgeText, { color: tone.fg }]}>
                  {statusLabel[status] || task.status}
                </Text>
              </View>
            </View>
            <View style={styles.metaRow}>
              <View style={[styles.miniPill, { backgroundColor: priorityTone.bg }]}>
                <Text style={[styles.miniPillText, { color: priorityTone.fg }]}>
                  {priorityLabel[task.priority] || task.priority}
                </Text>
              </View>
              <Text style={[styles.meta, { color: overdue ? colors.danger : colors.textMuted }]}>
                {overdue ? 'متأخرة · ' : ''}
                {formatDateTime(task.dueDate)}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
                {assigneeText}
              </Text>
            </View>
          </Card>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8
  },
  filterItem: {
    flex: 1,
    minWidth: 0
  },
  taskCard: {
    padding: 12,
    borderRadius: 16,
    gap: 8
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  taskTitle: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right'
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 8
  },
  miniPill: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  miniPillText: {
    fontFamily: fonts.bold,
    fontSize: 11
  },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right'
  }
});
