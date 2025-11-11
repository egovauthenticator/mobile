import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UploadModalPage } from './upload-modal.page';

describe('UploadModalPage', () => {
  let component: UploadModalPage;
  let fixture: ComponentFixture<UploadModalPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(UploadModalPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
