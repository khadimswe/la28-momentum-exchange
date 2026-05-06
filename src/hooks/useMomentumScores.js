import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

export function useMomentumScores() {
  const [scores, setScores] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadScores() {
      try {
        const snapshot = await getDocs(collection(db, 'momentum'))
        const data = {}
        snapshot.forEach((doc) => {
          data[doc.id] = doc.data()
        })
        setScores(data)
      } catch (e) {
        console.error('Failed to load momentum scores:', e)
      } finally {
        setLoading(false)
      }
    }
    loadScores()
  }, [])

  return { scores, loading }
}
