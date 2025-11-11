// src/app/pages/register/register.page.ts
import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonNote, IonButton, IonIcon, IonButtons,
  IonText, IonBackButton, Platform, IonModal,
  IonFooter,
  IonCheckbox
} from '@ionic/angular/standalone';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { addIcons } from 'ionicons';
import { eye, eyeOff, arrowBack } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { ScrollService } from '../../services/scroll.service';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonNote, IonButton, IonButtons, IonBackButton,
    IonIcon, IonText, IonModal, IonFooter, IonCheckbox
  ]
})
export class RegisterPage implements OnInit {
  showPassword = false;
  termsOpen = false;

  // Maintain a policy version and effective date for auditable consent trails
  readonly TERMS_VERSION = 'v2025-11-11';
  readonly TERMS_EFFECTIVE = new Date('2025-11-11');

  form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
    email: ['', [Validators.required, Validators.email]],
    password: [null, [Validators.required, Validators.minLength(6)]],
    acceptTerms: [false, [Validators.requiredTrue]],  // <— NEW
  });

  private registerSub?: Subscription;
  private backSub?: Subscription;

  @ViewChild(IonContent, { static: true }) content!: IonContent;
  @ViewChild(IonModal) modal?: IonModal;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private platform: Platform,
    public  scrollService: ScrollService,
    private readonly statusBarService: StatusBarService,
  ) {
    this.backSub = this.platform.backButton.subscribeWithPriority(10, async () => {
      this.registerSub?.unsubscribe();
      this.router.navigateByUrl('/landing-page', { replaceUrl: true });
    });
    addIcons({ eye, eyeOff, arrowBack });
  }

  ngOnInit(): void {}
  ngAfterViewInit() { this.scrollService.register(this.content); }
  ngOnDestroy() { this.registerSub?.unsubscribe(); this.backSub?.unsubscribe(); }

  ionViewWillEnter() { this.initializeStatusBar(); }
  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Dark);
    this.backSub?.unsubscribe();
    this.backSub = undefined;
  }

  // Open modal, optionally jump to 'privacy' section
  openTerms(ev: Event, section: 'terms' | 'privacy' | 'consent' = 'terms') {
    ev?.preventDefault();
    this.termsOpen = true;
    // small delay to allow modal paint before jump
    setTimeout(() => this.jump(`#${section}`), 50);
  }

  // Scroll to section inside modal
  jump(selector: string) {
    const el = document.querySelector(selector);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Agree button inside modal -> check the checkbox + close
  async agreeFromModal() {
    this.form.patchValue({ acceptTerms: true });
    this.termsOpen = false;
    // Optional: toast feedback
    // await this.showToast('Terms accepted.');
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      if (!this.form.value.acceptTerms) {
        this.showToast('Please accept the Terms & Privacy first.');
      } else {
        this.showToast('Please fill in valid credentials.');
      }
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Signing up...', spinner: 'circles' });
    await loading.present();

    const { name, email, password } = this.form.value as { name: string; email: string; password: string };

    // Attach auditable consent info
    const consent = {
      accepted: true,
      version: this.TERMS_VERSION,
      acceptedAt: new Date().toISOString(),
      // optionally add: device info, app version, ip (server-side), etc.
    };

    this.registerSub = this.authService.register({ name, email, password }).subscribe(
      async (res) => {
        await loading.dismiss();
        if (res?.success) {
          this.router.navigate(['/otp'], {
            replaceUrl: true,
            state: { name, email, password, type: 'verify', backUrl: 'register' }
          });
        } else {
          if (res?.message?.toLowerCase?.().includes('user already exists')) {
            this.form.controls.email.setErrors({ userExists: true });
          }
          this.showToast(res?.message || 'Signup failed.');
        }
      },
      async (err) => {
        await loading.dismiss();
        this.showToast(err?.message || 'Signup failed.');
      }
    );
  }

  private async showToast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }

  get name()       { return this.form.get('name'); }
  get email()      { return this.form.get('email'); }
  get password()   { return this.form.get('password'); }
  get acceptTerms(){ return this.form.get('acceptTerms'); }

  private initializeStatusBar() {
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);
  }
}
