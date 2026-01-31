import React, { useState } from 'react';

function FileUpload({ onFileSelect, accept, label = "Drag & Drop or Click to Upload" }) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  const handleFileInput = (e) => {
    const files = e.target.files;
    if (files.length > 0) {
      onFileSelect(files[0]);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-upload-input').click()}
      style={{
        border: `2px dashed ${isDragging ? 'var(--btn-primary)' : 'var(--border-color)'}`,
        borderRadius: '8px',
        padding: '40px 20px',
        textAlign: 'center',
        cursor: 'pointer',
        background: isDragging ? 'var(--bg-secondary)' : 'transparent',
        transition: 'all 0.2s',
        color: 'var(--text-secondary)'
      }}
    >
      <input
        id="file-upload-input"
        type="file"
        accept={accept}
        onChange={handleFileInput}
        style={{ display: 'none' }}
      />
      <div style={{ fontSize: '14px' }}>
        {label}
      </div>
    </div>
  );
}

export default FileUpload;
