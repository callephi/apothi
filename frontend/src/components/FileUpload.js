import React, { useState } from 'react';

function FileUpload({ onFileSelect, currentFile, accept, label = "Drag & Drop or Click to Upload" }) {
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

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + sizes[i];
  };

  return (
    <>
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
      
      {currentFile && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '20px' }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ 
                fontWeight: '600', 
                fontSize: '14px',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {currentFile.name}
              </div>
              <div style={{ 
                fontSize: '12px', 
                color: 'var(--text-meta)',
                marginTop: '2px'
              }}>
                {formatFileSize(currentFile.size)}
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onFileSelect(null);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-meta)',
                cursor: 'pointer',
                fontSize: '20px',
                padding: '4px 8px',
                lineHeight: 1
              }}
              title="Remove file"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default FileUpload;
