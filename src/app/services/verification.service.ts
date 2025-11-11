import { HttpClient, HttpEvent } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { catchError, Observable, of, tap, throwError } from 'rxjs';
import { environment } from 'src/environments/environment';
import { Verification } from '../model/verification';
import { ApiResponse } from '../model/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class VerificationService {

  // TODO: point this to your API route
  constructor(private http: HttpClient) { }

  verifyPSA(payload: {
    userId: string;
    d: string;
    dob: string;
    pcn: string;
    pob: string;
    fn: string;
    ln: string;
    mn: string;
    s: string;
    sf: string;
  }): Observable<ApiResponse<Verification>> {
    return this.http.post<any>(`${environment.apiBaseUrl}/verification/verify/psa`, payload);
  }

  verifyOCR(
    formData: FormData
  ): Observable<HttpEvent<ApiResponse<Verification>>> {
    const form = formData instanceof FormData ? formData : (() => {
      const f = new FormData();
      f.append('file', formData);
      return f;
    })();

    return this.http.post<ApiResponse<Verification>>(
      `${environment.apiBaseUrl}/verification/verify/ocr`,
      form,
      { reportProgress: true, observe: 'events' }
    ).pipe(
      catchError(err => throwError(() => err))
    );
  }

  getVerificationList(
    q: string = "",
    type: string,
    userId: string,
    pageIndex: number,
    pageSize: number,): Observable<ApiResponse<{ results: Verification[]; total: number; }>> {
    return this.http.get<any>(environment.apiBaseUrl + '/verification/' + userId + '/list', {
      params: {
        q,
        type,
        pageIndex,
        pageSize
      }
    })
      .pipe(
        tap(_ => this.log('verification')),
        catchError(this.handleError('verification', []))
      );
  }

  delete(id: string): Observable<ApiResponse<Verification>> {
    return this.http.delete<any>(`${environment.apiBaseUrl}/verification/${id}`)
      .pipe(
        catchError(this.handleError('verification', []))
      );
  }

  handleError<T>(operation = 'operation', result?: T) {
    return (error: any): Observable<T> => {
      this.log(error.message);
      return of(error.error as T);
    };
  }

  log(message: string) {
    console.log(message);
  }

}
