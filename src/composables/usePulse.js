import { ref, onMounted, onUnmounted } from 'vue'
import { getFingerprint } from '../services/fingerprint.js'
import {
  recordVisit,
  subscribeStats,
  subscribePageStats,
  subscribeAllPages,
} from '../services/pulse.js'

export function usePulse({ projectId, pageKey = null, context = {} }) {
  const stats = ref(null)
  const pageStats = ref(null)
  const allPages = ref([])
  const loading = ref(true)
  const error = ref(null)

  const unsubs = []

  onMounted(async () => {
    try {
      const fingerprintId = await getFingerprint()
      await recordVisit(projectId, pageKey, { ...context, fingerprintId })

      unsubs.push(
        subscribeStats(projectId, (data) => {
          stats.value = data
          loading.value = false
        })
      )

      if (pageKey) {
        unsubs.push(
          subscribePageStats(projectId, pageKey, (data) => {
            pageStats.value = data
          })
        )
      }

      unsubs.push(
        subscribeAllPages(projectId, (data) => {
          allPages.value = data
        })
      )
    } catch (e) {
      error.value = e
      loading.value = false
    }
  })

  onUnmounted(() => {
    unsubs.forEach((fn) => fn())
  })

  return { stats, pageStats, allPages, loading, error }
}
