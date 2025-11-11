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
  IonInputOtp,
  Platform,
} from '@ionic/angular/standalone';

// Controllers/services come from @ionic/angular
import { ToastController, LoadingController, IonicModule } from '@ionic/angular';

import { AuthService } from '../../services/auth.service';

import { addIcons } from 'ionicons';
import { arrowBack } from 'ionicons/icons';
import { StorageService } from '../../services/storage.service';
import { Subscription } from 'rxjs';
import { ScrollService } from '../../services/scroll.service';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';
@Component({
  selector: 'app-otp',
  templateUrl: './otp.page.html',
  styleUrls: ['./otp.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    // Standalone Ionic components you actually use:
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonInput, IonButton, IonButtons, IonBackButton,
    IonIcon, IonText, IonInputOtp, IonNote
  ]
})
export class OtpPage implements OnInit {
  showPassword = false;
  form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    otp: [null, [Validators.required]],
  });

  type: "verify" | "reset";
  backUrl: "login" | "register" | "profile" | "send-verification";

  private verifySub?: Subscription;
  private backSub?: Subscription;
  @ViewChild(IonContent, { static: true }) content!: IonContent;
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
    this.backSub = this.platform.backButton.subscribeWithPriority(10, async () => {
      this.verifySub?.unsubscribe();
      this.router.navigateByUrl('/landing-page', { replaceUrl: true });
    });

    addIcons({ arrowBack, });

    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state;
    console.log(state);
    if (state) {
      const { email, type, backUrl } = state as { email: string; type: 'verify' | 'reset'; backUrl: 'login' | 'register'; };

      if (!email || email.length === 0 || !type || (type !== 'verify' && type !== 'reset') || !backUrl || (backUrl !== 'login' && backUrl !== 'register' && backUrl !== 'profile')) {
        this.router.navigateByUrl('/login', { replaceUrl: true });
      }
      if (type === "reset") {
        this.backUrl = "send-verification";
      } else {
        this.backUrl = backUrl;
      }

      this.type = type;
      this.form.patchValue({ email }, { emitEvent: false });
    } else {
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
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
    this.verifySub?.unsubscribe();
    this.backSub?.unsubscribe();
  }

  async onSubmit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.showToast('Please fill in valid credentials.');
      return;
    }

    const loading = await this.loadingCtrl.create({ message: 'Verifying...', spinner: 'circles' });
    await loading.present();

    const { email, otp } = this.form.value as { email: string; otp: string };
    this.verifySub = this.authService.verify({ email, otp }).subscribe(async (res) => {
      console.log('Verification response', res.data);
      await loading.dismiss();
      if (res.success) {
        if (this.type === 'reset') {
          this.router.navigate(['/reset-password'], {
            replaceUrl: true,
            state: {
              email,
              hashOtp: res.data["hashOtp"],
              backUrl: this.backUrl
            }
          });
        } else {
          this.router.navigateByUrl('/login', { replaceUrl: true });
        }
      } else {
        if (res?.message.toLowerCase().includes('invalid otp')) {
          this.form.controls.otp.setErrors({ invalidOtp: true });
        }
        this.showToast(res?.message || 'Login failed.');
      }
    }, async (err) => {
      await loading.dismiss();
      this.showToast(err?.message || 'Login failed.');
    });
  }

  onBackHandler() {
    let state = {
      type: this.type,
      backUrl: null
    };
    if (this.type === "reset") {
      state.backUrl = "login";
    } else {
      state.backUrl = "register";
    }
    this.router.navigate(['/' + this.backUrl], {
      replaceUrl: true,
      state
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
  get otp() { return this.form.get('otp'); }

  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);

  }
}
