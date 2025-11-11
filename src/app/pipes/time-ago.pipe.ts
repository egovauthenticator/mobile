import { ChangeDetectorRef, OnDestroy, Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'timeAgo',
  standalone: true,
  pure: false, // re-run periodically
})
export class TimeAgoPipe implements PipeTransform, OnDestroy {
  private timer: any;

  constructor(private cdr: ChangeDetectorRef) {}

  transform(value: string | number | Date): string {
    if (!value) return '';

    const date = value instanceof Date ? value : new Date(value);
    const now = new Date();
    let diff = Math.floor((now.getTime() - date.getTime()) / 1000); // seconds

    // handle future timestamps
    if (diff < 0) diff = 0;

    // schedule updates (more frequent for recent items)
    this.clearTimer();
    const nextUpdateInMs = this.getNextUpdateIntervalMs(diff);
    this.timer = setTimeout(() => this.cdr.markForCheck(), nextUpdateInMs);

    if (diff < 5) return 'just now';
    if (diff < 60) return `${diff}s ago`;

    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}min ago`;

    const hours = Math.floor(diff / 3600);
    if (hours < 24) return `${hours}hr ago`;

    const days = Math.floor(diff / 86400);
    return `${days}day${days > 1 ? 's' : ''} ago`;
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private getNextUpdateIntervalMs(diffSeconds: number): number {
    // <1 min: update every second; <1 hr: every 30s; else every 5 minutes
    if (diffSeconds < 60) return 1000;
    if (diffSeconds < 3600) return 30_000;
    return 300_000;
  }
}
