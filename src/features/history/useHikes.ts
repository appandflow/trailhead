import { useQuery } from '@tanstack/react-query';
import { asc, desc, eq } from 'drizzle-orm';
import { format } from 'date-fns';

import { db } from '@/src/db/client';
import { hikes, hikePoints, type Hike, type HikePoint } from '@/src/db/schema';
import { hikeCount } from '@/src/db/seed';

export const hikeKeys = {
  all: ['hikes'] as const,
  detail: (id: string) => ['hikes', 'detail', id] as const,
  count: ['hikes', 'count'] as const,
};

export interface HikeSection {
  title: string;
  data: Hike[];
}

export interface HikeDetail {
  hike: Hike;
  points: HikePoint[];
}

export function useHikes() {
  return useQuery({
    queryKey: hikeKeys.all,
    queryFn: () => db.select().from(hikes).orderBy(desc(hikes.startedAt)).all(),
  });
}

export function useHike(id: string) {
  return useQuery<HikeDetail | null>({
    queryKey: hikeKeys.detail(id),
    enabled: id.length > 0,
    queryFn: () => {
      const hike = db.select().from(hikes).where(eq(hikes.id, id)).get();
      if (!hike) return null;
      const points = db
        .select()
        .from(hikePoints)
        .where(eq(hikePoints.hikeId, id))
        .orderBy(asc(hikePoints.timestamp))
        .all();
      return { hike, points };
    },
  });
}

export function useHikeCount() {
  return useQuery({ queryKey: hikeKeys.count, queryFn: () => hikeCount() });
}

export function monthLabel(startedAt: string): string {
  return format(new Date(startedAt), 'MMMM yyyy');
}

export function groupHikesByMonth(list: Hike[]): HikeSection[] {
  const buckets = new Map<string, Hike[]>();
  for (const hike of list) {
    const title = monthLabel(hike.startedAt);
    const bucket = buckets.get(title);
    if (bucket) bucket.push(hike);
    else buckets.set(title, [hike]);
  }

  const sections = Array.from(buckets, ([title, data]) => ({
    title,
    data: data.sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  }));
  sections.sort((a, b) => a.title.localeCompare(b.title));
  return sections;
}
