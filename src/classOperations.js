export const normalizeClassName = name => String(name || '').trim();
export const classNameKey = name => normalizeClassName(name).toLocaleLowerCase();

export function findLegacySessionSubjectId(subjects, session) {
  const matches = subjects.filter(subject =>
    subject.semesterId === session.semesterId && classNameKey(subject.name) === classNameKey(session.subject)
  );
  return matches.length === 1 ? matches[0].id : undefined;
}

export function validateUniqueClassName(subjects, semesterId, name, ignoredIds = []) {
  const normalized = normalizeClassName(name);
  if (!normalized) return { valid: false, error: 'Class name cannot be empty.' };
  const ignored = new Set(ignoredIds);
  const conflict = subjects.find(subject =>
    subject.semesterId === semesterId &&
    !ignored.has(subject.id) &&
    classNameKey(subject.name) === classNameKey(normalized)
  );
  return conflict
    ? { valid: false, error: `A class named "${conflict.name}" already exists in that semester.`, conflict }
    : { valid: true, name: normalized };
}

export async function createClass(database, semesterId, name) {
  const subjects = await database.subjects.toArray();
  const validation = validateUniqueClassName(subjects, semesterId, name);
  if (!validation.valid) throw new Error(validation.error);
  return database.subjects.add({ name: validation.name, semesterId });
}

const linkedSessions = async (database, subject) => {
  const subjects = await database.subjects.toArray();
  const legacyOwnerIsUnambiguous = subjects.filter(candidate =>
    candidate.semesterId === subject.semesterId && classNameKey(candidate.name) === classNameKey(subject.name)
  ).length === 1;
  return database.sessions.filter(session =>
    session.subjectId === subject.id ||
    (legacyOwnerIsUnambiguous && session.subjectId == null && session.semesterId === subject.semesterId && classNameKey(session.subject) === classNameKey(subject.name))
  );
};

export async function applyClassOperation(database, options) {
  const { subjectId, destinationSemesterId, operation, incomingName, existingSubjectId, existingName } = options;
  if (!['rename', 'move', 'duplicate'].includes(operation)) throw new Error('Unsupported class operation.');

  return database.transaction('rw', database.subjects, database.sessions, async () => {
    const [source, subjects] = await Promise.all([database.subjects.get(subjectId), database.subjects.toArray()]);
    if (!source) throw new Error('The class no longer exists.');
    const targetSemesterId = operation === 'rename' ? source.semesterId : destinationSemesterId;
    const ignoredIds = [operation === 'duplicate' ? null : source.id, existingSubjectId].filter(id => id != null);
    const incomingValidation = validateUniqueClassName(subjects, targetSemesterId, incomingName, ignoredIds);
    if (!incomingValidation.valid) throw new Error(incomingValidation.error);

    let existing = null;
    let cleanExistingName = null;
    if (existingSubjectId != null) {
      existing = subjects.find(subject => subject.id === existingSubjectId);
      if (!existing || existing.semesterId !== targetSemesterId || existing.id === source.id) throw new Error('The conflicting class no longer exists.');
      const existingValidation = validateUniqueClassName(subjects, targetSemesterId, existingName, [existing.id, operation === 'duplicate' ? null : source.id].filter(id => id != null));
      if (!existingValidation.valid || classNameKey(existingValidation.name) === classNameKey(incomingValidation.name)) {
        throw new Error(!existingValidation.valid ? existingValidation.error : 'The two resulting class names must be different.');
      }
      cleanExistingName = existingValidation.name;
    }

    if (existing) {
      const existingSessions = await linkedSessions(database, existing);
      await database.subjects.update(existing.id, { name: cleanExistingName });
      await existingSessions.modify({ subject: cleanExistingName, subjectId: existing.id });
    }

    if (operation === 'duplicate') {
      const copy = { ...source, name: incomingValidation.name, semesterId: targetSemesterId };
      delete copy.id;
      return { operation, subjectId: await database.subjects.add(copy) };
    }

    const sourceSessions = await linkedSessions(database, source);
    await database.subjects.update(source.id, { name: incomingValidation.name, semesterId: targetSemesterId });
    await sourceSessions.modify({
      subject: incomingValidation.name,
      subjectId: source.id,
      semesterId: targetSemesterId
    });
    return { operation, subjectId: source.id };
  });
}
