// src/db.js
import Dexie from 'dexie';
import { findLegacySessionSubjectId } from './classOperations';

export const db = new Dexie('StudyTrackerDB');

db.version(1).stores({
  semesters: '++id, archived', // Primary key 'id' (auto-incremented)
  subjects: '++id, semesterId', 
  sessions: '++id, semesterId, subject',
  assessments: '++id, subjectId, type',
  gradeEntries: '++id, subjectId, category' // Manual calculator entries
});

// Sessions created by older releases are matched only when one class in the
// recorded semester has the same normalized name. Ambiguous/unmatched rows are
// intentionally left untouched so a migration can never guess incorrectly.
db.version(2).stores({
  semesters: '++id, archived',
  subjects: '++id, semesterId',
  sessions: '++id, semesterId, subject, subjectId',
  assessments: '++id, subjectId, type',
  gradeEntries: '++id, subjectId, category'
}).upgrade(async transaction => {
  const subjects = await transaction.table('subjects').toArray();
  await transaction.table('sessions').toCollection().modify(session => {
    if (session.subjectId != null) return;
    const subjectId = findLegacySessionSubjectId(subjects, session);
    if (subjectId != null) session.subjectId = subjectId;
  });
});
