import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('Scoring app crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', fontFamily: 'sans-serif' }}>
          <h2 style={{ color: '#2E75B6' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: 20 }}>
            {this.state.error?.message}
          </p>
          <button
            type="button"
            onClick={() => { window.location.href = '/'; }}
            style={{
              background: '#2E75B6',
              color: 'white',
              border: 'none',
              padding: '12px 24px',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 16
            }}
          >
            Return to Home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
