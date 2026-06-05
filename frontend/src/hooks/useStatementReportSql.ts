import { useEffect, useMemo, useState } from 'react'
import { reportsApi } from '../api/reports'
import { extractReportIdsFromConfig, type StatementConfig } from '../lib/statementConfig'

export function useStatementReportSql(
  accessToken: string | null,
  config: StatementConfig | null | undefined,
) {
  const reportIds = useMemo(
    () => (config ? extractReportIdsFromConfig(config) : []),
    [config],
  )
  const reportIdsKey = reportIds.join(',')

  const [sqlByReportId, setSqlByReportId] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!accessToken || reportIds.length === 0) {
      setSqlByReportId({})
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    Promise.all(
      reportIds.map(async (id) => {
        try {
          const report = await reportsApi.get(accessToken, id)
          return [id, report.sql] as const
        } catch {
          return [id, ''] as const
        }
      }),
    )
      .then((entries) => {
        if (cancelled) return
        setSqlByReportId(Object.fromEntries(entries))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accessToken, reportIdsKey, reportIds.length])

  const sqlSources = useMemo(
    () => reportIds.map((id) => sqlByReportId[id]).filter((sql): sql is string => Boolean(sql)),
    [reportIds, sqlByReportId],
  )

  return { sqlSources, loading, reportIds }
}
