import React, { useState, useEffect } from 'react';
import axios from 'axios';
import logger from '../utils/logger';

function Dashboard() {
  // State declarations
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
    return saved ? parseInt(saved) : 24;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const [showTagsMenu, setShowTagsMenu] = useState(false);
  const [showExtrasModal, setShowExtrasModal] = useState(false);
  const [selectedAppExtras, setSelectedAppExtras] = useState(null);
  const [appExtras, setAppExtras] = useState([]);
  const [appsWithExtras, setAppsWithExtras] = useState({});

  // Save preferences to localStorage
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

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showTagsMenu]);

  useEffect(() => {
    loadApplications();
  }, []);

  // Auto-select simple single-version apps
  useEffect(() => {
    applications.forEach(app => {
      // Skip if already selected or multiple OS
      if (selectedVersions[app.id] || app.has_multiple_os) return;
      
      const versions = appVersions[app.id];
      if (!versions || versions.length === 0) return;
      
      // Group versions to check structure
      const grouped = {};
      versions.forEach(v => {
        const archs = v.architecture && Array.isArray(v.architecture) && v.architecture.length > 0
          ? v.architecture
          : [v.architecture || null];
        
        archs.forEach(arch => {
          const key = `${v.version_number}-${v.operating_system || 'all'}`;
          if (!grouped[key]) {
            grouped[key] = { versionNumber: v.version_number, operatingSystem: v.operating_system, architectures: {} };
          }
          
          const archKey = arch || 'default';
          if (!grouped[key].architectures[archKey]) {
            grouped[key].architectures[archKey] = { architecture: arch, types: [] };
          }
          
          grouped[key].architectures[archKey].types.push({ id: v.id, type: v.version_type, ...v, architecture: arch });
        });
      });
      
      const groupedVersions = Object.values(grouped);
      
      // Only auto-select if there's exactly one version with one arch and one type
      if (groupedVersions.length === 1) {
        const group = groupedVersions[0];
        const archs = Object.keys(group.architectures);
        
        if (archs.length === 1) {
          const archData = group.architectures[archs[0]];
          if (archData.types.length === 1) {
            const version = archData.types[0];
            setSelectedVersionNumber(prev => ({ ...prev, [app.id]: version.version_number }));
            setSelectedVersions(prev => ({ ...prev, [app.id]: version.id }));
          }
        }
      }
    });
  }, [applications, appVersions]);

  // Filter and sort applications
  useEffect(() => {
    let filtered = [...applications];
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(app =>
        (app.name && app.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (app.description && app.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (app.developer && app.developer.toLowerCase().includes(searchTerm.toLowerCase()))
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
        loadExtrasForApp(app);
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
      const versions = response.data.versions.slice(0, 15);
      setAppVersions(prev => ({ ...prev, [app.id]: versions }));
      
      // Auto-selection will be handled after render with proper grouping
    } catch (err) {
      logger.error('Error loading versions:', err);
    }
  };

  const loadExtrasForApp = async (app) => {
    try {
      const response = await axios.get(`/applications/${app.id}/extras`);
      const hasExtras = response.data.extras && response.data.extras.length > 0;
      setAppsWithExtras(prev => ({ ...prev, [app.id]: hasExtras }));
    } catch (err) {
      // Silently fail - extras are optional
      setAppsWithExtras(prev => ({ ...prev, [app.id]: false }));
    }
  };

  // Format bytes to human readable
  const formatBytes = (bytes, decimals = 1) => {
    if (bytes === 0) return '0B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i];
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
          const timeDiff = (now - lastTime) / 1000;
          const loadedDiff = progressEvent.loaded - lastLoaded;
          
          const speed = timeDiff > 0 ? loadedDiff / timeDiff : 0;
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

  const openExtrasModal = async (app) => {
    setSelectedAppExtras(app);
    try {
      const response = await axios.get(`/applications/${app.id}/extras`);
      setAppExtras(response.data.extras || []);
      setShowExtrasModal(true);
    } catch (err) {
      logger.error('Error loading extras:', err);
      setAppExtras([]);
      setShowExtrasModal(true);
    }
  };

  // Helper function to group versions
  const groupVersions = (versions) => {
    const grouped = {};
    
    versions.forEach(v => {
      // Handle architecture - if it's an array with multiple values, expand
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
          architecture: arch
        });
      });
    });
    
    return Object.values(grouped);
  };

  // Get all unique tags
  const allTags = [...new Set(applications.flatMap(app => app.tags || []))].sort();

  // Calculate pagination
  const totalPages = Math.ceil(filteredApps.length / appsPerPage);
  const startIndex = (currentPage - 1) * appsPerPage;
  const endIndex = startIndex + appsPerPage;
  const paginatedApps = filteredApps.slice(startIndex, endIndex);

  // Render helper for OS tags and homepage
  const renderOSTagsAndHomepage = (app) => {
    const versions = appVersions[app.id] || [];
    const operatingSystems = [...new Set(versions.map(v => v.operating_system).filter(Boolean))];
    const osOrder = ['Windows', 'macOS', 'Linux', 'Source Code'];
    const sortedOS = operatingSystems.sort((a, b) => osOrder.indexOf(a) - osOrder.indexOf(b));

    if (viewMode === 'grid') {
      return (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          alignItems: 'flex-end',
          zIndex: 1
        }}>
          {appsWithExtras[app.id] && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openExtrasModal(app);
              }}
              style={{
                background: '#10b981',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                textAlign: 'center',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#059669'}
              onMouseOut={(e) => e.target.style.background = '#10b981'}
            >
              Extras ›
            </button>
          )}
          {sortedOS.map(os => (
            <span key={os} style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                marginTop: sortedOS.length > 0 ? '4px' : '0'
              }}
              title={app.homepage}
            >
              {app.homepage.includes('github.com') ? (
                <img src="/icons/github.svg" width="16" height="16" alt="Source Code" />
              ) : (
                <img src="/icons/globe.svg" width="16" height="16" alt="Homepage" />
              )}
            </a>
          )}
        </div>
      );
    } else if (viewMode === 'list') {
      // List view - horizontal layout
      return (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
          {appsWithExtras[app.id] && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openExtrasModal(app);
              }}
              style={{
                background: '#10b981',
                color: 'white',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '600',
                border: 'none',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseOver={(e) => e.target.style.background = '#059669'}
              onMouseOut={(e) => e.target.style.background = '#10b981'}
            >
              Extras ›
            </button>
          )}
          {sortedOS.map(os => (
            <span key={os} style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
              {app.homepage.includes('github.com') ? (
                <img src="/icons/github.svg" width="16" height="16" alt="Source Code" />
              ) : (
                <img src="/icons/globe.svg" width="16" height="16" alt="Homepage" />
              )}
            </a>
          )}
        </div>
      );
    }
    return null;
  };

  // Render helper for app metadata
  const renderAppMetadata = (app) => {
    const versions = appVersions[app.id] || [];
    const latestVersions = versions.filter(v => v.version_number === app.latest_version);
    const maxSize = latestVersions.length > 0 
      ? Math.max(...latestVersions.map(v => v.file_size || 0))
      : 0;

    return (
      <div>
        {app.developer && <p className="app-meta">Developer: {app.developer}</p>}
        {app.latest_version && (
          <p className="app-meta">
            Latest: v{app.latest_version}{maxSize > 0 && ` (~${formatBytes(maxSize)})`}
          </p>
        )}
        <p className="app-description">{app.description || 'No description available'}</p>
      </div>
    );
  };

  // Render helper for version dropdowns
  const renderVersionDropdowns = (app) => {
    const versions = appVersions[app.id] || [];
    if (versions.length === 0) {
      return <p className="no-versions">No versions available</p>;
    }

    const groupedVersions = groupVersions(versions);
    const selectedOSForApp = selectedOS[app.id];
    const selectedVerNum = selectedVersionNumber[app.id];
    const selectedArch = selectedArchitecture[app.id];
    const selectedType = selectedVersionType[app.id];

    return (
      <div className="app-download-section">
        {/* OS Dropdown (if multiple OS) */}
        {app.has_multiple_os && (
          <select
            className={`version-select ${!selectedOSForApp ? 'full-width' : ''}`}
            value={selectedOSForApp || ''}
            onChange={(e) => {
              const os = e.target.value;
              setSelectedOS(prev => ({ ...prev, [app.id]: os }));
              setSelectedVersionNumber(prev => ({ ...prev, [app.id]: '' }));
              setSelectedArchitecture(prev => ({ ...prev, [app.id]: '' }));
              setSelectedVersionType(prev => ({ ...prev, [app.id]: '' }));
              setSelectedVersions(prev => ({ ...prev, [app.id]: null }));
            }}
          >
            <option value="">Select operating system...</option>
            {[...new Set(versions.map(v => v.operating_system).filter(Boolean))]
              .sort((a, b) => {
                const order = ['Windows', 'macOS', 'Linux', 'Source Code'];
                return order.indexOf(a) - order.indexOf(b);
              })
              .map(os => (
                <option key={os} value={os}>{os}</option>
              ))
            }
          </select>
        )}

        {/* Version Dropdown */}
        {(!app.has_multiple_os || selectedOSForApp) && (() => {
          // Check if additional dropdowns will appear after selection
          const willShowMoreDropdowns = selectedVerNum && (() => {
            const matchingGroup = groupedVersions.find(g => 
              g.versionNumber === selectedVerNum && 
              (app.has_multiple_os ? g.operatingSystem === selectedOSForApp : true)
            );
            if (!matchingGroup) return false;
            const archs = Object.keys(matchingGroup.architectures);
            // More dropdowns if: multiple archs OR single arch with multiple types
            return archs.length > 1 || (archs.length === 1 && matchingGroup.architectures[archs[0]].types.length > 1);
          })();
          
          return (
            <select
              className={`version-select ${!app.has_multiple_os && !willShowMoreDropdowns ? 'full-width' : ''}`}
              value={selectedVerNum || ''}
              onChange={(e) => {
                const verNum = e.target.value;
                setSelectedVersionNumber(prev => ({ ...prev, [app.id]: verNum }));
                setSelectedArchitecture(prev => ({ ...prev, [app.id]: '' }));
                setSelectedVersionType(prev => ({ ...prev, [app.id]: '' }));
                setSelectedVersions(prev => ({ ...prev, [app.id]: null }));
                
                const matchingGroup = groupedVersions.find(g => 
                  g.versionNumber === verNum && 
                  (app.has_multiple_os ? g.operatingSystem === selectedOSForApp : true)
                );
                
                if (matchingGroup) {
                  const archs = Object.keys(matchingGroup.architectures);
                  if (archs.length === 1) {
                    const singleArch = matchingGroup.architectures[archs[0]];
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
          );
        })()}
        
        {/* Architecture Dropdown */}
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
                  
                  const archData = matchingGroup.architectures[arch];
                  if (archData && archData.types.length === 1) {
                    setSelectedVersions(prev => ({ ...prev, [app.id]: archData.types[0].id }));
                  }
                }}
              >
                <option value="">Select arch...</option>
                {archs.map(archKey => {
                  const archData = matchingGroup.architectures[archKey];
                  const label = archData.types.length === 1
                    ? `${archData.architecture || 'Default'} (${archData.types[0].type.charAt(0).toUpperCase() + archData.types[0].type.slice(1)})`
                    : (archData.architecture || 'Default');
                  return (
                    <option key={archKey} value={archKey}>{label}</option>
                  );
                })}
              </select>
            );
          }
          return null;
        })()}

        {/* Type Dropdown */}
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
                      style={{ filter: 'brightness(0) invert(1)' }}
                      className="spinner"
                    />
                  </div>
                )}
              </>
            ) : '⬇ Download'}
          </button>
        )}
      </div>
    );
  };

  // Render helper for single app card
  const renderAppCard = (app) => {
    return (
      <div key={app.id} className={viewMode === 'grid' ? 'app-card-enhanced' : 'app-list-item'} style={{ position: 'relative' }}>
        {viewMode === 'grid' && renderOSTagsAndHomepage(app)}
        
        <div className={viewMode === 'grid' ? '' : 'app-list-info'}>
          {app.icon_url && (
            <img src={app.icon_url} alt={app.name} className="app-icon" style={{ marginBottom: '12px' }} />
          )}
          <h3 className="app-name">{app.name}</h3>
          
          {app.tags && app.tags.length > 0 && (
            <div className={viewMode === 'grid' ? 'app-tags' : 'app-tags-horizontal'}>
              {app.tags.map(tag => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}
          
          {renderAppMetadata(app)}
          {viewMode === 'list' && renderOSTagsAndHomepage(app)}
        </div>
        
        {renderVersionDropdowns(app)}
      </div>
    );
  };

  // Render helper for pagination
  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
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
  };

  return (
    <div className="container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="filter-select"
          >
            <option value="name">Sort by Name</option>
            <option value="date">Sort by Date</option>
          </select>
          
          <select
            value={filterOS}
            onChange={(e) => setFilterOS(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Platforms</option>
            <option value="Windows">Windows</option>
            <option value="macOS">macOS</option>
            <option value="Linux">Linux</option>
            <option value="Source Code">Source Code</option>
          </select>

          <div className="tags-menu-container" style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary"
              onClick={(e) => {
                e.stopPropagation();
                setShowTagsMenu(!showTagsMenu);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              Tags {selectedTags.length > 0 && `(${selectedTags.length})`}
              <span style={{ fontSize: '10px' }}>▼</span>
            </button>
            {showTagsMenu && (
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
            )}
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
                setCurrentPage(1);
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
              <option value="12">12</option>
              <option value="24">24</option>
              <option value="48">48</option>
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

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-meta)' }}>
          Loading applications...
        </div>
      ) : (
        <>
          <div className={viewMode === 'grid' ? 'grid' : 'app-list'}>
            {paginatedApps.map(app => renderAppCard(app))}
          </div>
          {renderPagination()}
        </>
      )}

      {/* Extras Modal */}
      {showExtrasModal && selectedAppExtras && (
        <div className="modal-overlay" onClick={() => setShowExtrasModal(false)}>
          <div className="modal" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <h2>{selectedAppExtras.name} - Extras</h2>
            
            {appExtras.length === 0 ? (
              <p style={{ textAlign: 'center', padding: '40px', color: 'var(--text-meta)' }}>
                No extra files available for this application
              </p>
            ) : (
              <div style={{ marginTop: '20px' }}>
                {appExtras.map(extra => (
                  <div key={extra.id} style={{ 
                    padding: '16px', 
                    marginBottom: '12px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                  }}>
                    <h4 style={{ margin: '0 0 8px 0' }}>{extra.file_name}</h4>
                    {extra.description && (
                      <p style={{ margin: '4px 0 8px 0', color: 'var(--text-secondary)' }}>
                        {extra.description}
                      </p>
                    )}
                    <p style={{ fontSize: '13px', color: 'var(--text-meta)', margin: '4px 0' }}>
                      Uploaded: {new Date(extra.uploaded_at).toLocaleDateString()} | ~{formatBytes(extra.file_size)}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-meta)', fontFamily: 'monospace', margin: '4px 0 12px 0' }}>
                      Path: {extra.file_path}
                    </p>
                    <a 
                      href={`/api/download-extra/${extra.id}`}
                      className="btn btn-primary"
                      style={{ display: 'inline-block', textDecoration: 'none' }}
                    >
                      ⬇ Download
                    </a>
                  </div>
                ))}
              </div>
            )}
            
            <div className="modal-actions" style={{ marginTop: '20px' }}>
              <button className="btn btn-secondary" onClick={() => setShowExtrasModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
