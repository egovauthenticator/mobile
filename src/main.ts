// src/main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { importProvidersFrom } from '@angular/core';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';

import {
  RouteReuseStrategy,
  provideRouter,
  withPreloading,
  PreloadAllModules,
} from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http'; // 👈 add this
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { IonicModule } from '@ionic/angular';
import { IonicStorageModule } from '@ionic/storage-angular';

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    importProvidersFrom(
      IonicModule.forRoot(),
      IonicStorageModule.forRoot({
        name: '__myappdb',
        // Optional driver order (uncomment if you installed cordova-sqlite-storage):
        // driverOrder: [Drivers.SQLite, Drivers.IndexedDB, Drivers.LocalStorage],
      })
    ),
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptorsFromDi()), // 👈 this provides HttpClient for your AuthService
    // 👇 IMPORTANT: register Ionic + IonicStorage for standalone bootstrapping
  ],
});
