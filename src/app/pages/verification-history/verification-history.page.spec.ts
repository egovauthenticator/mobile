import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerificationHistoryPage } from './verification-history.page';

describe('VerificationHistoryPage', () => {
  let component: VerificationHistoryPage;
  let fixture: ComponentFixture<VerificationHistoryPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VerificationHistoryPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
