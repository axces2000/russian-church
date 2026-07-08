// src/lib/firestore.ts
// Typed helpers for all Firestore reads and writes.

import {
  collection, doc, getDoc, getDocs, setDoc,
  deleteDoc, onSnapshot, query, orderBy, writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Section {
  id: string;
  nameEn: string;
  nameRu: string;
  order: number;
  visible: boolean;
  slug: string;
}

export interface Page {
  id: string;
  sectionId: string;
  titleEn: string;
  titleRu: string;
  order: number;
  contentEn: string;
  contentRu: string;
  updatedAt: any;
}

export interface SiteSettings {
  activeTemplate: string;
  phone: string;
  siteName: string;
  siteNameRu: string;
}

export interface AdminRecord {
  uid: string;
  email: string;
  role: 'superadmin' | 'admin';
  sections: string[] | 'all';
}

export interface SiteSettings {
  activeTemplate: string;
  phone: string;
  siteName: string;
  siteNameRu: string;
  contactNameEn: string;   // ← add
  contactNameRu: string;   // ← add
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSiteSettings(): Promise<SiteSettings | null> {
  const snap = await getDoc(doc(db, 'settings', 'site'));
  return snap.exists() ? (snap.data() as SiteSettings) : null;
}

export async function updateSiteSettings(data: Partial<SiteSettings>) {
  await setDoc(doc(db, 'settings', 'site'), data, { merge: true });
}

export function subscribeSettings(cb: (s: SiteSettings) => void): Unsubscribe {
  return onSnapshot(doc(db, 'settings', 'site'), snap => {
    if (snap.exists()) cb(snap.data() as SiteSettings);
  });
}

// ─── Sections ─────────────────────────────────────────────────────────────────

export async function getSections(): Promise<Section[]> {
  const snap = await getDocs(query(collection(db, 'sections'), orderBy('order')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Section));
}

export function subscribeSections(cb: (sections: Section[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'sections'), orderBy('order')),
    snap => { cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Section))); }
  );
}

export async function saveSection(section: Section) {
  await setDoc(doc(db, 'sections', section.id), section, { merge: true });
}

export async function deleteSection(sectionId: string) {
  await deleteDoc(doc(db, 'sections', sectionId));
}

export async function reorderSections(sections: Section[]) {
  const batch = writeBatch(db);
  sections.forEach((s, i) => {
    batch.update(doc(db, 'sections', s.id), { order: i });
  });
  await batch.commit();
}

// ─── Pages ────────────────────────────────────────────────────────────────────

export async function getPages(sectionId: string): Promise<Page[]> {
  const snap = await getDocs(query(collection(db, 'pages'), orderBy('order')));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Page))
    .filter(p => p.sectionId === sectionId);
}

export async function getAllPages(): Promise<Page[]> {
  const snap = await getDocs(query(collection(db, 'pages'), orderBy('order')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Page));
}

export function subscribePages(
  sectionId: string,
  cb: (pages: Page[]) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'pages'), orderBy('order')),
    snap => {
      cb(
        snap.docs
          .map(d => ({ id: d.id, ...d.data() } as Page))
          .filter(p => p.sectionId === sectionId)
      );
    }
  );
}

export async function savePage(page: Omit<Page, 'updatedAt'>) {
  await setDoc(doc(db, 'pages', page.id), {
    ...page,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function deletePage(pageId: string) {
  await deleteDoc(doc(db, 'pages', pageId));
}

export async function reorderPages(pages: Page[]) {
  const batch = writeBatch(db);
  pages.forEach((p, i) => {
    batch.update(doc(db, 'pages', p.id), { order: i });
  });
  await batch.commit();
}

// ─── Admins ───────────────────────────────────────────────────────────────────

export async function getAdmins(): Promise<AdminRecord[]> {
  const snap = await getDocs(collection(db, 'admins'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() } as AdminRecord));
}

export async function saveAdmin(admin: AdminRecord) {
  await setDoc(doc(db, 'admins', admin.uid), admin, { merge: true });
}

export async function deleteAdmin(uid: string) {
  await deleteDoc(doc(db, 'admins', uid));
}

