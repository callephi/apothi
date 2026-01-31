import React, { useState, useEffect } from 'react';
import axios from 'axios';
import logger from '../utils/logger';

function Dashboard() {
  const [applications, setApplications] = useState([]);
  const [filteredApps, setFilteredApps] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedVersions, setSelectedVersions] = useState({});
  const [selectedOS, setSelectedOS] = useState({});
  const [selectedVersionNumber, setSelectedVersionNumber] = useState({});
  const [selectedVersionType, setSelectedVersionType] = useState({});
  const [downloading, setDownloading] = useState(null);
  const [appVersions, setAppVersions] = useState({});
  const [sortBy, setSortBy] = useState('name');
  const [filterOS, setFilterOS] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('apothi_viewMode');
    return saved || 'grid';
  });
  const [showMenu, setShowMenu] = useState(false);
  const [showTagsMenu, setShowTagsMenu] = useState(false);

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('apothi_viewMode', viewMode);
  }, [viewMode]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showTagsMenu && !event.target.closest('.tags-menu-container')) {
        setShowTagsMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showTagsMenu]);

  useEffect(() => {
    loadApplications();
  }, []);

  useEffect(() => {
    let filtered = applications;
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(app =>
        app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.developer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.publisher?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // OS filter
    if (filterOS !== 'all') {
      filtered = filtered.filter(app => {
        const versions = appVersions[app.id] || [];
        return versions.some(v => v.operating_system === filterOS);
      });
    }
    
    // Tags filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter(app => {
        const appTags = app.tags || [];
        return selectedTags.every(tag => appTags.includes(tag));
      });
    }
    
    // Sort
    if (sortBy === 'name') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else {
      filtered = [...filtered].sort((a, b) => 
        new Date(b.created_at) - new Date(a.created_at)
      );
    }
    
    setFilteredApps(filtered);
  }, [searchTerm, applications, sortBy, filterOS, selectedTags, appVersions]);

  const loadApplications = async () => {
    try {
      const response = await axios.get('/applications');
      setApplications(response.data.applications);
      setFilteredApps(response.data.applications);
      
      // Load versions for each application
      for (const app of response.data.applications) {
        loadVersionsForApp(app);
      }
    } catch (err) {
      logger.error('Error loading applications:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVersionsForApp = async (app) => {
    try {
      const response = await axios.get(`/applications/${app.id}`);
      const versions = response.data.versions.slice(0, 15); // Latest 15 versions (already sorted by sort_order DESC)
      setAppVersions(prev => ({ ...prev, [app.id]: versions }));
      
      // Auto-select latest version for single OS apps
      if (!app.has_multiple_os && versions.length > 0) {
        // Get the latest version (first one, as it's sorted by sort_order DESC)
        const latestVersion = versions[0];
        setSelectedVersionNumber(prev => ({ ...prev, [app.id]: latestVersion.version_number }));
        
        // Check if there are multiple types for this version
        const sameVersionTypes = versions.filter(v => v.version_number === latestVersion.version_number);
        
        if (sameVersionTypes.length === 1) {
          // Only one type, auto-select it
          setSelectedVersions(prev => ({ ...prev, [app.id]: latestVersion.id }));
        }
        // If multiple types, user needs to select type
      }
    } catch (err) {
      logger.error('Error loading versions:', err);
    }
  };

  const handleDownload = async (appId, appName) => {
    const versionId = selectedVersions[appId];
    if (!versionId) return;

    setDownloading(appId);
    try {
      const versions = appVersions[appId];
      const version = versions.find(v => v.id === versionId);
      
      const response = await axios.get(`/download/${versionId}`, {
        responseType: 'blob'
      });
      
      // Get original filename from file_path
      const originalFilename = version.file_path.split('/').pop();
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', originalFilename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      logger.error('Error downloading:', err);
      alert('Failed to download file');
    } finally {
      setDownloading(null);
    }
  };

  // Helper function to group versions by version number and OS
  const groupVersions = (versions) => {
    const grouped = {};
    versions.forEach(v => {
      const key = `${v.version_number}-${v.operating_system || 'all'}`;
      if (!grouped[key]) {
        grouped[key] = {
          versionNumber: v.version_number,
          operatingSystem: v.operating_system,
          types: []
        };
      }
      grouped[key].types.push({
        id: v.id,
        type: v.version_type,
        ...v
      });
    });
    return Object.values(grouped);
  };

  if (loading) {
    return <div className="loading">Loading applications...</div>;
  }

  return (
    <div className="container">
      <h2 style={{ marginBottom: '20px' }}>Application Library</h2>
      
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="version-select" style={{ flex: '0 0 auto' }}>
            <option value="name">Sort: A-Z</option>
            <option value="date">Sort: Latest</option>
          </select>
          
          <select value={filterOS} onChange={(e) => setFilterOS(e.target.value)} className="version-select" style={{ flex: '0 0 auto' }}>
            <option value="all">All Platforms</option>
            <option value="Windows">Windows Only</option>
            <option value="macOS">macOS Only</option>
            <option value="Linux">Linux Only</option>
          </select>
          
          <div className="tags-menu-container" style={{ position: 'relative' }}>
            <button 
              className="btn btn-secondary"
              onClick={() => setShowTagsMenu(!showTagsMenu)}
              style={{ padding: '10px 16px' }}
            >
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
            </button>
            {showTagsMenu && (() => {
              const allTags = [...new Set(applications.flatMap(app => app.tags || []))].sort();
              return (
                <div className="dropdown-menu" style={{ left: '50%', transform: 'translateX(-50%)', minWidth: '200px', maxHeight: '300px', overflowY: 'auto' }}>
                  {allTags.length === 0 ? (
                    <div style={{ padding: '12px', color: 'var(--text-meta)' }}>No tags available</div>
                  ) : (
                    allTags.map(tag => (
                      <label key={tag} style={{ display: 'flex', alignItems: 'center', padding: '8px 12px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={selectedTags.includes(tag)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTags([...selectedTags, tag]);
                            } else {
                              setSelectedTags(selectedTags.filter(t => t !== tag));
                            }
                          }}
                          style={{ marginRight: '8px' }}
                        />
                        {tag}
                      </label>
                    ))
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`btn ${viewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('grid')}
            style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Grid View"
          >
            <img src="/icons/grid.svg" width="20" height="20" alt="Grid" style={{ display: 'block' }} />
          </button>
          <button
            className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setViewMode('list')}
            style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="List View"
          >
            <img src="/icons/list.svg" width="20" height="20" alt="List" style={{ display: 'block' }} />
          </button>
        </div>
      </div>
      
      <input
        type="text"
        className="search-bar"
        placeholder="Search applications..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      {filteredApps.length === 0 ? (
        <div className="empty-state">
          <h3>No applications found</h3>
          <p>{searchTerm ? 'Try a different search term' : 'No applications have been added yet'}</p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid' : 'app-list'}>
          {filteredApps.map(app => {
            const versions = appVersions[app.id] || [];
            const selectedVersionId = selectedVersions[app.id];
            
            return (
              <div key={app.id} className={viewMode === 'grid' ? 'app-card-enhanced' : 'app-list-item'} style={{ position: 'relative' }}>
                {/* OS tags and homepage icon for grid view - positioned absolutely */}
                {viewMode === 'grid' && (() => {
                  const operatingSystems = [...new Set(versions.map(v => v.operating_system).filter(Boolean))].sort((a, b) => {
                    const order = ['Windows', 'macOS', 'Linux'];
                    return order.indexOf(a) - order.indexOf(b);
                  });
                  
                  const isGitHub = app.homepage && app.homepage.includes('github.com');
                  
                  // Show if there are OS tags or homepage
                  if (operatingSystems.length > 0 || app.homepage) {
                    return (
                      <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-end' }}>
                        {operatingSystems.length > 0 && operatingSystems.map(os => (
                          <span key={os} style={{
                            background: 'var(--btn-primary)',
                            color: 'white',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600',
                            textAlign: 'center'
                          }}>
                            {os}
                          </span>
                        ))}
                        {app.homepage && (
                          <a 
                            href={app.homepage} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '4px',
                              padding: '4px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: operatingSystems.length > 0 ? '4px' : '0'
                            }}
                            title={app.homepage}
                          >
                            {isGitHub ? (
                              <img src="/icons/github.svg" width="16" height="16" alt="GitHub" style={{ display: 'block' }} />
                            ) : (
                              <img src="/icons/globe.svg" width="16" height="16" alt="Website" style={{ display: 'block' }} />
                            )}
                          </a>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}
                {app.icon_url && (
                  <img src={app.icon_url} alt={app.name} className="app-icon" />
                )}
                <div className="app-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0 }}>{app.name}</h3>
                    {viewMode === 'list' && versions.length > 0 && (() => {
                      const operatingSystems = [...new Set(versions.map(v => v.operating_system).filter(Boolean))].sort((a, b) => {
                        const order = ['Windows', 'macOS', 'Linux'];
                        return order.indexOf(a) - order.indexOf(b);
                      });
                      const isGitHub = app.homepage && app.homepage.includes('github.com');
                      
                      return (
                        <>
                          {operatingSystems.map(os => (
                            <span key={os} style={{
                              background: 'var(--btn-primary)',
                              color: 'white',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: '600',
                              textAlign: 'center'
                            }}>
                              {os}
                            </span>
                          ))}
                          {app.homepage && (
                            <a 
                              href={app.homepage} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '4px',
                                padding: '4px 8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title={app.homepage}
                            >
                              {isGitHub ? (
                                <img src="/icons/github.svg" width="16" height="16" alt="GitHub" style={{ display: 'block' }} />
                              ) : (
                                <img src="/icons/globe.svg" width="16" height="16" alt="Website" style={{ display: 'block' }} />
                              )}
                            </a>
                          )}
                        </>
                      );
                    })()}
                  </div>
                  {app.developer && <p className="app-meta">Developer: {app.developer}</p>}
                  {app.publisher && <p className="app-meta">Publisher: {app.publisher}</p>}
                  {app.latest_version && <p className="app-meta">Latest: v{app.latest_version}</p>}
                  <p className="app-description">{app.description || 'No description available'}</p>
                </div>
                
                {versions.length > 0 && (
                  <div className="app-download-section">
                    {(() => {
                      const groupedVersions = groupVersions(versions);
                      const selectedOSForApp = selectedOS[app.id];
                      const selectedVerNum = selectedVersionNumber[app.id];
                      const selectedType = selectedVersionType[app.id];
                      
                      const operatingSystems = [...new Set(versions.map(v => v.operating_system).filter(Boolean))].sort((a, b) => {
                        const order = ['Windows', 'macOS', 'Linux'];
                        return order.indexOf(a) - order.indexOf(b);
                      });
                      const isGitHub = app.homepage && app.homepage.includes('github.com');
                      
                      return (
                        <>
                          {app.has_multiple_os && (
                            <select
                              className="version-select"
                              value={selectedOSForApp || ''}
                              onChange={(e) => {
                                setSelectedOS(prev => ({ ...prev, [app.id]: e.target.value }));
                                setSelectedVersionNumber(prev => ({ ...prev, [app.id]: '' }));
                                setSelectedVersionType(prev => ({ ...prev, [app.id]: '' }));
                                setSelectedVersions(prev => ({ ...prev, [app.id]: null }));
                              }}
                            >
                              <option value="">Select operating system...</option>
                              {[...new Set(groupedVersions.map(g => g.operatingSystem).filter(Boolean))].map(os => (
                                <option key={os} value={os}>{os}</option>
                              ))}
                            </select>
                          )}
                          
                          {(!app.has_multiple_os || selectedOSForApp) && (
                            <select
                              className="version-select"
                              value={selectedVerNum || ''}
                              onChange={(e) => {
                                const verNum = e.target.value;
                                setSelectedVersionNumber(prev => ({ ...prev, [app.id]: verNum }));
                                setSelectedVersionType(prev => ({ ...prev, [app.id]: '' }));
                                
                                // Find versions for this version number and OS
                                const matchingGroup = groupedVersions.find(g => 
                                  g.versionNumber === verNum && 
                                  (app.has_multiple_os ? g.operatingSystem === selectedOSForApp : true)
                                );
                                
                                if (matchingGroup && matchingGroup.types.length === 1) {
                                  // Only one type, auto-select it
                                  setSelectedVersions(prev => ({ ...prev, [app.id]: matchingGroup.types[0].id }));
                                } else {
                                  setSelectedVersions(prev => ({ ...prev, [app.id]: null }));
                                }
                              }}
                            >
                              <option value="">Select version...</option>
                              {groupedVersions
                                .filter(g => !app.has_multiple_os || g.operatingSystem === selectedOSForApp)
                                .map(g => (
                                  <option key={`${g.versionNumber}-${g.operatingSystem}`} value={g.versionNumber}>
                                    v{g.versionNumber}
                                    {g.types.length === 1 && ` (${g.types[0].type.charAt(0).toUpperCase() + g.types[0].type.slice(1)})`}
                                  </option>
                                ))}
                            </select>
                          )}
                          
                          {selectedVerNum && (() => {
                            const matchingGroup = groupedVersions.find(g => 
                              g.versionNumber === selectedVerNum && 
                              (app.has_multiple_os ? g.operatingSystem === selectedOSForApp : true)
                            );
                            
                            if (matchingGroup && matchingGroup.types.length > 1) {
                              return (
                                <select
                                  className="version-select"
                                  value={selectedType || ''}
                                  onChange={(e) => {
                                    const type = e.target.value;
                                    setSelectedVersionType(prev => ({ ...prev, [app.id]: type }));
                                    const typeVersion = matchingGroup.types.find(t => t.type === type);
                                    if (typeVersion) {
                                      setSelectedVersions(prev => ({ ...prev, [app.id]: typeVersion.id }));
                                    }
                                  }}
                                >
                                  <option value="">Select type...</option>
                                  {matchingGroup.types.map(t => (
                                    <option key={t.id} value={t.type}>
                                      {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                                    </option>
                                  ))}
                                </select>
                              );
                            }
                            return null;
                          })()}
                          
                          {selectedVersions[app.id] && (
                            <button
                              className="btn btn-download"
                              onClick={() => handleDownload(app.id, app.name)}
                              disabled={downloading === app.id}
                            >
                              {downloading === app.id ? 'Downloading...' : '⬇ Download'}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
                
                {versions.length === 0 && (
                  <p className="no-versions">No versions available</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
