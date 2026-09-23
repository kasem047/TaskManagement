import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useState } from 'react';
import { extractApiError } from '../api/client';
import { tasksApi } from '../api/services';
import type { TaskPriority } from '../api/types';
import { isOwnerRole, useAccess } from '../access/AccessProvider';
import { AssigneePicker } from '../components/AssigneePicker';
import { ChoiceRow } from '../components/ChoiceRow';
import { DateTimeField } from '../components/DateTimeField';
import { Banner, Button, Empty, Field, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import {
  fromDateTimeLocal,
  loadAssignableMembers,
  priorityOptions,
  type AssignableMember
} from './taskUi';
import { TaskBoard } from './TaskBoard';

export function TasksScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Tasks'>>();
  const { workspaceId, projectId, projectName } = route.params;

  return (
    <TaskBoard
      workspaceId={workspaceId}
      projectId={projectId}
      projectName={projectName}
    />
  );
}

export function CreateTaskScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CreateTask'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const access = useAccess();
  const { workspaceId, projectId } = route.params;
  const role = access.roleIn(workspaceId);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('Medium');
  const [dueDate, setDueDate] = useState('');
  const [members, setMembers] = useState<AssignableMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const loadMembers = useCallback(async () => {
    try {
      setMembers(await loadAssignableMembers(workspaceId, projectId));
    } catch {
      setMembers([]);
    }
  }, [projectId, workspaceId]);

  useFocusEffect(
    useCallback(() => {
      void loadMembers();
    }, [loadMembers])
  );

  if (isOwnerRole(role) || access.activeRoleMode === 'owner') {
    return (
      <Screen title="مهمة جديدة" subtitle="إنشاء المهام متاح لمدير المشروع فقط.">
        <Empty text="مالك مساحة العمل لا ينشئ المهام ولا ينفّذها. تابع الحالة من لوحة التحكم." />
      </Screen>
    );
  }

  const selectedMember = members.find((member) => member.userId === selectedUserId);

  const submit = async () => {
    if (!title.trim()) {
      setError('أدخل عنوان المهمة.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const created = await tasksApi.create(workspaceId, projectId, {
        title: title.trim(),
        description: description.trim() || null,
        priority,
        dueDate: fromDateTimeLocal(dueDate)
      });

      if (selectedUserId) {
        await tasksApi.assign(workspaceId, projectId, created.id, selectedUserId);
      }

      navigation.replace('TaskDetail', {
        workspaceId,
        projectId,
        taskId: created.id,
        projectName: created.title
      });
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen dense title="مهمة جديدة" subtitle="أدخل التفاصيل والموعد ثم أسند المهمة لعضو واحد.">
      <Banner text={error} />
      <AssigneePicker
        members={members}
        selectedUserId={selectedUserId}
        selectedName={selectedMember?.fullName}
        onSelect={(member) => setSelectedUserId(member.userId)}
        onClear={() => setSelectedUserId(null)}
      />
      <Field dense label="العنوان" value={title} onChangeText={setTitle} />
      <Field
        dense
        label="الوصف"
        value={description}
        onChangeText={setDescription}
        multiline
        style={{ minHeight: 88, textAlignVertical: 'top', paddingVertical: 10 }}
      />
      <ChoiceRow
        dense
        label="الأولوية"
        value={priority}
        options={priorityOptions}
        onChange={setPriority}
      />
      <DateTimeField dense label="الموعد النهائي" value={dueDate} onChange={setDueDate} />
      <Button
        label={saving ? 'جارٍ الإنشاء...' : 'إنشاء المهمة'}
        onPress={() => void submit()}
        disabled={saving}
      />
    </Screen>
  );
}
