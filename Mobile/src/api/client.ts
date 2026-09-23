import { API_BASE_URL } from '../config';
import { getToken, clearSession } from '../storage/session';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  auth?: boolean;
};

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function extractApiError(error: unknown): string {
  if (error instanceof ApiError) {
    const body = error.body as Record<string, unknown> | string | null;

    if (body && typeof body === 'object') {
      const validation = body.errors;

      if (validation && typeof validation === 'object') {
        const messages = Object.values(validation as Record<string, unknown>)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter(Boolean)
          .map(String);

        if (messages.length > 0) {
          return messages.join(' ');
        }
      }

      const detail =
        readString(body.detail) ??
        readString(body.message) ??
        readString(body.title);

      if (detail) {
        if (detail.includes('This invitation is no longer pending')) {
          return 'هذه الدعوة لم تعد معلّقة. حدّث الصفحة ثم أعد المحاولة.';
        }

        if (detail.includes('already an active member of this workspace')) {
          return 'أنت عضو في مساحة العمل بالفعل.';
        }

        if (detail.includes('User not found or inactive')) {
          return 'المستخدم المختار غير موجود أو حسابه غير نشط.';
        }

        if (detail.includes('must be an active member of this workspace')) {
          return 'يمكن إضافة أعضاء من مساحة العمل الحالية فقط.';
        }

        if (detail.includes('Only the workspace owner can add members')) {
          return 'إضافة أعضاء المشروع متاحة لمالك مساحة العمل فقط.';
        }

        if (detail.includes('already a member of this project')) {
          return 'هذا المستخدم عضو في المشروع بالفعل.';
        }

        if (detail.includes('must have the ProjectManager role')) {
          return 'يمكن تعيين مستخدم بدور «مدير مشروع» فقط كمدير للمشروع.';
        }

        if (detail.includes('must be a member of this project') ||
          detail.includes('workspace member with the Member role')) {
          return 'يمكن إسناد المهمة لأعضاء المشروع أو أعضاء مساحة العمل بدور عضو.';
        }

        if (detail.includes('not an active member of this workspace')) {
          return 'المستخدم المختار ليس عضوًا نشطًا في مساحة العمل.';
        }

        if (detail.includes('Workspace owner cannot be assigned')) {
          return 'لا يمكن إسناد المهمة لمالك مساحة العمل.';
        }

        if (detail.includes('Workspace owners cannot assign')) {
          return 'مالك مساحة العمل لا يسند المهام.';
        }

        if (detail.includes('Members cannot assign')) {
          return 'الأعضاء لا يغيّرون إسناد المهام.';
        }

        if (detail.includes('already archived')) {
          return 'هذا المشروع مؤرشف بالفعل.';
        }

        if (detail.includes('Archived projects cannot be updated')) {
          return 'لا يمكن تعديل مشروع مؤرشف.';
        }

        if (detail.includes('You do not have permission to perform this action')) {
          return 'لا تملك الصلاحية المطلوبة لتنفيذ هذه العملية.';
        }

        return detail;
      }
    }

    if (error.status === 0) {
      return `تعذر الاتصال بالخادم على ${API_BASE_URL}. شغّل الـ API من Visual Studio ثم أعد المحاولة.`;
    }

    if (error.status === 403) {
      return 'لا تملك الصلاحية المطلوبة لتنفيذ هذه العملية.';
    }

    if (error.status === 404) {
      return 'العنصر المطلوب غير موجود.';
    }
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return 'تعذر تنفيذ العملية.';
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {
    Accept: 'application/json'
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth !== false) {
    const token = await getToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body)
    });
  } catch {
    throw new ApiError('تعذر الاتصال بالخادم.', 0, null);
  }

  const text = await response.text();
  let parsed: unknown = null;

  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (response.status === 401 && options.auth !== false && !path.includes('/api/Auth/profile')) {
    const token = await getToken();

    if (token) {
      try {
        const profileResponse = await fetch(`${API_BASE_URL}/api/Auth/profile`, {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`
          }
        });

        if (profileResponse.status === 401) {
          await clearSession();
        }
      } catch {
        // Keep the original 401 for the screen to display.
      }
    }
  }

  if (!response.ok) {
    throw new ApiError('Request failed', response.status, parsed);
  }

  return parsed as T;
}
