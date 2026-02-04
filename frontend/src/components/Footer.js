import React from 'react';

function Footer() {
  // Get current year in EST
  const currentYear = new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric'
  });

  return (
    <footer style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      textAlign: 'center',
      padding: '12px 20px',
      color: 'var(--text-meta)',
      fontSize: '14px',
      borderTop: '1px solid var(--border-color)',
      background: 'var(--bg-primary)',
      zIndex: 100
    }}>
      apothi. v1.0.3a | Designed by <a href="https://github.com/callephi" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-meta)', textDecoration: 'underline' }}>callephi@mcw</a> © {currentYear}.
    </footer>
  );
}

export default Footer;
