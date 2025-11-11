import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './guard/auth-guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'home'
  },
  {
    path: 'home',
    canMatch: [authGuard],
    loadComponent: () => import('./pages/home/home.page').then( m => m.HomePage)
  },
  {
    path: 'profile',
    canMatch: [authGuard],
    loadComponent: () => import('./pages/profile/profile.page').then( m => m.ProfilePage)
  },
  {
    path: 'search',
    canMatch: [authGuard],
    loadComponent: () => import('./pages/search/search.page').then( m => m.SearchPage)
  },
  {
    path: 'verification-details',
    canMatch: [authGuard],
    loadComponent: () => import('./pages/verification-details/verification-details.page').then( m => m.VerificationDetailsPage)
  },
  {
    path: 'verification-history',
    canMatch: [authGuard],
    loadComponent: () => import('./pages/verification-history/verification-history.page').then( m => m.VerificationHistoryPage)
  },
  {
    path: 'landing-page',
    loadComponent: () => import('./pages/landing-page/landing-page.page').then( m => m.LandingPagePage)
  },
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./pages/login/login.page').then( m => m.LoginPage)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/register/register.page').then( m => m.RegisterPage)
  },
  {
    path: 'otp',
    loadComponent: () => import('./pages/otp/otp.page').then( m => m.OtpPage)
  },
  {
    path: 'send-verification',
    loadComponent: () => import('./pages/send-verification/send-verification.page').then( m => m.SendVerificationPage)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./pages/reset-password/reset-password.page').then( m => m.ResetPasswordPage)
  },
  {
    path: 'help-support',
    loadComponent: () => import('./pages/help-support/help-support.page').then( m => m.HelpSupportPage)
  },
  { path: '**', redirectTo: '' },
];
