import { VerificationService } from 'src/app/services/verification.service';
import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AlertController, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonContent, IonFooter, IonHeader, IonIcon, IonImg, IonInfiniteScroll, IonInfiniteScrollContent, IonProgressBar, IonRefresher, IonRefresherContent, IonRippleEffect, IonSpinner, IonText, IonTitle, IonToolbar, ModalController, RefresherCustomEvent, ToastController } from '@ionic/angular/standalone';
import { RouterModule } from '@angular/router';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, cloudUploadOutline, ellipsisVertical, helpCircle, scanOutline, search } from 'ionicons/icons';
import { ScanPage } from '../scan/scan.page';
import { UploadModalPage } from '../upload-modal/upload-modal.page';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';
import { User } from 'src/app/model/user';
import { Verification } from 'src/app/model/verification';
import { StorageService } from 'src/app/services/storage.service';
import { AuthService } from 'src/app/services/auth.service';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { EmptyRecordsComponent } from 'src/app/shared/empty-records/empty-records.component';
import { TimeAgoPipe } from 'src/app/pipes/time-ago.pipe';
import { ScrollService } from 'src/app/services/scroll.service';
import { VerificationDetailsPage } from '../verification-details/verification-details.page';
import { ActionSheetController, LoadingController } from '@ionic/angular';
import { delayWhen, Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule, IonContent,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonImg,
    IonIcon, IonCard, IonCardContent, IonProgressBar,
    IonRippleEffect, IonCardTitle, IonText,
    NgxSkeletonLoaderModule, IonInfiniteScroll, IonInfiniteScrollContent, IonSpinner,
    EmptyRecordsComponent, IonCardHeader, IonCardSubtitle, TimeAgoPipe, IonFooter,
    IonRefresher, IonRefresherContent]
})
export class HomePage implements OnInit {
  currentProfile: User;
  verificationHistory: Verification[] = [];
  pageIndex = 0;
  pageSize = 10;
  total = 0;
  isLoading = false;
  showShadow = false;
  @ViewChild(IonContent, { static: true }) content!: IonContent;
  private deleteSub?: Subscription;
  @ViewChild(IonRefresher, { static: true }) refresher!: IonRefresher;
  constructor(
    private readonly modalCtrl: ModalController,
    private readonly statusBarService: StatusBarService,
    private readonly verificationService: VerificationService,
    private readonly storageService: StorageService,
    private readonly authService: AuthService,
    private readonly alertController: AlertController,
    private readonly scrollService: ScrollService,
    private readonly actionSheetController: ActionSheetController,
    private readonly loadingCtrl: LoadingController,
    private readonly toastController: ToastController,
  ) {
    this.authService.user$.subscribe(res => {
      if (res) {
        this.currentProfile = res;
      }
    });
    this.scrollService.scrollTop$.subscribe(res => {
      this.showShadow = res > 0;
    });
    addIcons({ search, helpCircle, scanOutline, cloudUploadOutline, ellipsisVertical, checkmarkCircleOutline })
  }

  ngOnInit() {
  }

  async ngAfterViewInit() {
    this.initializeStatusBar();
    await this.scrollService.register(this.content);
  }

  ionViewWillEnter() {
    this.pageIndex = 0;
    this.verificationHistory = [];
    this.isLoading = true;
    this.initHistory();
    this.initializeStatusBar();
  }

  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Dark);
    if (this.deleteSub) {
      this.deleteSub?.unsubscribe();
      this.deleteSub = undefined;
    }
  }

  async ngOnDestroy() {
    if (this.deleteSub) {
      this.deleteSub?.unsubscribe();
      this.deleteSub = undefined;
    }
  }

  async initHistory() {

    try {
      this.verificationService.getVerificationList(
        "", "PSA,PHILSYS,VOTERS", this.currentProfile?.userId, this.pageIndex, this.pageSize
      ).subscribe(res => {

        if (res.success) {
          this.verificationHistory = [...this.verificationHistory, ...res.data.results];
          this.total = res.data.total;
        }
        this.isLoading = false;
        this.storageService.saveProfile(this.currentProfile);
        this.authService.setCurrentLogin(this.currentProfile);

        if (this.refresher) {
          this.refresher.complete();
        }
      });

    } catch (ex) {
      this.isLoading = false;
      await this.presentAlertMessage('Try again!', Array.isArray(ex.message) ? ex.message[0] : ex.message);
    }
  }

  async onShowScanner() {
    const modal = await this.modalCtrl.create({
      component: ScanPage,
      cssClass: 'modal-fullscreen scanner',
      backdropDismiss: false,
      canDismiss: true,
      id: "scanner",
      componentProps: { currentProfile: this.currentProfile },
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss();
    if (data?.success) {
      this.isLoading = true;
      this.verificationHistory = [];
      this.pageIndex = 0;
      this.initHistory();
    }
  }

  async onShowUploader() {
    const modal = await this.modalCtrl.create({
      component: UploadModalPage,
      cssClass: 'modal-fullscreen',
      backdropDismiss: false, // prevent accidental close while thinking
      canDismiss: true,
      id: 'uploader',
      componentProps: { currentProfile: this.currentProfile }
    });
    await modal.present();

    // optionally refresh history on success
    const { data, role } = await modal.onDidDismiss();
    if (data?.success) {
      // TODO: re-fetch your "History" list here if needed
      this.verificationHistory = [];
      this.pageIndex = 0;
      this.initHistory();
    }
  }

  async onOpenDetails(verification: Verification) {
    const modal = await this.modalCtrl.create({
      component: VerificationDetailsPage,
      cssClass: 'modal-fullscreen',
      backdropDismiss: false,
      canDismiss: true,
      componentProps: { currentProfile: this.currentProfile, verification },
    });
    await modal.present();
    modal.onDidDismiss().then((res: { data: { result: string; currentFacing: "user" | "environment" } }) => {
      // this.initHistory();
    });
  }

  async loadMore(ev: CustomEvent) {
    if (!this.isLoading && this.total !== this.verificationHistory.length) {
      this.isLoading = true;
      this.pageIndex++;
      await this.initHistory();
      (ev.target as HTMLIonInfiniteScrollElement).complete();
    } else {
      (ev.target as HTMLIonInfiniteScrollElement).complete();
    }
  }

  handleRefresh(event: RefresherCustomEvent) {
    this.pageIndex = 0;
    this.verificationHistory = [];
    this.isLoading = true;
    this.initHistory();
  }

  async openMenu(verification: Verification) {
    const sheet = await this.actionSheetController.create({
      header: "Menu",
      buttons: [
        {
          text: 'View verification details',
          handler: async () => {
            await this.onOpenDetails(verification);
            await sheet.dismiss();
          },
        },
        {
          text: 'Delete document request?',
          cssClass: 'action-sheet-button-danger',
          handler: async () => {
            const alert = await this.alertController.create({
              header: "Delete Request?",
              message: "Are you sure you want to delete this request? This action cannot be undone.",
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
                    this.deleteSub?.unsubscribe();
                    const loading = await this.loadingCtrl.create({ message: 'Processing please wait...', spinner: 'circles' });
                    await loading.present();
                    this.deleteSub = this.verificationService.delete(verification?.id).subscribe(async (res) => {
                      console.log('Delete request response', res.data);
                      alert.dismiss();
                      await loading.dismiss();
                      if (res.success) {
                        this.presentToastMessage("Deleted successfully");
                        this.isLoading = true;
                        this.verificationHistory = [];
                        this.pageIndex = 0;
                        this.initHistory();
                      } else {
                        alert.dismiss();
                        this.presentAlertMessage("Error updating request", res?.message || 'Failed to updated request.');
                      }
                    }, async (err) => {
                      alert.dismiss();
                      await loading.dismiss();
                      this.presentAlertMessage("Error updating request", err?.error?.message || 'Failed to updated request.');
                    });
                  }
                },
              ],
            });
            await alert.present();
          },
        },
        {
          text: 'Back',
          cssClass: 'close dismiss cancel',
          handler: async () => { sheet.dismiss(); },
        }
      ]
    });
    await sheet.present();
  }

  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
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
      icon: 'checkmark-circle-outline',
    });
    await toast.present();
  }
}
