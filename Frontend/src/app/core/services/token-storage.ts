import {
  Injectable
} from '@angular/core';


export interface StoredUser {

  userId: number;

  fullName: string;

  email: string;

  expiresAt: string;

  sessionId: number;
}


@Injectable({
  providedIn: 'root'
})
export class TokenStorage {

  private readonly tokenKey =
    'taskmanagement_access_token';

  private readonly userKey =
    'taskmanagement_user';


  /* =========================
     TOKEN
     ========================= */

  setToken(
    token: string
  ): void {

    localStorage.setItem(
      this.tokenKey,
      token
    );
  }


  getToken():
    string | null {

    return localStorage.getItem(
      this.tokenKey
    );
  }


  hasToken():
    boolean {

    return Boolean(
      this.getToken()
    );
  }


  isAuthenticated():
    boolean {

    const token =
      this.getToken();


    if (!token) {
      return false;
    }


    const user =
      this.getUser();


    if (!user) {
      return false;
    }


    /*
     * إذا كان expiresAt موجودًا وصالحًا
     * نتحقق أن الجلسة لم تنتهِ.
     */
    if (
      user.expiresAt
    ) {

      const expiresAt =
        new Date(
          user.expiresAt
        ).getTime();


      if (
        Number.isFinite(
          expiresAt
        ) &&
        expiresAt <=
        Date.now()
      ) {

        return false;
      }
    }


    return true;
  }


  /* =========================
     USER
     ========================= */

  setUser(
    user: StoredUser
  ): void {

    localStorage.setItem(
      this.userKey,
      JSON.stringify(
        user
      )
    );
  }


  getUser():
    StoredUser | null {

    const storedUser =
      localStorage.getItem(
        this.userKey
      );


    if (!storedUser) {
      return null;
    }


    try {

      return JSON.parse(
        storedUser
      ) as StoredUser;

    } catch {

      this.clear();

      return null;
    }
  }


  /* =========================
     CLEAR
     ========================= */

  clear(): void {

    localStorage.removeItem(
      this.tokenKey
    );

    localStorage.removeItem(
      this.userKey
    );


    localStorage.removeItem(
      'taskmanagement_workspace_id'
    );

    localStorage.removeItem(
      'taskmanagement_workspace_name'
    );

    localStorage.removeItem(
      'taskmanagement_project_id'
    );

    localStorage.removeItem(
      'taskmanagement_project_name'
    );
  }
}