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
  const [selectedArchitecture, setSelectedArchitecture] = useState({});
  const [downloading, setDownloading] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [downloadCancelTokens, setDownloadCancelTokens] = useState({});
  const [appVersions, setAppVersions] = useState({});
  const [sortBy, setSortBy] = useState('name');
  const [filterOS, setFilterOS] = useState('all');
  const [selectedTags, setSelectedTags] = useState([]);
  const [viewMode, setViewMode] = useState(() => {
    const saved = localStorage.getItem('apothi_viewMode');
    return saved || 'grid';
  });
  const [appsPerPage, setAppsPerPage] = useState(() => {
    const saved = localStorage.getItem('apothi_appsPerPage');
    return saved ? parseInt(saved) : 25;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const [showTagsMenu, setShowTagsMenu] = useState(false);

  // Save view mode and apps per page to localStorage
  useEffect(() => {
    localStorage.setItem('apothi_viewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('apothi_appsPerPage', appsPerPage.toString());
  }, [appsPerPage]);

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
    setCurrentPage(1); // Reset to first page when filters change
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

  // Format bytes to human readable
  const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const handleDownload = async (appId, appName) => {
    const versionId = selectedVersions[appId];
    if (!versionId) return;

    setDownloading(appId);
    setDownloadProgress({ [appId]: { loaded: 0, total: 0, speed: 0, percentage: 0 } });
    
    // Create cancel token
    const CancelToken = axios.CancelToken;
    const source = CancelToken.source();
    setDownloadCancelTokens({ ...downloadCancelTokens, [appId]: source });
    
    try {
      const versions = appVersions[appId];
      const version = versions.find(v => v.id === versionId);
      
      const startTime = Date.now();
      let lastTime = startTime;
      let lastLoaded = 0;
      
      const response = await axios.get(`/download/${versionId}`, {
        responseType: 'blob',
        cancelToken: source.token,
        onDownloadProgress: (progressEvent) => {
          const now = Date.now();
          const timeDiff = (now - lastTime) / 1000; // seconds
          const loadedDiff = progressEvent.loaded - lastLoaded;
          
          // Calculate speed (bytes per second)
          const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
          
          // Calculate percentage
          const percentage = progressEvent.total 
            ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
            : 0;
          
          setDownloadProgress({
            [appId]: {
              loaded: progressEvent.loaded,
              total: progressEvent.total || 0,
              speed: speed,
              percentage: percentage
            }
          });
          
          lastTime = now;
          lastLoaded = progressEvent.loaded;
        }
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
      if (axios.isCancel(err)) {
        logger.log('Download cancelled');
      } else {
        logger.error('Error downloading:', err);
        alert('Failed to download file');
      }
    } finally {
      setDownloading(null);
      setDownloadProgress({});
      // Clean up cancel token
      const newTokens = { ...downloadCancelTokens };
      delete newTokens[appId];
      setDownloadCancelTokens(newTokens);
    }
  };

  const cancelDownload = (appId) => {
    if (downloadCancelTokens[appId]) {
      downloadCancelTokens[appId].cancel('Download cancelled by user');
    }
  };

  // Helper function to group versions by version number and OS
  const groupVersions = (versions) => {
    const grouped = {};
    
    versions.forEach(v => {
      // If version has multiple architectures, expand into separate entries
      const archs = v.architecture && Array.isArray(v.architecture) && v.architecture.length > 0
        ? v.architecture
        : [v.architecture || null];
      
      archs.forEach(arch => {
        const key = `${v.version_number}-${v.operating_system || 'all'}`;
        if (!grouped[key]) {
          grouped[key] = {
            versionNumber: v.version_number,
            operatingSystem: v.operating_system,
            architectures: {}
          };
        }
        
        const archKey = arch || 'default';
        if (!grouped[key].architectures[archKey]) {
          grouped[key].architectures[archKey] = {
            architecture: arch,
            types: []
          };
        }
        
        grouped[key].architectures[archKey].types.push({
          id: v.id,
          type: v.version_type,
          ...v,
          architecture: arch // Override with current arch from loop
        });
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
        
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
              Apps per page:
            </label>
            <select
              value={appsPerPage}
              onChange={(e) => {
                setAppsPerPage(parseInt(e.target.value));
                setCurrentPage(1); // Reset to first page
              }}
              style={{
                padding: '8px 30px 8px 12px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                borderRadius: '6px',
                fontSize: '14px',
                cursor: 'pointer'
              }}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>
          
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
        <>
        <div className={viewMode === 'grid' ? 'grid' : 'app-list'}>
          {(() => {
            // Calculate pagination
            const totalPages = Math.ceil(filteredApps.length / appsPerPage);
            const startIndex = (currentPage - 1) * appsPerPage;
            const endIndex = startIndex + appsPerPage;
            const paginatedApps = filteredApps.slice(startIndex, endIndex);
            
            return paginatedApps.map(app => {
            const versions = appVersions[app.id] || [];
            const selectedVersionId = selectedVersions[app.id];
            
            return (
              <div key={app.id} className={viewMode === 'grid' ? 'app-card-enhanced' : 'app-list-item'} style={{ position: 'relative' }}>
                {/* OS tags and homepage icon for grid view - positioned absolutely */}
                {viewMode === 'grid' && (() => {
                  const operatingSystems = [...new Set(versions.map(v => v.operating_system).filter(Boolean))].sort((a, b) => {
                    const order = ['Windows', 'macOS', 'Linux', 'Source Code'];
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
                        const order = ['Windows', 'macOS', 'Linux', 'Source Code'];
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
                  {app.latest_version && (() => {
                    // Find largest file size for this version
                    const latestVersions = versions.filter(v => v.version_number === app.latest_version);
                    const maxSize = latestVersions.length > 0 
                      ? Math.max(...latestVersions.map(v => v.file_size || 0))
                      : 0;
                    return (
                      <p className="app-meta">
                        Latest: v{app.latest_version}
                        {maxSize > 0 && ` (~${formatBytes(maxSize)})`}
                      </p>
                    );
                  })()}
                  <p className="app-description">{app.description || 'No description available'}</p>
                </div>
                
                {versions.length > 0 && (
                  <div className="app-download-section">
                    {(() => {
                      const groupedVersions = groupVersions(versions);
                      const selectedOSForApp = selectedOS[app.id];
                      const selectedVerNum = selectedVersionNumber[app.id];
                      const selectedArch = selectedArchitecture[app.id];
                      const selectedType = selectedVersionType[app.id];
                      
                      const operatingSystems = [...new Set(versions.map(v => v.operating_system).filter(Boolean))].sort((a, b) => {
                        const order = ['Windows', 'macOS', 'Linux', 'Source Code'];
                        return order.indexOf(a) - order.indexOf(b);
                      });
                      
                      return (
                        <>
                          {/* OS Dropdown (only if multiple OS) */}
                          {app.has_multiple_os && (
                            <select
                              className={`version-select ${!selectedOSForApp ? 'full-width' : ''}`}
                              value={selectedOSForApp || ''}
                              onChange={(e) => {
                                setSelectedOS(prev => ({ ...prev, [app.id]: e.target.value }));
                                setSelectedVersionNumber(prev => ({ ...prev, [app.id]: '' }));
                                setSelectedArchitecture(prev => ({ ...prev, [app.id]: '' }));
                                setSelectedVersionType(prev => ({ ...prev, [app.id]: '' }));
                                setSelectedVersions(prev => ({ ...prev, [app.id]: null }));
                              }}
                            >
                              <option value="">Select operating system...</option>
                              {operatingSystems.map(os => (
                                <option key={os} value={os}>{os}</option>
                              ))}
                            </select>
                          )}
                          
                          {/* Version Dropdown */}
                          {(!app.has_multiple_os || selectedOSForApp) && (
                            <select
                              className={`version-select ${!app.has_multiple_os && !selectedVerNum ? 'full-width' : ''}`}
                              value={selectedVerNum || ''}
                              onChange={(e) => {
                                const verNum = e.target.value;
                                setSelectedVersionNumber(prev => ({ ...prev, [app.id]: verNum }));
                                setSelectedArchitecture(prev => ({ ...prev, [app.id]: '' }));
                                setSelectedVersionType(prev => ({ ...prev, [app.id]: '' }));
                                setSelectedVersions(prev => ({ ...prev, [app.id]: null }));
                                
                                // Find matching version group
                                const matchingGroup = groupedVersions.find(g => 
                                  g.versionNumber === verNum && 
                                  (app.has_multiple_os ? g.operatingSystem === selectedOSForApp : true)
                                );
                                
                                if (matchingGroup) {
                                  const archs = Object.keys(matchingGroup.architectures);
                                  
                                  // If only one architecture
                                  if (archs.length === 1) {
                                    const singleArch = matchingGroup.architectures[archs[0]];
                                    
                                    // If only one type in that architecture, auto-select
                                    if (singleArch.types.length === 1) {
                                      setSelectedVersions(prev => ({ ...prev, [app.id]: singleArch.types[0].id }));
                                    }
                                  }
                                }
                              }}
                            >
                              <option value="">Select version...</option>
                              {groupedVersions
                                .filter(g => !app.has_multiple_os || g.operatingSystem === selectedOSForApp)
                                .map(g => {
                                  const archs = Object.keys(g.architectures);
                                  const singleArch = archs.length === 1 ? g.architectures[archs[0]] : null;
                                  
                                  // Show architecture if: single arch with single type, OR single arch with architecture defined
                                  const showArch = singleArch && singleArch.architecture;
                                  const archLabel = showArch ? `, ${singleArch.architecture}` : '';
                                  
                                  const typeLabel = singleArch && singleArch.types.length === 1 
                                    ? ` (${singleArch.types[0].type.charAt(0).toUpperCase() + singleArch.types[0].type.slice(1)}${archLabel})`
                                    : '';
                                  
                                  return (
                                    <option key={`${g.versionNumber}-${g.operatingSystem}`} value={g.versionNumber}>
                                      v{g.versionNumber}{typeLabel}
                                    </option>
                                  );
                                })}
                            </select>
                          )}
                          
                          {/* Architecture Dropdown (if multiple architectures exist) */}
                          {selectedVerNum && (() => {
                            const matchingGroup = groupedVersions.find(g => 
                              g.versionNumber === selectedVerNum && 
                              (app.has_multiple_os ? g.operatingSystem === selectedOSForApp : true)
                            );
                            
                            if (!matchingGroup) return null;
                            
                            const archs = Object.keys(matchingGroup.architectures);
                            
                            if (archs.length > 1) {
                              return (
                                <select
                                  className="version-select"
                                  value={selectedArch || ''}
                                  onChange={(e) => {
                                    const arch = e.target.value;
                                    setSelectedArchitecture(prev => ({ ...prev, [app.id]: arch }));
                                    setSelectedVersionType(prev => ({ ...prev, [app.id]: '' }));
                                    setSelectedVersions(prev => ({ ...prev, [app.id]: null }));
                                    
                                    // If only one type for this arch, auto-select
                                    const archData = matchingGroup.architectures[arch];
                                    if (archData && archData.types.length === 1) {
                                      setSelectedVersions(prev => ({ ...prev, [app.id]: archData.types[0].id }));
                                    }
                                  }}
                                >
                                  <option value="">Select arch...</option>
                                  {archs.map(arch => {
                                    const archData = matchingGroup.architectures[arch];
                                    const archLabel = archData.architecture || 'Default';
                                    const typeLabel = archData.types.length === 1 
                                      ? ` (${archData.types[0].type.charAt(0).toUpperCase() + archData.types[0].type.slice(1)})`
                                      : '';
                                    
                                    return (
                                      <option key={arch} value={arch}>
                                        {archLabel}{typeLabel}
                                      </option>
                                    );
                                  })}
                                </select>
                              );
                            }
                            return null;
                          })()}
                          
                          {/* Type Dropdown (if multiple types exist for selected arch) */}
                          {selectedVerNum && (() => {
                            const matchingGroup = groupedVersions.find(g => 
                              g.versionNumber === selectedVerNum && 
                              (app.has_multiple_os ? g.operatingSystem === selectedOSForApp : true)
                            );
                            
                            if (!matchingGroup) return null;
                            
                            const archs = Object.keys(matchingGroup.architectures);
                            const currentArch = archs.length > 1 ? selectedArch : archs[0];
                            
                            if (!currentArch) return null;
                            
                            const archData = matchingGroup.architectures[currentArch];
                            
                            if (archData && archData.types.length > 1) {
                              return (
                                <select
                                  className="version-select"
                                  value={selectedType || ''}
                                  onChange={(e) => {
                                    const type = e.target.value;
                                    setSelectedVersionType(prev => ({ ...prev, [app.id]: type }));
                                    const typeVersion = archData.types.find(t => t.type === type);
                                    if (typeVersion) {
                                      setSelectedVersions(prev => ({ ...prev, [app.id]: typeVersion.id }));
                                    }
                                  }}
                                >
                                  <option value="">Select type...</option>
                                  {archData.types.map(t => {
                                    // Show architecture if it exists on any type in this archData
                                    const showArch = t.architecture || archData.architecture;
                                    return (
                                      <option key={t.id} value={t.type}>
                                        {t.type.charAt(0).toUpperCase() + t.type.slice(1)}
                                        {showArch ? ` (${showArch})` : ''}
                                      </option>
                                    );
                                  })}
                                </select>
                              );
                            }
                            return null;
                          })()}
                          
                          {/* Download Button */}
                          {selectedVersions[app.id] && (
                            <button
                              className="btn btn-download"
                              onClick={() => downloading === app.id ? cancelDownload(app.id) : handleDownload(app.id, app.name)}
                              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minHeight: downloading === app.id ? '60px' : 'auto', position: 'relative' }}
                            >
                              {downloading === app.id ? (
                                <>
                                  <div>Downloading...</div>
                                  {downloadProgress[app.id] && (
                                    <div style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
                                      <span>{formatBytes(downloadProgress[app.id].speed)}/s</span>
                                      <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.3)', borderRadius: '2px', overflow: 'hidden' }}>
                                        <div style={{ height: '100%', background: 'white', width: `${downloadProgress[app.id].percentage}%`, transition: 'width 0.3s' }}></div>
                                      </div>
                                      <span>{downloadProgress[app.id].percentage}%</span>
                                      <img 
                                        src="/icons/spinner.svg" 
                                        width="16" 
                                        height="16" 
                                        alt="Loading" 
                                        style={{ animation: 'spin 1s linear infinite', cursor: 'pointer' }}
                                        title="Click to cancel download"
                                      />
                                    </div>
                                  )}
                                </>
                              ) : '⬇ Download'}
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
          })()}
        </div>
        
        {/* Pagination Controls */}
        {filteredApps.length > 0 && (() => {
          const totalPages = Math.ceil(filteredApps.length / appsPerPage);
          
          // Reset to page 1 if current page exceeds total pages
          if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
          }
          
          if (totalPages <= 1) {
            return null;
          }
          
          return (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '10px', 
              marginTop: '30px',
              marginBottom: '20px'
            }}>
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ minWidth: '80px' }}
              >
                Previous
              </button>
              
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', justifyContent: 'center' }}>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  // Show first, last, and pages around current
                  let pageNum;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      className={`btn ${currentPage === pageNum ? 'btn-primary' : 'btn-secondary'}`}
                      onClick={() => setCurrentPage(pageNum)}
                      style={{ minWidth: '40px' }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                className="btn btn-secondary"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ minWidth: '80px' }}
              >
                Next
              </button>
            </div>
          );
        })()}
        </>
      )}
    </div>
  );
}

export default Dashboard;
