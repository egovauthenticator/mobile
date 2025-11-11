import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Animation, StatusBar, Style } from '@capacitor/status-bar';

@Injectable({
  providedIn: 'root'
})
export class StatusBarService {

  constructor() {
  }


  async show(show = true) {
    const getPlatform = Capacitor.getPlatform();
    if (getPlatform !== 'web') {
      if (show) {
        await StatusBar.show({ animation: Animation.Fade });
      } else {
        await StatusBar.hide({ animation: Animation.Fade });
      }
    }
  }

  async overLay(overlay = true) {
    const getPlatform = Capacitor.getPlatform();
    if (getPlatform !== 'web') {
      await StatusBar.setOverlaysWebView({ overlay });
    }
  }

  async modifyStatusBar(style: Style, color: string = "") {
    const getPlatform = Capacitor.getPlatform();
    if (getPlatform !== 'web') {
      await StatusBar.setStyle({ style });
      if (color && color !== '') {
        await StatusBar.setBackgroundColor({ color });
      }
    }
  }

}
