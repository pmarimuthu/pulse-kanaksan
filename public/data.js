import {
  getFirestore, doc, getDoc,
  collection, getDocs, query, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js'

let db

export function initDb(app) {
  db = getFirestore(app)
}

export async function fetchStats(projectId) {
  const snap = await getDoc(doc(db, 'projects', projectId, 'stats', 'global'))
  return snap.exists() ? snap.data() : null
}

export async function fetchTopPages(projectId) {
  const q = query(
    collection(db, 'projects', projectId, 'pages'),
    orderBy('total', 'desc'),
    limit(10)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

export async function fetchRatings(projectId) {
  const snap = await getDocs(collection(db, 'projects', projectId, 'ratings'))
  return snap.docs.map(d => d.data())
}

export async function fetchIssues(projectId) {
  const q = query(
    collection(db, 'projects', projectId, 'issues'),
    orderBy('ts', 'desc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data())
}

export async function loadAll(projectId) {
  const [stats, pages, ratings, issues] = await Promise.all([
    fetchStats(projectId),
    fetchTopPages(projectId),
    fetchRatings(projectId),
    fetchIssues(projectId),
  ])
  return { stats, pages, ratings, issues }
}
