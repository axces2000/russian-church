// src/lib/firestore.ts
// Typed helpers for all Firestore reads and writes.

import {
  collection, doc, getDoc, getDocs, setDoc,
  deleteDoc, onSnapshot, query, orderBy, where,
  writeBatch, serverTimestamp,
} from 'firebase/firestore';
import type { Unsubscribe } from 'firebase/firestore';
import { db } from './firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Section {
  id: string; nameEn: string; nameRu: string;
  order: number; visible: boolean; slug: string;
}
export interface Page {
  id: string; sectionId: string; titleEn: string; titleRu: string;
  order: number; contentEn: string; contentRu: string; updatedAt: any;
}
export interface SiteSettings {
  activeTemplate: string; phone: string;
  siteName: string; siteNameRu: string;
  contactNameEn: string; contactNameRu: string;
}
export interface AdminRecord {
  uid: string; email: string;
  role: 'superadmin' | 'admin'; sections: string[] | 'all';
}

// ─── Service Schedule ─────────────────────────────────────────────────────────
export interface ServiceEvent {
  date: string; yearMonth: string;
  entriesEn: string; entriesRu: string; updatedAt: any;
}
export interface ServiceTemplate {
  id: string; nameEn: string; nameRu: string;
  entriesEn: string; entriesRu: string; order: number;
}
export interface ServiceEntryType {
  id: string; textEn: string; textRu: string; order: number;
}

// ─── Sunday School ────────────────────────────────────────────────────────────
export interface SSEvent {
  date: string; yearMonth: string;
  entriesEn: string; entriesRu: string; updatedAt: any;
}
export interface SSTemplate {
  id: string; nameEn: string; nameRu: string;
  entriesEn: string; entriesRu: string; order: number;
}
export interface SSEntryType {
  id: string; textEn: string; textRu: string; order: number;
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
  sections.forEach((s, i) => batch.update(doc(db, 'sections', s.id), { order: i }));
  await batch.commit();
}

// ─── Pages ────────────────────────────────────────────────────────────────────
export async function getPages(sectionId: string): Promise<Page[]> {
  const snap = await getDocs(query(collection(db, 'pages'), orderBy('order')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Page)).filter(p => p.sectionId === sectionId);
}
export async function getAllPages(): Promise<Page[]> {
  const snap = await getDocs(query(collection(db, 'pages'), orderBy('order')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Page));
}
export function subscribePages(sectionId: string, cb: (pages: Page[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(db, 'pages'), orderBy('order')),
    snap => { cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as Page)).filter(p => p.sectionId === sectionId)); }
  );
}
export async function savePage(page: Omit<Page, 'updatedAt'>) {
  await setDoc(doc(db, 'pages', page.id), { ...page, updatedAt: serverTimestamp() }, { merge: true });
}
export async function deletePage(pageId: string) { await deleteDoc(doc(db, 'pages', pageId)); }
export async function reorderPages(pages: Page[]) {
  const batch = writeBatch(db);
  pages.forEach((p, i) => batch.update(doc(db, 'pages', p.id), { order: i }));
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
export async function deleteAdmin(uid: string) { await deleteDoc(doc(db, 'admins', uid)); }

// ─── Service Events ───────────────────────────────────────────────────────────
export async function getServiceEvent(dateStr: string): Promise<ServiceEvent | null> {
  const snap = await getDoc(doc(db, 'serviceEvents', dateStr));
  return snap.exists() ? { date: snap.id, ...snap.data() } as ServiceEvent : null;
}
export async function saveServiceEvent(event: Omit<ServiceEvent, 'updatedAt'>) {
  await setDoc(doc(db, 'serviceEvents', event.date), { ...event, updatedAt: serverTimestamp() }, { merge: true });
}
export async function deleteServiceEvent(dateStr: string) {
  await deleteDoc(doc(db, 'serviceEvents', dateStr));
}
export function subscribeServiceEventsForMonth(year: number, month: number,
  cb: (events: Record<string, ServiceEvent>) => void): Unsubscribe {
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  return onSnapshot(
    query(collection(db, 'serviceEvents'), where('yearMonth', '==', ym)),
    snap => {
      const result: Record<string, ServiceEvent> = {};
      snap.docs.forEach(d => { result[d.id] = { date: d.id, ...d.data() } as ServiceEvent; });
      cb(result);
    }
  );
}

// ─── Service Templates ────────────────────────────────────────────────────────
export function subscribeServiceTemplates(cb: (t: ServiceTemplate[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'serviceTemplates'), orderBy('order')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceTemplate))));
}
export async function saveServiceTemplate(t: ServiceTemplate) {
  await setDoc(doc(db, 'serviceTemplates', t.id), t, { merge: true });
}
export async function deleteServiceTemplate(id: string) {
  await deleteDoc(doc(db, 'serviceTemplates', id));
}
export async function reorderServiceTemplates(templates: ServiceTemplate[]) {
  const batch = writeBatch(db);
  templates.forEach((t, i) => batch.update(doc(db, 'serviceTemplates', t.id), { order: i }));
  await batch.commit();
}

// ─── Service Entry Types ──────────────────────────────────────────────────────
export function subscribeServiceEntryTypes(cb: (e: ServiceEntryType[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'serviceEntryTypes'), orderBy('order')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as ServiceEntryType))));
}
export async function saveServiceEntryType(e: ServiceEntryType) {
  await setDoc(doc(db, 'serviceEntryTypes', e.id), e, { merge: true });
}
export async function deleteServiceEntryType(id: string) {
  await deleteDoc(doc(db, 'serviceEntryTypes', id));
}
export async function reorderServiceEntryTypes(entries: ServiceEntryType[]) {
  const batch = writeBatch(db);
  entries.forEach((e, i) => batch.update(doc(db, 'serviceEntryTypes', e.id), { order: i }));
  await batch.commit();
}

// ─── Sunday School Events ─────────────────────────────────────────────────────
export async function getSSEvent(dateStr: string): Promise<SSEvent | null> {
  const snap = await getDoc(doc(db, 'ssEvents', dateStr));
  return snap.exists() ? { date: snap.id, ...snap.data() } as SSEvent : null;
}
export async function saveSSEvent(event: Omit<SSEvent, 'updatedAt'>) {
  await setDoc(doc(db, 'ssEvents', event.date), { ...event, updatedAt: serverTimestamp() }, { merge: true });
}
export async function deleteSSEvent(dateStr: string) {
  await deleteDoc(doc(db, 'ssEvents', dateStr));
}
export function subscribeSSEventsForMonth(year: number, month: number,
  cb: (events: Record<string, SSEvent>) => void): Unsubscribe {
  const ym = `${year}-${String(month + 1).padStart(2, '0')}`;
  return onSnapshot(
    query(collection(db, 'ssEvents'), where('yearMonth', '==', ym)),
    snap => {
      const result: Record<string, SSEvent> = {};
      snap.docs.forEach(d => { result[d.id] = { date: d.id, ...d.data() } as SSEvent; });
      cb(result);
    }
  );
}

// ─── Sunday School Templates ──────────────────────────────────────────────────
export function subscribeSSTemplates(cb: (t: SSTemplate[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'ssTemplates'), orderBy('order')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as SSTemplate))));
}
export async function saveSSTemplate(t: SSTemplate) {
  await setDoc(doc(db, 'ssTemplates', t.id), t, { merge: true });
}
export async function deleteSSTemplate(id: string) {
  await deleteDoc(doc(db, 'ssTemplates', id));
}
export async function reorderSSTemplates(templates: SSTemplate[]) {
  const batch = writeBatch(db);
  templates.forEach((t, i) => batch.update(doc(db, 'ssTemplates', t.id), { order: i }));
  await batch.commit();
}

// ─── Sunday School Entry Types ────────────────────────────────────────────────
export function subscribeSSEntryTypes(cb: (e: SSEntryType[]) => void): Unsubscribe {
  return onSnapshot(query(collection(db, 'ssEntryTypes'), orderBy('order')),
    snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data() } as SSEntryType))));
}
export async function saveSSEntryType(e: SSEntryType) {
  await setDoc(doc(db, 'ssEntryTypes', e.id), e, { merge: true });
}
export async function deleteSSEntryType(id: string) {
  await deleteDoc(doc(db, 'ssEntryTypes', id));
}
export async function reorderSSEntryTypes(entries: SSEntryType[]) {
  const batch = writeBatch(db);
  entries.forEach((e, i) => batch.update(doc(db, 'ssEntryTypes', e.id), { order: i }));
  await batch.commit();
}
