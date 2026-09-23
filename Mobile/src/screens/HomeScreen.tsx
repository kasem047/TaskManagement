import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { invitationsApi, membersApi, projectsApi, tasksApi } from '../api/services';
import type { Project, TaskItem, WorkspaceInvitation } from '../api/types';
import {
  dashboardSubtitle,
  roleLabel,
  useAccess
} from '../access/AccessProvider';
import { Icon } from '../components/Icon';
import {
  RoleInsightsBoard,
  buildInsights,
  emptyInsights,
  type RoleInsights
} from '../components/RoleInsightsBoard';
import { RoleSwitcher } from '../components/RoleSwitcher';
import { Banner, Button, Card, Empty, Loader, Screen, SectionTitle } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { AdminHomeDashboard } from './AdminHomeDashboard';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export function HomeScreen() {
  const access = useAccess();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [invitations, setInvitations] = useState<WorkspaceInvitation[]>([]);
  const [insights, setInsights] = useState<RoleInsights>(emptyInsights());
  const [managerProjectName, setManagerProjectName] = useState('');
  const [managerWorkspaceName, setManagerWorkspaceName] = useState('');
  const [memberProjectNames, setMemberProjectNames] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [error, setError] = useState('');
  const [busyInvitationId, setBusyInvitationId] = useState(0);

  const pendingInvitations = invitations.filter((invitation) => invitation.status === 'Pending');
  const firstName = (access.user?.fullName || 'بك').split(' ')[0];
  const scoped = access.scopedWorkspaces;
  const ownerWorkspace = access.ownedWorkspaces[0];

  const loadInvitations = useCallback(async () => {
    try {
      setInvitations(await invitationsApi.getMine());
    } catch {
      setInvitations([]);
    }
  }, []);

  const loadInsights = useCallback(async () => {
    if (access.isSystemAdmin || access.isFreeUser || scoped.length === 0) {
      setInsights(emptyInsights());
      return;
    }

    setLoadingInsights(true);

    try {
      const packs = await Promise.all(
        scoped.map(async (workspace) => {
          const projects = await projectsApi.getByWorkspace(workspace.id).catch(() => [] as Project[]);
          const members = await membersApi.getByWorkspace(workspace.id).catch(() => []);
          const tasks = await Promise.all(
            projects.map((project) =>
              tasksApi.getByProject(workspace.id, project.id).catch(() => [] as TaskItem[])
            )
          );
          const projectMembers = await Promise.all(
            projects.map(async (project) => {
              try {
                const items = await projectsApi.getMembers(workspace.id, project.id);
                return items.map((item) => ({ userId: item.userId, roleName: item.roleName }));
              } catch {
                return [];
              }
            })
          );

          return { workspace, projects, members, tasks, projectMembers };
        })
      );

      const projects = packs.flatMap((pack) =>
        pack.projects.map((project) => ({
          workspaceId: pack.workspace.id,
          project
        }))
      );

      const visibleProjects =
        access.activeRoleMode === 'manager' && access.currentUserId
          ? projects.filter((item) => item.project.managerUserId === access.currentUserId)
          : projects;

      if (access.activeRoleMode === 'manager' && visibleProjects[0]) {
        setManagerProjectName(visibleProjects[0].project.name);
        setManagerWorkspaceName(
          scoped.find((workspace) => workspace.id === visibleProjects[0].workspaceId)?.name || ''
        );
      } else {
        setManagerProjectName('');
        setManagerWorkspaceName('');
      }

      if (access.activeRoleMode === 'member') {
        setMemberProjectNames(visibleProjects.map((item) => item.project.name));
      } else {
        setMemberProjectNames([]);
      }

      const source =
        access.activeRoleMode === 'owner'
          ? 'workspace'
          : access.activeRoleMode === 'manager'
            ? 'project'
            : 'assigned';

      const tasks = visibleProjects.map((item) => {
        const pack = packs.find((entry) => entry.workspace.id === item.workspaceId);
        const index = pack?.projects.findIndex((project) => project.id === item.project.id) ?? -1;
        return pack?.tasks[index] ?? [];
      });

      const memberGroups =
        source === 'workspace'
          ? packs.map((pack) =>
              pack.members.map((member) => ({
                userId: member.userId,
                roleName: member.roleName,
                status: member.status
              }))
            )
          : visibleProjects.map((item) => {
              const pack = packs.find((entry) => entry.workspace.id === item.workspaceId);
              const index = pack?.projects.findIndex((project) => project.id === item.project.id) ?? -1;
              return pack?.projectMembers[index] ?? [];
            });

      setInsights(
        buildInsights({
          workspaces: scoped,
          projects: visibleProjects,
          tasks,
          members: memberGroups,
          source
        })
      );
    } catch {
      setInsights(emptyInsights());
    } finally {
      setLoadingInsights(false);
    }
  }, [access.activeRoleMode, access.currentUserId, access.isFreeUser, access.isSystemAdmin, scoped]);

  useEffect(() => {
    void loadInvitations();
  }, [loadInvitations]);

  useEffect(() => {
    void loadInsights();
  }, [loadInsights]);

  const respond = async (id: number, accept: boolean) => {
    if (busyInvitationId > 0) {
      return;
    }

    setError('');
    setBusyInvitationId(id);

    try {
      if (accept) {
        await invitationsApi.accept(id);
      } else {
        await invitationsApi.reject(id);
      }

      await access.refresh();
      await loadInvitations();
      await loadInsights();
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setBusyInvitationId(0);
    }
  };

  const eyebrow = useMemo(() => {
    if (access.activeRoleMode === 'owner') {
      return 'مالك مساحة العمل';
    }

    if (access.activeRoleMode === 'manager') {
      return 'مدير المشروع';
    }

    if (access.activeRoleMode === 'member') {
      return 'عضو';
    }

    return 'مرحبًا بعودتك';
  }, [access.activeRoleMode]);

  const title = useMemo(() => {
    if (access.activeRoleMode === 'owner') {
      return ownerWorkspace?.name || scoped[0]?.name || firstName;
    }

    if (access.activeRoleMode === 'manager') {
      return managerProjectName || 'مشروعك';
    }

    if (access.activeRoleMode === 'member') {
      return scoped[0]?.name || 'مساحة العمل';
    }

    return firstName;
  }, [
    access.activeRoleMode,
    firstName,
    managerProjectName,
    ownerWorkspace?.name,
    scoped
  ]);

  const subtitle = useMemo(() => {
    if (access.activeRoleMode === 'manager' && managerWorkspaceName) {
      return `ضمن مساحة ${managerWorkspaceName}`;
    }

    if (access.activeRoleMode === 'member' && memberProjectNames.length > 0) {
      return `المشاريع التي أنت ضمنها: ${memberProjectNames.join(' · ')}`;
    }

    return dashboardSubtitle(access);
  }, [access, managerWorkspaceName, memberProjectNames]);

  const openProjects = () => {
    const parent = navigation.getParent() as NativeStackNavigationProp<RootStackParamList> | undefined;

    if (scoped.length === 1 && parent) {
      parent.navigate('Projects', {
        workspaceId: scoped[0].id,
        workspaceName: scoped[0].name
      });
      return;
    }

    navigation.navigate('ProjectsTab' as never);
  };

  const openTasks = () => {
    navigation.navigate('TasksTab' as never);
  };

  const openTeam = () => {
    if (!ownerWorkspace) {
      return;
    }

    const parent = navigation.getParent() as NativeStackNavigationProp<RootStackParamList> | undefined;

    parent?.navigate('Team', {
      workspaceId: ownerWorkspace.id,
      workspaceName: ownerWorkspace.name
    });
  };

  if (!access.ready) {
    return <Loader />;
  }

  if (access.isSystemAdmin) {
    return <AdminHomeDashboard />;
  }

  return (
    <Screen dense>
      <View style={styles.top}>
        <View style={styles.topCopy}>
          <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
          <Text style={[styles.name, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.lead, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            onPress={() => {
              void access.refresh();
              void loadInvitations();
              void loadInsights();
            }}
            style={[styles.roundBtn, { backgroundColor: colors.surface2, borderColor: colors.border }]}
          >
            <Icon name="refresh-outline" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <RoleSwitcher />

      <Banner text={error} />

      {access.isFreeUser ? (
        <Empty text="لا توجد مساحة عمل مرتبطة بحسابك بعد. انتظر دعوة أو إنشاء المساحة من مسؤول النظام." />
      ) : loadingInsights ? (
        <Loader />
      ) : (
        <RoleInsightsBoard
          eyebrow="حالة المهام"
          heading="توزيع سير العمل"
          subtitle="حجم المهام حسب الحالة داخل نطاق دورك الحالي."
          insights={insights}
          thirdLabel={access.activeRoleMode === 'owner' ? 'أعضاء الفريق' : 'أعضاء المشروع'}
          thirdHint={
            access.activeRoleMode === 'owner'
              ? 'مالك ومدير وعضو داخل المساحة'
              : 'ضمن المشاريع الظاهرة لك'
          }
          projectsActionLabel="المشاريع"
          showTeamAction={access.showTeamNav}
          showTasksAction={access.showTasksNav}
          onProjects={openProjects}
          onTasks={openTasks}
          onTeam={openTeam}
        />
      )}

      {pendingInvitations.length > 0 ? (
        <>
          <SectionTitle title="دعوات بانتظارك" />
          {pendingInvitations.map((invitation) => (
            <Card key={invitation.id}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{invitation.workspaceName}</Text>
              <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                الدور: {roleLabel(invitation.roleName)}
              </Text>
              <View style={styles.rowActions}>
                <Button
                  label={busyInvitationId === invitation.id ? 'جارٍ القبول...' : 'قبول'}
                  size="sm"
                  disabled={busyInvitationId > 0}
                  onPress={() => void respond(invitation.id, true)}
                />
                <Button
                  label={busyInvitationId === invitation.id ? 'جارٍ الرفض...' : 'رفض'}
                  size="sm"
                  variant="secondary"
                  disabled={busyInvitationId > 0}
                  onPress={() => void respond(invitation.id, false)}
                />
              </View>
            </Card>
          ))}
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 4
  },
  topCopy: {
    flex: 1,
    gap: 2
  },
  topActions: {
    alignItems: 'flex-end',
    gap: 8
  },
  eyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  name: {
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
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'right'
  },
  cardMeta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right'
  },
  rowActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 4
  }
});
