// src/app/guards/auth.guard.ts
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, CanMatchFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { StorageService } from '../services/storage.service';

// ---- Helpers ---------------------------------------------------------------

type GuardResult = Promise<boolean | UrlTree>;

async function resolveAuthAllow(): GuardResult {
  const storage = inject(StorageService);
  const auth = inject(AuthService);
  const router = inject(Router);

  const profile = await storage.getSavedProfile(); // User | null
  const isValid = !!profile && typeof profile.userId === 'string' && profile.userId.trim().length > 0;

  if (isValid) {
    auth.setCurrentLogin(profile);
    return true;
  };


  const completed = await storage.isOnboardingCompleted(); // expects boolean-ish
  if (completed !== true && completed !== 'true' && completed !== 1) {
    return router.parseUrl('/landing-page');
  } else {
    auth.logout(); // clear any stale data
    return router.parseUrl('/login');
  }
}

async function resolveGuestAllow(): GuardResult {
  const storage = inject(StorageService);
  const router = inject(Router);

  const profile = await storage.getSavedProfile(); // User | null
  const isValid = !!profile && typeof profile.userId === 'string' && profile.userId.trim().length > 0;

  // If already logged-in, send them to your private entry (adjust to /home if you prefer)
  return isValid ? router.parseUrl('/home') : true;
}

/**
 * Landing / onboarding gate:
 * - If onboarding already completed -> go to /login automatically.
 * - If not completed (or flag missing) -> allow staying on landing page.
 */
async function resolveLandingAllow(): GuardResult {
  const storage = inject(StorageService);
  const router = inject(Router);

  const completed = await storage.isOnboardingCompleted(); // expects boolean-ish
  const done = completed === true || completed === 'true' || completed === 1; // tolerate loose storage types

  return done ? router.parseUrl('/login') : true;
}

// ---- Public guards (usable in canActivate or canMatch) ---------------------

export const authGuard: CanActivateFn & CanMatchFn = () => resolveAuthAllow();
export const guestGuard: CanActivateFn & CanMatchFn = () => resolveGuestAllow();
export const landingGuard: CanActivateFn & CanMatchFn = () => resolveLandingAllow();
