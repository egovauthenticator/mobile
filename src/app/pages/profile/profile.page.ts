import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActionSheetController, IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonFooter, IonHeader, IonIcon, IonInput, IonItem, IonLabel, IonList, IonModal, IonNote, IonText, IonTitle, IonToolbar, Platform } from '@ionic/angular/standalone';
import { Router, RouterModule } from '@angular/router';
import { StorageService } from '../../services/storage.service';
import { addIcons } from 'ionicons';
import { arrowBack, checkmarkCircle, footstepsOutline, helpBuoyOutline, idCardOutline, lockOpenOutline, personCircleOutline, volumeHighOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ScrollService } from '../../services/scroll.service';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';
import { AlertController, LoadingController, ModalController, ToastController } from '@ionic/angular';
import { User } from 'src/app/model/user';
import { Subscription } from 'rxjs';
import { UserService } from 'src/app/services/user.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule,

    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    // Standalone Ionic components you actually use:
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
    IonItem, IonLabel, IonInput, IonNote, IonButton, IonButtons, IonBackButton,
    IonIcon, IonText, IonFooter, IonList, IonModal
  ]
})
export class ProfilePage implements OnInit {
  currentProfile: User;
  showShadow = false;
  @ViewChild(IonContent, { static: true }) content!: IonContent;

  formUpdateProfile = this.fb.group({
    name: [null, [Validators.required]],
    email: [null, [Validators.required, Validators.email]],
  });
  isLoading = false;
  private updateSub?: Subscription;
  constructor(
    private fb: FormBuilder,
    private readonly storageService: StorageService,
    private readonly authService: AuthService,
    private alertController: AlertController,
    private platform: Platform,
    public scrollService: ScrollService,
    private readonly statusBarService: StatusBarService,
    public userService: UserService,
    private toastController: ToastController,
    private loadingCtrl: LoadingController,
    private modalController: ModalController,
    private router: Router) {
    addIcons({ arrowBack, idCardOutline, personCircleOutline, helpBuoyOutline, lockOpenOutline, checkmarkCircle });
    this.scrollService.scrollTop$.subscribe(res => {
      this.showShadow = res > 0;
    });
  }

  ngOnInit() {
    this.fillForm();
    this.authService.user$.subscribe(profile => {
      if (profile) {
        this.currentProfile = profile;
      }
    });
  }

  fillForm() {
    this.authService.user$.subscribe(res => {
      if (res) {
        this.formUpdateProfile.setValue({
          name: res.name as any,
          email: res.email as any,
        });
        this.formUpdateProfile.markAsUntouched();
        this.formUpdateProfile.markAsPristine();
      }
    });
  }

  async ngAfterViewInit() {
    this.initializeStatusBar();
    await this.scrollService.register(this.content);
  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Light);
  }

  async onSubmitUpdateProfile() {
    const alert = await this.alertController.create({
      header: "Update profile",
      message: "Are you sure you want update your profile? This action cannot be undone.",
      buttons: [
        {
          text: "CANCEL",
          role: "cancel",
          cssClass: 'alert-button-cancel',
        },
        {
          text: 'OK',
          cssClass: 'alert-button-confirm',
          handler: async () => {
            this.updateSub?.unsubscribe();
            const loading = await this.loadingCtrl.create({ message: 'Saving please wait...', spinner: 'circles' });
            await loading.present();

            const { name, email } = this.formUpdateProfile.value;
            this.updateSub = this.userService.update(this.currentProfile?.userId, { name, email }).subscribe(async (res) => {
              console.log('Update profile response', res.data);
              await loading.dismiss();
              if (res.success) {
                this.currentProfile.name = name;
                this.currentProfile.email = email;
                this.authService.setCurrentLogin(this.currentProfile);
                this.storageService.saveProfile(this.currentProfile);
                this.formUpdateProfile.markAsPristine();
                const modal = await this.modalController.getTop();
                if (modal) modal.dismiss();
                this.presentToastMessage("Profile updated successfully");
              } else {
                this.presentAlertMessage("Error updating profile", res?.message || 'Failed to updated profile.');
              }
            }, async (err) => {
              await loading.dismiss();
              this.presentAlertMessage("Error updating profile", err?.error?.message || 'Failed to updated profile.');
            });
          }
        }
      ]
    });
    await alert.present();
  }

  onResetPassword() {
    this.router.navigate(['/send-verification'], {
      replaceUrl: true,
      state: {
        type: 'reset',
        backUrl: 'profile'
      }
    });
  }

  async onLogout() {
    const alert = await this.alertController.create({
      header: "Are you sure you want to logout?",
      message: "You’ll be signed out from your account and need to log in again to continue.",
      buttons: [
        {
          text: "CANCEL",
          role: "cancel",
          cssClass: 'alert-button-cancel',
        },
        {
          text: 'Yes, Logout',
          cssClass: 'alert-button-danger',
          handler: async () => {
            await this.authService.logout();
            this.router.navigateByUrl('/login', { replaceUrl: true });
          }
        },
      ]
    });
    await alert.present();
  }


  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Dark);
    this.statusBarService.overLay(false);

  }


  private async presentAlertMessage(header, message) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        {
          text: 'OK',
          role: 'cancel',
          cssClass: 'alert-button-ok',
        },
      ],
    });
    await alert.present();

  }

  private async presentToastMessage(message = "Success") {
    const toast = await this.toastController.create({
      message,
      duration: 2500,
      color: 'success',
      position: 'bottom',
      icon: 'checkmark-circle',
    });
    await toast.present();
  }

  get name() { return this.formUpdateProfile.get('name'); }
  get email() { return this.formUpdateProfile.get('email'); }
}
