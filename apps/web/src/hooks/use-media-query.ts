import { useEffect, useState } from 'react'

function useMediaQuery(query: string, fallback = false) {
  const [matches, setMatches] = useState(() => {
    if (typeof window.matchMedia !== 'function') return fallback
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const media = window.matchMedia(query)
    const update = () => setMatches(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [query])

  return matches
}

export { useMediaQuery }
