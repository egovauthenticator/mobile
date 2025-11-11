// src/app/login/login.page.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';

// Ionic standalone UI pieces ONLY (no IonicModule here!)
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle, IonCardContent,
  IonItem, IonLabel, IonInput, IonNote, IonButton, IonIcon, IonButtons,
  IonText,
  IonBackButton
} from '@ionic/angular/standalone';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';
@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.page.html',
  styleUrls: ['./landing-page.page.scss'],
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
export class LandingPagePage implements OnInit {

  constructor(
      private readonly statusBarService: StatusBarService,) {
  }

  ngOnInit() {
  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  ionViewWillLeave() {
    this.statusBarService.modifyStatusBar(Style.Light);
  }

  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Dark);
    this.statusBarService.overLay(false);

  }

}
