import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  ChartSlice,
  RoleInsights,
  TASK_CHART_COLORS,
  chartBarHeight,
  chartRate,
  taskConicGradient,
  toChartSlices
} from '../chart-slices';

@Component({
  selector: 'app-role-insights-board',
  templateUrl: './role-insights-board.html',
  styleUrl: './role-insights-board.scss'
})
export class RoleInsightsBoard {
  @Input() eyebrow = '';
  @Input({ required: true }) heading = '';
  @Input() subtitle = '';
  @Input({ required: true }) insights!: RoleInsights;
  @Input({ required: true }) taskSlices: ChartSlice[] = [];
  @Input() variant: 'owner' | 'manager' | 'member' = 'owner';
  @Input() projectsCaption = 'المشاريع';
  @Input() thirdLabel = 'أعضاء الفريق';
  @Input() thirdHint = '';
  @Input() showTeamAction = false;
  @Input() showTasksAction = false;
  @Input() projectsActionLabel = 'المشاريع';

  @Output() teamClick = new EventEmitter<void>();
  @Output() projectsClick = new EventEmitter<void>();
  @Output() tasksClick = new EventEmitter<void>();

  get completion(): number {
    return chartRate(this.insights.doneTasks, this.insights.totalTasks);
  }

  get activeProjectRate(): number {
    return chartRate(this.insights.activeProjects, this.insights.projectCount);
  }

  get userSlices(): ChartSlice[] {
    return toChartSlices([
      {
        key: 'owners',
        label: 'مالك',
        value: this.insights.ownerMembers,
        color: TASK_CHART_COLORS.owner
      },
      {
        key: 'managers',
        label: 'مدير مشروع',
        value: this.insights.managerMembers,
        color: TASK_CHART_COLORS.manager
      },
      {
        key: 'members',
        label: 'عضو',
        value: this.insights.regularMembers,
        color: TASK_CHART_COLORS.member
      }
    ]);
  }

  get userConic(): string {
    return taskConicGradient(this.userSlices);
  }

  get projectSlices(): ChartSlice[] {
    return toChartSlices([
      {
        key: 'active',
        label: 'نشط',
        value: this.insights.activeProjects,
        color: TASK_CHART_COLORS.active
      },
      {
        key: 'archived',
        label: 'مؤرشف',
        value: this.insights.archivedProjects,
        color: TASK_CHART_COLORS.archived
      }
    ]);
  }

  get projectConic(): string {
    return taskConicGradient(this.projectSlices);
  }

  get userChartLabel(): string {
    if (this.variant === 'manager') {
      return 'أعضاء المشروع';
    }

    if (this.variant === 'member') {
      return 'فريق المشروع';
    }

    return 'حالة المستخدمين';
  }

  get userChartTitle(): string {
    if (this.variant === 'manager') {
      return 'الفريق داخل المشروع';
    }

    if (this.variant === 'member') {
      return 'الأعضاء معك';
    }

    return 'توزيع الأدوار';
  }

  get projectChartLabel(): string {
    if (this.variant === 'manager') {
      return 'تقدم المشروع';
    }

    if (this.variant === 'member') {
      return 'مشاريعي';
    }

    return 'تقدم المشاريع';
  }

  get projectChartTitle(): string {
    if (this.variant === 'manager') {
      return 'إنجاز المهام';
    }

    if (this.variant === 'member') {
      return 'حالة مشاريعك';
    }

    return 'النشط والمؤرشف';
  }

  barWidth(percent: number): number {
    return Math.max(percent, percent > 0 ? 6 : 0);
  }

  barHeight(value: number): number {
    const max = Math.max(...this.taskSlices.map(slice => slice.value), 1);
    return chartBarHeight(value, max);
  }
}
