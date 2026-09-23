import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Admin, AdminDashboard } from '../../../../core/services/admin';
import { AdminUser, AdminUsers } from '../../../../core/services/admin-users';
import { Workspaces } from '../../../../core/services/workspaces';

type ChartSlice = {
  key: string;
  label: string;
  value: number;
  color: string;
  percent: number;
  dasharray: string;
  offset: number;
};

const DONUT_RADIUS = 54;
const DONUT_CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

@Component({
  selector: 'app-admin-dashboard',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboardPage implements OnInit {
  private readonly admin = inject(Admin);
  private readonly adminUsers = inject(AdminUsers);
  private readonly workspaces = inject(Workspaces);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  dashboard: AdminDashboard | null = null;
  loading = true;
  errorMessage = '';
  successMessage = '';

  createModalOpen = false;
  submitting = false;
  loadingOwners = false;
  eligibleOwners: AdminUser[] = [];

  readonly workspaceForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
    description: ['', [Validators.maxLength(1000)]],
    ownerUserId: [0, [Validators.required, Validators.min(1)]]
  });

  ngOnInit(): void {
    this.loadDashboard();
  }

  loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    this.admin.getDashboard().subscribe({
      next: dashboard => {
        this.dashboard = dashboard;
        this.loading = false;
      },
      error: error => {
        this.errorMessage = this.extractApiError(error);
        this.loading = false;
      }
    });
  }

  get completionRate(): number {
    return this.rate(this.dashboard?.doneTasks ?? 0, this.dashboard?.totalTasks ?? 0);
  }

  get activeUsersRate(): number {
    return this.rate(this.dashboard?.activeUsers ?? 0, this.dashboard?.totalUsers ?? 0);
  }

  get activeProjectsRate(): number {
    return this.rate(this.dashboard?.activeProjects ?? 0, this.dashboard?.totalProjects ?? 0);
  }

  get taskSlices(): ChartSlice[] {
    if (!this.dashboard) {
      return [];
    }

    return this.toSlices([
      { key: 'todo', label: 'للعمل', value: this.dashboard.todoTasks, color: '#8b95ab' },
      { key: 'progress', label: 'قيد التنفيذ', value: this.dashboard.inProgressTasks, color: '#e8a317' },
      { key: 'partial', label: 'مكتملة جزئيًا', value: this.dashboard.inReviewTasks, color: '#8a73d8' },
      { key: 'done', label: 'مكتملة', value: this.dashboard.doneTasks, color: '#3d9a6a' },
      { key: 'cancelled', label: 'ملغاة', value: this.dashboard.cancelledTasks, color: '#d26d87' }
    ]);
  }

  get userSlices(): ChartSlice[] {
    if (!this.dashboard) {
      return [];
    }

    return this.toSlices([
      { key: 'active', label: 'نشط', value: this.dashboard.activeUsers, color: '#5d6fe6' },
      { key: 'inactive', label: 'غير نشط', value: this.dashboard.inactiveUsers, color: '#6f7b93' }
    ]);
  }

  get projectSlices(): ChartSlice[] {
    if (!this.dashboard) {
      return [];
    }

    return this.toSlices([
      { key: 'active', label: 'نشط', value: this.dashboard.activeProjects, color: '#5d6fe6' },
      { key: 'archived', label: 'مؤرشف', value: this.dashboard.archivedProjects, color: '#8a73d8' }
    ]);
  }

  get taskBarMax(): number {
    return Math.max(...this.taskSlices.map(slice => slice.value), 1);
  }

  barHeight(value: number): number {
    return Math.max(8, Math.round((value / this.taskBarMax) * 100));
  }

  exportDashboard(format: 'excel' | 'pdf'): void {
    this.admin.exportDashboard(format).subscribe({
      next: blob => {
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = format === 'excel' ? 'admin-dashboard.xlsx' : 'admin-dashboard.pdf';
        link.click();
        window.URL.revokeObjectURL(url);
      },
      error: error => {
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  openCreateWorkspace(): void {
    this.errorMessage = '';
    this.successMessage = '';
    this.workspaceForm.reset({
      name: '',
      description: '',
      ownerUserId: 0
    });
    this.createModalOpen = true;
    this.loadEligibleOwners();
  }

  closeCreateWorkspace(): void {
    if (this.submitting) {
      return;
    }

    this.createModalOpen = false;
  }

  createWorkspace(): void {
    if (this.submitting) {
      return;
    }

    if (this.workspaceForm.invalid) {
      this.workspaceForm.markAllAsTouched();
      this.errorMessage = 'راجع بيانات مساحة العمل واختر مالكًا لإسنادها.';
      return;
    }

    const value = this.workspaceForm.getRawValue();
    const name = value.name.trim();
    const description = value.description.trim();

    if (name.length < 2) {
      this.errorMessage = 'يجب أن يتكون اسم المساحة من حرفين على الأقل.';
      return;
    }

    this.submitting = true;
    this.errorMessage = '';

    this.workspaces
      .create({
        name,
        description: description || null,
        ownerUserId: Number(value.ownerUserId)
      })
      .subscribe({
        next: workspace => {
          this.submitting = false;
          this.createModalOpen = false;
          this.successMessage = `تم إنشاء مساحة العمل «${workspace.name}» وإسنادها إلى المالك المحدد.`;
          this.loadDashboard();
        },
        error: error => {
          this.submitting = false;
          this.errorMessage = this.extractApiError(error);
        }
      });
  }

  openUsers(): void {
    this.router.navigateByUrl('/admin/users');
  }

  openPasswordRecovery(): void {
    this.router.navigateByUrl('/admin/password-recovery');
  }

  openActivity(): void {
    this.router.navigateByUrl('/activity');
  }

  openRolesPermissions(): void {
    this.router.navigateByUrl('/admin/roles-permissions');
  }

  openWorkspaces(): void {
    this.router.navigateByUrl('/workspaces');
  }

  openNotifications(): void {
    this.router.navigateByUrl('/notifications');
  }

  private loadEligibleOwners(): void {
    this.loadingOwners = true;
    this.eligibleOwners = [];

    this.adminUsers.getUsers(undefined, true).subscribe({
      next: users => {
        this.loadingOwners = false;
        this.eligibleOwners = users.filter(
          user => user.isActive && !user.isSystemAdmin && user.ownsWorkspace !== true
        );
      },
      error: error => {
        this.loadingOwners = false;
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  private rate(part: number, total: number): number {
    if (total < 1) {
      return 0;
    }

    return Math.round((part / total) * 100);
  }

  private toSlices(
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

  private extractApiError(error: any): string {
    const errors = error?.error?.errors;

    if (errors && typeof errors === 'object') {
      const messages = Object.values(errors)
        .flatMap(value => (Array.isArray(value) ? value : [value]))
        .filter(Boolean)
        .map(String);

      if (messages.length > 0) {
        return messages.join('\n');
      }
    }

    return (
      error?.error?.message ??
      error?.error?.detail ??
      error?.error?.title ??
      error?.message ??
      'تعذر تحميل لوحة إدارة النظام.'
    );
  }
}
