import { Component, OnDestroy, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonContent, IonHeader, IonTitle, IonToolbar,
  IonButtons, IonButton, IonIcon, IonFab, IonFabButton,
  ModalController, AlertController,
  AlertButton,
  LoadingController,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { arrowBack, cameraOutline, cameraReverse, checkmarkCircleOutline, qrCodeOutline, repeat } from 'ionicons/icons';
import jsQR from 'jsqr';
import { createWorker, type Worker as TesseractWorker, type RecognizeResult } from 'tesseract.js';
import { Verification } from 'src/app/model/verification';
import { environment } from 'src/environments/environment';
import { VerificationService } from 'src/app/services/verification.service';
import { ApiResponse } from 'src/app/model/api-response.model';
import { HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';
import { User } from 'src/app/model/user';

// Optional: replace with your real ScrollService
class ScrollService { public scrollTop$ = { subscribe: () => ({ unsubscribe() { } }) as any }; }

@Component({
  selector: 'app-scan',
  standalone: true,
  imports: [
    CommonModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonButtons, IonButton, IonIcon, IonFab, IonFabButton,
    IonSegment, IonSegmentButton, IonLabel
  ],
  templateUrl: './scan.page.html',
  styleUrls: ['./scan.page.scss']
})
export class ScanPage implements OnInit, OnDestroy {
  currentProfile: User;
  private readonly MIN_VIDEO_W = 640;
  private readonly MIN_VIDEO_H = 480;

  // kept for compatibility; auto OCR sampling removed in new flow
  private readonly OCR_WARMUP_FRAMES = 15;

  @ViewChild('videoEl', { static: true }) videoEl!: ElementRef<HTMLVideoElement>;

  scrollService = new ScrollService();

  // UI state
  showSplash = true;
  isScanning = false;
  showRetry = false;               // only used in OCR mode now
  needsTapToStart = false;
  unsupportedMsg: string | null = null;
  previewSrc: string | null = null;

  // camera/device
  hasMultipleCams = false;
  currentFacing: 'user' | 'environment' = 'environment';
  private stream: MediaStream | null = null;

  // workers/canvas
  private ocrWorker: TesseractWorker | null = null;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private rafId: number | null = null;
  private isOcrBusy = false;

  // results
  lastQrText: string | null = null;
  lastOcrText: string | null = null;

  // frame counter for warmup
  private framesSeen = 0;

  // Mode & submit flag
  mode: 'qr' | 'ocr' = 'qr';
  isSubmitting = false;
  progress = 0;
  loading = false;
  uploading = false;
  constructor(
    private readonly modalCtrl: ModalController,
    private readonly alertController: AlertController,
    private readonly loadingCtrl: LoadingController,
    private readonly verificationService: VerificationService,
    private readonly statusBarService: StatusBarService,
  ) {
    addIcons({ arrowBack, cameraReverse, repeat, cameraOutline, qrCodeOutline, checkmarkCircleOutline });
  }

  async ngOnInit() {
    // Prepare a canvas for frame sampling
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      this.unsupportedMsg = 'Canvas not supported.';
      return;
    }
    this.ctx = ctx;

    if (!navigator.mediaDevices?.getUserMedia) {
      this.unsupportedMsg = 'Camera not supported by this browser.';
      return;
    }

    try {
      await this.initOcrWorker();  // ready for future OCR needs
      await this.openCamera();
    } catch (e: any) {
      if (String(e).includes('NotAllowedError') || String(e).includes('play()')) {
        this.needsTapToStart = true;
      } else {
        this.unsupportedMsg = (e?.message ?? e) || 'Failed to start camera.';
      }
    }
  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  async ngAfterViewInit() {
    this.initializeStatusBar();
  }

  ngOnDestroy(): void {
    this.stopLoop();
    this.stopStream();
    this.terminateOcr();
  }

  // ---------- UI handlers ----------
  close() {
    this.stopLoop();
    this.stopStream();
    this.terminateOcr();
    this.modalCtrl.dismiss();
  }

  async onTapToStart() {
    try {
      await this.openCamera();
      this.needsTapToStart = false;
    } catch (e: any) {
      this.unsupportedMsg = (e?.message ?? e) || 'Unable to start camera.';
    }
  }

  async switchCamera() {
    if (this.previewSrc) return; // don't switch while previewing
    this.currentFacing = this.currentFacing === 'user' ? 'environment' : 'user';
    await this.reopenCamera();
  }

  onRetry() {
    // Only used in OCR mode to retake
    this.previewSrc = null;
    this.showRetry = false;
    this.isScanning = true;
    this.framesSeen = 0;
    this.startLoop();
  }

  // Mode switch
  onModeChange(value: 'qr' | 'ocr' | any) {
    this.mode = value as 'qr' | 'ocr';

    // Reset shared UI state
    this.previewSrc = null;
    this.showRetry = false;

    // In both modes we keep the camera live;
    // QR mode: auto-scan; OCR mode: wait for Capture
    this.isScanning = true;
    this.framesSeen = 0;
    this.startLoop();
  }

  // OCR: capture still and show preview (hidden in QR mode by template)
  onCapture() {
    if (!this.isScanning) return;
    this.capturePreview();
    this.stopLoop();
    this.showRetry = true; // retake available in OCR mode
  }

  // OCR: submit preview to /verification/verify/ocr
  async onSubmitPreview() {
    if (!this.previewSrc) return;

    this.isSubmitting = true;

    try {
      // 🔎 First, try QR from the captured still
      const qrText = await this.tryQrOnPreview();
      if (qrText) {
        this.lastQrText = qrText;

        // Reuse your existing QR verification flow
        // (it already shows its own loading and handles modal dismissal)
        await this.verifyPsaIfNeeded('qr');

        // If verifyPsaIfNeeded handled success/failure, we’re done here.
        // ShowRetry is already controlled inside verifyPsaIfNeeded on failures.
        return;
      }

      // 📝 No QR found → proceed with your current OCR upload flow
      const loading = await this.loadingCtrl.create({
        message: 'Uploading please wait...',
        spinner: 'crescent',
        backdropDismiss: false
      });
      await loading.present();

      const blob = dataUrlToBlob(this.previewSrc);
      const form = new FormData();
      form.append('image', blob, 'capture.jpg');
      form.append('userId', '1'); // TODO: real user id

      this.verificationService.verifyOCR(form).subscribe({
        next: async (event: HttpEvent<any>) => {
          if (event.type === HttpEventType.UploadProgress && event.total) {
            this.progress = Math.round(100 * (event.loaded / event.total));
          } else if (event.type === HttpEventType.Response) {
            this.loading = false;
            this.uploading = false;
            await loading.dismiss();
            const response = event.body as ApiResponse<Verification>;

            if (response.success) {
              await this.presentAlert(
                'Verification Successful',
                response.data?.type === 'PSA'
                  ? 'PSA Birth Certificate is verified and authentic'
                  : 'Voters Identification is verified and authentic',
                [
                  {
                    text: 'OK',
                    handler: () => {
                      this.alertController.dismiss();
                      this.modalCtrl.dismiss({
                        success: true,
                        data: event.body?.data ?? null
                      });
                    }
                  }
                ]
              );
            } else {
              await this.presentAlert(
                'Verification failed',
                response?.message || 'Not activated / not found.'
              );
              this.showRetry = true;
            }
          }
        },
        error: async (err: HttpErrorResponse) => {
          this.uploading = false;
          this.loading = false;
          this.showRetry = true;
          await loading.dismiss();
          this.presentAlert(
            'Verification failed',
            err?.error?.message ?? 'Scan failed. Please try again.'
          );
        }
      });
    } catch (e: any) {
      await this.presentAlert(
        'Verification failed',
        e?.message || 'Unable to submit image.'
      );
      this.showRetry = true;
    } finally {
      this.isSubmitting = false;
    }
  }

  // ---------- Camera ----------
  private async openCamera() {
    this.showSplash = true;
    this.isScanning = false;
    this.previewSrc = null;
    this.showRetry = false;
    this.framesSeen = 0;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.hasMultipleCams = devices.filter(d => d.kind === 'videoinput').length > 1;
    } catch { /* ignore */ }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: this.currentFacing },
        width: { ideal: 1280, min: this.MIN_VIDEO_W },
        height: { ideal: 720, min: this.MIN_VIDEO_H }
      }
    };

    this.stopStream();
    this.stream = await navigator.mediaDevices.getUserMedia(constraints);

    const video = this.videoEl.nativeElement;
    video.srcObject = this.stream;
    await video.play();

    // Wait for actual dimensions
    await new Promise<void>((resolve) => {
      const ready = () => {
        if (video.videoWidth > 0) {
          this.canvas.width = video.videoWidth;
          this.canvas.height = video.videoHeight;
          resolve();
        } else {
          requestAnimationFrame(ready);
        }
      };
      ready();
    });

    this.showSplash = false;
    this.isScanning = true;
    this.startLoop();
  }

  private async reopenCamera() {
    this.stopLoop();
    await this.openCamera();
  }

  private stopStream() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  // ---------- Main loop (continuous) ----------
  private startLoop() {
    const loop = () => {
      if (!this.isScanning) return;
      this.rafId = requestAnimationFrame(loop);

      const video = this.videoEl.nativeElement;
      if (video.readyState < 2) return;

      // Draw current frame
      this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
      this.framesSeen++;

      // Auto-QR only in QR mode
      if (this.mode === 'qr' && !this.previewSrc) {
        try {
          const img = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
          const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
          if (qr?.data) {
            this.lastQrText = qr.data;
            this.capturePreview(); // snapshot for visual confirmation
            this.finish('qr');
            return;
          }
        } catch { /* ignore */ }
      }

      // OCR mode: no auto-OCR; user uses Capture → Submit
    };

    // Avoid double loops
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(loop);
    }
  }

  private stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.isScanning = false;
  }

  // ---------- OCR worker (kept ready; not auto-used) ----------
  private async initOcrWorker() {
    this.ocrWorker = await createWorker('eng');
    await this.ocrWorker.load();
    await this.ocrWorker.reinitialize('eng');
    await this.ocrWorker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789:-/#',
      preserve_interword_spaces: '1'
    });
  }

  private terminateOcr() {
    if (this.ocrWorker) {
      this.ocrWorker.terminate?.();
      this.ocrWorker = null;
    }
  }

  // ---------- Result handling ----------
  private capturePreview() {
    this.previewSrc = this.canvas.toDataURL('image/jpeg', 0.85);
  }

  private finish(kind: 'qr' | 'ocr') {
    this.isScanning = false;
    // In QR mode, we do NOT show Retry per your request
    this.showRetry = false;
    this.stopLoop();
    console.log('kind:', kind, 'QR:', this.lastQrText, 'OCR:', this.lastOcrText);

    // Auto-verify only for QR auto-detect (unchanged)
    if (kind === 'qr') {
      this.verifyPsaIfNeeded('qr');
    }
  }

  // ===== PSA helpers & local API call =====
  private async verifyPsaIfNeeded(kind: 'qr' | 'ocr') {
    if (kind !== 'qr') return;
    const raw = this.lastQrText || '';
    if (!raw.includes('PSA')) return;

    // Prevent user actions
    this.isScanning = false;
    this.showRetry = false;

    const loading = await this.loadingCtrl.create({
      message: 'Verifying PSA QR...',
      spinner: 'crescent',
      backdropDismiss: false,
      cssClass: 'psa-loading-block'
    });

    await loading.present();

    try {
      let body: any;
      try {
        body = this.buildLocalPsaBodyFromQr(raw);
      } catch (e) {
        await loading.dismiss();
        await this.presentAlert('Error scanned QR', 'The scanned QR content cannot be parsed.');
        return;
      }

      const res = await this.verificationService.verifyPSA({
        ...body,
        userId: this.currentProfile?.userId
      }).toPromise();


      if (!res?.success) {
        await loading.dismiss();
        this.showRetry = true
        await this.presentAlert('Error scanned QR', 'Unexpected response from verification server.');
        return;
      }

      await loading.dismiss();
      if (res?.data.status === 'AUTHENTIC') {
        await this.presentAlert('Verification Successful', 'This PhilSys ID is valid and authentic.', [
          {
            text: "OK",
            handler: () => {
              this.alertController.dismiss();
              this.modalCtrl.dismiss({ success: true, data: res?.data ?? null });
            }
          }
        ]);
      } else {
        this.showRetry = true
        await this.presentAlert('Philsys ID maybe Fake or not found', res?.message);
      }

    } catch (err) {
      this.showRetry = true
      console.error('verifyPsaIfNeeded error', err);
      await loading.dismiss();
      await this.presentAlert('Network Error', 'Unable to contact verification server.');
    }
  }

  private buildLocalPsaBodyFromQr(qrText: string) {
    const obj = JSON.parse(qrText);
    const sb = obj.subject ?? {};

    const d = this.parseHumanDateToISO(obj.DateIssued);
    const dob = this.parseHumanDateToISO(sb.DOB);
    const pcn = (sb.PCN ?? '').toString().replace(/[^0-9]/g, '');
    let pob = (sb.POB ?? '').toString().trim();
    pob = pob.replace(/,\s*/g, ', ');

    const fn = (sb.fName ?? '').toString().trim().toUpperCase();
    const ln = (sb.lName ?? '').toString().trim().toUpperCase();
    const mn = (sb.mName ?? '').toString().trim().toUpperCase();
    const s = (sb.sex ?? '').toString().trim();
    const sf = (sb.Suffix ?? '').toString().trim();

    return {
      d, dob, pcn, pob,
      fn, ln, mn,
      s: s || 'string',
      sf: sf || 'Male'
    };
  }

  private parseHumanDateToISO(input: string | undefined): string {
    if (!input) return '';
    const s = input.toString().trim();

    const dmy = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (dmy) {
      const [_, d, mon, y] = dmy;
      const m = this.monthTo2(mon);
      return `${y}-${m}-${this.pad2(+d)}`;
    }
    const mdy = s.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/);
    if (mdy) {
      const [_, mon, d, y] = mdy;
      const m = this.monthTo2(mon);
      return `${y}-${m}-${this.pad2(+d)}`;
    }
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const m = this.pad2(dt.getMonth() + 1);
      const d = this.pad2(dt.getDate());
      return `${y}-${m}-${d}`;
    }
    return '';
  }
  private monthTo2(mon: string): string {
    const m = mon.toLowerCase();
    const map: Record<string, string> = {
      jan: '01', january: '01', feb: '02', february: '02', mar: '03', march: '03',
      apr: '04', april: '04', may: '05',
      jun: '06', june: '06', jul: '07', july: '07',
      aug: '08', august: '08', sep: '09', sept: '09', september: '09',
      oct: '10', october: '10', nov: '11', november: '11', dec: '12', december: '12'
    };
    return map[m] || '01';
  }
  private pad2(n: number) { return (n < 10 ? '0' : '') + n; }

  private async presentAlert(header: string, message: string, buttons: AlertButton[] = ['OK'] as any) {
    const a = await this.alertController.create({ header, message, buttons });
    await a.present();
  }
  /** Try to decode a QR from the current preview image (if any). */
  private async tryQrOnPreview(): Promise<string | null> {
    if (!this.previewSrc) return null;
    return this.decodeQrFromDataUrl(this.previewSrc);
  }

  /** Decode QR text from a dataURL by drawing onto the existing canvas. */
  private decodeQrFromDataUrl(dataUrl: string): Promise<string | null> {
    return new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;

        // Use the same canvas/ctx you already manage
        this.canvas.width = w;
        this.canvas.height = h;
        this.ctx.drawImage(img, 0, 0, w, h);

        try {
          const imageData = this.ctx.getImageData(0, 0, w, h);
          const qr = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'attemptBoth'
          });
          resolve(qr?.data ?? null);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
  }


  private initializeStatusBar() {
    // document.body.classList.add('status-bar-overlay');
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);

  }
}

// dataURL -> Blob helper
function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(',');
  const mime = /data:(.*?);base64/.exec(meta)?.[1] || 'image/jpeg';
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
