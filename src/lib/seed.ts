// src/lib/seed.ts
// Run this ONCE from the browser console or a one-off admin page
// to populate Firestore with the initial sections and settings.
// After seeding, this file can be removed or left in place (it is idempotent).

import { setDoc, doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { v4 as uuid } from 'uuid';

const INITIAL_SECTIONS = [
  { nameEn: 'Home',           nameRu: 'Главная',              slug: 'home',           order: 0 },
  { nameEn: 'Services',       nameRu: 'Богослужения',          slug: 'services',       order: 1 },
  { nameEn: 'Sunday School',  nameRu: 'Воскресная школа',      slug: 'sunday-school',  order: 2 },
  { nameEn: 'Choir',          nameRu: 'Хор',                   slug: 'choir',          order: 3 },
  { nameEn: 'Parish',         nameRu: 'Приход',                slug: 'parish',         order: 4 },
  { nameEn: 'Contact',        nameRu: 'Контакты',              slug: 'contact',        order: 5 },
];

export async function seedFirestore() {
  console.log('Seeding Firestore…');

  // Site settings
  const settingsRef = doc(db, 'settings', 'site');
  const settingsSnap = await getDoc(settingsRef);
  if (!settingsSnap.exists()) {
    await setDoc(settingsRef, {
      activeTemplate: 'hagia-sophia-gold',
      siteName: 'Church of Christ the Saviour',
      siteNameRu: 'Храм Христа Спасителя',
      phone: '+64 21 0235 2269 (Alexei)',
    });

    console.log('✅ settings/site created');
  } else {
    console.log('⏭  settings/site already exists — skipped');
  }

  // Sections + one placeholder page each
  for (const s of INITIAL_SECTIONS) {
    const sectionId = s.slug;
    const sectionRef = doc(db, 'sections', sectionId);
    const sectionSnap = await getDoc(sectionRef);

    if (!sectionSnap.exists()) {
      await setDoc(sectionRef, {
        ...s,
        visible: true,
      });
      console.log(`✅ section "${s.nameEn}" created`);

      // One placeholder page per section
      const pageId = uuid();
      await setDoc(doc(db, 'pages', pageId), {
        sectionId,
        titleEn: s.nameEn,
        titleRu: s.nameRu,
        order: 0,
        contentEn: `<p>Welcome to the ${s.nameEn} section. This content will be edited by an administrator.</p>`,
        contentRu: `<p>Добро пожаловать в раздел «${s.nameRu}». Содержимое будет добавлено администратором.</p>`,
        updatedAt: null,
      });
      console.log(`✅ placeholder page for "${s.nameEn}" created`);
    } else {
      console.log(`⏭  section "${s.nameEn}" already exists — skipped`);
    }
  }

  console.log('Seeding complete.');
}
