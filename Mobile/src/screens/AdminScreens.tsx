import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { adminApi, workspacesApi } from '../api/services';
import type { AdminUser, Workspace } from '../api/types';
import { useAccess } from '../access/AccessProvider';
import { ChoiceRow } from '../components/ChoiceRow';
import { Badge, Banner, Button, Card, Empty, Field, ListRow, Loader, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

function formatAdminDate(value: string | null | undefined) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleString('ar', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function userTypeLabel(user: AdminUser) {
  switch (user.workspaceRole) {
    case 'SystemAdmin':
      return 'مدير النظام';
    case 'WorkspaceOwner':
      return 'مالك مساحة عمل';
    case 'ProjectManager':
      return 'مدير مشروع';
    case 'Member':
      return 'عضو';
    default:
      return user.isSystemAdmin ? 'مدير النظام' : 'بدون دور';
  }
}

export function CreateWorkspaceScreen() {
  const access = useAccess();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [ownerUserId, setOwnerUserId] = useState(0);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!access.canCreateWorkspace) {
      return;
    }

    void adminApi
      .getUsers()
      .then((items) => {
        const eligible = items.filter((user) => user.isActive && !user.isSystemAdmin && !user.ownsWorkspace);
        setUsers(eligible);
      })
      .catch((caught) => setError(extractApiError(caught)));
  }, [access.canCreateWorkspace]);

  if (!access.canCreateWorkspace) {
    return (
      <Screen dense title="المساحات" subtitle="إنشاء المساحات متاح لمسؤول النظام فقط.">
        <Empty text="لا يمكن إنشاء مساحة عمل من هذا الحساب." />
      </Screen>
    );
  }

  return (
    <Screen dense title="مساحة عمل جديدة" subtitle="عيّن مالكًا لا يملك مساحة أخرى.">
      <Banner text={error} />
      <Field dense label="اسم المساحة" value={name} onChangeText={setName} />
      <Field dense label="الوصف" value={description} onChangeText={setDescription} />
      <Text style={[styles.section, { color: colors.text }]}>المالك</Text>
      {users.length === 0 ? (
        <Empty text="لا يوجد مستخدم نشط يمكنه امتلاك مساحة عمل جديدة." />
      ) : (
        users.map((user) => (
          <ListRow
            key={user.id}
            title={user.fullName}
            subtitle={user.email}
            selected={ownerUserId === user.id}
            onPress={() => setOwnerUserId(user.id)}
          />
        ))
      )}
      <Button
        label={saving ? 'جارٍ الإنشاء...' : 'إنشاء المساحة'}
        disabled={saving}
        onPress={() => {
          if (!name.trim() || ownerUserId < 1) {
            setError('أدخل الاسم واختر مالكًا.');
            return;
          }

          setSaving(true);
          void workspacesApi
            .create({
              name: name.trim(),
              description: description.trim() || null,
              ownerUserId
            })
            .then(async () => {
              await access.refresh();
              navigation.goBack();
            })
            .catch((caught) => setError(extractApiError(caught)))
            .finally(() => setSaving(false));
        }}
      />
    </Screen>
  );
}

export function AdminWorkspacesScreen() {
  const access = useAccess();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [assigningId, setAssigningId] = useState(0);
  const [ownerUserId, setOwnerUserId] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const eligibleOwners = useMemo(
    () => users.filter((user) => user.isActive && !user.isSystemAdmin && !user.ownsWorkspace),
    [users]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const [items, accounts] = await Promise.all([workspacesApi.getAll(), adminApi.getUsers()]);
      setWorkspaces(items);
      setUsers(accounts);
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const transferOwner = async (workspaceId: number) => {
    if (ownerUserId < 1) {
      setError('اختر مالكًا جديدًا للمساحة.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    try {
      await workspacesApi.transferOwnership(workspaceId, ownerUserId);
      setAssigningId(0);
      setOwnerUserId(0);
      setSuccess('تم تعيين مالك مساحة العمل.');
      await access.refresh();
      await load();
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  if (!access.showAdminNav) {
    return (
      <Screen dense title="مساحات العمل" subtitle="إدارة المساحات متاحة لمسؤول النظام فقط.">
        <Empty text="لا يمكن عرض مساحات النظام من هذا الحساب." />
      </Screen>
    );
  }

  return (
    <Screen
      dense
      title="مساحات العمل"
      subtitle="عرض المساحات ومالكيها وإنشاء مساحات جديدة."
      right={
        <Button
          label="جديد"
          size="sm"
          icon="add"
          onPress={() => navigation.navigate('CreateWorkspace')}
        />
      }
    >
      <Banner text={error} />
      <Banner text={success} kind="success" />
      {loading ? <Loader /> : null}
      {!loading && workspaces.length === 0 ? (
        <Empty text="لا توجد مساحات عمل. أنشئ المساحة الأولى وأسندها إلى مستخدم لا يملك مساحة." />
      ) : null}
      {workspaces.map((workspace) => (
        <Card key={workspace.id} style={styles.workspaceCard}>
          <View style={styles.workspaceHead}>
            <View style={[styles.workspaceMark, { backgroundColor: colors.primarySoft }]}>
              <Text style={[styles.workspaceMarkText, { color: colors.primary }]}>
                {workspace.name.trim().charAt(0) || 'م'}
              </Text>
            </View>
            <View style={styles.workspaceCopy}>
              <Text style={[styles.workspaceName, { color: colors.text }]} numberOfLines={1}>
                {workspace.name}
              </Text>
              <Text style={[styles.workspaceLead, { color: colors.textSecondary }]} numberOfLines={2}>
                {workspace.description || 'لا يوجد وصف لمساحة العمل.'}
              </Text>
            </View>
          </View>
          <Text style={[styles.workspaceMeta, { color: colors.textMuted }]}>
            المالك: {workspace.ownerUserName || '—'}
          </Text>
          <Text style={[styles.workspaceMeta, { color: colors.textMuted }]}>
            أُنشئت في {formatAdminDate(workspace.createdAt)}
          </Text>
          {assigningId === workspace.id ? (
            <>
              <Text style={[styles.section, { color: colors.text }]}>تعيين مالك جديد</Text>
              {eligibleOwners.length === 0 ? (
                <Empty text="لا يوجد مستخدم نشط يمكنه امتلاك هذه المساحة." />
              ) : (
                eligibleOwners.map((user) => (
                  <ListRow
                    key={user.id}
                    title={user.fullName}
                    subtitle={user.email}
                    selected={ownerUserId === user.id}
                    onPress={() => setOwnerUserId(user.id)}
                  />
                ))
              )}
              <View style={styles.rowActions}>
                <Button
                  label={saving ? 'جارٍ الحفظ...' : 'حفظ المالك'}
                  size="sm"
                  style={styles.actionBtn}
                  disabled={saving || eligibleOwners.length === 0}
                  onPress={() => void transferOwner(workspace.id)}
                />
                <Button
                  label="إلغاء"
                  size="sm"
                  variant="secondary"
                  style={styles.actionBtn}
                  disabled={saving}
                  onPress={() => {
                    setAssigningId(0);
                    setOwnerUserId(0);
                  }}
                />
              </View>
            </>
          ) : (
            <Button
              label="تعيين مالك"
              size="sm"
              variant="secondary"
              onPress={() => {
                setAssigningId(workspace.id);
                setOwnerUserId(0);
                setError('');
              }}
            />
          )}
        </Card>
      ))}
    </Screen>
  );
}

export function AdminUsersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors } = useTheme();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setUsers(await adminApi.getUsers());
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const toggleStatus = async (user: AdminUser) => {
    setUpdatingId(user.id);
    setError('');
    setSuccess('');

    try {
      const updated = await adminApi.setActiveStatus(user.id, !user.isActive);
      setUsers((current) => current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      setSelected((current) => (current?.id === updated.id ? { ...current, ...updated } : current));
      setSuccess(updated.isActive ? `تم تفعيل ${updated.fullName}.` : `تم تعطيل ${updated.fullName}.`);
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setUpdatingId(0);
    }
  };

  return (
    <Screen
      dense
      title="مستخدمو النظام"
      subtitle="عرض الحسابات وحالتها وإنشاء مستخدمين جدد."
      right={
        <Button
          label="جديد"
          size="sm"
          icon="add"
          onPress={() => navigation.navigate('CreateAdminUser')}
        />
      }
    >
      <Banner text={error} />
      <Banner text={success} kind="success" />
      {loading ? <Loader /> : null}
      {!loading && users.length === 0 ? <Empty text="لا يوجد مستخدمون بعد." /> : null}
      {users.map((user) => (
        <ListRow
          key={user.id}
          title={user.fullName}
          subtitle={`${user.email} · ${userTypeLabel(user)}`}
          onPress={() => {
            setSelected(user);
            setError('');
          }}
          trailing={
            <Badge
              label={user.isActive ? 'نشط' : 'معطل'}
              tone={user.isActive ? 'success' : 'violet'}
            />
          }
        />
      ))}

      <Modal visible={Boolean(selected)} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSelected(null)} />
          {selected ? (
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.modalHead}>
                <View style={styles.workspaceCopy}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{selected.fullName}</Text>
                  <Text style={[styles.workspaceLead, { color: colors.textSecondary }]}>{selected.email}</Text>
                </View>
                <Badge
                  label={selected.isActive ? 'نشط' : 'معطل'}
                  tone={selected.isActive ? 'success' : 'violet'}
                />
              </View>

              <View style={styles.detailsGrid}>
                <DetailItem label="رقم المستخدم" value={String(selected.id)} />
                <DetailItem label="الدور" value={userTypeLabel(selected)} />
                <DetailItem label="وصف المستخدم" value={selected.roleDescription || '—'} wide />
                <DetailItem label="الحالة" value={selected.isActive ? 'نشط' : 'معطل'} />
                <DetailItem label="اسم المستخدم" value={selected.userName || '—'} />
                <DetailItem label="يملك مساحة" value={selected.ownsWorkspace ? 'نعم' : 'لا'} />
                <DetailItem label="تاريخ إنشاء الحساب" value={formatAdminDate(selected.createdAt)} />
                <DetailItem label="آخر تسجيل دخول" value={formatAdminDate(selected.lastLoginAt)} />
              </View>

              <View style={styles.rowActions}>
                {!selected.isSystemAdmin ? (
                  <Button
                    label={
                      updatingId === selected.id
                        ? 'جارٍ الحفظ...'
                        : selected.isActive
                          ? 'تعطيل'
                          : 'تفعيل'
                    }
                    size="sm"
                    variant={selected.isActive ? 'danger' : 'primary'}
                    style={styles.actionBtn}
                    disabled={updatingId === selected.id}
                    onPress={() => void toggleStatus(selected)}
                  />
                ) : null}
                <Button
                  label="إغلاق"
                  size="sm"
                  variant="secondary"
                  style={styles.actionBtn}
                  onPress={() => setSelected(null)}
                />
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </Screen>
  );
}

export function CreateAdminUserScreen() {
  const navigation = useNavigation();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState<'active' | 'inactive'>('active');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (fullName.trim().length < 2) {
      setError('الاسم الكامل يجب أن يتكون من حرفين على الأقل.');
      return;
    }

    if (!email.trim() || !email.includes('@')) {
      setError('أدخل بريدًا إلكترونيًا صحيحًا.');
      return;
    }

    if (password.length < 8 || !/[a-z]/.test(password) || !/\d/.test(password)) {
      setError('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل وتتضمن حرفًا صغيرًا ورقمًا.');
      return;
    }

    if (password !== confirmPassword) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await adminApi.createUser({
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        confirmPassword,
        isActive: isActive === 'active'
      });
      navigation.goBack();
    } catch (caught) {
      setError(extractApiError(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen dense title="مستخدم جديد" subtitle="سيتمكن المستخدم من تسجيل الدخول مباشرة بالبيانات التي تحددها.">
      <Banner text={error} />
      <Field dense label="الاسم الكامل" value={fullName} onChangeText={setFullName} />
      <Field dense label="البريد الإلكتروني" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <Field dense label="كلمة المرور" value={password} onChangeText={setPassword} secureTextEntry />
      <Field
        dense
        label="تأكيد كلمة المرور"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
      />
      <ChoiceRow
        dense
        label="حالة الحساب"
        value={isActive}
        options={[
          { value: 'active', label: 'نشط' },
          { value: 'inactive', label: 'معطل' }
        ]}
        onChange={setIsActive}
      />
      <Button
        label={saving ? 'جارٍ الإنشاء...' : 'إنشاء المستخدم'}
        disabled={saving}
        onPress={() => void submit()}
      />
    </Screen>
  );
}

function DetailItem({
  label,
  value,
  wide
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.detailItem, wide ? styles.detailWide : null, { backgroundColor: colors.surface2 }]}>
      <Text style={[styles.detailLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'right'
  },
  workspaceCard: {
    gap: 6
  },
  workspaceHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10
  },
  workspaceMark: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  workspaceMarkText: {
    fontFamily: fonts.bold,
    fontSize: 15
  },
  workspaceCopy: {
    flex: 1,
    gap: 2
  },
  workspaceName: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right'
  },
  workspaceLead: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right'
  },
  workspaceMeta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'right'
  },
  rowActions: {
    flexDirection: 'row-reverse',
    gap: 8
  },
  actionBtn: {
    flex: 1,
    minWidth: 0
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: 18
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 18, 0.72)'
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    gap: 12,
    maxHeight: '88%'
  },
  modalHead: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    textAlign: 'right'
  },
  detailsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  detailItem: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 12,
    padding: 10,
    gap: 4
  },
  detailWide: {
    width: '100%'
  },
  detailLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  detailValue: {
    fontFamily: fonts.bold,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right'
  }
});
