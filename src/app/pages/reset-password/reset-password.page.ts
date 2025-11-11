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
import { Style } from '@capacitor/status-bar';
import { StatusBarService } from 'src/app/services/status-bar.service';
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.page.html',
  styleUrls: ['./reset-password.page.scss'],
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
export class ResetPasswordPage implements OnInit {
  showPassword = false;
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    hashOtp: ['', [Validators.required]],
    newPassword: [null, [Validators.required, Validators.minLength(6)]],
    confirmPassword: [null, [Validators.required, Validators.minLength(6)]],
  });

  backUrl: "login" | "register" | "profile" | "send-verification";

  @ViewChild(IonContent, { static: true }) content!: IonContent;
  private resetPasswordSub?: Subscription;
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
    addIcons({ eye, eyeOff, arrowBack });

    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state;
    console.log(state);
    if(state) {
      const { backUrl, hashOtp, email } = state as { email: string; hashOtp: string; backUrl: 'login' | 'register' | 'profile'; };
      if(!email || !hashOtp || !backUrl || (backUrl !== 'login' && backUrl !== 'register' && backUrl !== 'profile' && backUrl !== 'send-verification')) {
        this.router.navigateByUrl('/login', { replaceUrl: true });
      }
      if(backUrl === "login") {
        this.backUrl = "send-verification";
      } else {
        this.backUrl = backUrl;
      }
      this.form.patchValue({ email, hashOtp, }, { emitEvent: false });
    } else {
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
    this.backSub = this.platform.backButton.subscribeWithPriority(10, async () => {
      this.resetPasswordSub?.unsubscribe();
      this.router.navigateByUrl('/' + this.backUrl, { replaceUrl: true });
    });

  }

  ngOnInit(): void {
    // no throw here
    this.confirmPassword.valueChanges.subscribe(value => {
      if(value && this.newPassword.value !== value) {
        this.confirmPassword.setErrors({ notMatching: true });
      } else {
        this.confirmPassword.setErrors(null);
      }
    });
  }

  ngAfterViewInit() {
    this.scrollService.register(this.content);
  }

  ngOnDestroy() {
    this.resetPasswordSub?.unsubscribe();
    this.backSub?.unsubscribe();
  }


  ionViewWillEnter() {
    this.initializeStatusBar();
  }
  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Dark);
    this.backSub?.unsubscribe();
    this.backSub = undefined;
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast('Please fill in valid credentials.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Saving password...', spinner: 'circles' });
    await loading.present();

    const { email, hashOtp, newPassword } = this.form.value as { email: string; hashOtp: string; newPassword: string; };
    this.resetPasswordSub = this.authService.resetPassword({ email, hashOtp, password: newPassword }).subscribe(async (res) => {
      console.log('Reset password response', res.data);
      if (res.success) {
        await loading.dismiss();
        this.showToast('Password reset successful. Please login.');
        this.router.navigateByUrl('/login', { replaceUrl: true });
      } else {
        await loading.dismiss();
        if(res?.message.toLowerCase().includes('user not found')) {
          this.form.controls.email.setErrors({ userNotFound: true });
        }

        if(res?.message.toLowerCase().includes('please request a new otp')) {
          this.router.navigate(['/send-verification'], {
            replaceUrl: true,
            state: {
              type: 'reset',
              backUrl: 'login'
            }
          });
        }
      }
    }, async (err) => {
      await loading.dismiss();
      this.showToast(err?.message || 'Reset password failed.');
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

  onBackHandler() {
    let state;
    if(this.backUrl === "send-verification") {
      this.router.navigate(['/send-verification'], {
        replaceUrl: true,
        state: {
          type: "reset",
          backUrl: "login"
        }
      });
    } else {
      this.router.navigate(['/' + this.backUrl], {
        replaceUrl: true,
      });
    }
  }

  private async showToast(message: string) {
    const t = await this.toastCtrl.create({ message, duration: 2200, position: 'bottom' });
    await t.present();
  }

  get email() { return this.form.get('email'); }
  get hashOtp() { return this.form.get('hashOtp'); }
  get newPassword() { return this.form.get('newPassword'); }
  get confirmPassword() { return this.form.get('confirmPassword'); }

  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);

  }
}
