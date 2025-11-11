import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AlertController, IonBackButton, IonButton, IonButtons, IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonChip, IonContent, IonFooter, IonHeader, IonIcon, IonImg, IonInfiniteScroll, IonInfiniteScrollContent, IonItem, IonLabel, IonList, IonNote, IonProgressBar, IonRippleEffect, IonSpinner, IonText, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { AuthService } from 'src/app/services/auth.service';
import { ScrollService } from 'src/app/services/scroll.service';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { StorageService } from 'src/app/services/storage.service';
import { VerificationService } from 'src/app/services/verification.service';
import { RouterModule } from '@angular/router';
import { NgxSkeletonLoaderModule } from 'ngx-skeleton-loader';
import { TimeAgoPipe } from 'src/app/pipes/time-ago.pipe';
import { EmptyRecordsComponent } from 'src/app/shared/empty-records/empty-records.component';
import { Verification } from 'src/app/model/verification';
import { addIcons } from 'ionicons';
import { arrowBack } from 'ionicons/icons';
import { Style } from '@capacitor/status-bar';

@Component({
  selector: 'app-verification-details',
  templateUrl: './verification-details.page.html',
  styleUrls: ['./verification-details.page.scss'],
  standalone: true,
  imports: [CommonModule,
    ReactiveFormsModule,
    RouterModule, IonContent,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, NgxSkeletonLoaderModule, IonList, IonItem,
    IonLabel, IonNote, IonChip, TimeAgoPipe
  ]
})
export class VerificationDetailsPage implements OnInit {
  verification: Verification;
  showShadow = false;
  @ViewChild(IonContent, { static: true }) content!: IonContent;
  constructor(
    private readonly modalCtrl: ModalController,
    private readonly statusBarService: StatusBarService,
    private readonly verificationService: VerificationService,
    private readonly storageService: StorageService,
    private readonly authService: AuthService,
    private readonly alertController: AlertController,
    private readonly scrollService: ScrollService) {

    addIcons({ arrowBack })
  }

  ngOnInit() {
  }

  async ngAfterViewInit() {
    this.initializeStatusBar();
    await this.scrollService.register(this.content);
  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Dark);
  }

  statusColor(status: string): 'success' | 'warning' | 'danger' | 'medium' {
    switch ((status || '').toLowerCase()) {
      case 'verified': return 'success';
      case 'pending': return 'warning';
      case 'rejected': return 'danger';
      default: return 'medium';
    }
  }
  async onClose() {
    const modal = await this.modalCtrl.getTop();
    await modal.dismiss();
  }

  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);

  }

}
