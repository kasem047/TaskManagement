import { isMemberRole, isOwnerRole } from '../access/AccessProvider';
import { membersApi, projectsApi, tasksApi } from '../api/services';
import type { AssignableMember, TaskPriority, TaskStatus } from '../api/types';

export type { AssignableMember };

export async function loadAssignableMembers(
  workspaceId: number,
  projectId: number
): Promise<AssignableMember[]> {
  try {
    const members = await tasksApi.getAssignableMembers(workspaceId, projectId);

    return members
      .filter((member) => member.userId && !isOwnerRole(member.roleName))
      .sort((left, right) => left.fullName.localeCompare(right.fullName, 'ar'));
  } catch {
    const [projectMembers, workspaceMembers] = await Promise.all([
      projectsApi.getMembers(workspaceId, projectId).catch(() => []),
      membersApi.getByWorkspace(workspaceId).catch(() => [])
    ]);

    const byUserId = new Map<number, AssignableMember>();

    const add = (member: { userId: number; fullName: string; email: string; roleName?: string }) => {
      if (!member.userId || isOwnerRole(member.roleName)) {
        return;
      }

      byUserId.set(member.userId, {
        userId: member.userId,
        fullName: member.fullName,
        email: member.email,
        roleName: member.roleName || 'Member'
      });
    };

    for (const member of projectMembers) {
      add(member);
    }

    for (const member of workspaceMembers) {
      if (member.status && member.status !== 'Active') {
        continue;
      }

      if (isMemberRole(member.roleName) || member.roleName === 'Member') {
        add(member);
      }
    }

    return [...byUserId.values()].sort((left, right) =>
      left.fullName.localeCompare(right.fullName, 'ar')
    );
  }
}

export const statusLabel: Record<string, string> = {
  Todo: 'للتنفيذ',
  InProgress: 'قيد التنفيذ',
  InReview: 'مكتملة جزئيًا',
  PartiallyCompleted: 'مكتملة جزئيًا',
  Done: 'مكتملة',
  Cancelled: 'ملغاة'
};

export const priorityLabel: Record<TaskPriority, string> = {
  Low: 'منخفضة',
  Medium: 'متوسطة',
  High: 'مرتفعة',
  Critical: 'حرجة'
};

export const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'Todo', label: 'للتنفيذ' },
  { value: 'InProgress', label: 'قيد التنفيذ' },
  { value: 'PartiallyCompleted', label: 'مكتملة جزئيًا' },
  { value: 'Done', label: 'مكتملة' },
  { value: 'Cancelled', label: 'ملغاة' }
];

export const priorityOptions: { value: TaskPriority; label: string }[] = [
  { value: 'Low', label: 'منخفضة' },
  { value: 'Medium', label: 'متوسطة' },
  { value: 'High', label: 'مرتفعة' },
  { value: 'Critical', label: 'حرجة' }
];

export function pad(value: number) {
  return String(value).padStart(2, '0');
}

export function toDateTimeLocal(iso: string | null | undefined) {
  if (!iso) {
    return '';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDateTimeLocal(value: string) {
  if (!value.trim()) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function formatDateTime(iso: string | null | undefined, empty = 'بدون موعد') {
  if (!iso) {
    return empty;
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return empty;
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) {
    return '—';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function isOverdue(iso: string | null | undefined, status?: string) {
  if (!iso || status === 'Done' || status === 'Cancelled') {
    return false;
  }

  const date = new Date(iso);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}

export function normalizeTaskStatus(status: string): TaskStatus {
  if (status === 'InReview') {
    return 'PartiallyCompleted';
  }

  return status as TaskStatus;
}

export const statusColors: Record<string, { bg: string; fg: string }> = {
  Todo: { bg: 'rgba(139, 149, 171, 0.18)', fg: '#8b95ab' },
  InProgress: { bg: 'rgba(232, 163, 23, 0.18)', fg: '#e8a317' },
  InReview: { bg: 'rgba(138, 115, 216, 0.18)', fg: '#8a73d8' },
  PartiallyCompleted: { bg: 'rgba(138, 115, 216, 0.18)', fg: '#8a73d8' },
  Done: { bg: 'rgba(61, 154, 106, 0.18)', fg: '#3d9a6a' },
  Cancelled: { bg: 'rgba(210, 109, 135, 0.18)', fg: '#d26d87' }
};

export const priorityColors: Record<TaskPriority, { bg: string; fg: string }> = {
  Low: { bg: 'rgba(139, 149, 171, 0.16)', fg: '#8b95ab' },
  Medium: { bg: 'rgba(93, 111, 230, 0.16)', fg: '#7B5CFF' },
  High: { bg: 'rgba(232, 163, 23, 0.16)', fg: '#e8a317' },
  Critical: { bg: 'rgba(210, 109, 135, 0.16)', fg: '#d26d87' }
};
