import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Subject, Observable, takeUntil, tap, catchError, of, delay } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';
import { StorageService } from './storage.service';
import { APIKeyManagement } from '../model/api-key-management';
import { SEND_USER_ID } from '../interceptor/api-interceptor-interceptor';

@Injectable({
  providedIn: 'root'
})
export class APIKeyManagementService {

  private apiKeySubject = new BehaviorSubject<APIKeyManagement | null>(null);
  apiKey$ = this.apiKeySubject.asObservable();

  protected ngUnsubscribe: Subject<void> = new Subject<void>();

  private readonly userIdCtx = new HttpContext().set(SEND_USER_ID, true);
  constructor(
    private http: HttpClient,
    private storageService: StorageService,
    private router: Router
  ) {
    // seed from storage once
    (async () => {
      const saved = await this.storageService.getSavedAPIKey();
      this.apiKeySubject.next(saved);
    })();
  }

  setCurrentAPIKey(apiKey: APIKeyManagement | null) {
    this.apiKeySubject.next(apiKey);
  }

  get currentAPIKey(): APIKeyManagement | null {
    return this.apiKeySubject.value;
  }

  get(name, refresh = false): Observable<ApiResponse<APIKeyManagement>> {
    return this.http.get<any>(
      environment.apiBaseUrl + '/api-key-management/one?name=' + name + "&" + (refresh ? 'refresh=true' : ''),
      { context: this.userIdCtx }
    ).pipe(
      takeUntil(this.ngUnsubscribe),
      catchError(this.handleError('api-key-management', []))
    );
  }

  addUsage(id: string) {
    return this.http.put<ApiResponse<APIKeyManagement>>(
      environment.apiBaseUrl + `/api-key-management/${id}/usage/`,
      {},
      { context: this.userIdCtx }
    ).pipe(
      takeUntil(this.ngUnsubscribe),
      catchError(this.handleError('api-key-management', []))
    );
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
