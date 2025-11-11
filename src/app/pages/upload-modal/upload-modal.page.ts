import { Component, ElementRef, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AlertButton, AlertController, IonButton, IonButtons, IonContent, IonFooter, IonHeader,
  IonIcon, IonImg, IonItem, IonLabel, IonProgressBar, IonSkeletonText, IonText, IonTitle, IonToolbar,
  LoadingController, ModalController, ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { cloudUploadOutline, imageOutline, trashOutline, close, checkmarkCircleOutline } from 'ionicons/icons';
import { VerificationService } from 'src/app/services/verification.service';
import { HttpEvent, HttpEventType } from '@angular/common/http';
import { User } from 'src/app/model/user';
import { ApiResponse } from 'src/app/model/api-response.model';
import { Verification } from 'src/app/model/verification';
import { StatusBarService } from 'src/app/services/status-bar.service';
import { Style } from '@capacitor/status-bar';

// QR decoder you already use elsewhere
import jsQR from 'jsqr';
import { ɵEmptyOutletComponent } from "@angular/router";

@Component({
  selector: 'app-upload-modal',
  templateUrl: './upload-modal.page.html',
  styleUrls: ['./upload-modal.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonIcon, IonContent,
    IonFooter, IonProgressBar, IonImg, IonText, IonItem, IonLabel, IonSkeletonText,
    ɵEmptyOutletComponent
  ]
})
export class UploadModalPage implements OnInit {
  currentProfile: User;
  file = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  selectedName = signal<string | null>(null);
  selectedSize = signal<string | null>(null);
  uploading = signal<boolean>(false);
  progress = signal<number | undefined>(undefined);

  // decoded QR text (if found)
  private qrText = signal<string | null>(null);

  // legacy tiny offscreen canvas
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;

  // robust worker canvas used by the hardened routine
  private workCanvas!: HTMLCanvasElement;
  private workCtx!: CanvasRenderingContext2D;

  /** Hard caps to prevent UI stalls */
  private readonly LONG_SIDE_MAX = 1024;           // cap working resolution for scanning
  private readonly SWEEP_SCALES: (1 | 2)[] = [1, 2]; // fewer upscales for speed
  private readonly SWEEP_ROT: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270];

  /** sequence to cancel in-flight scans when a new file is picked */
  private scanSeq = 0;

  @ViewChild('fileInput', { static: true }) fileInput!: ElementRef<HTMLInputElement>;

  constructor(
    private readonly modalCtrl: ModalController,
    private readonly toastCtrl: ToastController,
    private readonly alertCtrl: AlertController,
    private readonly loaderCtrl: LoadingController,
    private readonly verificationService: VerificationService,
    private readonly statusBarService: StatusBarService,
  ) {
    addIcons({ close, cloudUploadOutline, imageOutline, trashOutline, checkmarkCircleOutline });
  }

  ngOnInit(): void {
    // legacy canvas
    this.canvas = document.createElement('canvas');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      console.warn('Canvas not supported; QR-from-file disabled.');
    } else {
      this.ctx = ctx;
    }

    // work canvas (robust path)
    this.workCanvas = document.createElement('canvas');
    const wctx = this.workCanvas.getContext('2d', { willReadFrequently: true } as any);
    if (!wctx) {
      throw new Error('2D canvas not available');
    }
    this.workCtx = wctx as CanvasRenderingContext2D;
  }

  ionViewWillEnter() {
    this.initializeStatusBar();
  }

  async ngAfterViewInit() {
    this.initializeStatusBar();
    this.fileInput.nativeElement.click();
  }

  ngOnDestroy(): void {
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
  }

  closeModal() {
    this.modalCtrl.dismiss();
  }

  clearSelection() {
    if (this.previewUrl()) URL.revokeObjectURL(this.previewUrl()!);
    this.file.set(null);
    this.previewUrl.set(null);
    this.selectedName.set(null);
    this.selectedSize.set(null);
    this.qrText.set(null);
  }

  onDragOver(ev: DragEvent) {
    ev.preventDefault();
  }

  onDrop(ev: DragEvent) {
    ev.preventDefault();
    if (!ev.dataTransfer?.files?.length) return;
    this.setFile(ev.dataTransfer.files[0]);
  }

  onFilePicked(ev: Event) {
    const input = ev.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.setFile(f);
  }

  private setFile(f: File | null) {
    if (!f) return;
    if (!/^image\//.test(f.type)) {
      this.showError('Please select an image file (JPG/PNG/WebP).');
      return;
    }
    this.clearSelection();
    this.file.set(f);
    this.selectedName.set(f.name);
    this.selectedSize.set(this.formatSize(f.size));
    const url = URL.createObjectURL(f);
    this.previewUrl.set(url);

    // cancel previous scan and start a new one
    const seq = ++this.scanSeq;
    this.scanQrFromFile(f, seq)
      .then(text => { if (seq === this.scanSeq && text) this.qrText.set(text); })
      .finally(() => { this.fileInput.nativeElement.value = ''; });
  }

  // ============================
  // SUBMIT: try QR first → else OCR (legacy)
  // ============================
  async submit() {
    if (!this.file()) return;

    const decoded = this.qrText();
    if (decoded) {
      const handled = await this.tryHandleDecodedQr(decoded);
      if (handled) return;
    }

    // fallback to OCR upload (unchanged)
    const loader = await this.loaderCtrl.create({
      message: 'Uploading please wait...',
      backdropDismiss: false
    });
    await loader.present();

    this.uploading.set(true);
    this.progress.set(0);

    const form = new FormData();
    form.append('image', this.file()!);
    form.append('userId', this.currentProfile?.userId);

    this.verificationService.verifyOCR(form).subscribe({
      next: async (event: HttpEvent<any>) => {
        if (event.type === HttpEventType.UploadProgress && event.total) {
          const val = event.loaded / event.total;
          this.progress.set(val);
        } else if (event.type === HttpEventType.Response) {
          this.uploading.set(false);
          this.progress.set(undefined);
          loader.dismiss();

          const response = event.body as ApiResponse<Verification>;

          if (response?.success) {
            await this.presentAlert(
              'Verification Successful',
              response.data?.type === "PSA"
                ? "PSA Birth Certificate is verified and authentic"
                : "Voters Identification is verified and authentic",
              [{
                text: 'OK',
                handler: () => {
                  this.alertCtrl.dismiss();
                  this.modalCtrl.dismiss({ success: true, data: event.body?.data ?? null });
                }
              }]
            );
          } else {
            this.presentAlert("Verification failed", event.body?.message ?? 'Upload failed. Please try again.');
          }
        }
      },
      error: (err) => {
        this.uploading.set(false);
        this.progress.set(undefined);
        loader.dismiss();

        // After CORS headers fix, you'll see real codes:
        const status = err?.status ?? 0;
        const msg =
          status === 413
            ? 'The image you uploaded is too large for the server to process. Please crop or resize the photo before uploading again. Keeping it below 4 MB usually works best.'
            : (err?.error?.message || err?.message || 'Upload failed. Please try again.');


        this.presentAlert('Verification failed', msg);
      }
    });
  }

  // ============================
  // Low-lag QR-from-file (capped + staged + yielding)
  // ============================
  /** Yield to UI so we don't block rendering (micro pause). */
  private microYield(): Promise<void> {
    return new Promise(res => setTimeout(res, 0));
  }

  /** Build an EXIF-corrected, resolution-capped ImageBitmap for scanning. */
  private async makeCappedBitmap(file: File): Promise<ImageBitmap | null> {
    try {
      const tmp = await createImageBitmap(file, { imageOrientation: 'from-image' as any });
      const w = tmp.width, h = tmp.height;
      const longSide = Math.max(w, h);
      if (longSide <= this.LONG_SIDE_MAX) return tmp;

      // compute resize while preserving aspect
      const scale = this.LONG_SIDE_MAX / longSide;
      const rw = Math.max(1, Math.round(w * scale));
      const rh = Math.max(1, Math.round(h * scale));

      // Prefer OffscreenCanvas if available, else fallback to regular canvas
      let off: any;
      try {
        // @ts-ignore
        off = new OffscreenCanvas(rw, rh);
      } catch {
        off = document.createElement('canvas');
        off.width = rw; off.height = rh;
      }
      const octx = off.getContext('2d')!;
      octx.imageSmoothingEnabled = true;
      octx.drawImage(tmp, 0, 0, rw, rh);
      tmp.close();

      // @ts-ignore convert OffscreenCanvas or HTMLCanvasElement to ImageBitmap
      const bmp: ImageBitmap = await (off.transferToImageBitmap ? off.transferToImageBitmap() : createImageBitmap(off));
      return bmp;
    } catch {
      return null;
    }
  }

  private async scanQrFromFile(file: File, seq: number): Promise<string | null> {
    // Build working sources (capped bitmap + HTMLImageElement)
    const [bmp, dataUrl] = await Promise.all([
      this.makeCappedBitmap(file),
      this.blobToDataUrl(file),
    ]);
    if (seq !== this.scanSeq) { bmp?.close?.(); return null; }

    const img = await this.loadImage(dataUrl);
    if (seq !== this.scanSeq) { bmp?.close?.(); return null; }

    // ---- Stage 1: cheap full-frame tries ----
    // Try native detector (fast) then jsQR on full frame (0° + 90°)
    // @ts-ignore
    const hasBD = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    if (hasBD) {
      try {
        // @ts-ignore
        const det = new window.BarcodeDetector({ formats: ['qr_code'] });
        this.drawSourceToCanvas(this.workCtx, img, bmp, 0, { x: 0, y: 0, w: 1, h: 1 }, 1);
        let found = await det.detect(this.workCanvas);
        if (seq === this.scanSeq && found?.length && found[0]?.rawValue) { bmp?.close?.(); return found[0].rawValue; }

        await this.microYield();
        this.drawSourceToCanvas(this.workCtx, img, bmp, 90, { x: 0, y: 0, w: 1, h: 1 }, 1);
        found = await det.detect(this.workCanvas);
        if (seq === this.scanSeq && found?.length && found[0]?.rawValue) { bmp?.close?.(); return found[0].rawValue; }
      } catch { /* continue */ }
    }

    // jsQR full frame (0°)
    try {
      this.drawSourceToCanvas(this.workCtx, img, bmp, 0, { x: 0, y: 0, w: 1, h: 1 }, 1);
      const { width, height } = this.workCanvas;
      const id = this.workCtx.getImageData(0, 0, width, height);
      const hit = jsQR(id.data, id.width, id.height, { inversionAttempts: 'attemptBoth' });
      if (seq === this.scanSeq && hit?.data) { bmp?.close?.(); return hit.data; }
    } catch { }
    await this.microYield();

    // ---- Stage 2: limited sweeps (yield between attempts) ----
    const REGIONS = [
      { x: 0.00, y: 0.00, w: 0.65, h: 0.65 }, // TL big
      { x: 0.15, y: 0.15, w: 0.70, h: 0.70 }, // center big
      { x: 0.25, y: 0.25, w: 0.50, h: 0.50 }, // center mid
      { x: 0.00, y: 0.50, w: 0.50, h: 0.50 }, // BL
      { x: 0.50, y: 0.00, w: 0.50, h: 0.50 }, // TR
    ] as const;

    for (const r of REGIONS) {
      for (const rot of this.SWEEP_ROT) {
        for (const s of this.SWEEP_SCALES) {
          if (seq !== this.scanSeq) { bmp?.close?.(); return null; }

          this.drawSourceToCanvas(this.workCtx, img, bmp, rot, r, s);
          this.simplePreprocess(this.workCtx);

          // Try native detector first (cheap), then jsQR
          if (hasBD) {
            try {
              // @ts-ignore
              const det = new window.BarcodeDetector({ formats: ['qr_code'] });
              const codes = await det.detect(this.workCanvas);
              if (seq === this.scanSeq && codes?.length && codes[0]?.rawValue) { bmp?.close?.(); return codes[0].rawValue; }
            } catch { }
          }

          try {
            const { width, height } = this.workCanvas;
            const id = this.workCtx.getImageData(0, 0, width, height);
            const hit = jsQR(id.data, id.width, id.height, { inversionAttempts: 'attemptBoth' });
            if (seq === this.scanSeq && hit?.data) { bmp?.close?.(); return hit.data; }
          } catch { }

          // Important: give control back to UI
          await this.microYield();
        }
      }
    }

    bmp?.close?.();
    return null;
  }

  /** Draw selected region (bitmap or img) onto canvas with rotation & pixelated scaling. */
  private drawSourceToCanvas(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    bmp: ImageBitmap | null,
    rotDeg: 0 | 90 | 180 | 270,
    region: { x: number; y: number; w: number; h: number },
    scale: 1 | 2 | 3 | 4
  ) {
    const srcW = ((bmp?.width ?? (img.naturalWidth || img.width)) as number) | 0;
    const srcH = ((bmp?.height ?? (img.naturalHeight || img.height)) as number) | 0;

    const sx = Math.max(0, Math.floor(region.x * srcW));
    const sy = Math.max(0, Math.floor(region.y * srcH));
    const sw = Math.max(1, Math.floor(region.w * srcW));
    const sh = Math.max(1, Math.floor(region.h * srcH));

    const dw0 = sw * scale;
    const dh0 = sh * scale;
    const rotated = rotDeg === 90 || rotDeg === 270;
    const dw = rotated ? dh0 : dw0;
    const dh = rotated ? dw0 : dh0;

    const c = ctx.canvas;
    c.width = dw; c.height = dh;

    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(dw / 2, dh / 2);
    ctx.rotate((rotDeg * Math.PI) / 180);

    const src = (bmp ?? img) as any; // ImageBitmap or HTMLImageElement
    ctx.drawImage(src, sx, sy, sw, sh, -dw0 / 2, -dh0 / 2, dw0, dh0);
    ctx.restore();
  }

  /** Light pre-process: grayscale + slight contrast bump (helps small/low-contrast codes). */
  private simplePreprocess(ctx: CanvasRenderingContext2D) {
    const { width, height } = ctx.canvas;
    const imgData = ctx.getImageData(0, 0, width, height);
    const d = imgData.data;
    const contrast = 1.2;
    const mid = 128;
    for (let i = 0; i < d.length; i += 4) {
      const g = (d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722);
      let v = (g - mid) * contrast + mid;
      if (v < 0) v = 0; else if (v > 255) v = 255;
      const gv = v | 0;
      d[i] = d[i + 1] = d[i + 2] = gv;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  private loadImage(dataUrl: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = dataUrl;
    });
  }

  /**
   * Try to handle decoded QR content.
   * - If it looks like PSA JSON, call verifyPSA and finish.
   * - Otherwise return false so caller can continue with OCR upload.
   */
  private async tryHandleDecodedQr(qrRaw: string): Promise<boolean> {
    let parsed: any;
    try { parsed = JSON.parse(qrRaw); } catch { return false; }
    if (!parsed || (!parsed.subject && !parsed.Subject && !parsed.subjects)) return false;

    let body: any;
    try { body = this.buildLocalPsaBodyFromQr(qrRaw); } catch { return false; }

    const loader = await this.loaderCtrl.create({ message: 'Verifying PSA QR...', backdropDismiss: false });
    await loader.present();

    try {
      const res = await this.verificationService.verifyPSA({
        ...body,
        userId: this.currentProfile?.userId
      }).toPromise();

      await loader.dismiss();

      if (!res?.success) {
        await this.presentAlert('Error scanned QR', res?.message || 'Unexpected response from verification server.');
        return true;
      }

      if (res?.data.status === 'AUTHENTIC') {
        await this.presentAlert('Verification Successful', 'This PhilSys ID is valid and authentic.', [
          {
            text: 'OK',
            handler: () => {
              this.alertCtrl.dismiss();
              this.modalCtrl.dismiss({ success: true, data: res?.data ?? null });
            }
          }
        ]);
      } else {
        await this.presentAlert('Philsys ID maybe Fake or not found', res?.message || 'Not found.');
      }
      return true;
    } catch {
      await loader.dismiss();
      await this.presentAlert('Network Error', 'Unable to contact verification server.');
      return true;
    }
  }

  // ============================
  // Minimal PSA parsing helpers (unchanged)
  // ============================
  private buildLocalPsaBodyFromQr(qrText: string) {
    const obj = JSON.parse(qrText);
    const sb = obj.subject ?? obj.Subject ?? {};

    const d = this.parseHumanDateToISO(obj.DateIssued ?? obj.dateIssued);
    const dob = this.parseHumanDateToISO(sb.DOB ?? sb.Dob ?? sb.BirthDate);
    const pcn = (sb.PCN ?? sb.pcn ?? '').toString().replace(/[^0-9]/g, '');
    let pob = (sb.POB ?? sb.pob ?? '').toString().trim();
    pob = pob.replace(/,\s*/g, ', ');

    const fn = (sb.fName ?? sb.firstName ?? '').toString().trim().toUpperCase();
    const ln = (sb.lName ?? sb.lastName ?? '').toString().trim().toUpperCase();
    const mn = (sb.mName ?? sb.middleName ?? '').toString().trim().toUpperCase();
    const s = (sb.sex ?? '').toString().trim();
    const sf = (sb.Suffix ?? sb.suffix ?? '').toString().trim();

    return { d, dob, pcn, pob, fn, ln, mn, s: s || 'string', sf: sf || 'Male' };
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

  // ============================
  // Utilities (existing)
  // ============================
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private async showError(message: string) {
    const alert = await this.alertCtrl.create({ header: 'Error', message, buttons: ['OK'] });
    await alert.present();
  }

  private async presentAlert(header: string, message: string, buttons: AlertButton[] = ['OK'] as any) {
    const a = await this.alertCtrl.create({ header, message, buttons });
    await a.present();
  }

  private initializeStatusBar() {
    this.statusBarService.show(true);
    this.statusBarService.modifyStatusBar(Style.Light);
    this.statusBarService.overLay(false);
  }
}
