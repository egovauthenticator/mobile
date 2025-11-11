// src/app/interceptors/user-id.interceptor.ts
import { inject, Injector } from '@angular/core';
import {
  HttpContextToken,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest
} from '@angular/common/http';
import { AuthService } from '../services/auth.service';

/** Opt-in flag. Only requests that set this to true will get the header. */
export const SEND_USER_ID = new HttpContextToken<boolean>(() => false);

export const userIdInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  // Only act when explicitly requested
  if (!req.context.get(SEND_USER_ID)) {
    return next(req);
  }

  const injector = inject(Injector);
  const auth = injector.get(AuthService);
  const user = auth.currentUser;

  // Try common id shapes; adjust if your User model differs
  const userId =
    (user as any)?.userId || null;

  if (!userId) {
    // No user yet? Just pass through without header.
    auth.logout();
    return next(req);
  }

  const cloned = req.clone({
    setHeaders: {
      // Use whatever name you prefer; 'x-user-id' is conventional.
      'userid': String(userId),
    },
  });
  return next(cloned);
};
