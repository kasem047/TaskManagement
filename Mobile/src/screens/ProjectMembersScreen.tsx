import { useRoute, type RouteProp } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { extractApiError } from '../api/client';
import { membersApi, projectsApi } from '../api/services';
import type { ProjectMember, WorkspaceMember } from '../api/types';
import { isOwnerRole, roleLabel, useAccess } from '../access/AccessProvider';
import { Banner, Button, Empty, ListRow, Loader, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export function ProjectMembersScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'ProjectMembers'>>();
  const access = useAccess();
  const { colors } = useTheme();
  const { workspaceId, projectId, projectName } = route.params;
  const canAdd = isOwnerRole(access.roleIn(workspaceId));
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [selectedUserId, setSelectedUserId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [projectMembers, spaceMembers] = await Promise.all([
        projectsApi.getMembers(workspaceId, projectId),
        canAdd ? membersApi.getByWorkspace(workspaceId) : Promise.resolve([])
      ]);

      setMembers(projectMembers);
      setWorkspaceMembers(spaceMembers);
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [canAdd, projectId, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const eligible = useMemo(() => {
    const added = new Set(members.map((member) => member.userId));

    return workspaceMembers.filter(
      (member) =>
        member.status === 'Active' &&
        member.roleName === 'Member' &&
        !added.has(member.userId)
    );
  }, [members, workspaceMembers]);

  const addMember = async () => {
    const userId = selectedUserId || eligible[0]?.userId || 0;

    if (userId < 1) {
      setError('اختر عضوًا من مساحة العمل الحالية لإضافته إلى المشروع.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const member = await projectsApi.addMember(workspaceId, projectId, userId);
      setMembers((current) => [...current, member]);
      setSelectedUserId(0);
      setSuccess(`تمت إضافة ${member.fullName} إلى المشروع.`);
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  const removeMember = async (userId: number) => {
    setSaving(true);
    setError('');

    try {
      await projectsApi.removeMember(workspaceId, projectId, userId);
      setMembers((current) => current.filter((member) => member.userId !== userId));
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen dense title="أعضاء المشروع" subtitle={`الأعضاء داخل ${projectName} من مساحة العمل الحالية فقط.`}>
      <Banner text={error} />
      <Banner text={success} kind="success" />
      {loading ? <Loader /> : null}
      {!loading && members.length === 0 ? <Empty text="لم يُضف أي عضو إلى هذا المشروع بعد." /> : null}
      {members.map((member) => (
        <ListRow
          key={member.userId}
          title={member.fullName}
          subtitle={`${member.email} · ${roleLabel(member.roleName)}`}
          trailing={
            canAdd ? (
              <Button
                label="إزالة"
                size="sm"
                variant="danger"
                disabled={saving}
                onPress={() => void removeMember(member.userId)}
              />
            ) : undefined
          }
        />
      ))}

      {canAdd ? (
        <>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            يمكن إضافة أعضاء من مساحة العمل الحالية فقط.
          </Text>
          {eligible.length === 0 ? (
            <Empty text="لا يوجد أعضاء في مساحة العمل يمكن إضافتهم إلى هذا المشروع." />
          ) : (
            eligible.map((member) => (
              <ListRow
                key={member.userId}
                title={member.fullName}
                subtitle={member.email}
                selected={selectedUserId === member.userId}
                onPress={() => setSelectedUserId(member.userId)}
              />
            ))
          )}
          <Button
            label={saving ? 'جارٍ الإضافة...' : 'إضافة عضو إلى هذا المشروع'}
            size="sm"
            disabled={saving || eligible.length === 0}
            onPress={() => void addMember()}
          />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right'
  }
});
