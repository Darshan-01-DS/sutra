'use client'
// src/components/panels/GraphErrorBoundary.tsx

import React from 'react'

interface State { hasError: boolean }

export class GraphErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(): State {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.error('[GraphErrorBoundary] Graph render failed:', error)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>◎</div>
          <div style={{ color: 'var(--text2)', marginBottom: 8 }}>Graph could not render</div>
          <button
            className="btn-ghost"
            onClick={() => this.setState({ hasError: false })}
            style={{ marginTop: 8 }}
          >
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
