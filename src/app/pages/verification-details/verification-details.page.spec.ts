import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VerificationDetailsPage } from './verification-details.page';

describe('VerificationDetailsPage', () => {
  let component: VerificationDetailsPage;
  let fixture: ComponentFixture<VerificationDetailsPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(VerificationDetailsPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
