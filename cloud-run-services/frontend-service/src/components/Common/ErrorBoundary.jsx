import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        // You can log the error to an error reporting service here
        console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ 
                    padding: '40px', 
                    textAlign: 'center', 
                    background: 'var(--bg-base)', 
                    color: 'var(--text-primary)',
                    height: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center'
                }}>
                    <i className='bx bx-error-circle' style={{ fontSize: '64px', color: '#ef4444', marginBottom: '20px' }}></i>
                    <h2 style={{ marginBottom: '10px' }}>Something went wrong.</h2>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '30px', maxWidth: '500px' }}>
                        The application encountered an unexpected error. We've been notified and are looking into it.
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '12px 24px',
                            background: 'var(--accent)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        Refresh Application
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <pre style={{ 
                            marginTop: '30px', 
                            textAlign: 'left', 
                            background: 'rgba(0,0,0,0.1)', 
                            padding: '15px', 
                            borderRadius: '8px',
                            maxWidth: '90vw',
                            overflow: 'auto',
                            fontSize: '12px'
                        }}>
                            {this.state.error?.toString()}
                        </pre>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
