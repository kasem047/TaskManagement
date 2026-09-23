import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { activityApi, invitationsApi, membersApi } from '../api/services';
import type {
  ActivityLog,
  WorkspaceMember,
  WorkspaceMemberCandidate,
  WorkspaceRoleOption
} from '../api/types';
import { isOwnerRole, roleLabel, useAccess } from '../access/AccessProvider';
import { FilterSelect } from '../components/FilterSelect';
import { Badge, Banner, Button, Empty, ListRow, Loader, MenuRow, Screen, SectionTitle } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

type PickerKey = 'user' | 'addRole' | 'editRole' | null;

function isAssignableRole(name: string) {
  return name === 'ProjectManager' || name === 'Member';
}

export function TeamScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Team'>>();
  const access = useAccess();
  const { colors } = useTheme();
  const { workspaceId, workspaceName } = route.params;
  const canManage = isOwnerRole(access.roleIn(workspaceId));
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [roles, setRoles] = useState<WorkspaceRoleOption[]>([]);
  const [candidates, setCandidates] = useState<WorkspaceMemberCandidate[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(0);
  const [selectedRoleId, setSelectedRoleId] = useState(0);
  const [editingMemberId, setEditingMemberId] = useState(0);
  const [editingRoleId, setEditingRoleId] = useState(0);
  const [openPicker, setOpenPicker] = useState<PickerKey>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const assignableRoles = useMemo(
    () =>
      roles
        .filter((role) => isAssignableRole(role.name))
        .sort((a, b) => (a.name === 'ProjectManager' ? -1 : 1)),
    [roles]
  );

  const roleOptions = useMemo(
    () =>
      assignableRoles.map((role) => ({
        value: role.id,
        label: roleLabel(role.name)
      })),
    [assignableRoles]
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    setError('');

    try {
      const [nextMembers, nextRoles, nextCandidates] = await Promise.all([
        membersApi.getByWorkspace(workspaceId),
        canManage ? membersApi.getRoles(workspaceId) : Promise.resolve([] as WorkspaceRoleOption[]),
        canManage
          ? membersApi.getCandidates(workspaceId)
          : Promise.resolve([] as WorkspaceMemberCandidate[])
      ]);

      setMembers(nextMembers);
      setRoles(nextRoles);
      setCandidates(
        [...nextCandidates].sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'))
      );

      const defaultRoleId =
        nextRoles.find((role) => role.name === 'Member')?.id ??
        nextRoles.find((role) => isAssignableRole(role.name))?.id ??
        0;
      setSelectedRoleId((current) =>
        nextRoles.some((role) => role.id === current && isAssignableRole(role.name))
          ? current
          : defaultRoleId
      );
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [canManage, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const editingMember = members.find((member) => member.id === editingMemberId);

  const addMember = async () => {
    const selectedRole = assignableRoles.find((role) => role.id === selectedRoleId);

    if (selectedUserId < 1) {
      setError('اختر مستخدمًا من القائمة.');
      return;
    }

    if (!selectedRole) {
      setError('اختر الدور: عضو أو مدير مشروع.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const result = await invitationsApi.create(workspaceId, {
        userId: selectedUserId,
        roleId: selectedRole.id
      });
      const name =
        result.member?.fullName ||
        result.invitation?.invitedUserFullName ||
        candidates.find((item) => item.userId === selectedUserId)?.fullName ||
        'المستخدم';

      setSelectedUserId(0);
      setEditingMemberId(0);
      await load(true);
      setSuccess(
        result.addedDirectly
          ? `تمت إضافة ${name} بدور ${roleLabel(selectedRole.name)}.`
          : `تم إرسال دعوة إلى ${name} بدور ${roleLabel(selectedRole.name)}.`
      );
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  const saveRole = async () => {
    if (!editingMember || editingRoleId < 1 || editingRoleId === editingMember.roleId) {
      return;
    }

    const selectedRole = assignableRoles.find((role) => role.id === editingRoleId);

    if (!selectedRole) {
      setError('الدور المحدد غير مسموح به.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const updated = await membersApi.updateRole(workspaceId, editingMember.id, selectedRole.id);
      setMembers((current) =>
        current.map((member) => (member.id === updated.id ? updated : member))
      );
      setEditingMemberId(0);
      setSuccess(`تم تغيير دور ${updated.fullName} إلى ${roleLabel(updated.roleName)}.`);
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen dense title="الفريق" subtitle={`أعضاء ${workspaceName}`}>
      <Banner text={error} />
      <Banner text={success} kind="success" />
      {loading ? <Loader /> : null}

      {members.length === 0 && !loading ? <Empty text="لا يوجد أعضاء في هذه المساحة بعد." /> : null}

      {members.map((member) => {
        const owner = isOwnerRole(member.roleName);
        const selected = editingMemberId === member.id;

        return (
          <ListRow
            key={member.id}
            title={member.fullName}
            subtitle={member.email}
            selected={selected}
            onPress={
              canManage && !owner
                ? () => {
                    setSuccess('');
                    setError('');
                    setOpenPicker(null);
                    if (selected) {
                      setEditingMemberId(0);
                      return;
                    }

                    setEditingMemberId(member.id);
                    setEditingRoleId(member.roleId);
                  }
                : undefined
            }
            trailing={
              <Badge
                label={roleLabel(member.roleName)}
                tone={owner ? 'violet' : member.roleName === 'ProjectManager' ? 'primary' : 'success'}
              />
            }
          />
        );
      })}

      {canManage && editingMember ? (
        <View style={styles.block}>
          <SectionTitle title={`تعديل دور ${editingMember.fullName}`} />
          <FilterSelect
            label="الدور"
            value={editingRoleId}
            options={roleOptions}
            open={openPicker === 'editRole'}
            onOpenChange={(open) => setOpenPicker(open ? 'editRole' : null)}
            onChange={setEditingRoleId}
          />
          <Button
            label={saving ? 'جارٍ الحفظ...' : 'حفظ الدور'}
            size="sm"
            disabled={saving || editingRoleId === editingMember.roleId}
            onPress={() => void saveRole()}
          />
        </View>
      ) : null}

      {canManage ? (
        <View style={styles.block}>
          <SectionTitle title="إضافة إلى الفريق" />
          <Text style={[styles.help, { color: colors.textMuted }]}>
            اختر مستخدمًا متاحًا ثم عيّنه عضوًا أو مدير مشروع. يمكنك تغيير الدور لاحقًا من بطاقة العضو.
          </Text>
          <FilterSelect
            label="المستخدم"
            value={selectedUserId}
            options={[
              { value: 0, label: 'اختر مستخدمًا متاحًا' },
              ...candidates.map((user) => ({
                value: user.userId,
                label: `${user.fullName} — ${user.email}`
              }))
            ]}
            open={openPicker === 'user'}
            onOpenChange={(open) => setOpenPicker(open ? 'user' : null)}
            onChange={setSelectedUserId}
          />
          {candidates.length === 0 ? (
            <Text style={[styles.help, { color: colors.textMuted }]}>
              لا يوجد مستخدمون متاحون للإضافة حاليًا.
            </Text>
          ) : null}
          <FilterSelect
            label="الدور"
            value={selectedRoleId}
            options={[{ value: 0, label: 'اختر الدور' }, ...roleOptions]}
            open={openPicker === 'addRole'}
            onOpenChange={(open) => setOpenPicker(open ? 'addRole' : null)}
            onChange={setSelectedRoleId}
          />
          <Button
            label={saving ? 'جارٍ الإضافة...' : 'إضافة إلى الفريق'}
            size="sm"
            disabled={saving || selectedUserId < 1 || selectedRoleId < 1 || candidates.length === 0}
            onPress={() => void addMember()}
          />
        </View>
      ) : (
        <Empty text="تعديل أعضاء المساحة متاح لمالك مساحة العمل فقط." />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
    marginTop: 4
  },
  help: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 18
  }
});

export function ActivityHubScreen() {
  const access = useAccess();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const scoped = access.scopedWorkspaces;

  return (
    <Screen dense title="النشاط" subtitle="سجل العمليات حسب دورك الحالي.">
      {scoped.length === 0 ? (
        <Empty text="لا توجد مساحات عمل لعرض نشاطها." />
      ) : (
        scoped.map((workspace) => (
          <MenuRow
            key={workspace.id}
            title={workspace.name}
            subtitle={roleLabel(workspace.currentUserRole)}
            icon="time-outline"
            onPress={() =>
              navigation.navigate('Activity', {
                workspaceId: workspace.id,
                workspaceName: workspace.name
              })
            }
          />
        ))
      )}
    </Screen>
  );
}

export function ActivityScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'Activity'>>();
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void activityApi
      .getByWorkspace(route.params.workspaceId)
      .then(setItems)
      .catch((caught) => setError(extractApiError(caught)))
      .finally(() => setLoading(false));
  }, [route.params.workspaceId]);

  return (
    <Screen dense title="سجل النشاط" subtitle={route.params.workspaceName}>
      <Banner text={error} />
      {loading ? <Loader /> : null}
      {items.map((item) => (
        <ListRow key={item.id} title={item.userFullName} subtitle={item.description || item.action} />
      ))}
    </Screen>
  );
}
