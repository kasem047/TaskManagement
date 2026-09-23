export type ChartSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
  percent: number;
  dasharray: string;
  offset: number;
};

export const TASK_CHART_COLORS = {
  todo: '#8b95ab',
  progress: '#e8a317',
  partial: '#8a73d8',
  done: '#3d9a6a',
  cancelled: '#d26d87',
  active: '#5d6fe6',
  archived: '#8a73d8',
  owner: '#5d6fe6',
  manager: '#8a73d8',
  member: '#6e7c98'
} as const;

const DONUT_RADIUS = 54;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export function toChartSlices(
  items: { key: string; label: string; value: number; color: string }[]
): ChartSlice[] {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  let offset = 0;

  return items.map(item => {
    const length = total > 0 ? (item.value / total) * DONUT_CIRCUMFERENCE : 0;
    const slice: ChartSlice = {
      ...item,
      percent: total > 0 ? Math.round((item.value / total) * 100) : 0,
      dasharray: `${length} ${DONUT_CIRCUMFERENCE}`,
      offset: -offset
    };

    offset += length;
    return slice;
  });
}

export function chartRate(part: number, total: number): number {
  if (total < 1) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

export function chartBarHeight(value: number, max: number): number {
  return Math.max(8, Math.round((value / Math.max(max, 1)) * 100));
}

export type ProjectProgressItem = {
  name: string;
  total: number;
  done: number;
  rate: number;
};

export type RoleInsights = {
  workspaceCount: number;
  projectCount: number;
  activeProjects: number;
  archivedProjects: number;
  memberCount: number;
  ownerMembers: number;
  managerMembers: number;
  regularMembers: number;
  activeMembers: number;
  inactiveMembers: number;
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  inReviewTasks: number;
  doneTasks: number;
  cancelledTasks: number;
  projectProgress: ProjectProgressItem[];
};

export function taskConicGradient(slices: ChartSlice[]): string {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  if (total < 1) {
    return 'conic-gradient(#2a3144 0 100%)';
  }

  let start = 0;
  const stops = slices.map(slice => {
    const next = start + (slice.value / total) * 100;
    const stop = `${slice.color} ${start}% ${next}%`;
    start = next;
    return stop;
  });

  return `conic-gradient(${stops.join(', ')})`;
}
