// src/app/services/lessons.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, shareReplay, Observable } from 'rxjs';
import { User } from '../model/user';

export type LessonItem = {
  name: string;
  slug: string;
  image: string;
  video: string;
  backgroundColor?: string;
  fontColor?: string;
  content?: string;
};

export type LessonCategory = {
  category: string;
  slug: string;
  image: string;
  items: LessonItem[];
};

export type CategoryProgress = {
  done: number;
  total: number;
  complete: boolean;
};

export const lessonKey = (categorySlug: string, itemSlug: string) =>
  `${categorySlug}::${itemSlug}`;

@Injectable({ providedIn: 'root' })
export class LessonsService {
  private http = inject(HttpClient);

  private data$: Observable<LessonCategory[]> = this.http
    .get<LessonCategory[]>('assets/lessons/lessons.json')
    .pipe(shareReplay(1));

  getCategories() { return this.data$; }
  getCategory(slug: string) {
    return this.data$.pipe(map(cats => cats.find(c => c.slug === slug)));
  }
  getItem(categorySlug: string, itemSlug: string) {
    return this.data$.pipe(
      map(list => {
        const cat = list.find(c => c.slug === categorySlug);
        const item = cat?.items.find(i => i.slug === itemSlug);
        return { category: cat, item };
      })
    );
  }

  /** Build a quick lookup set for completed keys (handles the typo "compeleted"). */
  private completedSet(user?: User): Set<string> {
    const arr = (user?.progress?.lessons as any)?.compeleted
             ?? (user?.progress?.lessons as any)?.completed
             ?? [];
    return new Set<string>(arr as string[]);
  }

  /** Is a particular item completed? */
  isItemDone(user: User | undefined, categorySlug: string, itemSlug: string): boolean {
    return this.completedSet(user).has(lessonKey(categorySlug, itemSlug));
  }

  /** Progress per category (slug -> {done,total,complete}). */
  progressFor(user: User | undefined): Observable<Record<string, CategoryProgress>> {
    const done = this.completedSet(user);
    return this.data$.pipe(
      map(categories => {
        const mapObj: Record<string, CategoryProgress> = {};
        for (const c of categories) {
          const total = c.items.length;
          const doneCount = c.items.filter(i => done.has(lessonKey(c.slug, i.slug))).length;
          mapObj[c.slug] = {
            done: doneCount,
            total,
            complete: total > 0 && doneCount === total,
          };
        }
        return mapObj;
      })
    );
  }
}
