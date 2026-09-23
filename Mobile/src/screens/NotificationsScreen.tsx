import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { extractApiError } from '../api/client';
import { notificationsApi } from '../api/services';
import type { NotificationItem } from '../api/types';
import { Banner, Button, Empty, Loader, Screen } from '../components/Ui';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';
import { formatDateTime } from './taskUi';

type ReadFilter = 'all' | 'unread' | 'read';

function sourceLabel(type: string) {
  if (type.startsWith('task.')) {
    return 'المهام';
  }

  if (type.startsWith('workspace.')) {
    return 'مساحة العمل';
  }

  if (type.startsWith('project.')) {
    return 'المشاريع';
  }

  if (type.startsWith('member.')) {
    return 'المكافآت';
  }

  return 'النظام';
}

function displayTitle(item: NotificationItem) {
  switch (item.type) {
    case 'project.manager_assigned':
      return 'تعيينك مديرًا للمشروع';
    case 'project.manager_removed':
      return 'لم تعد مديرًا للمشروع';
    case 'project.manager_required':
      return 'المشروع يحتاج مديرًا جديدًا';
    case 'project.member_added':
      return 'تمت إضافتك إلى مشروع';
    case 'project.member_removed':
      return 'تمت إزالتك من مشروع';
    case 'project.archived':
      return 'تم أرشفة مشروع';
    case 'project.deleted':
      return 'تم حذف مشروع';
    case 'task.assigned':
      return 'تم إسناد مهمة إليك';
    case 'task.unassigned':
      return 'أُلغي إسناد مهمة';
    case 'task.status_changed':
    case 'task.completed':
      return item.type === 'task.completed' ? 'اكتملت مهمة' : 'تغيّرت حالة مهمة';
    case 'task.comment_added':
      return 'تعليق جديد على مهمة';
    case 'workspace.invitation':
    case 'workspace.invitation_received':
      return 'دعوة إلى مساحة عمل';
    case 'member.ontime_reward':
      return 'مكافأة مالية مقترحة';
    default:
      return item.title && /[\u0600-\u06FF]/.test(item.title) ? item.title : item.title || 'إشعار جديد';
  }
}

function displayMessage(item: NotificationItem) {
  if (item.message && /[\u0600-\u06FF]/.test(item.message)) {
    return item.message;
  }

  return item.message || item.title || '';
}

function isSameLocalDay(iso: string, day: Date) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

export function NotificationsScreen() {
  const { colors } = useTheme();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('all');
  const [todayOnly, setTodayOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      setItems(await notificationsApi.getAll());
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

  const unreadCount = items.filter((item) => !item.isRead).length;
  const readCount = items.length - unreadCount;
  const todayCount = items.filter((item) => isSameLocalDay(item.createdAt, new Date())).length;

  const visible = useMemo(() => {
    const now = new Date();

    return items.filter((item) => {
      if (readFilter === 'unread' && item.isRead) {
        return false;
      }

      if (readFilter === 'read' && !item.isRead) {
        return false;
      }

      if (todayOnly && !isSameLocalDay(item.createdAt, now)) {
        return false;
      }

      return true;
    });
  }, [items, readFilter, todayOnly]);

  const markRead = async (item: NotificationItem) => {
    if (item.isRead) {
      return;
    }

    try {
      await notificationsApi.markRead(item.id);
      setItems((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry))
      );
    } catch (caught) {
      setError(extractApiError(caught));
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) {
      return;
    }

    try {
      await notificationsApi.markAllRead();
      setItems((current) => current.map((entry) => ({ ...entry, isRead: true })));
    } catch (caught) {
      setError(extractApiError(caught));
    }
  };

  const filters: { id: string; label: string; count: number; active: boolean; onPress: () => void }[] = [
    { id: 'all', label: 'الكل', count: items.length, active: readFilter === 'all', onPress: () => setReadFilter('all') },
    { id: 'unread', label: 'غير مقروء', count: unreadCount, active: readFilter === 'unread', onPress: () => setReadFilter('unread') },
    { id: 'read', label: 'مقروء', count: readCount, active: readFilter === 'read', onPress: () => setReadFilter('read') },
    { id: 'today', label: 'اليوم', count: todayCount, active: todayOnly, onPress: () => setTodayOnly((value) => !value) }
  ];

  return (
    <Screen
      dense
      title="الإشعارات"
      subtitle={`${unreadCount} غير مقروء · تنبيهات المساحات والمهام`}
      right={
        <Button
          label="تعليم الكل كمقروء"
          size="sm"
          variant="secondary"
          disabled={unreadCount === 0}
          onPress={() => void markAllRead()}
        />
      }
    >
      <Banner text={error} />

      <View style={styles.filters}>
        {filters.map((item) => (
          <Pressable
            key={item.id}
            onPress={item.onPress}
            style={[
              styles.chip,
              {
                backgroundColor: item.active ? colors.primarySoft : colors.surface,
                borderColor: item.active ? colors.primary : colors.border
              }
            ]}
          >
            <Text
              numberOfLines={1}
              style={[styles.chipText, { color: item.active ? colors.primary : colors.textSecondary }]}
            >
              {item.label}
            </Text>
            <Text style={[styles.chipCount, { color: item.active ? colors.primary : colors.textMuted }]}>
              {item.count}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? <Loader /> : null}
      {!loading && items.length === 0 ? <Empty text="لا توجد إشعارات بعد." /> : null}
      {!loading && items.length > 0 && visible.length === 0 ? (
        <Empty text="لا توجد إشعارات مطابقة للفلاتر الحالية." />
      ) : null}

      {visible.map((item) => {
        const unread = !item.isRead;

        return (
          <Pressable
            key={item.id}
            onPress={() => void markRead(item)}
            style={[
              styles.card,
              {
                backgroundColor: unread ? colors.surface2 : colors.surface,
                borderColor: unread ? colors.primary : colors.border
              }
            ]}
          >
            <View
              style={[
                styles.statusBar,
                { backgroundColor: unread ? colors.primary : colors.border }
              ]}
            />
            <View style={styles.cardBody}>
              <View style={styles.cardHead}>
                <View
                  style={[
                    styles.source,
                    { backgroundColor: unread ? colors.primarySoft : colors.surface3 }
                  ]}
                >
                  <Text
                    style={[styles.sourceText, { color: unread ? colors.primary : colors.textMuted }]}
                  >
                    {sourceLabel(item.type)}
                  </Text>
                </View>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {displayTitle(item)}
                </Text>
              </View>
              <Text style={[styles.message, { color: colors.textSecondary }]} numberOfLines={2}>
                {displayMessage(item)}
              </Text>
              <View style={styles.meta}>
                <Text
                  style={[
                    styles.status,
                    { color: unread ? colors.primary : colors.textMuted }
                  ]}
                >
                  {unread ? 'غير مقروء' : 'مقروء'}
                </Text>
                <Text style={[styles.time, { color: colors.textMuted }]}>
                  {formatDateTime(item.createdAt)}
                </Text>
              </View>
            </View>
          </Pressable>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  filters: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    gap: 6
  },
  chip: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 4,
    paddingVertical: 8
  },
  chipText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'center'
  },
  chipCount: {
    fontFamily: fonts.bold,
    fontSize: 11
  },
  card: {
    flexDirection: 'row-reverse',
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
    minHeight: 72
  },
  statusBar: {
    width: 4
  },
  cardBody: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4
  },
  cardHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8
  },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'right'
  },
  source: {
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  sourceText: {
    fontFamily: fonts.bold,
    fontSize: 10
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right'
  },
  meta: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    marginTop: 2
  },
  time: {
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'right'
  },
  status: {
    fontFamily: fonts.semibold,
    fontSize: 11
  }
});
