export type NotificationTextSource = {
  type: string;
  title?: string | null;
  message?: string | null;
};

const roleLabels: Record<string, string> = {
  WorkspaceOwner: 'مالك مساحة العمل',
  Owner: 'مالك مساحة العمل',
  ProjectManager: 'مدير مشروع',
  Member: 'عضو'
};

function quotedNames(text: string): string[] {
  return [...text.matchAll(/"([^"]+)"/g)].map(match => match[1]);
}

function hasArabic(text: string): boolean {
  return /[\u0600-\u06FF]/.test(text);
}

function roleLabel(name: string): string {
  return roleLabels[name] || name;
}

function extractRole(message: string): string | null {
  const match =
    message.match(/role ([A-Za-z]+)/i) ||
    message.match(/as ([A-Za-z]+)/i) ||
    message.match(/from ([A-Za-z]+) to ([A-Za-z]+)/i);

  if (!match) {
    return null;
  }

  return roleLabel(match[match.length - 1]);
}

export function arabicNotificationTitle(
  item: NotificationTextSource
): string {
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
      return 'تم إسناد مهمة';
    case 'task.unassigned':
      return 'أُلغي إسناد مهمة';
    case 'task.status_changed':
      return 'تغيّرت حالة مهمة';
    case 'task.completed':
      return 'اكتملت مهمة';
    case 'task.cancelled':
      return 'أُلغيت مهمة';
    case 'task.partially_completed':
      return 'إنجاز جزئي لمهمة';
    case 'task.progress_updated':
      return 'تحديث تقدم مهمة';
    case 'task.reopened':
      return 'أُعيد فتح مهمة';
    case 'task.comment_added':
      return 'تعليق جديد على مهمة';
    case 'task.deleted':
      return 'تم حذف مهمة';
    case 'task.details_changed':
      return 'تغيّرت تفاصيل مهمة';
    case 'task.priority_changed':
      return 'تغيّرت أولوية مهمة';
    case 'task.due_date_changed':
      return 'تغيّر موعد مهمة';
    case 'task.dependencies_updated':
      return 'تغيّرت اعتماديات مهمة';
    case 'task.reminder.halfway':
      return 'تذكير منتصف مدة المهمة';
    case 'task.reminder.one_day':
      return 'المهمة مستحقة غدًا';
    case 'task.reminder.one_hour':
      return 'المهمة مستحقة خلال ساعة';
    case 'task.reminder.overdue':
      return 'المهمة متأخرة عن موعدها';
    case 'workspace.invitation':
    case 'workspace.invitation_received':
      return 'دعوة إلى مساحة عمل';
    case 'workspace.invitation_updated':
      return 'تم تحديث دعوة مساحة العمل';
    case 'workspace.invitation_accepted':
      return 'تم قبول دعوة مساحة العمل';
    case 'workspace.invitation_rejected':
      return 'تم رفض دعوة مساحة العمل';
    case 'workspace.invitation_cancelled':
      return 'تم إلغاء دعوة مساحة العمل';
    case 'workspace.member_added':
      return 'تمت إضافتك إلى مساحة عمل';
    case 'workspace.member_removed':
      return 'تمت إزالتك من مساحة عمل';
    case 'workspace.member_role_changed':
      return 'تغيّر دورك في مساحة العمل';
    case 'workspace.assigned':
    case 'workspace.ownership_assigned':
      return 'إسناد ملكية مساحة عمل';
    case 'member.ontime_reward':
      return 'مكافأة مالية مقترحة';
    case 'account.profile_updated':
      return 'تم تحديث الملف الشخصي';
    case 'account.email_changed':
      return 'تم تغيير البريد الإلكتروني';
    case 'account.password_changed':
      return 'تم تغيير كلمة المرور';
    case 'account.password_recovery.requested':
      return 'طلب استعادة كلمة المرور';
    case 'account.password_recovery.approved':
      return 'تمت الموافقة على استعادة كلمة المرور';
    case 'account.password_recovery.rejected':
      return 'رُفض طلب استعادة كلمة المرور';
    case 'account.password_recovery.code_sent':
      return 'تم إرسال رمز الاستعادة';
    case 'account.password_recovery.completed':
      return 'اكتملت استعادة كلمة المرور';
    case 'manual.notification':
      return item.title || 'إشعار يدوي';
    default:
      return item.title && hasArabic(item.title)
        ? item.title
        : item.title || 'إشعار جديد';
  }
}

export function arabicNotificationMessage(
  item: NotificationTextSource
): string {
  const message = item.message?.trim() || '';

  if (message && hasArabic(message)) {
    return message;
  }

  const names = quotedNames(message);
  const first = names[0] || '';
  const role = extractRole(message);

  switch (item.type) {
    case 'project.manager_assigned':
      return first
        ? `تم تعيينك مديرًا للمشروع "${first}".`
        : 'تم تعيينك مديرًا لمشروع.';
    case 'project.manager_removed':
      return first
        ? `لم تعد مديرًا للمشروع "${first}".`
        : 'لم تعد مديرًا للمشروع.';
    case 'project.manager_required':
      return first
        ? `المشروع "${first}" لم يعد له مدير. يرجى تعيين مدير مشروع جديد.`
        : 'أحد المشاريع يحتاج إلى مدير جديد.';
    case 'project.member_added':
      return first
        ? `تمت إضافتك إلى المشروع "${first}".`
        : 'تمت إضافتك إلى مشروع.';
    case 'project.archived':
      return first
        ? `تم أرشفة المشروع "${first}".`
        : 'تم أرشفة مشروع.';
    case 'project.deleted':
      return first
        ? `تم حذف المشروع "${first}".`
        : 'تم حذف مشروع.';
    case 'task.assigned':
      return first
        ? `أُسندت المهمة "${first}" إليك.`
        : 'أُسندت مهمة إليك.';
    case 'task.unassigned':
      return first
        ? `لم تعد المهمة "${first}" مسندة.`
        : 'أُلغي إسناد مهمة.';
    case 'task.completed':
      return first
        ? `اكتملت المهمة "${first}".`
        : 'اكتملت مهمة.';
    case 'task.cancelled':
      return first
        ? `أُلغيت المهمة "${first}".`
        : 'أُلغيت مهمة.';
    case 'task.partially_completed':
      return first
        ? `المهمة "${first}" أصبحت مكتملة جزئيًا.`
        : 'تم تسجيل إنجاز جزئي لمهمة.';
    case 'task.progress_updated':
      return first
        ? `تم تحديث تقدم المهمة "${first}".`
        : 'تم تحديث تقدم مهمة.';
    case 'task.comment_added':
      return first
        ? `أُضيف تعليق جديد على المهمة "${first}".`
        : 'أُضيف تعليق جديد على مهمة.';
    case 'task.deleted':
      return first
        ? `تم حذف المهمة "${first}".`
        : 'تم حذف مهمة.';
    case 'task.details_changed':
    case 'task.priority_changed':
    case 'task.due_date_changed':
      return first
        ? `تم تحديث تفاصيل المهمة "${first}".`
        : 'تم تحديث تفاصيل مهمة.';
    case 'task.dependencies_updated':
      return first
        ? `تم تحديث اعتماديات المهمة "${first}".`
        : 'تم تحديث اعتماديات مهمة.';
    case 'task.reminder.halfway':
      return first
        ? `انتصف الوقت المتاح للمهمة "${first}".`
        : 'انتصف الوقت المتاح لمهمة.';
    case 'task.reminder.one_day':
      return first
        ? `المهمة "${first}" مستحقة خلال 24 ساعة.`
        : 'مهمة مستحقة خلال 24 ساعة.';
    case 'task.reminder.one_hour':
      return first
        ? `المهمة "${first}" مستحقة خلال ساعة.`
        : 'مهمة مستحقة خلال ساعة.';
    case 'task.reminder.overdue':
      return first
        ? `المهمة "${first}" تجاوزت موعدها.`
        : 'مهمة تجاوزت موعدها.';
    case 'workspace.invitation':
    case 'workspace.invitation_received':
      return first
        ? `دُعيت للانضمام إلى مساحة العمل "${first}"${role ? ` بدور ${role}` : ''}.`
        : 'دُعيت للانضمام إلى مساحة عمل.';
    case 'workspace.invitation_updated':
      return first
        ? `تم تحديث دعوتك إلى مساحة العمل "${first}"${role ? ` بدور ${role}` : ''}.`
        : 'تم تحديث دعوة مساحة العمل.';
    case 'workspace.invitation_accepted':
      return first
        ? `تم قبول الدعوة والانضمام إلى مساحة العمل "${first}".`
        : 'تم قبول دعوة مساحة عمل.';
    case 'workspace.invitation_rejected':
      return first
        ? `رُفضت الدعوة إلى مساحة العمل "${first}".`
        : 'رُفضت دعوة مساحة عمل.';
    case 'workspace.invitation_cancelled':
      return first
        ? `أُلغيت دعوتك إلى مساحة العمل "${first}".`
        : 'أُلغيت دعوة مساحة عمل.';
    case 'workspace.member_added':
      return first
        ? `تمت إضافتك إلى مساحة العمل "${first}"${role ? ` بدور ${role}` : ''}.`
        : role
          ? `تمت إضافتك إلى مساحة عمل بدور ${role}.`
          : 'تمت إضافتك إلى مساحة عمل.';
    case 'workspace.member_removed':
      return 'تمت إزالتك من مساحة العمل.';
    case 'workspace.member_role_changed':
      return role
        ? `تغيّر دورك في مساحة العمل إلى ${role}.`
        : 'تغيّر دورك في مساحة العمل.';
    case 'workspace.assigned':
    case 'workspace.ownership_assigned':
      return first
        ? `تم إسناد ملكية مساحة العمل "${first}".`
        : 'تم إسناد ملكية مساحة عمل.';
    case 'member.ontime_reward':
      return message || 'يُقترح منح مكافأة مالية لعضو أنجز 3 مهام في موعدها.';
    case 'account.profile_updated':
      return 'تم تحديث بيانات ملفك الشخصي.';
    case 'account.email_changed':
      return 'تم تغيير البريد الإلكتروني للحساب.';
    case 'account.password_changed':
      return 'تم تغيير كلمة مرور حسابك، وأُلغيت الجلسات الأخرى.';
    case 'account.password_recovery.requested':
      return 'تم إرسال طلب استعادة كلمة المرور.';
    case 'account.password_recovery.approved':
      return 'تمت الموافقة على طلب استعادة كلمة المرور. بانتظار إرسال رمز التحقق.';
    case 'account.password_recovery.rejected':
      return 'رُفض طلب استعادة كلمة المرور.';
    case 'account.password_recovery.code_sent':
      return 'تم إرسال رمز استعادة كلمة المرور المكوّن من 6 أرقام.';
    case 'account.password_recovery.completed':
      return 'اكتملت استعادة كلمة المرور وأُلغيت الجلسات السابقة.';
    default:
      return message || item.title || '';
  }
}
