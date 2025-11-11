import { Component } from '@angular/core';
import { ActionSheetController, AlertController, IonApp, IonRouterOutlet, LoadingController, ModalController, Platform } from '@ionic/angular/standalone';
import { StatusBar, Style, Animation } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private backSub?: Subscription;
  constructor(
    private readonly platform: Platform,
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly modalCtrl: ModalController,
    private readonly loadingCtrl: LoadingController, // from @ionic/angular
    private readonly actionSheetController: ActionSheetController,
    private readonly alertController: AlertController,
    private readonly authService: AuthService
  ) {
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
      console.log('Current route:', this.router.url);

      const page = this.router.url;

      const extra = [];
      const defaultButtons = [
        {
          text: 'Minimize the app?',
          handler: async () => App.minimizeApp(),
        },
        {
          text: 'Close the app?',
          handler: async () => App.exitApp(),
        },
        {
          text: 'Back',
          cssClass: 'close dismiss cancel',
          handler: async () => { this.actionSheetController.dismiss(); },
        }
      ];
      if (page.includes("/profile") || page.includes("/verification-history")) {
        this.router.navigateByUrl("/home")
        return;
      }
      else if (page.includes("/home")) {
        extra.push(
          {
            text: 'Logout',
            handler: async () => {
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
                      await this.router.navigateByUrl('/login', { replaceUrl: true });
                    }
                  },
                ],
              });
              await alert.present();
            },
          })
        const sheet = await this.actionSheetController.create({ buttons: [...extra, ...defaultButtons] });
        await sheet.present();
      }
      else if (page.includes("/landing-page")) {
        const sheet = await this.actionSheetController.create({ buttons: defaultButtons });
        await sheet.present();
      }

    });

  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  ionViewWillLeave() {
    this.backSub?.unsubscribe();
    this.backSub = undefined;
  }

  async initializeStatusBar() {
    if (Capacitor.getPlatform() !== 'web') {
      await StatusBar.show({ animation: Animation.Fade });
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setOverlaysWebView({ overlay: false });
    }
  }

  ngOnInit(): void {


    this.platform.ready().then(async () => {
      this.initializeStatusBar();
    });

  }

  ngOnDestroy() {
    this.backSub?.unsubscribe();
  }
}
