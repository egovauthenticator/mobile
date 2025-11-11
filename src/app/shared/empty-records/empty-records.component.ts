import { CommonModule } from '@angular/common';
import { Component, Input, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { IonCard, IonCardContent, IonCardHeader, IonCardSubtitle, IonCardTitle, IonIcon, IonRippleEffect, IonText } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudOutline } from 'ionicons/icons';

@Component({
  selector: 'empty-records',
  templateUrl: './empty-records.component.html',
  styleUrls: ['./empty-records.component.scss'],
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule,FormsModule, IonIcon
  ]
})
export class EmptyRecordsComponent  implements OnInit {

  @Input("src") src: string = null;
  @Input("icon") icon: string = null;
  @Input("title") title: string = null;
  @Input("description") description: string = null;
  constructor() {
    addIcons({ cloudOutline })
  }

  ngOnInit() {}

}
