const EMOJI  = ['😵', '🤔', '🙂', '💡', '🚀']
const LABELS = ['Lost', 'Confused', 'Getting it', 'Got it!', 'Mastered!']

const IST = { timeZone: 'Asia/Kolkata' }

function toIST(ts) {
  if (!ts?.toMillis) return ''
  return new Date(ts.toMillis()).toLocaleString('en-IN', {
    ...IST, day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

const BASE_URL = 'https://learn.kanaksan.com'

const SUBJ_CODE = { physics: 'phy', chemistry: 'che', maths: 'mat', biology: 'bio' }

function shortKey(pageKey) {
  const m = pageKey.match(/ncert_class(\d+)_(\w+)_chapters_(\d+)-[^_]+_([\w-]+)$/)
  if (!m) return pageKey
  const [, cls, subj, ch, lesson] = m
  return `ncert/${cls}/${SUBJ_CODE[subj] ?? subj}/ch${ch}/${lesson}`
}

function pageUrl(pageKey) {
  return BASE_URL + '/' + pageKey.replace(/_/g, '/').replace('/chapters/', '/chapters/')
}

function timeAgo(ts) {
  if (!ts?.toMillis) return ''
  const s = Math.floor((Date.now() - ts.toMillis()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function renderMetrics(stats, avgRating, totalRatings) {
  const el = document.getElementById('metrics')
  const avg = avgRating != null ? avgRating.toFixed(1) : '—'
  if (!stats) { el.innerHTML = '<div class="metric"><div class="m-label">No data yet</div></div>'; return }
  const dateIST = stats.todayDate
    ? new Date(stats.todayDate + 'T00:00:00+05:30').toLocaleDateString('en-IN', { ...IST, day: '2-digit', month: 'short' })
    : ''
  el.innerHTML = `
    <div class="metric"><div class="m-label">Total visits</div><div class="m-value">${(stats.total ?? 0).toLocaleString('en-IN')}</div><div class="m-sub">all time</div></div>
    <div class="metric"><div class="m-label">Unique visitors</div><div class="m-value">${(stats.unique ?? 0).toLocaleString('en-IN')}</div><div class="m-sub">by fingerprint</div></div>
    <div class="metric"><div class="m-label">Today</div><div class="m-value">${(stats.todayCount ?? 0).toLocaleString('en-IN')}</div><div class="m-sub">${dateIST}</div></div>
    <div class="metric"><div class="m-label">Avg rating</div><div class="m-value">${avg}</div><div class="m-sub">${totalRatings} ratings</div></div>
  `
}

export function renderPages(pages) {
  const el = document.getElementById('pages-list')
  if (!pages.length) { el.innerHTML = '<p class="empty">No page data yet.</p>'; return }
  const max = pages[0].total || 1
  el.innerHTML = pages.map(p => `
    <div class="page-row">
      <a class="page-key" href="${pageUrl(p.pageKey)}" target="_blank" rel="noopener" title="${p.pageKey}">${shortKey(p.pageKey)}</a>
      <div class="bar-wrap"><div class="bar-fill" style="width:${Math.round(p.total / max * 100)}%"></div></div>
      <span class="page-num">${p.total}</span>
    </div>`).join('')
}

export function renderRatings(ratings) {
  const avgEl = document.getElementById('ratings-avg')
  const listEl = document.getElementById('ratings-list')
  if (!ratings.length) {
    avgEl.innerHTML = ''
    listEl.innerHTML = '<p class="empty">No ratings yet.</p>'
    return
  }
  const avg = (ratings.reduce((s, r) => s + r.score, 0) / ratings.length).toFixed(1)
  const counts = [0, 0, 0, 0, 0]
  ratings.forEach(r => { if (r.score >= 1 && r.score <= 5) counts[r.score - 1]++ })
  const max = Math.max(...counts, 1)
  avgEl.innerHTML = `<span class="avg-big">${avg}</span><span class="avg-of">/ 5 &nbsp;·&nbsp; ${ratings.length} ratings</span>`
  listEl.innerHTML = [...counts].reverse().map((c, i) => {
    const idx = 4 - i
    return `<div class="rating-row">
      <span class="r-emoji">${EMOJI[idx]}</span>
      <span class="r-label">${LABELS[idx]}</span>
      <div class="r-bar-wrap"><div class="r-bar-fill" style="width:${Math.round(c / max * 100)}%"></div></div>
      <span class="r-count">${c}</span>
    </div>`
  }).join('')
}

export function renderIssues(issues) {
  const el = document.getElementById('issues-list')
  if (!issues.length) { el.innerHTML = '<p class="empty">No issues reported yet.</p>'; return }
  el.innerHTML = issues.map(i => `
    <div class="issue-item">
      <div class="issue-top">
        <span class="issue-cat">${i.category}</span>
        <span class="issue-page">${i.pageKey}</span>
        <span class="issue-time" title="${toIST(i.ts)}">${timeAgo(i.ts)}</span>
      </div>
      ${i.comment ? `<div class="issue-comment">${i.comment}</div>` : ''}
    </div>`).join('')
}
