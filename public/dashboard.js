import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js'
import { FIREBASE_CONFIG, REFRESH_MS } from './config.js'
import { initDb, loadAll, fetchApps } from './data.js'
import { renderMetrics, renderPages, renderRatings, renderIssues } from './render.js'

const app = initializeApp(FIREBASE_CONFIG, 'pulse-dashboard')
initDb(app)

const projSelect  = document.getElementById('proj-select')
const refreshBtn  = document.getElementById('refresh-btn')
const lastUpdated = document.getElementById('last-updated')

const PAGE_SIZE = 10
let allIssues = []
let issuesPage = 0

// ── LocalStorage keys ──────────────────────────────────────────
const LS_PROJECT = 'pulse_selected_project'
const LS_THEME   = 'pulse_theme'

// ── Theme toggle ───────────────────────────────────────────────
const themeBtn  = document.getElementById('theme-btn')
const themeIcon = document.getElementById('theme-icon')

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  themeIcon.className = theme === 'dark' ? 'ti ti-moon' : 'ti ti-sun'
  localStorage.setItem(LS_THEME, theme)
}

applyTheme(localStorage.getItem(LS_THEME) || 'dark')

themeBtn.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
  applyTheme(next)
})

// ── Load apps from Firestore and populate dropdown ─────────────
async function initProjects() {
  let projects = []
  try {
    projects = await fetchApps()
  } catch (err) {
    console.error('[pulse] failed to load apps:', err)
  }

  if (!projects.length) {
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = 'No apps configured'
    projSelect.appendChild(opt)
    return
  }

  projects.forEach(p => {
    const opt = document.createElement('option')
    opt.value = p.id
    opt.textContent = p.label
    projSelect.appendChild(opt)
  })

  const saved      = localStorage.getItem(LS_PROJECT)
  const savedValid = projects.some(p => p.id === saved)
  projSelect.value = savedValid ? saved : projects[0].id

  load()
}

projSelect.addEventListener('change', () => {
  localStorage.setItem(LS_PROJECT, projSelect.value)
  load()
})

// ── Issue pagination ───────────────────────────────────────────
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

// ── Fullscreen ─────────────────────────────────────────────────
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

// ── Data load ──────────────────────────────────────────────────
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

refreshBtn.addEventListener('click', load)
if (REFRESH_MS > 0) setInterval(load, REFRESH_MS)

initProjects()