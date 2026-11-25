import { applyClassOperation, classNameKey, createClass, findLegacySessionSubjectId, normalizeClassName, validateUniqueClassName } from './classOperations';

class MemoryTable {
  constructor(rows = []) { this.rows = rows.map(row => ({...row})); this.nextId = Math.max(0, ...rows.map(row => row.id || 0)) + 1; }
  async toArray() { return this.rows.map(row => ({...row})); }
  async get(id) { const row = this.rows.find(item => item.id === id); return row && {...row}; }
  async add(value) { const id = value.id || this.nextId++; this.rows.push({...value, id}); return id; }
  async update(id, changes) { const row = this.rows.find(item => item.id === id); if (!row) return 0; Object.assign(row, changes); return 1; }
  filter(predicate) { return { modify: async changes => { this.rows.filter(predicate).forEach(row => Object.assign(row, changes)); } }; }
}

function memoryDb({subjects = [], sessions = [], assessments = [], gradeEntries = []} = {}) {
  const database = { subjects: new MemoryTable(subjects), sessions: new MemoryTable(sessions), assessments: new MemoryTable(assessments), gradeEntries: new MemoryTable(gradeEntries) };
  database.transaction = async (_mode, ...args) => {
    const work = args.pop();
    const snapshots = Object.values(database).filter(value => value instanceof MemoryTable).map(table => [table, table.rows.map(row => ({...row}))]);
    try { return await work(); } catch (error) { snapshots.forEach(([table, rows]) => { table.rows = rows; }); throw error; }
  };
  return database;
}

const base = () => memoryDb({
  subjects: [
    {id: 1, semesterId: 10, name: 'ECE 313', assignmentTypes: ['Exam'], gradeWeights: {Exam: 80}, remainingItems: {Exam: 2}},
    {id: 2, semesterId: 20, name: 'MATH 241'}
  ],
  sessions: [{id: 1, semesterId: 10, subjectId: 1, subject: 'ECE 313', startTime: '2026-01-01T10:00:00.000Z', durationSeconds: 7200, tag: 'Exam'}],
  assessments: [{id: 1, subjectId: 1, name: 'Midterm', grade: 90}],
  gradeEntries: [{id: 1, subjectId: 1, name: 'Quiz', score: 9}]
});

test('normalizes names and rejects empty or case-insensitive duplicates in one semester', () => {
  expect(normalizeClassName('  ECE 313  ')).toBe('ECE 313');
  expect(classNameKey('ECE 313')).toBe(classNameKey('ece 313'));
  expect(validateUniqueClassName([{id: 1, semesterId: 10, name: 'ECE 313'}], 10, ' ece 313 ')).toMatchObject({valid: false});
  expect(validateUniqueClassName([], 10, '  ')).toMatchObject({valid: false});
});

test('allows matching names in different semesters and creates trimmed names', async () => {
  const database = base();
  expect(validateUniqueClassName(await database.subjects.toArray(), 20, 'ECE 313').valid).toBe(true);
  const id = await createClass(database, 20, '  ECE 313 ');
  expect(await database.subjects.get(id)).toMatchObject({name: 'ECE 313', semesterId: 20});
});

test('renames a class and all linked sessions without changing identity or history', async () => {
  const database = base();
  const before = await database.sessions.get(1);
  await applyClassOperation(database, {subjectId: 1, destinationSemesterId: 10, operation: 'rename', incomingName: 'Circuits'});
  expect(await database.subjects.get(1)).toMatchObject({id: 1, name: 'Circuits', semesterId: 10});
  expect(await database.sessions.get(1)).toEqual({...before, subject: 'Circuits'});
});

test('moves sessions while assessments and grades remain linked to the stable class id', async () => {
  const database = base();
  await applyClassOperation(database, {subjectId: 1, destinationSemesterId: 20, operation: 'move', incomingName: 'Circuits'});
  expect(await database.sessions.get(1)).toMatchObject({subjectId: 1, subject: 'Circuits', semesterId: 20, durationSeconds: 7200});
  expect(await database.assessments.get(1)).toMatchObject({subjectId: 1, name: 'Midterm'});
  expect(await database.gradeEntries.get(1)).toMatchObject({subjectId: 1, name: 'Quiz'});
});

test('duplicates configuration with a new id but no sessions, assessments, or grades', async () => {
  const database = base();
  const result = await applyClassOperation(database, {subjectId: 1, destinationSemesterId: 20, operation: 'duplicate', incomingName: 'Circuits II'});
  expect(result.subjectId).not.toBe(1);
  expect(await database.subjects.get(result.subjectId)).toMatchObject({semesterId: 20, name: 'Circuits II', assignmentTypes: ['Exam'], gradeWeights: {Exam: 80}, remainingItems: {Exam: 2}});
  expect((await database.sessions.toArray()).filter(row => row.subjectId === result.subjectId)).toHaveLength(0);
  expect((await database.assessments.toArray()).filter(row => row.subjectId === result.subjectId)).toHaveLength(0);
  expect((await database.gradeEntries.toArray()).filter(row => row.subjectId === result.subjectId)).toHaveLength(0);
});

test.each([
  ['incoming only', 'ECE 314', 'MATH 241'],
  ['destination only', 'ECE 313', 'Calculus'],
  ['both', 'ECE 314', 'Calculus']
])('resolves a conflict by renaming %s', async (_label, incomingName, existingName) => {
  const database = base();
  await database.subjects.update(2, {name: 'ECE 313'});
  await applyClassOperation(database, {subjectId: 1, destinationSemesterId: 20, operation: 'move', incomingName, existingSubjectId: 2, existingName});
  expect(await database.subjects.get(1)).toMatchObject({name: incomingName, semesterId: 20});
  expect(await database.subjects.get(2)).toMatchObject({name: existingName, semesterId: 20});
});

test('a failed conflict transaction rolls back both class and session changes', async () => {
  const database = base();
  await expect(applyClassOperation(database, {subjectId: 1, destinationSemesterId: 20, operation: 'move', incomingName: 'Same', existingSubjectId: 2, existingName: 'same'})).rejects.toThrow();
  expect(await database.subjects.get(1)).toMatchObject({name: 'ECE 313', semesterId: 10});
  expect(await database.subjects.get(2)).toMatchObject({name: 'MATH 241', semesterId: 20});
  expect(await database.sessions.get(1)).toMatchObject({subject: 'ECE 313', semesterId: 10});
});

test('legacy migration matches by semester and normalized name but never guesses ambiguity', () => {
  const subjects = [{id: 1, semesterId: 10, name: 'ECE 313'}, {id: 2, semesterId: 20, name: 'ECE 313'}];
  expect(findLegacySessionSubjectId(subjects, {semesterId: 10, subject: ' ece 313 '})).toBe(1);
  expect(findLegacySessionSubjectId([...subjects, {id: 3, semesterId: 10, name: 'ece 313'}], {semesterId: 10, subject: 'ECE 313'})).toBeUndefined();
  expect(findLegacySessionSubjectId(subjects, {semesterId: 10, subject: 'Unknown'})).toBeUndefined();
});

test('renaming does not claim ambiguous unlinked legacy sessions', async () => {
  const database = memoryDb({
    subjects: [{id: 1, semesterId: 10, name: 'History'}, {id: 2, semesterId: 10, name: 'history'}],
    sessions: [{id: 1, semesterId: 10, subject: 'History', durationSeconds: 60}]
  });
  await applyClassOperation(database, {subjectId: 1, destinationSemesterId: 10, operation: 'rename', incomingName: 'World History'});
  expect(await database.sessions.get(1)).toMatchObject({subject: 'History'});
  expect((await database.sessions.get(1)).subjectId).toBeUndefined();
});

test('move preserves semester totals mathematically and duplicate leaves totals unchanged', async () => {
  const database = base();
  const total = rows => rows.reduce((sum, row) => sum + row.durationSeconds, 0);
  const originalGlobal = total(await database.sessions.toArray());
  await applyClassOperation(database, {subjectId: 1, destinationSemesterId: 20, operation: 'move', incomingName: 'ECE 313'});
  let rows = await database.sessions.toArray();
  expect(total(rows.filter(row => row.semesterId === 10))).toBe(0);
  expect(total(rows.filter(row => row.semesterId === 20))).toBe(originalGlobal);
  await applyClassOperation(database, {subjectId: 1, destinationSemesterId: 10, operation: 'duplicate', incomingName: 'ECE 313'});
  rows = await database.sessions.toArray();
  expect(total(rows)).toBe(originalGlobal);
});
