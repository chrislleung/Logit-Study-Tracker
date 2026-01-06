// src/db.js
import Dexie from 'dexie';

export const db = new Dexie('StudyTrackerDB');

db.version(1).stores({
  semesters: '++id, archived', // Primary key 'id' (auto-incremented)
  subjects: '++id, semesterId', 
  sessions: '++id, semesterId, subject',
  assessments: '++id, subjectId, type',
  gradeEntries: '++id, subjectId, category' // Manual calculator entries
});
