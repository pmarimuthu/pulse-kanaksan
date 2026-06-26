(function () {
  const script = document.currentScript;
  const app = (script && script.getAttribute('data-app')) || 'unknown';
  const today = new Date().toISOString().slice(0, 10);
  const dedupKey = 'pulse_visited_' + app + '_' + today;

  if (localStorage.getItem(dedupKey)) return;

  function run() {
    try {
      Promise.all([
        import('/config.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js')
      ]).then(function ([{ FIREBASE_CONFIG }, { initializeApp }, { getAuth, signInAnonymously }, { getFirestore, collection, addDoc, serverTimestamp, Timestamp }]) {
        const firebaseApp = initializeApp(FIREBASE_CONFIG, 'pulse-tracker');
        const auth = getAuth(firebaseApp);
        const db = getFirestore(firebaseApp);

        signInAnonymously(auth).then(function (cred) {
          const uid = cred.user.uid;
          const ttlTs = Timestamp.fromDate(new Date(Date.now() + 60 * 24 * 60 * 60 * 1000));

          function writeVisit(lat, lng) {
            addDoc(collection(db, 'visits'), {
              uid,
              app,
              lat: lat !== undefined ? lat : null,
              lng: lng !== undefined ? lng : null,
              city: null,
              country: null,
              userAgent: navigator.userAgent,
              referrer: document.referrer,
              timestamp: serverTimestamp(),
              ttl: ttlTs
            }).then(function () {
              localStorage.setItem(dedupKey, '1');
            }).catch(function () {});
          }

          navigator.geolocation.getCurrentPosition(
            function (pos) { writeVisit(pos.coords.latitude, pos.coords.longitude); },
            function () { writeVisit(null, null); },
            { timeout: 8000, maximumAge: 600000 }
          );
        }).catch(function () {});
      }).catch(function () {});
    } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
