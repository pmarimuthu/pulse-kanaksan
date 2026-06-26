const { onSchedule } = require('firebase-functions/v2/scheduler');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

initializeApp();

exports.cleanupOldVisits = onSchedule('every week', async () => {
  const db = getFirestore();
  const cutoff = Timestamp.fromDate(new Date(Date.now() - 60 * 24 * 60 * 60 * 1000));
  const BATCH_SIZE = 400;
  let deleted = 0;

  while (true) {
    const snap = await db.collection('visits')
      .where('timestamp', '<', cutoff)
      .limit(BATCH_SIZE)
      .get();

    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;

    if (snap.size < BATCH_SIZE) break;
  }

  console.log('Cleanup: deleted', deleted, 'old visit docs');
});
