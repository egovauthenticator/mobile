import { TestBed } from '@angular/core/testing';

import { HelpSupportService } from './help-support.service';

describe('HelpSupportService', () => {
  let service: HelpSupportService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(HelpSupportService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
