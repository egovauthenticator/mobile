import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SendVerificationPage } from './send-verification.page';

describe('SendVerificationPage', () => {
  let component: SendVerificationPage;
  let fixture: ComponentFixture<SendVerificationPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(SendVerificationPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
