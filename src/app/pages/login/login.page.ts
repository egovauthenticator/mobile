// src/app/login/login.page.ts
import { Component, HostListener, OnInit, ViewChild } from '@angular/core';
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
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
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
export class LoginPage implements OnInit {
  showPassword = false;
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: [null, [Validators.required]],
  });

  private loginSub?: Subscription;
  private backSub?: Subscription;

  @ViewChild(IonContent, { static: true }) content!: IonContent;
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private storageService: StorageService,
    private readonly statusBarService: StatusBarService,
    private router: Router,
    private toastCtrl: ToastController,     // from @ionic/angular
    private loadingCtrl: LoadingController, // from @ionic/angular
    private platform: Platform,
    public scrollService: ScrollService
  ) {
    this.backSub = this.platform.backButton.subscribeWithPriority(10, async () => {
      this.loginSub?.unsubscribe();
      this.router.navigateByUrl("/landing-page", { replaceUrl: true });
    });

    addIcons({ eye, eyeOff, arrowBack });
  }

  ngOnInit(): void {
    // no throw here
  }

  ngAfterViewInit() {
    this.scrollService.register(this.content);
  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Dark);
    this.backSub?.unsubscribe();
    this.backSub = undefined;
  }

  // Ionic/Angular lifecycle—cancel when leaving/destroying the view
  ngOnDestroy() {
    this.loginSub?.unsubscribe();
    this.backSub?.unsubscribe();
  }

  async onSubmit() {
    this.loginSub?.unsubscribe();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast('Please fill in valid credentials.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Signing in…', spinner: 'circles' });
    await loading.present();

    const { email, password } = this.form.value as { email: string; password: string };
    this.loginSub = this.authService.login({ email, password }).subscribe(async (res) => {
      console.log('Login response', res.data);
      if (res.success) {
        this.storageService.saveProfile(res.data).then(async () => {
          this.authService.setCurrentLogin(res.data);
          await loading.dismiss();
          this.router.navigateByUrl('/home', { replaceUrl: true });
        });
      } else {
        await loading.dismiss();
        if (res?.message.toLowerCase().includes('user not found')) {
          this.form.controls.email.setErrors({ userNotFound: true });
        }
        if (res?.message.toLowerCase().includes('password incorrect')) {
          this.form.controls.password.setErrors({ passwordIncorrect: true });
        }
        if (res?.message.toLowerCase().includes('user is not verified')) {
          this.router.navigate(['/otp'], {
            replaceUrl: true,
            state: {
              email,
              type: 'verify'
            }
          });
        }
        this.showToast(res?.message || 'Login failed.');
      }
    }, async (err) => {
      await loading.dismiss();
      this.showToast(err?.message || 'Login failed.');
    });
  }

  async onForgotPassword() {
    this.router.navigate(['/send-verification'], {
      replaceUrl: true,
      state: {
        type: 'reset',
        backUrl: 'login'
      }
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
  get password() { return this.form.get('password'); }

  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);

  }
}
