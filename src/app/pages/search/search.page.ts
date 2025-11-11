import { EmptyRecordsComponent } from 'src/app/shared/empty-records/empty-records.component';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonBackButton, IonButton, IonContent, IonFooter, IonHeader, IonTitle, IonToolbar, IonButtons, IonIcon, IonItem, IonInput, IonList, IonLabel, IonNote, AlertController, IonSpinner, ModalController, Platform, ActionSheetController, LoadingController, IonText } from '@ionic/angular/standalone';
import { ScrollService } from 'src/app/services/scroll.service';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { arrowBackOutline, closeOutline, documentAttachOutline, readerOutline, searchOutline } from 'ionicons/icons';
import { addIcons } from 'ionicons';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { User } from 'src/app/model/user';
import { AuthService } from 'src/app/services/auth.service';
import { TimeAgoPipe } from 'src/app/pipes/time-ago.pipe';
import { debounceTime, delayWhen, distinctUntilChanged, finalize, Subject, Subscription, switchMap, tap, timer } from 'rxjs';
import { Verification } from 'src/app/model/verification';
import { VerificationService } from 'src/app/services/verification.service';
import { VerificationDetailsPage } from '../verification-details/verification-details.page';

@Component({
  selector: 'app-search',
  templateUrl: './search.page.html',
  styleUrls: ['./search.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, CommonModule, FormsModule,
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    IonContent, IonHeader, IonToolbar, IonButton, IonButtons,
    IonIcon, IonItem, IonInput, IonList, NgxSkeletonLoaderModule, EmptyRecordsComponent,
    IonLabel, IonNote, TimeAgoPipe, IonSpinner, IonText
  ]
})
export class SearchPage implements OnInit {
  currentProfile: User;
  @ViewChild(IonContent, { static: true }) content!: IonContent;
  @ViewChild('searchInput', { static: false }) searchInput!: IonInput;
  backUrl: string;
  showShadow = false;
  isLoading = false;
  verificationHistory: Verification[] = [];
  isSearchComplete = false;
  type: {
    psa: boolean;
    philSys: boolean;
    voters: boolean;
  } = {
      psa: false,
      philSys: false,
      voters: false,
    };
  private searchSubject = new Subject<{ query: string, type: string; }>();
  private subscription: any;
  private backSub?: Subscription;
  constructor(
    private platform: Platform,
    public readonly scrollService: ScrollService,
    private readonly router: Router,
    private readonly statusBarService: StatusBarService,
    private readonly verificationService: VerificationService,
    private readonly authService: AuthService,
    private readonly alertController: AlertController,
    private readonly modalController: ModalController,
    private readonly modalCtrl: ModalController,
    private readonly loadingCtrl: LoadingController, // from @ionic/angular
    private readonly actionSheetController: ActionSheetController, // from @ionic/angular
    private readonly route: ActivatedRoute) {
    addIcons({ arrowBackOutline, searchOutline, documentAttachOutline, readerOutline, closeOutline });
    this.authService.user$.subscribe(res => {
      if (res) {
        this.currentProfile = res;
      }
    });
    this.backSub = this.platform.backButton.subscribeWithPriority(10, async () => {

      const modal = await this.modalCtrl.getTop();
      const activeSheet = await this.actionSheetController.getTop();
      const loading = await this.loadingCtrl.getTop();
      if (modal) {
        await modal.dismiss();
        return;
      }
      if (activeSheet) {
        await activeSheet.dismiss();
        return;
      }
      if (loading) {
        await loading.dismiss();
        return;
      }
      this.router.navigateByUrl(this.backUrl);
    });
    this.scrollService.scrollTop$.subscribe(res => {
      this.showShadow = res > 0;
    });
    this.route.queryParams.subscribe(params => {
      console.log('Query Params:', params);
      const { backUrl } = params;
      if (backUrl) {
        this.backUrl = backUrl;
      }
    });

    this.subscription = this.searchSubject
      .pipe(
        debounceTime(1000), // wait 300ms after the last keypress
        distinctUntilChanged(),
        switchMap((params) =>
          this.verificationService.getVerificationList(params.query, params.type, this.currentProfile?.userId, 0, 9999999).pipe(

            // ✅ hide spinner after completion
            finalize(() => {
              this.isLoading = false;
            })
          )
        )
      ).subscribe(res => {
        this.isSearchComplete = true;
        if (res.success) {
          this.verificationHistory = res.data.results || [];
        }
        this.isLoading = false;
      }, (error) => {
        this.verificationHistory = [];
        this.isSearchComplete = true;
        this.isLoading = false;
      });

  }

  ngOnInit() {
  }

  async ngAfterViewInit() {

    await this.scrollService.register(this.content);
    setTimeout(() => {
      this.searchInput.setFocus();
    }, 100);
  }

  ionViewWillEnter() {
    this.initializeStatusBar();
    // Give the DOM a small delay to settle before focusing
    setTimeout(() => {
      if (this.searchInput) this.searchInput.setFocus();
    }, 300);
  }

  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Dark);
    this.onClear();
    this.searchInput.value = null;
  }

  ngOnDestroy() {
    this.searchSubject?.unsubscribe();
    this.searchSubject = undefined;
    this.backSub?.unsubscribe();
    this.backSub = undefined;
    this.subscription?.unsubscribe();
    this.onClear();
    this.searchInput.value = null;
  }

  onSelectType(key) {
    this.type[key] = !this.type[key];
    this.isLoading = true;
    const value = this.searchInput?.value?.toString()?.trim();
    const type = [];
    if (this.type.psa) {
      type.push("PSA");
    }
    if (this.type.philSys) {
      type.push("PHILSYS");
    }
    if (this.type.voters) {
      type.push("VOTERS");
    }
    this.searchSubject.next({ query: value, type: type.join(",") });
  }

  async onKey(event: KeyboardEvent) {
    try {
      const key = event.key?.toLowerCase();
      const value = (event.target as HTMLInputElement).value.trim();

      if (!value) {
        this.onClear();
        return;
      }

      // Works for both native "search" key and desktop Enter
      if (key === 'enter' || key === 'search') {
        this.isLoading = true;
        const type = [];
        if (this.type.psa) {
          type.push("PSA");
        }
        if (this.type.philSys) {
          type.push("PHILSYS");
        }
        if (this.type.voters) {
          type.push("VOTERS");
        }
        this.searchSubject.next({ query: value, type: type.join(",") });
      }
    } catch (ex) {
      this.isLoading = false;
      this.isSearchComplete = false;
      this.presentAlertMessage('Try again!', Array.isArray(ex.message) ? ex.message[0] : ex.message);
    }
  }

  onInput(event: any) {
    const curr = event?.target?.value ?? '';
    if (!curr) {
      this.onClear();
      return;
    }
    this.isLoading = true;
    const value = event.target.value.trim();
    const type = [];
    if (this.type.psa) {
      type.push("PSA");
    }
    if (this.type.philSys) {
      type.push("PHILSYS");
    }
    if (this.type.voters) {
      type.push("VOTERS");
    }
    this.searchSubject.next({ query: value, type: type.join(",") });

  }

  onClear() {
    this.verificationHistory = [];
    this.isSearchComplete = false;
    this.type.psa = false;
    this.type.philSys = false;
    this.type.voters = false;
  }

  // Open search modal and use returned placeId
  async onOpenDetails(verification: Verification) {
    const modal = await this.modalController.create({
      component: VerificationDetailsPage,
      cssClass: 'modal-fullscreen',
      backdropDismiss: false,
      canDismiss: true,
      componentProps: { verification, currentProfile: this.currentProfile },
    });
    await modal.present();

    const { data, role } = await modal.onDidDismiss<{
    }>();
    if (role !== 'ok' || !data) {
      this.statusBarService.modifyStatusBar(Style.Light);
    };
    this.statusBarService.modifyStatusBar(Style.Light);
    modal.dismiss();
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
}
