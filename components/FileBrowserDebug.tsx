'use client';

import { useEffect } from 'react';

export default function FileBrowserDebug() {
  useEffect(() => {
    console.log('FileBrowserDebug mounted');
    
    // Test the API
    fetch('/api/files')
      .then(response => response.json())
      .then(data => {
        console.log('API test response:', data);
      })
      .catch(error => {
        console.error('API test error:', error);
      });
  }, []);

  return (
    <div style={{ padding: '20px', background: '#f0f0f0', border: '2px solid red' }}>
      <h3>FileBrowser Debug Component</h3>
      <p>This component is mounted and should be visible.</p>
      <p>Check browser console for API test results.</p>
    </div>
  );
}
