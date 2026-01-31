import React from 'react';

function Footer() {
  // Get current year in EST
  const currentYear = new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    year: 'numeric'
  });

  return (
    <footer style={{
      textAlign: 'center',
      padding: '20px',
      marginTop: 'auto',
      color: 'var(--text-meta)',
      fontSize: '14px',
      borderTop: '1px solid var(--border-color)'
    }}>
      apothi. v1.0.1 | Designed by <a href="https://github.com/callephi" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-meta)', textDecoration: 'underline' }}>callephi@mcw</a> © {currentYear}.
    </footer>
  );
}

export default Footer;
