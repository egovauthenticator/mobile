import { Injectable } from '@angular/core';
import { User } from '../model/user';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { ApiResponse } from '../model/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  constructor(private http: HttpClient) { }

  update(userId, data: { name: string; email: string; }): Observable<ApiResponse<User>>  {
    return this.http.put<any>(`${environment.apiBaseUrl}/user/${userId}`, data)
      .pipe(
        tap(_ => this.log('user')),
        catchError(this.handleError('user', []))
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
