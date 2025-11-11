// src/app/services/storage.service.ts
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage-angular';
import { User } from '../model/user';
import { Verification } from '../model/verification';
import { APIKeyManagement } from '../model/api-key-management';

@Injectable({ providedIn: 'root' })
export class StorageService {
  private _storage: Storage | null = null;
  // A single promise that resolves when storage is created
  private ready: Promise<Storage>;

  constructor(private storage: Storage) {
    // Kick off creation immediately and keep the promise
    this.ready = this.storage.create().then(s => {
      this._storage = s;
      console.log('Storage driver:', this.storage.driver);
      return s;
    });
  }

  /** Ensure storage is created before any operation */
  private async ensureReady(): Promise<Storage> {
    if (this._storage) return this._storage;
    return this.ready; // waits for create()
  }

  async getSavedProfile(): Promise<User | null> {
    const res = await this.getItem<User>('profile');
    return res ?? null;
  }

  async saveProfile(value: User): Promise<void> {
    await this.setItem('profile', value);
  }

  async getAccessToken(): Promise<string | null> {
    return this.getItem<string>('accessToken');
  }

  async saveAccessToken(value: string): Promise<void> {
    await this.setItem('accessToken', value);
  }

  async getRefreshToken(): Promise<string | null> {
    return this.getItem<string>('refreshToken');
  }

  async saveRefreshToken(value: string): Promise<void> {
    await this.setItem('refreshToken', value);
  }

  async setOnboardingCompleted() {
    this.setItem('onboardingCompleted', true);
  }

   async isOnboardingCompleted() {
    return this.getItem('onboardingCompleted');
  }

  async setCameraFacing(currentFacing: 'user' | 'environment') {
    this.setItem('camera_facing', true);
  }

   async getCameraFacing(): Promise<'user' | 'environment'> {
    return this.getItem('camera_facing');
  }

  async getSavedAPIKey(): Promise<APIKeyManagement | null> {
    const res = await this.getItem<APIKeyManagement>('apiKey');
    return res ?? null;
  }

  async saveAPIKey(value: APIKeyManagement): Promise<void> {
    await this.setItem('apiKey', value);
  }

  async getVerificationHistory(): Promise<Verification[]> {
    return this.getItem<string>('verification') as any;
  }

  async saveVerification(value: Verification): Promise<void> {
    await this.setItem('verification', value);
  }

  // Set value
  async setItem<T = any>(key: string, value: T | null | undefined): Promise<void> {
    const store = await this.ensureReady();
    if (value !== null && value !== undefined) {
      await store.set(key, value);
    } else {
      await store.remove(key);
    }
  }

  // Get value
  async getItem<T = any>(key: string): Promise<T | null> {
    const store = await this.ensureReady();
    return (await store.get(key)) as T | null;
  }

  async clear(): Promise<void> {
    const store = await this.ensureReady();
    await store.clear();
  }
}
