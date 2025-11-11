import { TestBed } from '@angular/core/testing';

import { APIKeyManagementService } from './api-key-management.service';

describe('APIKeyManagementService', () => {
  let service: APIKeyManagementService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(APIKeyManagementService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
