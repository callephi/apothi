import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

function ApplicationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(null);

  useEffect(() => {
    loadApplication();
  }, [id]);

  const loadApplication = async () => {
    try {
      const response = await axios.get(`/applications/${id}`);
      setApplication(response.data.application);
      setVersions(response.data.versions);
    } catch (err) {
      console.error('Error loading application:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (versionId, versionNumber) => {
    setDownloading(versionId);
    try {
      const response = await axios.get(`/download/${versionId}`, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${application.name}-${versionNumber}.7z`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading:', err);
      alert('Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return <div className="loading">Loading application...</div>;
  }

  if (!application) {
    return (
      <div className="container">
        <div className="empty-state">
          <h3>Application not found</h3>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Library
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <button className="btn btn-secondary" onClick={() => navigate('/')} style={{ marginBottom: '20px' }}>
        ← Back to Library
      </button>

      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '20px' }}>
          {application.icon_url && (
            <img src={application.icon_url} alt={application.name} style={{ width: '64px', height: '64px' }} />
          )}
          <div>
            <h2 style={{ marginBottom: '10px' }}>{application.name}</h2>
            <p style={{ color: '#7f8c8d' }}>{application.description || 'No description available'}</p>
          </div>
        </div>

        <h3 style={{ marginBottom: '15px', marginTop: '30px' }}>Available Versions</h3>

        {versions.length === 0 ? (
          <div className="empty-state">
            <p>No versions available for download</p>
          </div>
        ) : (
          versions.map(version => (
            <div key={version.id} className="version-item">
              <div className="version-info">
                <h4>Version {version.version_number}</h4>
                <p>
                  {formatFileSize(version.file_size)} • Uploaded {formatDate(version.uploaded_at)}
                </p>
                {version.notes && <p style={{ marginTop: '5px' }}>{version.notes}</p>}
              </div>
              <div className="version-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => handleDownload(version.id, version.version_number)}
                  disabled={downloading === version.id}
                >
                  {downloading === version.id ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default ApplicationDetail;
