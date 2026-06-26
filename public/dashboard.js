import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'
import { FIREBASE_CONFIG, PROJECTS, REFRESH_MS } from './config.js'
import { initDb, loadAll } from './data.js'
import { renderMetrics, renderPages, renderRatings, renderIssues } from './render.js'

const app = initializeApp(FIREBASE_CONFIG, 'pulse-dashboard')
initDb(app)

const projSelect  = document.getElementById('proj-select')
const refreshBtn  = document.getElementById('refresh-btn')
const lastUpdated = document.getElementById('last-updated')

const PAGE_SIZE = 10
let allIssues = []
let issuesPage = 0

PROJECTS.forEach(p => {
  const opt = document.createElement('option')
  opt.value = p.id
  opt.textContent = p.label
  projSelect.appendChild(opt)
})

function renderIssuePage() {
  const start = issuesPage * PAGE_SIZE
  renderIssues(allIssues.slice(start, start + PAGE_SIZE))
  const total = Math.ceil(allIssues.length / PAGE_SIZE) || 1
  document.getElementById('pg-info').textContent = `${issuesPage + 1} / ${total}`
  document.getElementById('pg-prev').disabled = issuesPage === 0
  document.getElementById('pg-next').disabled = issuesPage >= total - 1
}

document.getElementById('pg-prev').addEventListener('click', () => {
  if (issuesPage > 0) { issuesPage--; renderIssuePage() }
})
document.getElementById('pg-next').addEventListener('click', () => {
  const total = Math.ceil(allIssues.length / PAGE_SIZE)
  if (issuesPage < total - 1) { issuesPage++; renderIssuePage() }
})

function toggleFullscreen(cardId, btnId) {
  const card = document.getElementById(cardId)
  const btn  = document.getElementById(btnId)
  if (!document.fullscreenElement) {
    card.requestFullscreen()
  } else {
    document.exitFullscreen()
  }
  document.addEventListener('fullscreenchange', () => {
    const icon = btn.querySelector('i')
    if (document.fullscreenElement === card) {
      icon.className = 'ti ti-arrows-minimize'
    } else {
      icon.className = 'ti ti-arrows-maximize'
    }
  }, { once: true })
}

document.getElementById('fs-pages').addEventListener('click',   () => toggleFullscreen('card-pages',   'fs-pages'))
document.getElementById('fs-ratings').addEventListener('click', () => toggleFullscreen('card-ratings', 'fs-ratings'))
document.getElementById('fs-issues').addEventListener('click',  () => toggleFullscreen('card-issues',  'fs-issues'))

async function load() {
  refreshBtn.disabled = true
  lastUpdated.textContent = 'Loading…'
  try {
    const projectId = projSelect.value
    const { stats, pages, ratings, issues } = await loadAll(projectId)
    const avg = ratings.length
      ? ratings.reduce((s, r) => s + r.score, 0) / ratings.length
      : null
    renderMetrics(stats, avg, ratings.length)
    renderPages(pages)
    renderRatings(ratings)
    allIssues = issues
    issuesPage = 0
    renderIssuePage()
    lastUpdated.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  } catch (err) {
    console.error('[pulse]', err)
    lastUpdated.textContent = 'Error — check console'
  } finally {
    refreshBtn.disabled = false
  }
}

projSelect.addEventListener('change', load)
refreshBtn.addEventListener('click', load)
setInterval(load, REFRESH_MS)
load()
