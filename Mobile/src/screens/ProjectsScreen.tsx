import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { membersApi, projectsApi } from '../api/services';
import type { Project, ProjectMember, WorkspaceMember } from '../api/types';
import { isManagerRole, isOwnerRole, roleLabel, useAccess } from '../access/AccessProvider';
import { FilterSelect } from '../components/FilterSelect';
import { Badge, Banner, Button, Card, Empty, Field, ListRow, Loader, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { ManagedProjectView } from './ManagedProjectView';
import { TaskBoard } from './TaskBoard';

export function ProjectsScreen({
  workspaceId: workspaceIdProp,
  workspaceName: workspaceNameProp
}: {
  workspaceId?: number;
  workspaceName?: string;
} = {}) {
  const route = useRoute<RouteProp<RootStackParamList, 'Projects'>>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const access = useAccess();
  const { colors } = useTheme();
  const workspaceId = workspaceIdProp ?? route.params?.workspaceId;
  const workspaceName = workspaceNameProp ?? route.params?.workspaceName ?? 'مساحة العمل';
  const role = workspaceId ? access.roleIn(workspaceId) : '';
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedId, setSelectedId] = useState(0);
  const [membersById, setMembersById] = useState<Record<number, ProjectMember[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(0);
  const [archiveTarget, setArchiveTarget] = useState<Project | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }

    if (!silent) {
      setLoading(true);
    }

    setError('');

    try {
      const items = await projectsApi.getByWorkspace(workspaceId);
      const visible =
        access.activeRoleMode === 'manager' && access.currentUserId
          ? items.filter((project) => project.managerUserId === access.currentUserId)
          : items;
      setProjects(visible);
      setSelectedId((current) =>
        visible.some((project) => project.id === current) ? current : visible[0]?.id ?? 0
      );

      const memberGroups = await Promise.all(
        visible.map(async (project) => {
          try {
            const members = await projectsApi.getMembers(workspaceId, project.id);
            return [project.id, members] as const;
          } catch {
            return [project.id, [] as ProjectMember[]] as const;
          }
        })
      );

      setMembersById(Object.fromEntries(memberGroups));
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, [access.activeRoleMode, access.currentUserId, workspaceId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const archiveProject = async (project: Project) => {
    if (!workspaceId || busyId === project.id) {
      return;
    }

    setBusyId(project.id);
    setError('');

    try {
      await projectsApi.archive(workspaceId, project.id);
      setProjects((current) =>
        current.map((item) =>
          item.id === project.id ? { ...item, isArchived: true } : item
        )
      );
      setArchiveTarget(null);
      await load(true);
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setBusyId(0);
    }
  };

  const memberPreview = (projectId: number) => {
    const members = membersById[projectId] ?? [];

    if (members.length === 0) {
      return 'لا يوجد أعضاء بعد';
    }

    const names = members.slice(0, 3).map((member) => member.fullName).join('، ');
    return members.length > 3 ? `${names} +${members.length - 3}` : names;
  };

  const selected = projects.find((project) => project.id === selectedId) ?? projects[0];
  const subtitle = isOwnerRole(role)
    ? 'أنشئ المشاريع وعيّن مديريها وأضف أعضاء مساحة العمل إلى كل مشروع.'
    : isManagerRole(role)
      ? `تفاصيل المشروع الذي تديره داخل مساحة ${workspaceName}: الفريق، المهام، وتاريخ العمل.`
      : 'المشاريع التي أنت عضو فيها. المهام تظهر فقط إذا أُسندت باسمك.';

  if (!workspaceId) {
    return (
      <Screen dense title="المشاريع" subtitle="اختر مساحة عمل لعرض مشاريعها.">
        <Empty text="لا توجد مساحة عمل محددة." />
      </Screen>
    );
  }

  if (!loading && isManagerRole(role) && selected) {
    return (
      <ManagedProjectView
        workspaceId={workspaceId}
        workspaceName={workspaceName}
        project={selected}
        header={
          projects.length > 1 ? (
            <ProjectChips
              items={projects.map((project) => ({ id: project.id, name: project.name }))}
              selectedId={selected.id}
              onSelect={setSelectedId}
            />
          ) : null
        }
      />
    );
  }

  return (
    <Screen
      dense
      title={workspaceName}
      subtitle={subtitle}
      right={
        isOwnerRole(role) ? (
          <Button
            label="جديد"
            size="sm"
            icon="add"
            onPress={() => navigation.navigate('CreateProject', { workspaceId })}
          />
        ) : undefined
      }
    >
      <Badge label={roleLabel(role)} />
      <Banner text={error} />
      {loading ? <Loader /> : null}
      {!loading && projects.length === 0 ? (
        <Empty text="لم تتم إضافة مشاريع إلى مساحة العمل هذه بعد." />
      ) : null}
      {projects.map((project) => {
        const owner = isOwnerRole(role);
        const members = membersById[project.id] ?? [];

        return (
          <Card key={project.id} style={styles.projectCard}>
            <View style={styles.projectHead}>
              <Badge
                label={project.isArchived ? 'مؤرشف' : 'نشط'}
                tone={project.isArchived ? 'violet' : 'success'}
              />
              <Text style={[styles.projectName, { color: colors.text }]} numberOfLines={1}>
                {project.name}
              </Text>
            </View>
            <Text style={[styles.projectLead, { color: colors.textSecondary }]} numberOfLines={2}>
              {project.description || 'لا يوجد وصف للمشروع.'}
            </Text>
            <Text style={[styles.projectMeta, { color: colors.textMuted }]} numberOfLines={1}>
              المدير: {project.managerUserFullName || 'بدون مدير'}
            </Text>
            <Text style={[styles.projectMeta, { color: colors.textMuted }]} numberOfLines={2}>
              الأعضاء ({members.length}): {memberPreview(project.id)}
            </Text>
            {project.isArchived ? (
              <Text style={[styles.projectMeta, { color: colors.violet }]}>
                المشروع مؤرشف؛ يمكن استعراض محتواه، لكن تعديله متوقف.
              </Text>
            ) : null}
            <View style={styles.projectActions}>
              {owner ? (
                <Button
                  label="إدارة المشروع"
                  size="sm"
                  style={styles.actionBtn}
                  onPress={() =>
                    navigation.navigate('EditProject', {
                      workspaceId,
                      projectId: project.id
                    })
                  }
                />
              ) : null}
              <Button
                label={owner ? 'المهام' : 'فتح المشروع'}
                size="sm"
                variant={owner ? 'secondary' : 'primary'}
                style={styles.actionBtn}
                onPress={() =>
                  navigation.navigate('Tasks', {
                    workspaceId,
                    projectId: project.id,
                    projectName: project.name
                  })
                }
              />
            </View>
            {owner && !project.isArchived ? (
              <Button
                label={busyId === project.id ? 'جارٍ الأرشفة...' : 'أرشفة المشروع'}
                size="sm"
                variant="secondary"
                disabled={busyId > 0}
                onPress={() => {
                  setError('');
                  setArchiveTarget(project);
                }}
              />
            ) : null}
          </Card>
        );
      })}
      <ConfirmSheet
        visible={archiveTarget !== null}
        title="أرشفة المشروع"
        message={
          archiveTarget
            ? `هل تريد أرشفة المشروع: ${archiveTarget.name}؟ سيبقى للعرض ويتوقف عن استقبال التعديلات.`
            : ''
        }
        confirmLabel={busyId > 0 ? 'جارٍ الأرشفة...' : 'تأكيد الأرشفة'}
        busy={busyId > 0}
        onConfirm={() => {
          if (archiveTarget) {
            void archiveProject(archiveTarget);
          }
        }}
        onClose={() => {
          if (busyId === 0) {
            setArchiveTarget(null);
          }
        }}
      />
    </Screen>
  );
}

export function CreateProjectScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CreateProject'>>();

  return <ProjectFormScreen workspaceId={route.params.workspaceId} />;
}

export function EditProjectScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'EditProject'>>();

  return (
    <ProjectFormScreen workspaceId={route.params.workspaceId} projectId={route.params.projectId} />
  );
}

function ProjectFormScreen({
  workspaceId,
  projectId
}: {
  workspaceId: number;
  projectId?: number;
}) {
  const navigation = useNavigation();
  const { colors } = useTheme();
  const isEdit = Boolean(projectId);
  const [name, setName] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [description, setDescription] = useState('');
  const [managerUserId, setManagerUserId] = useState(0);
  const [managers, setManagers] = useState<WorkspaceMember[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [addUserId, setAddUserId] = useState(0);
  const [openPicker, setOpenPicker] = useState<'manager' | 'member' | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [archived, setArchived] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const eligible = useMemo(() => {
    const added = new Set(projectMembers.map((member) => member.userId));

    return workspaceMembers
      .filter(
        (member) =>
          member.status === 'Active' &&
          member.roleName === 'Member' &&
          !added.has(member.userId)
      )
      .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'));
  }, [projectMembers, workspaceMembers]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError('');

      try {
        const [members, projects, currentMembers] = await Promise.all([
          membersApi.getByWorkspace(workspaceId),
          isEdit ? projectsApi.getByWorkspace(workspaceId) : Promise.resolve([] as Project[]),
          isEdit && projectId
            ? projectsApi.getMembers(workspaceId, projectId)
            : Promise.resolve([] as ProjectMember[])
        ]);

        if (!active) {
          return;
        }

        setWorkspaceMembers(members);
        setManagers(
          members
            .filter((member) => member.status === 'Active' && member.roleName === 'ProjectManager')
            .sort((a, b) => a.fullName.localeCompare(b.fullName, 'ar'))
        );
        setProjectMembers(currentMembers);

        if (isEdit && projectId) {
          const current = projects.find((project) => project.id === projectId);

          if (!current) {
            setError('تعذر تحميل بيانات المشروع.');
            return;
          }

          setName(current.name);
          setOriginalName(current.name);
          setDescription(current.description || '');
          setManagerUserId(current.managerUserId || 0);
          setArchived(current.isArchived);
        }
      } catch (caught) {
        if (active) {
          setError(extractApiError(caught));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [isEdit, projectId, workspaceId]);

  const submit = async () => {
    if (name.trim().length < 2) {
      setError('اسم المشروع يجب أن يتكون من حرفين على الأقل.');
      return;
    }

    if (archived) {
      setError('لا يمكن تعديل مشروع مؤرشف.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const body = {
        name: name.trim(),
        description: description.trim() || null,
        managerUserId: managerUserId > 0 ? managerUserId : null
      };

      if (isEdit && projectId) {
        await projectsApi.update(workspaceId, projectId, body);
        setSuccess('تم حفظ تعديلات المشروع.');
        setOriginalName(body.name);
      } else {
        await projectsApi.create(workspaceId, body);
        navigation.goBack();
      }
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  const addMember = async () => {
    if (!projectId || addUserId < 1) {
      setError('اختر عضوًا من مساحة العمل الحالية لإضافته إلى المشروع.');
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      const member = await projectsApi.addMember(workspaceId, projectId, addUserId);
      setProjectMembers((current) => [...current, member]);
      setAddUserId(0);
      setSuccess(`تمت إضافة ${member.fullName} إلى المشروع.`);
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  const removeMember = async (userId: number) => {
    if (!projectId) {
      return;
    }

    setBusy(true);
    setError('');
    setSuccess('');

    try {
      await projectsApi.removeMember(workspaceId, projectId, userId);
      setProjectMembers((current) => current.filter((member) => member.userId !== userId));
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  const archiveProject = async () => {
    if (!projectId || busy) {
      return;
    }

    setBusy(true);
    setError('');

    try {
      await projectsApi.archive(workspaceId, projectId);
      setArchived(true);
      setArchiveOpen(false);
      navigation.goBack();
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  const deleteProject = async () => {
    if (!projectId) {
      return;
    }

    if (deleteConfirmation.trim() !== originalName) {
      setError('اكتب اسم المشروع كما هو تمامًا لتأكيد الحذف.');
      return;
    }

    setBusy(true);
    setError('');

    try {
      await projectsApi.delete(workspaceId, projectId);
      navigation.goBack();
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      dense
      title={isEdit ? 'إدارة المشروع' : 'مشروع جديد'}
      subtitle={
        isEdit
          ? 'حدّث الاسم والوصف والمدير والأعضاء، أو أرشف المشروع.'
          : 'أنشئ مشروعًا وعيّن مديرًا بدور «مدير مشروع».'
      }
    >
      <Banner text={error} />
      <Banner text={success} kind="success" />
      {loading ? <Loader /> : null}
      {!loading ? (
        <>
          {archived ? (
            <Text style={[styles.help, { color: colors.violet }]}>
              المشروع مؤرشف؛ يمكن استعراض محتواه، لكن تعديله متوقف.
            </Text>
          ) : null}
          <Field
            dense
            label="اسم المشروع"
            value={name}
            onChangeText={setName}
            editable={!archived}
            maxLength={150}
          />
          <Field
            dense
            label="الوصف"
            value={description}
            onChangeText={setDescription}
            editable={!archived}
            multiline
            maxLength={1000}
            style={{ minHeight: 72, textAlignVertical: 'top', paddingVertical: 10 }}
          />
          <FilterSelect
            label="مدير المشروع"
            value={managerUserId}
            options={[
              { value: 0, label: 'بدون مدير حاليًا' },
              ...managers.map((member) => ({
                value: member.userId,
                label: `${member.fullName} — ${member.email}`
              }))
            ]}
            open={openPicker === 'manager'}
            onOpenChange={(open) => setOpenPicker(open && !archived ? 'manager' : null)}
            onChange={setManagerUserId}
          />
          {!archived && managers.length === 0 ? (
            <Text style={[styles.help, { color: colors.textMuted }]}>
              لا يوجد عضو بدور «مدير مشروع» في مساحة العمل حاليًا.
            </Text>
          ) : null}

          {isEdit ? (
            <View style={styles.membersBlock}>
              <Text style={[styles.section, { color: colors.text }]}>أعضاء المشروع</Text>
              <Text style={[styles.help, { color: colors.textMuted }]}>
                يمكن إضافة أعضاء من مساحة العمل الحالية فقط.
              </Text>
              {projectMembers.length === 0 ? (
                <Empty text="لم يُضف أي عضو إلى هذا المشروع بعد." />
              ) : (
                projectMembers.map((member) => (
                  <ListRow
                    key={member.userId}
                    title={member.fullName}
                    subtitle={member.email}
                    trailing={
                      archived ? undefined : (
                        <Button
                          label="إزالة"
                          size="sm"
                          variant="danger"
                          disabled={busy}
                          onPress={() => void removeMember(member.userId)}
                        />
                      )
                    }
                  />
                ))
              )}
              {!archived ? (
                <View style={styles.addMemberBlock}>
                  <FilterSelect
                    label="إضافة عضو"
                    value={addUserId}
                    options={[
                      { value: 0, label: 'اختر عضوًا من مساحة العمل' },
                      ...eligible.map((member) => ({
                        value: member.userId,
                        label: `${member.fullName} — ${member.email}`
                      }))
                    ]}
                    open={openPicker === 'member'}
                    onOpenChange={(open) => setOpenPicker(open ? 'member' : null)}
                    onChange={setAddUserId}
                  />
                  {eligible.length === 0 ? (
                    <Text style={[styles.help, { color: colors.textMuted }]}>
                      لا يوجد أعضاء في مساحة العمل يمكن إضافتهم إلى هذا المشروع.
                    </Text>
                  ) : null}
                  <Button
                    label={busy ? 'جارٍ الإضافة...' : 'إضافة عضو إلى هذا المشروع'}
                    size="sm"
                    variant="secondary"
                    disabled={busy || eligible.length === 0 || addUserId < 1}
                    onPress={() => void addMember()}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          <Button
            label={saving ? 'جارٍ الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إنشاء المشروع'}
            onPress={() => void submit()}
            disabled={saving || archived}
          />

          {isEdit && !archived ? (
            <Button
              label={busy ? 'جارٍ الأرشفة...' : 'أرشفة المشروع'}
              variant="secondary"
              disabled={busy || saving}
              onPress={() => {
                setError('');
                setArchiveOpen(true);
              }}
            />
          ) : null}

          {isEdit ? (
            <>
              <Text style={[styles.section, { color: colors.danger }]}>حذف المشروع</Text>
              <Text style={[styles.help, { color: colors.textMuted }]}>
                اكتب اسم المشروع كما هو تمامًا لتأكيد الحذف.
              </Text>
              <Field
                dense
                label="تأكيد الاسم"
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
              />
              <Button
                label={busy ? 'جارٍ الحذف...' : 'حذف المشروع'}
                variant="danger"
                disabled={busy || saving || deleteConfirmation.trim() !== originalName}
                onPress={() => void deleteProject()}
              />
            </>
          ) : null}
        </>
      ) : null}
      <ConfirmSheet
        visible={archiveOpen}
        title="أرشفة المشروع"
        message={`هل تريد أرشفة المشروع: ${originalName}؟ سيبقى للعرض ويتوقف عن استقبال التعديلات.`}
        confirmLabel={busy ? 'جارٍ الأرشفة...' : 'تأكيد الأرشفة'}
        busy={busy}
        onConfirm={() => void archiveProject()}
        onClose={() => {
          if (!busy) {
            setArchiveOpen(false);
          }
        }}
      />
    </Screen>
  );
}

export function ProjectsEntryScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const access = useAccess();
  const scoped = access.scopedWorkspaces;
  const [targets, setTargets] = useState<
    { workspaceId: number; workspaceName: string; project: Project }[]
  >([]);
  const [selectedId, setSelectedId] = useState(0);
  const [loading, setLoading] = useState(true);
  const subtitle =
    access.activeRoleMode === 'owner'
      ? 'أنشئ المشاريع وعيّن مديريها وأضف الأعضاء إلى كل مشروع.'
      : access.activeRoleMode === 'manager'
        ? 'تفاصيل المشروع الذي تديره: الفريق، المهام، وتاريخ العمل.'
        : 'المشاريع التي أنت عضو فيها.';

  const loadProjects = useCallback(async () => {
    if (access.activeRoleMode !== 'manager') {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const groups = await Promise.all(
        scoped.map(async (workspace) => {
          try {
            const items = await projectsApi.getByWorkspace(workspace.id);
            const visible = access.currentUserId
              ? items.filter((project) => project.managerUserId === access.currentUserId)
              : items;

            return visible.map((project) => ({
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              project
            }));
          } catch {
            return [];
          }
        })
      );

      const next = groups.flat();
      setTargets(next);
      setSelectedId((current) =>
        next.some((item) => item.project.id === current) ? current : next[0]?.project.id ?? 0
      );
    } finally {
      setLoading(false);
    }
  }, [access.activeRoleMode, access.currentUserId, scoped]);

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
    }, [loadProjects])
  );

  if (!access.ready) {
    return <Loader />;
  }

  if (access.activeRoleMode === 'manager') {
    const selected = targets.find((item) => item.project.id === selectedId) ?? targets[0];

    if (loading && targets.length === 0) {
      return <Loader />;
    }

    if (!selected) {
      return (
        <Screen dense title="المشاريع" subtitle={subtitle}>
          <Empty text="لا يوجد مشروع ظاهر ضمن نطاق إدارتك بعد." />
        </Screen>
      );
    }

    return (
      <ManagedProjectView
        key={`${selected.workspaceId}-${selected.project.id}`}
        workspaceId={selected.workspaceId}
        workspaceName={selected.workspaceName}
        project={selected.project}
        header={
          targets.length > 1 ? (
            <ProjectChips
              items={targets.map((item) => ({ id: item.project.id, name: item.project.name }))}
              selectedId={selected.project.id}
              onSelect={setSelectedId}
            />
          ) : null
        }
      />
    );
  }

  if (scoped.length === 1) {
    return (
      <ProjectsScreen workspaceId={scoped[0].id} workspaceName={scoped[0].name} />
    );
  }

  return (
    <WorkspacePickerScreen
      title="المشاريع"
      subtitle={subtitle}
      onPick={(workspaceId, workspaceName) =>
        navigation.navigate('Projects', { workspaceId, workspaceName })
      }
    />
  );
}

export function TasksEntryScreen() {
  const access = useAccess();
  const scoped = access.scopedWorkspaces;
  const [targets, setTargets] = useState<
    { workspaceId: number; workspaceName: string; project: Project }[]
  >([]);
  const [selectedId, setSelectedId] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    setLoading(true);

    try {
      const groups = await Promise.all(
        scoped.map(async (workspace) => {
          try {
            const items = await projectsApi.getByWorkspace(workspace.id);
            const visible =
              access.activeRoleMode === 'manager' && access.currentUserId
                ? items.filter((project) => project.managerUserId === access.currentUserId)
                : items;

            return visible.map((project) => ({
              workspaceId: workspace.id,
              workspaceName: workspace.name,
              project
            }));
          } catch {
            return [];
          }
        })
      );

      const next = groups.flat();
      setTargets(next);
      setSelectedId((current) =>
        next.some((item) => item.project.id === current) ? current : next[0]?.project.id ?? 0
      );
    } finally {
      setLoading(false);
    }
  }, [access.activeRoleMode, access.currentUserId, scoped]);

  useFocusEffect(
    useCallback(() => {
      void loadProjects();
    }, [loadProjects])
  );

  const selected = targets.find((item) => item.project.id === selectedId) ?? targets[0];

  if (loading && targets.length === 0) {
    return <Loader />;
  }

  if (!selected) {
    return (
      <Screen dense title="المهام" subtitle="لا توجد مشاريع ظاهرة لدورك الحالي.">
        <Empty text="لا توجد مهام لعرضها حتى يُنشأ مشروع ضمن نطاقك." />
      </Screen>
    );
  }

  return (
    <TaskBoard
      key={`${selected.workspaceId}-${selected.project.id}`}
      workspaceId={selected.workspaceId}
      projectId={selected.project.id}
      projectName={selected.project.name}
      projects={targets.map((item) => ({
        id: item.project.id,
        name: item.project.name
      }))}
      onSelectProject={setSelectedId}
    />
  );
}

function ConfirmSheet({
  visible,
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onClose
}: {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.sheetMessage, { color: colors.textSecondary }]}>{message}</Text>
          <Button label={confirmLabel} disabled={busy} onPress={onConfirm} />
          <Button label="إلغاء" variant="secondary" disabled={busy} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function ProjectChips({
  items,
  selectedId,
  onSelect
}: {
  items: { id: number; name: string }[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.projectFilters}>
      {items.map((item) => {
        const active = item.id === selectedId;

        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(item.id)}
            style={[
              styles.projectChip,
              {
                backgroundColor: active ? colors.primarySoft : colors.surface,
                borderColor: active ? colors.primary : colors.border
              }
            ]}
          >
            <Text
              style={[
                styles.projectChipText,
                { color: active ? colors.primary : colors.textSecondary }
              ]}
            >
              {item.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WorkspacePickerScreen({
  title,
  subtitle,
  onPick
}: {
  title: string;
  subtitle: string;
  onPick: (workspaceId: number, workspaceName: string) => void;
}) {
  const access = useAccess();

  if (!access.ready) {
    return <Loader />;
  }

  const items = access.scopedWorkspaces;

  return (
    <Screen dense title={title} subtitle={subtitle}>
      {items.length === 0 ? <Empty text="لا توجد مساحات عمل ظاهرة لدورك الحالي." /> : null}
      {items.map((workspace) => (
        <ListRow
          key={workspace.id}
          title={workspace.name}
          subtitle={roleLabel(workspace.currentUserRole)}
          onPress={() => onPick(workspace.id, workspace.name)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  projectCard: {
    gap: 4,
    padding: 10
  },
  projectHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6
  },
  projectName: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'right'
  },
  projectLead: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'right'
  },
  projectMeta: {
    fontFamily: fonts.regular,
    fontSize: 10,
    textAlign: 'right'
  },
  projectActions: {
    flexDirection: 'row-reverse',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    gap: 6,
    marginTop: 2
  },
  actionBtn: {
    flex: 1,
    minWidth: 0
  },
  projectFilters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6
  },
  projectChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  projectChipText: {
    fontFamily: fonts.semibold,
    fontSize: 12
  },
  section: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right',
    marginTop: 8
  },
  help: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right'
  },
  membersBlock: {
    gap: 8
  },
  addMemberBlock: {
    gap: 8
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 18, 0.72)'
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 10
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'right'
  },
  sheetMessage: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right'
  }
});
