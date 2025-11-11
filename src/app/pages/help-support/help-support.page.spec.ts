import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HelpSupportPage } from './help-support.page';

describe('HelpSupportPage', () => {
  let component: HelpSupportPage;
  let fixture: ComponentFixture<HelpSupportPage>;

  beforeEach(() => {
    fixture = TestBed.createComponent(HelpSupportPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
