import { useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { tasksApi } from '../api/services';
import type { TaskAssignee, TaskComment, TaskItem, TaskPriority, TaskStatus } from '../api/types';
import { isManagerRole, isOwnerRole, useAccess } from '../access/AccessProvider';
import { AssigneePicker } from '../components/AssigneePicker';
import { ChoiceRow } from '../components/ChoiceRow';
import { DateTimeField } from '../components/DateTimeField';
import { Banner, Button, Card, Empty, Field, Loader, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import {
  formatDateTime,
  fromDateTimeLocal,
  isOverdue,
  loadAssignableMembers,
  priorityOptions,
  statusColors,
  statusLabel,
  statusOptions,
  toDateTimeLocal,
  type AssignableMember
} from './taskUi';

export function TaskDetailScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'TaskDetail'>>();
  const access = useAccess();
  const { colors } = useTheme();
  const { workspaceId, projectId, taskId } = route.params;
  const role = access.roleIn(workspaceId);
  const ownerView = isOwnerRole(role) || access.activeRoleMode === 'owner';
  const canManage = isManagerRole(role) && !ownerView;
  const [task, setTask] = useState<TaskItem | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [originalDueLocal, setOriginalDueLocal] = useState('');
  const [status, setStatus] = useState<TaskStatus>('Todo');
  const [progress, setProgress] = useState('');
  const [progressNote, setProgressNote] = useState('');
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [error, setError] = useState('');
  const [assigneeError, setAssigneeError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);

    try {
      const [items, nextComments, assignableMembers, nextAssignees] = await Promise.all([
        tasksApi.getByProject(workspaceId, projectId),
        tasksApi.getComments(workspaceId, projectId, taskId),
        loadAssignableMembers(workspaceId, projectId),
        tasksApi.getAssignees(workspaceId, projectId, taskId).catch(() => [] as TaskAssignee[])
      ]);

      const current = items.find((item) => item.id === taskId) ?? null;
      setTask(current);
      setComments(nextComments);
      setMembers(assignableMembers);
      setAssignees(nextAssignees);

      if (current) {
        const localDue = toDateTimeLocal(current.dueDate);
        setTitle(current.title);
        setDescription(current.description || '');
        setPriority(current.priority);
        setDueDate(localDue);
        setOriginalDueLocal(localDue);
        setStatus(
          current.status === 'InReview' ? 'PartiallyCompleted' : (current.status as TaskStatus)
        );
        setProgress(
          current.progressPercentage != null ? String(current.progressPercentage) : ''
        );
        setProgressNote(current.progressNote || '');
      }
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const currentAssignee = assignees[0] ?? null;
  const assignedToMe = currentAssignee?.userId === access.currentUserId;
  const canExecute = !ownerView && (canManage || (role === 'Member' && assignedToMe));
  const canEditDetails = canManage;

  const saveDetails = async () => {
    if (!task) {
      return;
    }

    if (!title.trim()) {
      setError('أدخل عنوان المهمة.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const nextDue =
        dueDate === originalDueLocal ? task.dueDate : fromDateTimeLocal(dueDate);

      const updated = await tasksApi.update(workspaceId, projectId, task.id, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        dueDate: nextDue
      });

      setTask(updated);
      setOriginalDueLocal(toDateTimeLocal(updated.dueDate));
      setDueDate(toDateTimeLocal(updated.dueDate));
      setSuccess('تم حفظ تفاصيل المهمة.');
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = async (nextStatus: TaskStatus) => {
    if (!task) {
      return;
    }

    if (nextStatus !== task.status && assignees.length === 0) {
      setError('يجب إسناد المهمة إلى عضو قبل تغيير حالتها.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const extra =
        nextStatus === 'PartiallyCompleted'
          ? {
              progressPercentage: progress ? Number(progress) : 50,
              progressNote: progressNote.trim() || null
            }
          : undefined;

      const updated = await tasksApi.updateStatus(
        workspaceId,
        projectId,
        task.id,
        nextStatus,
        task.position,
        extra
      );

      setTask(updated);
      setStatus(updated.status === 'InReview' ? 'PartiallyCompleted' : updated.status);
      setSuccess('تم تحديث حالة المهمة.');
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  const addComment = async () => {
    if (!comment.trim()) {
      return;
    }

    try {
      const created = await tasksApi.addComment(workspaceId, projectId, taskId, comment.trim());
      setComments((current) => [...current, created]);
      setComment('');
    } catch (caught) {
      setError(extractApiError(caught));
    }
  };

  const assign = async (member: AssignableMember) => {
    setAssigning(true);
    setAssigneeError('');
    setSuccess('');

    try {
      const created = await tasksApi.assign(workspaceId, projectId, taskId, member.userId);
      setAssignees([created]);
      setSuccess(`تم إسناد المهمة إلى ${member.fullName}.`);
    } catch (caught) {
      setAssigneeError(extractApiError(caught));
    } finally {
      setAssigning(false);
    }
  };

  const unassign = async () => {
    if (!currentAssignee) {
      return;
    }

    setAssigning(true);
    setAssigneeError('');

    try {
      await tasksApi.removeAssignee(workspaceId, projectId, taskId, currentAssignee.userId);
      setAssignees([]);
      setSuccess('تم إلغاء إسناد المهمة.');
    } catch (caught) {
      setAssigneeError(extractApiError(caught));
    } finally {
      setAssigning(false);
    }
  };

  if (loading || !task) {
    return (
      <Screen title="المهمة" dense>
        <Banner text={error} />
        <Loader />
      </Screen>
    );
  }

  const overdue = isOverdue(task.dueDate, status);
  const tone = statusColors[status] ?? statusColors.Todo;

  return (
    <Screen title="تفاصيل المهمة" subtitle={task.title} dense>
      <Banner text={error} />
      <Banner text={success} kind="success" />

      {ownerView ? (
        <Text style={[styles.note, { color: colors.textSecondary }]}>
          المالك يشاهد المهام ولا يعدّلها ولا يسندها من هنا.
        </Text>
      ) : null}

      <View style={styles.summary}>
        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
          <Text style={[styles.badgeText, { color: tone.fg }]}>{statusLabel[status]}</Text>
        </View>
        <Text style={[styles.meta, { color: overdue ? colors.danger : colors.textMuted }]}>
          {overdue ? 'متأخرة · ' : ''}
          {formatDateTime(task.dueDate)}
        </Text>
      </View>

      {canManage || currentAssignee ? (
        <AssigneePicker
          members={members}
          selectedUserId={currentAssignee?.userId}
          selectedName={currentAssignee?.userFullName}
          disabled={!canManage || assigning}
          error={assigneeError}
          onSelect={(member) => void assign(member)}
          onClear={canManage ? () => void unassign() : undefined}
        />
      ) : null}

      <Field dense label="العنوان" value={title} onChangeText={setTitle} editable={canEditDetails} />
      <Field
        dense
        label="الوصف"
        value={description}
        onChangeText={setDescription}
        editable={canEditDetails}
        multiline
        style={{ minHeight: 72, textAlignVertical: 'top', paddingVertical: 10 }}
      />
      <ChoiceRow
        dense
        label="الأولوية"
        value={priority}
        options={priorityOptions}
        onChange={setPriority}
        disabled={!canEditDetails}
      />
      <DateTimeField
        dense
        label="الموعد النهائي"
        value={dueDate}
        onChange={setDueDate}
        disabled={!canEditDetails}
      />
      {canEditDetails ? (
        <Button
          label={saving ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}
          size="sm"
          onPress={() => void saveDetails()}
          disabled={saving}
        />
      ) : null}

      <ChoiceRow
        dense
        label="حالة المهمة"
        value={status}
        options={statusOptions}
        onChange={setStatus}
        disabled={!canExecute}
      />
      {status === 'PartiallyCompleted' && canExecute ? (
        <>
          <Field
            dense
            label="نسبة الإنجاز %"
            value={progress}
            onChangeText={setProgress}
            keyboardType="number-pad"
          />
          <Field dense label="ملاحظة الإنجاز" value={progressNote} onChangeText={setProgressNote} />
        </>
      ) : null}
      {canExecute ? (
        <Button
          label={saving ? 'جارٍ التحديث...' : 'تحديث الحالة'}
          size="sm"
          variant="secondary"
          onPress={() => void saveStatus(status)}
          disabled={saving}
        />
      ) : null}

      <Text style={[styles.section, { color: colors.text }]}>التعليقات</Text>
      {comments.length === 0 ? <Empty text="لا توجد تعليقات بعد." /> : null}
      {comments.map((item) => (
        <Card key={item.id} style={styles.commentCard}>
          <Text style={[styles.commentName, { color: colors.text }]}>{item.userFullName}</Text>
          <Text style={[styles.commentBody, { color: colors.textSecondary }]}>{item.content}</Text>
        </Card>
      ))}
      {canExecute ? (
        <>
          <Field
            dense
            label="تعليق جديد"
            value={comment}
            onChangeText={setComment}
            multiline
            style={{ minHeight: 64, textAlignVertical: 'top', paddingVertical: 10 }}
          />
          <Button label="إرسال التعليق" size="sm" variant="secondary" onPress={() => void addComment()} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  note: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right'
  },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8
  },
  badge: {
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11
  },
  meta: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  section: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right',
    marginTop: 4
  },
  commentCard: {
    padding: 12,
    borderRadius: 14,
    gap: 4
  },
  commentName: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'right'
  },
  commentBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'right'
  }
});
