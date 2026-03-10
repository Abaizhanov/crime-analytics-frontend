'use client'
import dynamic from 'next/dynamic'

const CrimeMap = dynamic(() => import('./components/CrimeMap'), {
  ssr: false
})

export default function Home() {
  return (
    <div>
      <CrimeMap />
    </div>
  )
}