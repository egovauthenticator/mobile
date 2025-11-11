import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle,
  IonFooter, IonButton, IonIcon, IonInput, IonList,
  IonItem, IonLabel, IonText, IonSpinner,
  IonModal,
  IonButtons,
  Platform,
  AlertController,
  ModalController,
  AlertButton,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { send, helpCircle, chatboxEllipses, informationCircle, close, arrowBack } from 'ionicons/icons';
import { HelpSupportService, ChatMessage } from 'src/app/services/help-support.service';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Style } from '@capacitor/status-bar';
import { ScrollService } from 'src/app/services/scroll.service';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { APIKeyManagementService } from 'src/app/services/api-key-management.service';
import { StorageService } from 'src/app/services/storage.service';

@Component({
  standalone: true,
  selector: 'app-help-support',
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle,
    IonFooter, IonButton, IonIcon, IonInput, IonList, IonItem, IonLabel, IonText, IonSpinner,
    IonModal, IonButtons, RouterModule
  ],
  templateUrl: './help-support.page.html',
  styleUrls: ['./help-support.page.scss'],
})
export class HelpSupportPage implements OnInit {
  @ViewChild(IonContent) content!: IonContent;
  @ViewChild('msgInput', { read: ElementRef }) msgInput!: ElementRef<HTMLInputElement>;

  inputText = '';
  messages: ChatMessage[] = [];
  typing = false;

  faqs: { title: string; items: { q: string; a: string }[] }[] = [];
  backUrl: "home" | "profile" = "home";
  private backSub?: Subscription;
  private apiKeyReloadInFlight = false;
  private lastErrorAt = 0;
  isAPIKeyLoading = true;

  constructor(
    private readonly helpSvc: HelpSupportService,
    private readonly platform: Platform,
    private readonly router: Router,
    public scrollService: ScrollService,
    private readonly statusBarService: StatusBarService,
    private storageService: StorageService,
    private readonly apiKeyManagementService: APIKeyManagementService,
    private readonly alertController: AlertController,
    private readonly modalCtrl: ModalController,) {
    addIcons({ send, helpCircle, chatboxEllipses, informationCircle, arrowBack, close });
    this.backSub = this.platform.backButton.subscribeWithPriority(10, async () => {
      this.router.navigateByUrl('/' + this.backUrl, { replaceUrl: true });
    });

    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state;
    console.log(state);
    if (state) {
      const { backUrl } = state as { backUrl: "home" | "profile"; };

      if (backUrl) {
        this.backUrl = backUrl;
      } else {
        this.backUrl = "home";
      }
    } else {
      this.router.navigateByUrl('/login', { replaceUrl: true });
    }
  }

  async ngOnInit() {
    this.loadAPIKey();
    this.messages = this.helpSvc.getConversation();
    this.faqs = await this.helpSvc.getFAQs();

    if (!this.messages.length) {
      this.helpSvc.addSystemTip(
        'Hi! Ask me about PSA Birth Certificates, PhilSys (National ID), Voter’s Certification, or how to use this app (scan/upload/results).'
      );
      this.messages = this.helpSvc.getConversation();
    }
  }

  ngAfterViewInit() {
    this.initializeStatusBar();
    this.scrollService.register(this.content);
  }

  ngOnDestroy() {
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

  // (unchanged) — used by our error flow
  private loadAPIKey(refresh = false) {
    this.isAPIKeyLoading = true;
    if (!this.apiKeyManagementService?.currentAPIKey?.apiKey) {
      this.apiKeyManagementService.get("google-gen-ai", refresh).subscribe(res => {
        this.isAPIKeyLoading = false;
        if (res && res.data && res.data.apiKey) {
          this.storageService.saveAPIKey(res.data);
          this.apiKeyManagementService.setCurrentAPIKey(res.data);
        } else {
          this.presentAlertMessage('Error', 'Failed to load API key. Please try again later.', [{
            text: 'OK',
            role: '',
            cssClass: 'alert-button-ok',
            handler: async () => { this.close(); }
          }]);
        }
      }, () => {
        this.isAPIKeyLoading = false;
        this.presentAlertMessage('Error', 'Failed to load API key. Please try again later.', [{
          text: 'OK',
          role: '',
          cssClass: 'alert-button-ok',
          handler: async () => { this.close(); }
        }]);
      });
    } else {
      this.isAPIKeyLoading = false;
    }
  }


  /** New flow: push user first, then fetch bot reply. */
  async onSend(raw?: string) {
    const txt = (raw ?? this.inputText).trim();
    this.inputText = '';
    if (!txt) return;

    // Step 1: show user's message immediately
    this.messages = this.helpSvc.addUserMessage(txt);
    setTimeout(() => this.content.scrollToBottom(150), 0);

    // Step 2: show typing while generating reply
    this.typing = true;
    let hasError = false;
    try {
      const updated = await this.helpSvc.generateReplyForLastUser();
      this.messages = updated;
      if (this.apiKeyManagementService?.currentAPIKey?.id) {
        await this.apiKeyManagementService.addUsage(this.apiKeyManagementService?.currentAPIKey?.id).toPromise();
      }
    } catch (ex) {
      hasError = true;

    } finally {
      // brief delay to make typing feel natural
      await new Promise(r => setTimeout(r, 250));
      this.typing = false;
      setTimeout(() => this.content.scrollToBottom(200), 0);
      this.autoFocus();
    }

    if (hasError) {
      const now = Date.now();
      // debounce: only trigger a reload at most once per 3 seconds
      if (!this.apiKeyReloadInFlight && now - this.lastErrorAt > 3000) {
        this.apiKeyReloadInFlight = true;
        this.lastErrorAt = now;
        // silently refresh key (alerts already handled inside loadAPIKey on hard failures)
        try {
          this.storageService.saveAPIKey(null);
          this.apiKeyManagementService.setCurrentAPIKey(null);
          this.loadAPIKey(true);
        } finally {
          // give it a short breathing room before allowing another refresh attempt
          setTimeout(() => (this.apiKeyReloadInFlight = false), 1500);
        }
      }
    }
  }

  async askFAQ(q: string) {
    await this.onSend(q);
  }

  async close() {
    const modal = await this.modalCtrl.getTop();
    modal?.dismiss();
    this.router.navigateByUrl("/" + this.backUrl);
  }

  private autoFocus() {
    setTimeout(() => {
      try { this.msgInput?.nativeElement?.focus(); } catch { }
    }, 40);
  }
  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);

  }

  private async presentAlertMessage(header: string, message: string, buttons: (string | AlertButton)[]) {
    if (!buttons || buttons.length === 0) {
      buttons = [{
        text: 'OK',
        role: 'cancel',
        cssClass: 'alert-button-ok',
      }];
    }
    const alert = await this.alertController.create({
      header,
      message,
      buttons,
    });
    await alert.present();
  }
}
