import { Pressable, StyleSheet, Text, View } from 'react-native';
import { isManagerRole, isMemberRole, isOwnerRole } from '../access/AccessProvider';
import type { Project, TaskItem, Workspace, WorkspaceMember } from '../api/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export const TASK_CHART_COLORS = {
  todo: '#8b95ab',
  progress: '#e8a317',
  partial: '#8a73d8',
  done: '#3d9a6a',
  cancelled: '#d26d87'
} as const;

export type RoleInsights = {
  workspaceCount: number;
  projectCount: number;
  activeProjects: number;
  archivedProjects: number;
  memberCount: number;
  ownerMembers: number;
  managerMembers: number;
  regularMembers: number;
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  inReviewTasks: number;
  doneTasks: number;
  cancelledTasks: number;
  projectProgress: { name: string; total: number; done: number; rate: number }[];
};

const chartItems = [
  { key: 'todoTasks', label: 'للعمل', color: TASK_CHART_COLORS.todo },
  { key: 'inProgressTasks', label: 'قيد التنفيذ', color: TASK_CHART_COLORS.progress },
  { key: 'inReviewTasks', label: 'جزئيًا', color: TASK_CHART_COLORS.partial },
  { key: 'doneTasks', label: 'مكتملة', color: TASK_CHART_COLORS.done },
  { key: 'cancelledTasks', label: 'ملغاة', color: TASK_CHART_COLORS.cancelled }
] as const;

function rate(part: number, total: number) {
  if (total < 1) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

export function emptyInsights(): RoleInsights {
  return {
    workspaceCount: 0,
    projectCount: 0,
    activeProjects: 0,
    archivedProjects: 0,
    memberCount: 0,
    ownerMembers: 0,
    managerMembers: 0,
    regularMembers: 0,
    totalTasks: 0,
    todoTasks: 0,
    inProgressTasks: 0,
    inReviewTasks: 0,
    doneTasks: 0,
    cancelledTasks: 0,
    projectProgress: []
  };
}

export function buildInsights(input: {
  workspaces: Workspace[];
  projects: { workspaceId: number; project: Project }[];
  tasks: TaskItem[][];
  members: { userId: number; roleName: string; status?: string }[][];
  source: 'workspace' | 'project' | 'assigned';
}): RoleInsights {
  const allTasks = input.tasks.flat();
  const allMembers = input.members.flat();
  const uniqueMembers = new Set(allMembers.map((member) => member.userId));

  if (input.source === 'project') {
    for (const item of input.projects) {
      if (item.project.managerUserId) {
        uniqueMembers.add(item.project.managerUserId);
      }
    }
  }

  return {
    workspaceCount: input.workspaces.length,
    projectCount: input.projects.length,
    activeProjects: input.projects.filter((item) => !item.project.isArchived).length,
    archivedProjects: input.projects.filter((item) => item.project.isArchived).length,
    memberCount: uniqueMembers.size,
    ownerMembers: allMembers.filter((member) => isOwnerRole(member.roleName)).length,
    managerMembers: Math.max(
      allMembers.filter((member) => isManagerRole(member.roleName)).length,
      input.source === 'project' ? input.projects.length : 0
    ),
    regularMembers: allMembers.filter(
      (member) => isMemberRole(member.roleName) || member.roleName === 'Member'
    ).length,
    totalTasks: allTasks.length,
    todoTasks: allTasks.filter((task) => task.status === 'Todo').length,
    inProgressTasks: allTasks.filter((task) => task.status === 'InProgress').length,
    inReviewTasks: allTasks.filter(
      (task) => task.status === 'InReview' || task.status === 'PartiallyCompleted'
    ).length,
    doneTasks: allTasks.filter((task) => task.status === 'Done').length,
    cancelledTasks: allTasks.filter((task) => task.status === 'Cancelled').length,
    projectProgress: input.projects.map((item, index) => {
      const projectTasks = input.tasks[index] ?? [];
      const done = projectTasks.filter((task) => task.status === 'Done').length;

      return {
        name: item.project.name,
        total: projectTasks.length,
        done,
        rate: projectTasks.length > 0 ? Math.round((done / projectTasks.length) * 100) : 0
      };
    })
  };
}

export function RoleInsightsBoard({
  eyebrow,
  heading,
  subtitle,
  insights,
  thirdLabel,
  thirdHint,
  projectsActionLabel,
  showTeamAction,
  showTasksAction,
  onProjects,
  onTasks,
  onTeam
}: {
  eyebrow: string;
  heading: string;
  subtitle: string;
  insights: RoleInsights;
  thirdLabel: string;
  thirdHint: string;
  projectsActionLabel: string;
  showTeamAction?: boolean;
  showTasksAction?: boolean;
  onProjects: () => void;
  onTasks?: () => void;
  onTeam?: () => void;
}) {
  const { colors } = useTheme();
  const maxTaskCount = Math.max(
    insights.todoTasks,
    insights.inProgressTasks,
    insights.inReviewTasks,
    insights.doneTasks,
    insights.cancelledTasks,
    1
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.stats}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>المشاريع</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{insights.projectCount}</Text>
          <Text style={[styles.statHint, { color: colors.textMuted }]}>
            {insights.activeProjects} نشط · {insights.archivedProjects} مؤرشف
          </Text>
          <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
            <View
              style={[
                styles.fill,
                { width: `${rate(insights.activeProjects, insights.projectCount)}%` }
              ]}
            />
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>المهام</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{insights.totalTasks}</Text>
          <Text style={[styles.statHint, { color: colors.textMuted }]}>
            الإنجاز {rate(insights.doneTasks, insights.totalTasks)}%
          </Text>
          <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
            <View
              style={[
                styles.fill,
                { width: `${rate(insights.doneTasks, insights.totalTasks)}%` }
              ]}
            />
          </View>
        </View>

        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{thirdLabel}</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{insights.memberCount}</Text>
          <Text style={[styles.statHint, { color: colors.textMuted }]}>{thirdHint}</Text>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.panelHead}>
          <View style={styles.panelCopy}>
            <Text style={[styles.panelEyebrow, { color: colors.primary }]}>{eyebrow}</Text>
            <Text style={[styles.panelTitle, { color: colors.text }]}>{heading}</Text>
            <Text style={[styles.panelHint, { color: colors.textSecondary }]}>{subtitle}</Text>
          </View>
          <View style={[styles.totalBadge, { backgroundColor: colors.primarySoft }]}>
            <Text style={[styles.totalBadgeText, { color: colors.primary }]}>{insights.totalTasks}</Text>
          </View>
        </View>

        <View style={styles.stack}>
          {chartItems.map((item) => {
            const value = insights[item.key];
            const width = rate(value, insights.totalTasks);

            return (
              <View key={item.key} style={styles.stackRow}>
                <Text style={[styles.stackLabel, { color: colors.textMuted }]}>{item.label}</Text>
                <View style={[styles.stackTrack, { backgroundColor: colors.surface3 }]}>
                  <View
                    style={[
                      styles.stackFill,
                      { width: `${Math.max(width, value > 0 ? 6 : 0)}%`, backgroundColor: item.color }
                    ]}
                  />
                </View>
                <Text style={[styles.stackValue, { color: colors.text }]}>{value}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.chart}>
          {chartItems.map((item) => {
            const value = insights[item.key];
            const height = Math.max(6, Math.round((value / maxTaskCount) * 84));

            return (
              <View key={`bar-${item.key}`} style={styles.chartCol}>
                <Text style={[styles.chartValue, { color: colors.text }]}>{value}</Text>
                <View style={styles.chartBarWrap}>
                  <View style={[styles.chartBar, { height, backgroundColor: item.color }]} />
                </View>
                <Text style={[styles.chartLabel, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {insights.projectProgress.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>تقدم المشاريع</Text>
          {insights.projectProgress.map((item) => (
            <View key={item.name} style={styles.progressRow}>
              <View style={styles.progressCopy}>
                <Text style={[styles.progressName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.progressMeta, { color: colors.textMuted }]}>
                  {item.done} مكتملة من {item.total}
                </Text>
              </View>
              <Text style={[styles.progressRate, { color: colors.primary }]}>{item.rate}%</Text>
              <View style={[styles.track, { backgroundColor: colors.surface3 }]}>
                <View style={[styles.fill, { width: `${item.rate}%` }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={onProjects}
          style={[styles.action, { backgroundColor: colors.primarySoft }]}
        >
          <Text style={[styles.actionText, { color: colors.primary }]}>{projectsActionLabel}</Text>
        </Pressable>
        {showTasksAction && onTasks ? (
          <Pressable
            onPress={onTasks}
            style={[styles.action, { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>المهام</Text>
          </Pressable>
        ) : null}
        {showTeamAction && onTeam ? (
          <Pressable
            onPress={onTeam}
            style={[styles.action, { backgroundColor: colors.surface2, borderColor: colors.border, borderWidth: 1 }]}
          >
            <Text style={[styles.actionText, { color: colors.text }]}>الفريق</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export type LoadedWorkspaceData = {
  workspace: Workspace;
  projects: Project[];
  members: WorkspaceMember[];
  tasksByProject: Record<number, TaskItem[]>;
  projectMembers: Record<number, { userId: number; roleName: string }[]>;
};

const styles = StyleSheet.create({
  wrap: {
    gap: 12
  },
  stats: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  statCard: {
    width: '31%',
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 4
  },
  statLabel: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 20,
    lineHeight: 26,
    textAlign: 'right'
  },
  statHint: {
    fontFamily: fonts.regular,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'right'
  },
  track: {
    height: 5,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4
  },
  fill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#7B5CFF',
    alignSelf: 'flex-end'
  },
  panel: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    gap: 10
  },
  panelHead: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8
  },
  panelCopy: {
    flex: 1,
    gap: 2
  },
  panelEyebrow: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  panelTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right'
  },
  panelHint: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right'
  },
  totalBadge: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10
  },
  totalBadgeText: {
    fontFamily: fonts.bold,
    fontSize: 15
  },
  stack: {
    gap: 8
  },
  stackRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8
  },
  stackLabel: {
    width: 78,
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  stackTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: 'hidden'
  },
  stackFill: {
    height: '100%',
    borderRadius: 999,
    alignSelf: 'flex-end'
  },
  stackValue: {
    width: 28,
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'left'
  },
  chart: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    height: 132,
    gap: 6
  },
  chartCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6
  },
  chartValue: {
    fontFamily: fonts.bold,
    fontSize: 13
  },
  chartBarWrap: {
    height: 84,
    width: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center'
  },
  chartBar: {
    width: '70%',
    maxWidth: 28,
    borderRadius: 10
  },
  chartLabel: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    textAlign: 'center'
  },
  progressRow: {
    gap: 6
  },
  progressCopy: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8
  },
  progressName: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'right'
  },
  progressMeta: {
    fontFamily: fonts.regular,
    fontSize: 12
  },
  progressRate: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'right'
  },
  actions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8
  },
  action: {
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 10
  },
  actionText: {
    fontFamily: fonts.bold,
    fontSize: 13
  }
});

