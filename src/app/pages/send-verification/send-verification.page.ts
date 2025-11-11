// src/app/login/login.page.ts
import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Ionic standalone UI pieces ONLY (no IonicModule here!)
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonNote, IonButton, IonIcon, IonButtons,
  IonText,
  IonBackButton,
  Platform
} from '@ionic/angular/standalone';

// Controllers/services come from @ionic/angular
import { ToastController, LoadingController, IonicModule } from '@ionic/angular';

import { AuthService } from '../../services/auth.service';

import { addIcons } from 'ionicons';
import { eye, eyeOff, arrowBack } from 'ionicons/icons';
import { StorageService } from '../../services/storage.service';
import { Subscription } from 'rxjs';
import { ScrollService } from '../../services/scroll.service';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';
@Component({
  selector: 'app-send-verification',
  templateUrl: './send-verification.page.html',
  styleUrls: ['./send-verification.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    // Standalone Ionic components you actually use:
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonNote, IonButton, IonButtons, IonBackButton,
    IonIcon, IonText
  ]
})
export class SendVerificationPage implements OnInit {
  showPassword = false;
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    type: [null],
  });

  backUrl: "login" | "register" | "profile";

  @ViewChild(IonContent, { static: true }) content!: IonContent;
  private sendVerificationSub?: Subscription;
  private backSub?: Subscription;
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private storageService: StorageService,
    private router: Router,
    private toastCtrl: ToastController,     // from @ionic/angular
    private loadingCtrl: LoadingController, // from @ionic/angular
    private platform: Platform,
    public scrollService: ScrollService,
    private readonly statusBarService: StatusBarService,
  ) {
    addIcons({ arrowBack });

    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state;
    console.log(state);
    if (state) {
      const { backUrl, type } = state as { type: 'verify' | 'reset'; backUrl: 'login' | 'register' | 'profile'; };
      if (!type || (type !== 'verify' && type !== 'reset') || !backUrl || (backUrl !== 'login' && backUrl !== 'register' && backUrl !== 'profile')) {
        this.router.navigateByUrl('/login', { replaceUrl: true });
      }
      this.backUrl = backUrl;
      this.form.patchValue({ type }, { emitEvent: false });
    } else {
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
    this.backSub = this.platform.backButton.subscribeWithPriority(10, async () => {
      this.sendVerificationSub?.unsubscribe();
      this.router.navigateByUrl('/' + this.backUrl, { replaceUrl: true });
    });

  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Dark);
    this.backSub?.unsubscribe();
    this.backSub = undefined;
  }

  ngOnInit(): void {
    // no throw here
  }

  ngAfterViewInit() {
    this.scrollService.register(this.content);
  }

  ngOnDestroy() {
    this.sendVerificationSub?.unsubscribe();
    this.backSub?.unsubscribe();
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast('Please fill in valid credentials.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Processing...', spinner: 'circles' });
    await loading.present();

    const { email, type } = this.form.value as { email: string; type: string };
    this.sendVerificationSub = this.authService.sendVerification({ email, type }).subscribe(async (res) => {
      console.log('Send verification response', res.data);
      if (res.success) {
        await loading.dismiss();
        this.router.navigate(['/otp'], {
          replaceUrl: true,
          state: {
            ...res.data,
            type,
            backUrl: this.backUrl
          }
        });
      } else {
        await loading.dismiss();
        if (res?.message.toLowerCase().includes('user not found')) {
          this.form.controls.email.setErrors({ userNotFound: true });
        }
        this.showToast(res?.message || 'Login failed.');
      }
    }, async (err) => {
      await loading.dismiss();
      this.showToast(err?.message || 'Login failed.');
    });
  }

  async onForgotPassword() {
    const email = this.form.controls.email?.value || '';
    this.authService.forgotPassword(email).subscribe({
      next: () => this.showToast('If that email exists, a reset link was sent.'),
      error: () => this.showToast('Unable to start reset right now.'),
    });
  }

  goToRegister() {
    this.router.navigateByUrl('/register');
  }

  private async showToast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }

  get email() { return this.form.get('email'); }
  get type() { return this.form.get('type'); }

  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);

  }
}
