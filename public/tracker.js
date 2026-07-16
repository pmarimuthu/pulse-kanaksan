(function () {
  'use strict';

  var script = document.currentScript
    || document.querySelector('script[src*="tracker.js"][data-app]');
  var projectId = (script && script.getAttribute('data-app')) || 'unknown';
  var pageKey   = location.pathname.replace(/\/$/, '') || '/';
  var today     = new Date().toISOString().slice(0, 10);

  // Stable 32-char hex fingerprint stored in localStorage
  var fpId = localStorage.getItem('pulse_fp');
  if (!fpId) {
    var arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    fpId = Array.from(arr).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    localStorage.setItem('pulse_fp', fpId);
  }

  // One write per project+page per day
  var dedupKey = 'pulse_v2_' + projectId + '_' + pageKey + '_' + today;
  if (localStorage.getItem(dedupKey)) return;

  function run() {
    try {
      Promise.all([
        import('https://pulse.kanaksan.com/config.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js'),
      ]).then(function (mods) {
        var FIREBASE_CONFIG  = mods[0].FIREBASE_CONFIG;
        var initializeApp    = mods[1].initializeApp;
        var getFirestore     = mods[2].getFirestore;
        var doc              = mods[2].doc;
        var getDoc           = mods[2].getDoc;
        var setDoc           = mods[2].setDoc;
        var updateDoc        = mods[2].updateDoc;
        var increment        = mods[2].increment;
        var serverTimestamp  = mods[2].serverTimestamp;

        var app = initializeApp(FIREBASE_CONFIG, 'pulse-tracker');
        var db  = getFirestore(app);
        var now = serverTimestamp();

        var fpRef     = doc(db, 'projects', projectId, 'fingerprints', fpId);
        var fpPageRef = doc(db, 'projects', projectId, 'fingerprints', fpId, 'pages', pageKey);
        var statsRef  = doc(db, 'projects', projectId, 'stats', 'global');
        var pageRef   = doc(db, 'projects', projectId, 'pages', pageKey);

        Promise.all([getDoc(fpRef), getDoc(fpPageRef)]).then(function (snaps) {
          var isNewToProject = !snaps[0].exists();
          var isNewToPage    = !snaps[1].exists();

          var p1 = isNewToProject
            ? setDoc(fpRef,     { firstSeen: now, lastSeen: now })
            : updateDoc(fpRef,  { lastSeen: now });

          var p2 = isNewToPage
            ? setDoc(fpPageRef,    { firstSeen: now, lastSeen: now })
            : updateDoc(fpPageRef, { lastSeen: now });

          var p3 = getDoc(statsRef).then(function (snap) {
            if (!snap.exists()) {
              return setDoc(statsRef, {
                total:      1,
                unique:     isNewToProject ? 1 : 0,
                todayCount: 1,
                todayDate:  today,
              });
            }
            var d = snap.data();
            return updateDoc(statsRef, {
              total:      increment(1),
              unique:     isNewToProject ? increment(1) : increment(0),
              todayCount: d.todayDate === today ? increment(1) : 1,
              todayDate:  today,
            });
          });

          var p4 = getDoc(pageRef).then(function (snap) {
            if (!snap.exists()) {
              return setDoc(pageRef, { pageKey: pageKey, total: 1, unique: isNewToPage ? 1 : 0 });
            }
            return updateDoc(pageRef, {
              total:  increment(1),
              unique: isNewToPage ? increment(1) : increment(0),
            });
          });

          return Promise.all([p1, p2, p3, p4]);
        }).then(function () {
          localStorage.setItem(dedupKey, '1');
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
