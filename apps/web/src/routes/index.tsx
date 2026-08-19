import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getHealth } from '@yetano/api-client'

import { StackTable } from '../components/StackTable'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  const health = useQuery({
    queryFn: async () => {
      const response = await getHealth({ throwOnError: true })
      return response.data
    },
    queryKey: ['api-health'],
  })

  const apiStatus = health.isPending
    ? 'Sprawdzanie…'
    : health.isSuccess
      ? 'Połączono'
      : 'Niedostępne'

  return (
    <main>
      <section className="hero" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">Fundament aplikacji</p>
          <h1 id="page-title">Praca operacyjna bez zbędnego ciężaru.</h1>
          <p className="hero-copy">
            Yetano Work ma gotowy, typowany pion od Reacta do PostgreSQL — przygotowany na
            rozwijanie właściwych modułów CRM i ERP.
          </p>
        </div>
        <aside className="status-card" aria-label="Status API">
          <span className={`status-dot status-dot--${health.isSuccess ? 'up' : 'down'}`} />
          <div>
            <span className="status-label">API i PostgreSQL</span>
            <strong>{apiStatus}</strong>
            {health.data ? <small>wersja {health.data.version}</small> : null}
          </div>
        </aside>
      </section>

      <section className="foundation" aria-labelledby="foundation-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Etap 1</p>
            <h2 id="foundation-title">Gotowy fundament</h2>
          </div>
          <span className="quiet-badge">Bez PWA i pgvector na tym etapie</span>
        </div>
        <StackTable />
      </section>
    </main>
  )
}
