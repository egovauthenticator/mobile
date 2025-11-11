// src/app/services/auth.service.ts
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  BehaviorSubject, catchError, delay, Observable, of, Subject, takeUntil, tap
} from 'rxjs';
import { environment } from 'src/environments/environment';
import { StorageService } from './storage.service';
import { Router } from '@angular/router';
import { ApiResponse } from '../model/api-response.model';
import { User } from '../model/user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  isLoggedIn = false;

  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  protected ngUnsubscribe: Subject<void> = new Subject<void>();

  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private router: Router
  ) {
    // seed from storage once
    (async () => {
      const saved = await this.storageService.getSavedProfile();
      this.userSubject.next(saved);
    })();
  }

  setCurrentLogin(user: User | null) {
    this.userSubject.next(user);
  }

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  login(data: { email: string; password: string }): Observable<ApiResponse<User>> {
    return this.http.post<any>(environment.apiBaseUrl + '/auth/login', data).pipe(
      takeUntil(this.ngUnsubscribe),
      tap(_ => (this.isLoggedIn = true)),
      catchError(this.handleError('login', []))
    );
  }

  register(data: { name: string; email: string; password: string }): Observable<ApiResponse<User>> {
    return this.http.post<any>(environment.apiBaseUrl + '/auth/register', data).pipe(
      takeUntil(this.ngUnsubscribe),
      tap(_ => (this.isLoggedIn = true)),
      catchError(this.handleError('register', []))
    );
  }

  verify(data: { email: string; otp: string }): Observable<ApiResponse<User | { hashOtp: string }>> {
    return this.http.post<any>(environment.apiBaseUrl + '/auth/verify', data).pipe(
      takeUntil(this.ngUnsubscribe),
      tap(_ => (this.isLoggedIn = true)),
      catchError(this.handleError('verify', []))
    );
  }

  sendVerification(data: { email: string; type: string }): Observable<ApiResponse<User>> {
    return this.http.post<any>(environment.apiBaseUrl + '/auth/send-verification', data).pipe(
      takeUntil(this.ngUnsubscribe),
      tap(_ => (this.isLoggedIn = true)),
      catchError(this.handleError('send-verification', []))
    );
  }

  resetPassword(data: { email: string; hashOtp: string; password: string }): Observable<ApiResponse<User>> {
    return this.http.post<any>(environment.apiBaseUrl + '/auth/reset-password', data).pipe(
      takeUntil(this.ngUnsubscribe),
      tap(_ => (this.isLoggedIn = true)),
      catchError(this.handleError('send-verification', []))
    );
  }

  forgotPassword(email: string) {
    return of({ ok: true }).pipe(delay(800));
  }

  async logout() {
    await this.storageService.saveAccessToken(null);
    await this.storageService.saveRefreshToken(null);
    await this.storageService.saveProfile(null);
    this.userSubject.next(null);
    this.isLoggedIn = false;
  }

  handleError<T>(operation = 'operation', result?: T) {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
    return (error: any): Observable<T> => {
      this.log(error.message);
      return of(error.error as T);
    };
  }

  private log(message: string) {
    console.log(message);
  }
}
