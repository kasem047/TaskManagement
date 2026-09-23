import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { Project, Projects } from '../../../../core/services/projects';
import { TaskItem, Tasks } from '../../../../core/services/tasks';
import { TokenStorage, StoredUser } from '../../../../core/services/token-storage';
import { Workspace } from '../../../../core/services/workspaces';
import { WorkspaceMembers } from '../../../../core/services/workspace-members';
import {
  WorkspaceAccess,
  isOwnerRole,
  isManagerRole,
  isMemberRole
} from '../../../../core/services/workspace-access';
import {
  ChartSlice,
  RoleInsights,
  TASK_CHART_COLORS,
  toChartSlices
} from '../../chart-slices';
import { RoleInsightsBoard } from '../../components/role-insights-board';

@Component({
  selector: 'app-dashboard',
  imports: [RoleInsightsBoard],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit {
  private readonly router = inject(Router);
  private readonly tokenStorage = inject(TokenStorage);
  private readonly access = inject(WorkspaceAccess);
  private readonly projectsApi = inject(Projects);
  private readonly tasksApi = inject(Tasks);
  private readonly membersApi = inject(WorkspaceMembers);

  user: StoredUser | null = null;
  workspaces: Workspace[] = [];
  loading = true;
  insightsLoading = false;
  errorMessage = '';

  ownerInsights: RoleInsights | null = null;
  managerInsights: RoleInsights | null = null;
  managerProjectName = '';
  managerWorkspaceName = '';
  memberInsights: RoleInsights | null = null;
  memberWorkspaceName = '';
  memberProjectNames: string[] = [];

  ngOnInit(): void {
    this.user = this.tokenStorage.getUser();

    if (this.access.isSystemAdmin) {
      this.router.navigateByUrl('/admin');
      return;
    }

    this.loadWorkspaces();
  }

  loadWorkspaces(): void {
    this.loading = true;
    this.errorMessage = '';

    this.access.refresh().subscribe({
      next: snapshot => {
        if (snapshot.profile?.isSystemAdmin === true) {
          this.router.navigateByUrl('/admin');
          return;
        }

        this.workspaces = snapshot.workspaces;
        this.loading = false;
        this.loadRoleInsights();
      },
      error: () => {
        this.errorMessage = 'تعذر تحميل مساحات العمل.';
        this.loading = false;
      }
    });
  }

  refresh(): void {
    this.loadWorkspaces();
  }

  openWorkspaceManagement(): void {
    this.router.navigateByUrl('/workspaces');
  }

  get canCreateWorkspace(): boolean {
    return this.access.canCreateWorkspace;
  }

  get isFreeUser(): boolean {
    return this.access.isFreeUser;
  }

  get showOwnerDashboard(): boolean {
    return this.access.activeRoleMode === 'owner';
  }

  get showManagerDashboard(): boolean {
    return this.access.activeRoleMode === 'manager';
  }

  get showMemberDashboard(): boolean {
    return this.access.activeRoleMode === 'member' && !this.isFreeUser;
  }

  get showRoleInsights(): boolean {
    return this.showOwnerDashboard || this.showManagerDashboard || this.showMemberDashboard;
  }

  get showOwnerBoard(): boolean {
    return this.showOwnerDashboard && !!this.ownerInsights;
  }

  get showManagerBoard(): boolean {
    return this.showManagerDashboard && !!this.managerInsights;
  }

  get showMemberBoard(): boolean {
    return this.showMemberDashboard && !!this.memberInsights;
  }

  get listedWorkspaces(): Workspace[] {
    return this.access.loaded
      ? this.access.scopedWorkspaces
      : this.workspaces.filter(workspace =>
          this.access.matchesActiveRole(workspace.currentUserRole)
        );
  }

  get workspaceListTitle(): string {
    if (this.showOwnerDashboard) {
      return 'المساحات التي تملكها';
    }

    if (this.showManagerDashboard) {
      return 'المساحات التي تدير فيها مشاريع';
    }

    return 'مساحات العمل';
  }

  get workspaceListHint(): string {
    if (this.showOwnerDashboard) {
      return 'اختر مساحة للانتقال إلى مشاريعها وفريقها.';
    }

    if (this.showManagerDashboard) {
      return 'اختر مساحة للانتقال إلى مشاريعك ومهامها.';
    }

    return 'المساحات التي يمكنك الوصول إليها.';
  }

  get ownedWorkspaceName(): string {
    return (
      this.access.ownedWorkspaces[0]?.name ||
      this.listedWorkspaces[0]?.name ||
      'مساحة العمل'
    );
  }

  get dashboardEyebrow(): string {
    if (this.showOwnerDashboard) {
      return 'مالك مساحة العمل';
    }

    if (this.showManagerDashboard) {
      return 'مدير المشروع';
    }

    if (this.showMemberDashboard) {
      return 'عضو';
    }

    return this.access.activeRoleLabel === 'الدور الحالي'
      ? 'مساحات العمل'
      : this.access.activeRoleLabel;
  }

  get dashboardTitle(): string {
    if (this.showOwnerDashboard) {
      return this.ownedWorkspaceName;
    }

    if (this.showManagerDashboard) {
      return this.managerProjectName || 'مشروعك';
    }

    if (this.showMemberDashboard) {
      return this.memberWorkspaceName || this.listedWorkspaces[0]?.name || 'مساحة العمل';
    }

    return `أهلًا ${this.user?.fullName || 'بك'}`;
  }

  get dashboardSubtitle(): string {
    if (this.isFreeUser) {
      return 'بانتظار مسؤول النظام لإنشاء مساحة عمل وإسنادها إليك، أو قبول دعوة عند وصولها.';
    }

    if (this.showOwnerDashboard) {
      return 'ملخص المستخدمين والمشاريع والمهام داخل مساحتك.';
    }

    if (this.showManagerDashboard) {
      return this.managerWorkspaceName
        ? `ضمن مساحة ${this.managerWorkspaceName}`
        : 'تابع المشروع المسند إليك وحالة مهامه داخل نطاق إدارتك.';
    }

    if (this.showMemberDashboard) {
      if (this.memberProjectNames.length > 0) {
        return `المشاريع التي أنت ضمنها: ${this.memberProjectNames.join(' · ')}`;
      }

      return 'تابع المشروع المسند إليك والمهام باسمك فقط.';
    }

    return 'تابع مساحات عملك حسب الدور الذي اخترته.';
  }

  get showProjectsAction(): boolean {
    return this.access.showProjectsNav;
  }

  get showTasksAction(): boolean {
    return this.access.showTasksNav;
  }

  get showOwnerAction(): boolean {
    return this.access.showOwnerNav;
  }

  get showTeamAction(): boolean {
    return this.access.showTeamNav;
  }

  openCreateWorkspace(): void {
    if (!this.canCreateWorkspace) {
      return;
    }

    this.router.navigate(['/workspaces'], {
      queryParams: { create: 1 }
    });
  }

  openWorkspace(workspace: Workspace): void {
    localStorage.setItem('taskmanagement_workspace_id', String(workspace.id));
    localStorage.setItem('taskmanagement_workspace_name', workspace.name);
    localStorage.setItem('taskmanagement_selected_workspace_id', String(workspace.id));
    localStorage.setItem('taskmanagement_selected_workspace_name', workspace.name);
    localStorage.removeItem('taskmanagement_selected_project_id');
    localStorage.removeItem('taskmanagement_project_name');

    this.router.navigate(['/workspaces', workspace.id, 'projects']);
  }

  openProjects(): void {
    this.router.navigateByUrl('/projects');
  }

  openTasks(): void {
    this.router.navigateByUrl('/tasks');
  }

  openTeam(): void {
    this.router.navigateByUrl('/team');
  }

  get ownerCount(): number {
    return this.listedWorkspaces.filter(workspace => isOwnerRole(workspace.currentUserRole)).length;
  }

  get managerCount(): number {
    return this.listedWorkspaces.filter(workspace => isManagerRole(workspace.currentUserRole)).length;
  }

  get memberCount(): number {
    return this.listedWorkspaces.filter(workspace => isMemberRole(workspace.currentUserRole)).length;
  }

  get ownerTaskChart(): ChartSlice[] {
    return this.taskSlices(this.ownerInsights);
  }

  get managerTaskChart(): ChartSlice[] {
    return this.taskSlices(this.managerInsights);
  }

  get memberTaskChart(): ChartSlice[] {
    return this.taskSlices(this.memberInsights);
  }

  roleLabel(role: string): string {
    switch (role) {
      case 'Owner':
      case 'WorkspaceOwner':
        return 'مالك مساحة العمل';
      case 'ProjectManager':
        return 'مدير مشروع';
      case 'Member':
        return 'عضو';
      default:
        return role;
    }
  }

  firstLetter(value: string | null | undefined): string {
    const normalized = value?.trim();

    if (!normalized) {
      return '؟';
    }

    return normalized.charAt(0).toUpperCase();
  }

  private loadRoleInsights(): void {
    const owned = this.workspaces.filter(workspace => isOwnerRole(workspace.currentUserRole));
    const managed = this.workspaces.filter(workspace => isManagerRole(workspace.currentUserRole));
    const membered = this.workspaces.filter(workspace => isMemberRole(workspace.currentUserRole));

    this.ownerInsights = null;
    this.managerInsights = null;
    this.memberInsights = null;
    this.managerProjectName = '';
    this.managerWorkspaceName = '';
    this.memberWorkspaceName = '';
    this.memberProjectNames = [];

    if (owned.length === 0 && managed.length === 0 && membered.length === 0) {
      this.insightsLoading = false;
      return;
    }

    this.insightsLoading = true;
    const requests = [];

    if (owned.length > 0) {
      requests.push(
        this.buildInsights(owned, 'workspace').pipe(
          map(insights => {
            this.ownerInsights = insights;
            return insights;
          })
        )
      );
    }

    if (managed.length > 0) {
      requests.push(
        this.buildInsights(managed, 'project').pipe(
          map(insights => {
            this.managerInsights = insights;
            return insights;
          })
        )
      );
    }

    if (membered.length > 0) {
      requests.push(
        this.buildInsights(membered, 'assigned').pipe(
          map(insights => {
            this.memberInsights = insights;
            return insights;
          })
        )
      );
    }

    forkJoin(requests).subscribe({
      next: () => {
        this.insightsLoading = false;
      },
      error: () => {
        this.insightsLoading = false;
      }
    });
  }

  private buildInsights(
    workspaces: Workspace[],
    memberSource: 'workspace' | 'project' | 'assigned'
  ) {
    const projectLoads = workspaces.map(workspace =>
      this.projectsApi.getByWorkspace(workspace.id).pipe(
        map(projects =>
          projects.map(project => ({
            workspaceId: workspace.id,
            project
          }))
        ),
        catchError(() => of([] as { workspaceId: number; project: Project }[]))
      )
    );

    return forkJoin(projectLoads).pipe(
      switchMap(groups => {
        const projects = groups.flat();
        const currentUserId = this.access.currentUserId;
        const visibleProjects =
          memberSource === 'project' && currentUserId
            ? projects.filter(item => item.project.managerUserId === currentUserId)
            : projects;

        if (memberSource === 'project' && visibleProjects[0]) {
          this.managerProjectName = visibleProjects[0].project.name;
          this.managerWorkspaceName =
            workspaces.find(workspace => workspace.id === visibleProjects[0].workspaceId)?.name
            || '';
        }

        if (memberSource === 'assigned') {
          this.memberWorkspaceName = workspaces[0]?.name || '';
          this.memberProjectNames = visibleProjects.map(item => item.project.name);
        }

        const taskLoads = visibleProjects.map(item =>
          this.tasksApi.getByProject(item.workspaceId, item.project.id).pipe(
            catchError(() => of([] as TaskItem[]))
          )
        );
        const memberLoads =
          memberSource === 'workspace'
            ? workspaces.map(workspace =>
                this.membersApi.getByWorkspace(workspace.id).pipe(
                  map(items =>
                    items.map(item => ({
                      userId: item.userId,
                      roleName: item.roleName,
                      status: item.status
                    }))
                  ),
                  catchError(() => of([] as { userId: number; roleName: string; status?: string }[]))
                )
              )
            : visibleProjects.map(item =>
                this.projectsApi.getMembers(item.workspaceId, item.project.id).pipe(
                  map(items =>
                    items.map(member => ({
                      userId: member.userId,
                      roleName: member.roleName
                    }))
                  ),
                  catchError(() => of([] as { userId: number; roleName: string; status?: string }[]))
                )
              );

        return forkJoin({
          tasks: taskLoads.length > 0 ? forkJoin(taskLoads) : of([] as TaskItem[][]),
          members: memberLoads.length > 0
            ? forkJoin(memberLoads)
            : of([] as { userId: number; roleName: string; status?: string }[][])
        }).pipe(
          map(({ tasks, members }) => {
            const allTasks = tasks.flat();
            const allMembers = members.flat();
            const uniqueMembers = new Set(
              allMembers.map(member => member.userId)
            );

            if (memberSource === 'project') {
              for (const item of visibleProjects) {
                if (item.project.managerUserId) {
                  uniqueMembers.add(item.project.managerUserId);
                }
              }
            }

            const projectProgress = visibleProjects.map((item, index) => {
              const projectTasks = tasks[index] ?? [];
              const done = projectTasks.filter(task => task.status === 'Done').length;

              return {
                name: item.project.name,
                total: projectTasks.length,
                done,
                rate: projectTasks.length > 0
                  ? Math.round((done / projectTasks.length) * 100)
                  : 0
              };
            });

            const ownerMembers = allMembers.filter(member => isOwnerRole(member.roleName)).length;
            const managerMembers = Math.max(
              allMembers.filter(member => isManagerRole(member.roleName)).length,
              memberSource === 'project' ? visibleProjects.length : 0
            );
            const regularMembers = allMembers.filter(member =>
              isMemberRole(member.roleName) || member.roleName === 'Member'
            ).length;

            return {
              workspaceCount: workspaces.length,
              projectCount: visibleProjects.length,
              activeProjects: visibleProjects.filter(item => !item.project.isArchived).length,
              archivedProjects: visibleProjects.filter(item => item.project.isArchived).length,
              memberCount: uniqueMembers.size,
              ownerMembers,
              managerMembers,
              regularMembers,
              activeMembers: allMembers.filter(member =>
                !('status' in member) || member.status === 'Active'
              ).length,
              inactiveMembers: allMembers.filter(member =>
                'status' in member && member.status !== 'Active'
              ).length,
              totalTasks: allTasks.length,
              todoTasks: allTasks.filter(task => task.status === 'Todo').length,
              inProgressTasks: allTasks.filter(task => task.status === 'InProgress').length,
              inReviewTasks: allTasks.filter(task => task.status === 'InReview').length,
              doneTasks: allTasks.filter(task => task.status === 'Done').length,
              cancelledTasks: allTasks.filter(task => task.status === 'Cancelled').length,
              projectProgress
            } satisfies RoleInsights;
          })
        );
      })
    );
  }

  private taskSlices(insights: RoleInsights | null): ChartSlice[] {
    if (!insights) {
      return [];
    }

    return toChartSlices([
      { key: 'todo', label: 'للعمل', value: insights.todoTasks, color: TASK_CHART_COLORS.todo },
      { key: 'progress', label: 'قيد التنفيذ', value: insights.inProgressTasks, color: TASK_CHART_COLORS.progress },
      { key: 'partial', label: 'مكتملة جزئيًا', value: insights.inReviewTasks, color: TASK_CHART_COLORS.partial },
      { key: 'done', label: 'مكتملة', value: insights.doneTasks, color: TASK_CHART_COLORS.done },
      { key: 'cancelled', label: 'ملغاة', value: insights.cancelledTasks, color: TASK_CHART_COLORS.cancelled }
    ]);
  }
}
