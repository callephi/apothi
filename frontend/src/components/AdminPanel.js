import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FileUpload from './FileUpload';
import ConfirmModal from './ConfirmModal';
import logger from '../utils/logger';

function AdminPanel({ currentUserId }) {
  const [activeTab, setActiveTab] = useState('applications');
  const [applications, setApplications] = useState([]);
  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAppModal, setShowAppModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showAppSettingsModal, setShowAppSettingsModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [selectedAppData, setSelectedAppData] = useState(null);
  const [appVersions, setAppVersions] = useState({});
  const [editingVersion, setEditingVersion] = useState(null);
  const [loading, setLoading] = useState(false);

  // Form states
  const [appForm, setAppForm] = useState({ name: '', description: '', developer: '', publisher: '', iconUrl: '', homepage: '', tags: [] });
  const [versionForm, setVersionForm] = useState({ 
    versionNumber: '', 
    notes: '', 
    file: null, 
    filePath: '', 
    useFilePath: false,
    operatingSystem: '',
    versionType: 'installer',
    releaseDate: ''
  });
  const [editVersionForm, setEditVersionForm] = useState({ 
    versionNumber: '', 
    notes: '', 
    filePath: '', 
    useFilePath: false,
    operatingSystem: '',
    versionType: 'installer',
    releaseDate: ''
  });
  const [draggedVersion, setDraggedVersion] = useState(null);
  const [userForm, setUserForm] = useState({ username: '', password: '', displayName: '', isAdmin: false });
  const [editingUser, setEditingUser] = useState(null);
  const [editUserForm, setEditUserForm] = useState({ username: '', password: '', displayName: '', isAdmin: false });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [settingsTab, setSettingsTab] = useState('versions');
  const [appEditForm, setAppEditForm] = useState({ name: '', description: '', developer: '', publisher: '', iconUrl: '', homepage: '', tags: [] });
  const [newTag, setNewTag] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [versionOSTabs, setVersionOSTabs] = useState([]);
  const [selectedOSTab, setSelectedOSTab] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [versionModalError, setVersionModalError] = useState('');
  const [versionModalSuccess, setVersionModalSuccess] = useState('');
  const [modalMouseDownTarget, setModalMouseDownTarget] = useState(null);

  // Helper to prevent modal dismissal when dragging
  const handleModalBackgroundClick = (e, closeFunction) => {
    // Only close if mousedown and mouseup both happened on the overlay
    if (e.target === modalMouseDownTarget) {
      closeFunction();
    }
    setModalMouseDownTarget(null);
  };

  useEffect(() => {
    loadApplications();
    loadUsers();
  }, []);

  const loadApplications = async () => {
    try {
      const response = await axios.get('/applications');
      const apps = response.data.applications;
      setApplications(apps);
      
      // Load versions for each app
      const versionsMap = {};
      await Promise.all(apps.map(async (app) => {
        try {
          const versionResponse = await axios.get(`/applications/${app.id}`);
          versionsMap[app.id] = versionResponse.data.versions || [];
        } catch (err) {
          versionsMap[app.id] = [];
        }
      }));
      setAppVersions(versionsMap);
    } catch (err) {
      logger.error('Error loading applications:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await axios.get('/users');
      setUsers(response.data.users);
    } catch (err) {
      logger.error('Error loading users:', err);
    }
  };

  const handleCreateApp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post('/applications', appForm);
      setSuccess('Application created successfully');
      setAppForm({ name: '', description: '', developer: '', publisher: '', iconUrl: '' });
      setShowAppModal(false);
      loadApplications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create application');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteApp = (id) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Application',
      message: 'Are you sure you want to delete this application and all its versions?',
      onConfirm: async () => {
        try {
          await axios.delete(`/applications/${id}`);
          setSuccess('Application deleted successfully');
          loadApplications();
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to delete application');
        }
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleUploadVersion = async (e) => {
    e.preventDefault();
    
    // Validate that either file or filePath is provided
    if (!versionForm.useFilePath && !versionForm.file) {
      setVersionModalError('Please select a file');
      return;
    }
    
    if (versionForm.useFilePath && !versionForm.filePath) {
      setVersionModalError('Please enter a file path');
      return;
    }

    setLoading(true);
    setVersionModalError('');
    setVersionModalSuccess('');

    const formData = new FormData();
    formData.append('versionNumber', versionForm.versionNumber);
    formData.append('notes', versionForm.notes);
    formData.append('operatingSystem', versionForm.operatingSystem);
    formData.append('versionType', versionForm.versionType);
    if (versionForm.releaseDate) {
      formData.append('releaseDate', versionForm.releaseDate);
    }
    formData.append('sortOrder', 0);
    
    if (versionForm.useFilePath) {
      formData.append('filePath', versionForm.filePath);
    } else {
      formData.append('file', versionForm.file);
    }

    try {
      await axios.post(`/applications/${selectedApp}/versions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setVersionModalSuccess('Version uploaded successfully');
      setVersionForm({ 
        versionNumber: '', 
        notes: '', 
        file: null, 
        filePath: '', 
        useFilePath: false,
        operatingSystem: '',
        versionType: 'installer',
        releaseDate: ''
      });
      setShowVersionModal(false);
      setSelectedApp(null);
      loadApplications();
    } catch (err) {
      setVersionModalError(err.response?.data?.error || 'Failed to upload version');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post('/users', userForm);
      setSuccess('User created successfully');
      setUserForm({ username: '', password: '', displayName: '', isAdmin: false });
      setShowUserModal(false);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser(user);
    setEditUserForm({
      username: user.username,
      password: '',
      displayName: user.display_name || '',
      isAdmin: user.is_admin
    });
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const updateData = {
        username: editUserForm.username,
        displayName: editUserForm.displayName,
        isAdmin: editUserForm.isAdmin
      };
      
      if (editUserForm.password) {
        updateData.password = editUserForm.password;
      }
      
      await axios.put(`/users/${editingUser.id}`, updateData);
      setSuccess('User updated successfully');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update user');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateApp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.put(`/applications/${selectedAppData.id}`, appEditForm);
      setSuccess('Application updated successfully');
      setSelectedAppData({ ...selectedAppData, ...appEditForm });
      loadApplications();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update application');
    } finally {
      setLoading(false);
    }
  };

  const openAppSettings = async (app) => {
    setSelectedAppData(app);
    setSettingsTab('versions');
    
    // Clear previous OS tabs immediately to prevent flash
    setVersionOSTabs([]);
    setSelectedOSTab('');
    
    setAppEditForm({
      name: app.name,
      description: app.description || '',
      developer: app.developer || '',
      publisher: app.publisher || '',
      iconUrl: app.icon_url || '',
      homepage: app.homepage || '',
      tags: app.tags || []
    });
    
    // Load versions for this app before showing modal
    try {
      const response = await axios.get(`/applications/${app.id}`);
      const versions = response.data.versions || [];
      setAppVersions(prev => ({ ...prev, [app.id]: versions }));
      
      // Set OS tabs if app has multiple OS
      if (app.has_multiple_os) {
        const operatingSystems = [...new Set(versions.map(v => v.operating_system).filter(Boolean))].sort((a, b) => {
          const order = ['Windows', 'macOS', 'Linux'];
          return order.indexOf(a) - order.indexOf(b);
        });
        setVersionOSTabs(operatingSystems);
        setSelectedOSTab(operatingSystems[0] || '');
      }
      
      // Show modal AFTER versions are loaded
      setShowAppSettingsModal(true);
    } catch (err) {
      setError('Failed to load versions');
      // Still show modal even if loading fails
      setShowAppSettingsModal(true);
    }
  };

  const closeAppSettingsModal = () => {
    setShowAppSettingsModal(false);
    // Clear OS tabs to prevent flash on next open
    setVersionOSTabs([]);
    setSelectedOSTab('');
  };

  const handleEditVersion = (version) => {
    setEditingVersion(version);
    setVersionModalError('');
    setVersionModalSuccess('');
    setEditVersionForm({
      versionNumber: version.version_number,
      notes: version.notes || '',
      filePath: version.file_path,
      useFilePath: !version.file_path.startsWith('/app/uploads/'),
      operatingSystem: version.operating_system || '',
      versionType: version.version_type || 'installer',
      releaseDate: version.release_date || ''
    });
  };

  const handleUpdateVersion = async (e) => {
    e.preventDefault();
    setLoading(true);
    setVersionModalError('');
    setVersionModalSuccess('');

    try {
      await axios.put(`/versions/${editingVersion.id}`, {
        versionNumber: editVersionForm.versionNumber,
        notes: editVersionForm.notes,
        operatingSystem: editVersionForm.operatingSystem,
        versionType: editVersionForm.versionType,
        releaseDate: editVersionForm.releaseDate,
        filePath: editVersionForm.useFilePath ? editVersionForm.filePath : undefined
      });
      setVersionModalSuccess('Version updated successfully');
      setEditingVersion(null);
      openAppSettings(selectedAppData); // Reload versions
    } catch (err) {
      setVersionModalError(err.response?.data?.error || 'Failed to update version');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteVersion = (versionId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Version',
      message: 'Are you sure you want to delete this version?',
      onConfirm: async () => {
        try {
          await axios.delete(`/versions/${versionId}`);
          setSuccess('Version deleted successfully');
          openAppSettings(selectedAppData); // Reload versions
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to delete version');
        }
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleDeleteUser = (userId) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete User',
      message: 'Are you sure you want to delete this user?',
      onConfirm: async () => {
        try {
          await axios.delete(`/users/${userId}`);
          setSuccess('User deleted successfully');
          loadUsers();
        } catch (err) {
          setError(err.response?.data?.error || 'Failed to delete user');
        }
        setConfirmModal({ isOpen: false });
      }
    });
  };

  const handleDragStart = (e, version) => {
    setDraggedVersion(version);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, targetVersion) => {
    e.preventDefault();
    
    if (!draggedVersion || draggedVersion.id === targetVersion.id) {
      setDraggedVersion(null);
      return;
    }
    
    try {
      // Reorder versions locally
      const reorderedVersions = [...appVersions];
      const draggedIndex = reorderedVersions.findIndex(v => v.id === draggedVersion.id);
      const targetIndex = reorderedVersions.findIndex(v => v.id === targetVersion.id);
      
      // Remove dragged item and insert at target position
      const [removed] = reorderedVersions.splice(draggedIndex, 1);
      reorderedVersions.splice(targetIndex, 0, removed);
      
      // Update sort_order for all affected versions
      for (let i = 0; i < reorderedVersions.length; i++) {
        const newSortOrder = reorderedVersions.length - i;
        await axios.put(`/versions/${reorderedVersions[i].id}`, {
          sortOrder: newSortOrder
        });
      }
      
      setSuccess('Version order updated');
      openAppSettings(selectedAppData); // Reload versions
    } catch (err) {
      setError('Failed to update version order');
    }
    
    setDraggedVersion(null);
  };

  return (
    <div className="container">
      <h2 style={{ marginBottom: '20px', color: '#2c3e50' }}>Admin Panel</h2>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          className={`btn ${activeTab === 'applications' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('applications')}
        >
          Applications
        </button>
        <button
          className={`btn ${activeTab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
      </div>

      {activeTab === 'applications' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Manage Applications</h3>
            <button className="btn btn-success" onClick={() => setShowAppModal(true)}>
              + New Application
            </button>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Search applications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontSize: '14px'
              }}
            />
          </div>

          {applications.filter(app =>
            app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            app.description?.toLowerCase().includes(searchTerm.toLowerCase())
          ).length === 0 ? (
            <div className="empty-state">
              <p>{searchTerm ? 'No applications found matching your search.' : 'No applications yet. Create one to get started!'}</p>
            </div>
          ) : (
            <div>
              {applications.filter(app =>
                app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                app.description?.toLowerCase().includes(searchTerm.toLowerCase())
              ).map(app => (
                <div key={app.id} className="version-item" style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                  {app.icon_url && (
                    <img src={app.icon_url} alt={app.name} style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0 }}>{app.name}</h4>
                      {app.latest_version && (
                        <span style={{ fontSize: '14px', color: 'var(--text-meta)' }}>v{app.latest_version}</span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 8px 0', color: 'var(--text-secondary)' }}>{app.description || 'No description'}</p>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-meta)' }}>
                        {app.version_count} {app.version_count === 1 ? 'version' : 'versions'}
                      </span>
                      {(() => {
                        const versions = appVersions[app.id] || [];
                        const operatingSystems = [...new Set(versions.map(v => v.operating_system).filter(Boolean))].sort((a, b) => {
                          const order = ['Windows', 'macOS', 'Linux'];
                          return order.indexOf(a) - order.indexOf(b);
                        });
                        return operatingSystems.map(os => (
                          <span key={os} style={{
                            background: 'var(--btn-primary)',
                            color: 'white',
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: '600'
                          }}>
                            {os}
                          </span>
                        ));
                      })()}
                    </div>
                  </div>
                  <div className="version-actions" style={{ flexShrink: 0 }}>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        setSelectedApp(app.id);
                        setVersionModalError('');
                        setVersionModalSuccess('');
                        setShowVersionModal(true);
                      }}
                    >
                      Add Version
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => openAppSettings(app)}
                    >
                      Settings
                    </button>
                    <button
                      className="btn btn-danger"
                      onClick={() => handleDeleteApp(app.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3>Manage Users</h3>
            <button className="btn btn-success" onClick={() => setShowUserModal(true)}>
              + New User
            </button>
          </div>

          {users.length === 0 ? (
            <div className="empty-state">
              <p>No users found</p>
            </div>
          ) : (
            <div>
              {users.map(user => (
                <div key={user.id} className="version-item">
                  <div className="version-info">
                    <h4>{user.display_name || user.username}</h4>
                    {user.display_name && <p style={{ fontSize: '12px', color: 'var(--text-meta)' }}>@{user.username}</p>}
                    <p>
                      {user.is_admin ? '👑 Admin' : '👤 User'} • Created {new Date(user.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="version-actions">
                    <button className="btn btn-primary" onClick={() => handleEditUser(user)}>
                      Edit
                    </button>
                    {user.id !== currentUserId && (
                      <button className="btn btn-danger" onClick={() => handleDeleteUser(user.id)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create Application Modal */}
      {showAppModal && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => setModalMouseDownTarget(e.target)}
          onClick={(e) => handleModalBackgroundClick(e, () => setShowAppModal(false))}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Application</h2>
            <form onSubmit={handleCreateApp}>
              <div className="form-group">
                <label>Application Name *</label>
                <input
                  type="text"
                  value={appForm.name}
                  onChange={(e) => setAppForm({ ...appForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Developer</label>
                <input
                  type="text"
                  value={appForm.developer}
                  onChange={(e) => setAppForm({ ...appForm, developer: e.target.value })}
                  placeholder="e.g., Acme Inc."
                />
              </div>
              <div className="form-group">
                <label>Publisher</label>
                <input
                  type="text"
                  value={appForm.publisher}
                  onChange={(e) => setAppForm({ ...appForm, publisher: e.target.value })}
                  placeholder="e.g., Acme Inc."
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={appForm.description}
                  onChange={(e) => setAppForm({ ...appForm, description: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Icon</label>
                <FileUpload
                  accept="image/*"
                  label="Drag & Drop Icon or Click to Upload"
                  onFileSelect={async (file) => {
                    const formData = new FormData();
                    formData.append('image', file);
                    try {
                      const response = await axios.post('/upload-image', formData, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                      });
                      setAppForm({ ...appForm, iconUrl: response.data.imageUrl });
                      setSuccess('Image uploaded successfully');
                    } catch (err) {
                      setError('Failed to upload image');
                    }
                  }}
                />
                {appForm.iconUrl && (
                  <img src={appForm.iconUrl} alt="Preview" style={{ width: '64px', marginTop: '8px', borderRadius: '8px' }} />
                )}
              </div>
              <div className="form-group">
                <label>Icon URL (alternative)</label>
                <input
                  type="text"
                  value={appForm.iconUrl}
                  onChange={(e) => setAppForm({ ...appForm, iconUrl: e.target.value })}
                  placeholder="https://example.com/icon.png"
                />
              </div>
              <div className="form-group">
                <label>Homepage</label>
                <input
                  type="text"
                  value={appForm.homepage}
                  onChange={(e) => setAppForm({ ...appForm, homepage: e.target.value })}
                  placeholder="https://example.com or https://github.com/user/repo"
                />
              </div>
              <div className="form-group">
                <label>Tags</label>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  {appForm.tags.map((tag, index) => (
                    <span key={index} style={{
                      background: 'var(--btn-primary)',
                      color: 'white',
                      padding: '4px 12px',
                      borderRadius: '16px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      {tag}
                      <button
                        type="button"
                        onClick={() => setAppForm({ 
                          ...appForm, 
                          tags: appForm.tags.filter((_, i) => i !== index) 
                        })}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'white',
                          cursor: 'pointer',
                          padding: '0',
                          fontSize: '14px',
                          lineHeight: '1'
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                  <div style={{ flex: 1, position: 'relative' }}>
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewTag(value);
                        
                        if (value.trim()) {
                          const allTags = [...new Set(applications.flatMap(app => app.tags || []))];
                          const suggestions = allTags.filter(tag => 
                            tag.toLowerCase().includes(value.toLowerCase()) && 
                            !appForm.tags.includes(tag)
                          );
                          setTagSuggestions(suggestions);
                          setShowTagSuggestions(suggestions.length > 0);
                        } else {
                          setTagSuggestions([]);
                          setShowTagSuggestions(false);
                        }
                      }}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newTag.trim() && !appForm.tags.includes(newTag.trim())) {
                            setAppForm({ ...appForm, tags: [...appForm.tags, newTag.trim()] });
                            setNewTag('');
                            setTagSuggestions([]);
                            setShowTagSuggestions(false);
                          }
                        }
                      }}
                      onBlur={() => {
                        setTimeout(() => setShowTagSuggestions(false), 200);
                      }}
                      placeholder="Add a tag..."
                    />
                    {showTagSuggestions && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        marginTop: '4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                      }}>
                        {tagSuggestions.map(tag => (
                          <div
                            key={tag}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setAppForm({ ...appForm, tags: [...appForm.tags, tag] });
                              setNewTag('');
                              setTagSuggestions([]);
                              setShowTagSuggestions(false);
                            }}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-color)',
                              transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                          >
                            {tag}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      if (newTag.trim() && !appForm.tags.includes(newTag.trim())) {
                        setAppForm({ ...appForm, tags: [...appForm.tags, newTag.trim()] });
                        setNewTag('');
                        setTagSuggestions([]);
                        setShowTagSuggestions(false);
                      }
                    }}
                  >
                    Add
                  </button>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAppModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Upload Version Modal */}
      {showVersionModal && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => setModalMouseDownTarget(e.target)}
          onClick={(e) => handleModalBackgroundClick(e, () => setShowVersionModal(false))}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Upload New Version</h2>
            {versionModalError && <div className="error-message">{versionModalError}</div>}
            {versionModalSuccess && <div className="success-message">{versionModalSuccess}</div>}
            <form onSubmit={handleUploadVersion}>
              <div className="form-group">
                <label>Version Number *</label>
                <input
                  type="text"
                  value={versionForm.versionNumber}
                  onChange={(e) => setVersionForm({ ...versionForm, versionNumber: e.target.value })}
                  placeholder="e.g., 1.0.0"
                  required
                />
              </div>
              <div className="form-group">
                <label>Release Notes</label>
                <textarea
                  value={versionForm.notes}
                  onChange={(e) => setVersionForm({ ...versionForm, notes: e.target.value })}
                  placeholder="What's new in this version?"
                />
              </div>
              
              <div className="form-group">
                <label>Version Type *</label>
                <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'nowrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                      type="radio"
                      name="versionType"
                      value="installer"
                      checked={versionForm.versionType === 'installer'}
                      onChange={(e) => {
                        setVersionForm({ ...versionForm, versionType: e.target.value });
                        if (!versionForm.operatingSystem) {
                          setVersionForm(prev => ({ ...prev, operatingSystem: '' }));
                        }
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    Installer
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                      type="radio"
                      name="versionType"
                      value="portable"
                      checked={versionForm.versionType === 'portable'}
                      onChange={(e) => {
                        setVersionForm({ ...versionForm, versionType: e.target.value });
                        if (!versionForm.operatingSystem) {
                          setVersionForm(prev => ({ ...prev, operatingSystem: '' }));
                        }
                      }}
                      style={{ marginRight: '8px' }}
                    />
                    Portable
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    <input
                      type="radio"
                      name="versionType"
                      value="source"
                      checked={versionForm.versionType === 'source'}
                      onChange={(e) => setVersionForm({ ...versionForm, versionType: e.target.value, operatingSystem: '' })}
                      style={{ marginRight: '8px' }}
                    />
                    Source Code
                  </label>
                </div>
              </div>

              {versionForm.versionType !== 'source' && (
                <div className="form-group">
                  <label>Operating System *</label>
                  <select
                    value={versionForm.operatingSystem}
                    onChange={(e) => setVersionForm({ ...versionForm, operatingSystem: e.target.value })}
                    required
                  >
                    <option value="">Select platform...</option>
                    <option value="Windows">Windows</option>
                    <option value="macOS">macOS</option>
                    <option value="Linux">Linux</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label>Release Date (optional)</label>
                <input
                  type="date"
                  value={versionForm.releaseDate}
                  onChange={(e) => setVersionForm({ ...versionForm, releaseDate: e.target.value })}
                />
              </div>
              
              <div className="form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="useFilePath"
                    checked={versionForm.useFilePath}
                    onChange={(e) => setVersionForm({ ...versionForm, useFilePath: e.target.checked, file: null, filePath: '' })}
                  />
                  <label htmlFor="useFilePath">Use file path?</label>
                </div>
              </div>
              
              {versionForm.useFilePath ? (
                <div className="form-group">
                  <label>File Path:</label>
                  <input
                    type="text"
                    value={versionForm.filePath}
                    onChange={(e) => setVersionForm({ ...versionForm, filePath: e.target.value })}
                    placeholder="/mnt/files/Application v1.0.0.zip"
                    required
                  />
                  <p className="hint-text">
                    Enter the absolute path to the file on the server.
                  </p>
                </div>
              ) : (
                <div className="form-group">
                  <label>Upload Archive</label>
                  <FileUpload
                    accept="*/*"
                    label="Drag & Drop Archive or Click to Upload"
                    onFileSelect={(file) => setVersionForm({ ...versionForm, file })}
                  />
                  {versionForm.file && (
                    <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-meta)' }}>
                      Selected: {versionForm.file.name}
                    </p>
                  )}
                  <p className="hint-text">Supports any file type!</p>
                </div>
              )}
              
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowVersionModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showUserModal && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => setModalMouseDownTarget(e.target)}
          onClick={(e) => handleModalBackgroundClick(e, () => setShowUserModal(false))}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create New User</h2>
            <form onSubmit={handleCreateUser}>
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={userForm.username}
                  onChange={(e) => setUserForm({ ...userForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Display Name (optional)</label>
                <input
                  type="text"
                  value={userForm.displayName}
                  onChange={(e) => setUserForm({ ...userForm, displayName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={userForm.isAdmin}
                    onChange={(e) => setUserForm({ ...userForm, isAdmin: e.target.checked })}
                  />
                  <label htmlFor="isAdmin">Administrator?</label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowUserModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Application Settings Modal */}
      {showAppSettingsModal && selectedAppData && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => setModalMouseDownTarget(e.target)}
          onClick={(e) => handleModalBackgroundClick(e, closeAppSettingsModal)}
        >
          <div className="modal" style={{ maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
            <h2>{selectedAppData.name} - Settings</h2>
            
            <div style={{ marginTop: '20px', marginBottom: '20px', display: 'flex', gap: '10px' }}>
              <button
                className={`btn ${settingsTab === 'app' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSettingsTab('app')}
              >
                Application
              </button>
              <button
                className={`btn ${settingsTab === 'versions' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSettingsTab('versions')}
              >
                Versions
              </button>
            </div>

            {settingsTab === 'app' && (
              <form onSubmit={handleUpdateApp}>
                <div className="form-group">
                  <label>Application Name *</label>
                  <input
                    type="text"
                    value={appEditForm.name}
                    onChange={(e) => setAppEditForm({ ...appEditForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Developer</label>
                  <input
                    type="text"
                    value={appEditForm.developer}
                    onChange={(e) => setAppEditForm({ ...appEditForm, developer: e.target.value })}
                    placeholder="e.g., Acme Inc."
                  />
                </div>
                <div className="form-group">
                  <label>Publisher</label>
                  <input
                    type="text"
                    value={appEditForm.publisher}
                    onChange={(e) => setAppEditForm({ ...appEditForm, publisher: e.target.value })}
                    placeholder="e.g., Acme Inc."
                  />
                </div>
                <div className="form-group">
                  <label>Description</label>
                  <textarea
                    value={appEditForm.description}
                    onChange={(e) => setAppEditForm({ ...appEditForm, description: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Icon</label>
                  <FileUpload
                    accept="image/*"
                    label="Drag & Drop Icon or Click to Upload"
                    onFileSelect={async (file) => {
                      const formData = new FormData();
                      formData.append('image', file);
                      try {
                        const response = await axios.post('/upload-image', formData, {
                          headers: { 'Content-Type': 'multipart/form-data' }
                        });
                        setAppEditForm({ ...appEditForm, iconUrl: response.data.imageUrl });
                        setSuccess('Image uploaded successfully');
                      } catch (err) {
                        setError('Failed to upload image');
                      }
                    }}
                  />
                  {appEditForm.iconUrl && (
                    <img src={appEditForm.iconUrl} alt="Preview" style={{ width: '64px', marginTop: '8px', borderRadius: '8px' }} />
                  )}
                </div>
                <div className="form-group">
                  <label>Icon URL (alternative)</label>
                  <input
                    type="text"
                    value={appEditForm.iconUrl}
                    onChange={(e) => setAppEditForm({ ...appEditForm, iconUrl: e.target.value })}
                    placeholder="https://example.com/icon.png"
                  />
                  <p className="hint-text">You can either upload an image above or provide a URL here</p>
                </div>
                <div className="form-group">
                  <label>Homepage</label>
                  <input
                    type="text"
                    value={appEditForm.homepage}
                    onChange={(e) => setAppEditForm({ ...appEditForm, homepage: e.target.value })}
                    placeholder="https://example.com or https://github.com/user/repo"
                  />
                </div>
                <div className="form-group">
                  <label>Tags</label>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {appEditForm.tags.map((tag, index) => (
                      <span key={index} style={{
                        background: 'var(--btn-primary)',
                        color: 'white',
                        padding: '4px 12px',
                        borderRadius: '16px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        {tag}
                        <button
                          type="button"
                          onClick={() => setAppEditForm({ 
                            ...appEditForm, 
                            tags: appEditForm.tags.filter((_, i) => i !== index) 
                          })}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer',
                            padding: '0',
                            fontSize: '14px',
                            lineHeight: '1'
                          }}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
                    <div style={{ flex: 1, position: 'relative' }}>
                      <input
                        type="text"
                        value={newTag}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewTag(value);
                          
                          // Generate suggestions
                          if (value.trim()) {
                            const allTags = [...new Set(applications.flatMap(app => app.tags || []))];
                            const suggestions = allTags.filter(tag => 
                              tag.toLowerCase().includes(value.toLowerCase()) && 
                              !appEditForm.tags.includes(tag)
                            );
                            setTagSuggestions(suggestions);
                            setShowTagSuggestions(suggestions.length > 0);
                          } else {
                            setTagSuggestions([]);
                            setShowTagSuggestions(false);
                          }
                        }}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newTag.trim() && !appEditForm.tags.includes(newTag.trim())) {
                              setAppEditForm({ ...appEditForm, tags: [...appEditForm.tags, newTag.trim()] });
                              setNewTag('');
                              setTagSuggestions([]);
                              setShowTagSuggestions(false);
                            }
                          }
                        }}
                        onBlur={() => {
                          // Delay to allow clicking suggestions
                          setTimeout(() => setShowTagSuggestions(false), 200);
                        }}
                        placeholder="Add a tag..."
                      />
                      {showTagSuggestions && (
                        <div style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          background: 'var(--bg-card)',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          marginTop: '4px',
                          maxHeight: '200px',
                          overflowY: 'auto',
                          zIndex: 1000,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                        }}>
                          {tagSuggestions.map(tag => (
                            <div
                              key={tag}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setAppEditForm({ ...appEditForm, tags: [...appEditForm.tags, tag] });
                                setNewTag('');
                                setTagSuggestions([]);
                                setShowTagSuggestions(false);
                              }}
                              style={{
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderBottom: '1px solid var(--border-color)',
                                transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.target.style.background = 'var(--bg-secondary)'}
                              onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                              {tag}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        if (newTag.trim() && !appEditForm.tags.includes(newTag.trim())) {
                          setAppEditForm({ ...appEditForm, tags: [...appEditForm.tags, newTag.trim()] });
                          setNewTag('');
                          setTagSuggestions([]);
                          setShowTagSuggestions(false);
                        }
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
              </form>
            )}
            
            {settingsTab === 'versions' && (
              <>
                <h3 style={{ marginBottom: '16px', fontSize: '18px' }}>Versions</h3>
                
                {versionOSTabs.length > 0 && (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                    {versionOSTabs.map(os => (
                      <button
                        key={os}
                        className={`btn ${selectedOSTab === os ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setSelectedOSTab(os)}
                      >
                        {os}
                      </button>
                    ))}
                  </div>
                )}
            
            {(appVersions[selectedAppData?.id] || []).filter(v => !versionOSTabs.length || v.operating_system === selectedOSTab).length === 0 ? (
              <p style={{ color: 'var(--text-meta)', textAlign: 'center', padding: '20px' }}>
                No versions added yet
              </p>
            ) : (
              <div>
                {(appVersions[selectedAppData?.id] || []).filter(v => !versionOSTabs.length || v.operating_system === selectedOSTab).map(version => (
                  <div 
                    key={version.id} 
                    style={{ marginBottom: '16px' }}
                    draggable={!editingVersion}
                    onDragStart={(e) => handleDragStart(e, version)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, version)}
                    className={draggedVersion?.id === version.id ? 'dragging' : ''}
                  >
                    {editingVersion?.id === version.id ? (
                      <form onSubmit={handleUpdateVersion} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                        {versionModalError && <div className="error-message">{versionModalError}</div>}
                        {versionModalSuccess && <div className="success-message">{versionModalSuccess}</div>}
                        <div className="form-group">
                          <label>Version Number *</label>
                          <input
                            type="text"
                            value={editVersionForm.versionNumber}
                            onChange={(e) => setEditVersionForm({ ...editVersionForm, versionNumber: e.target.value })}
                            required
                          />
                        </div>
                        <div className="form-group">
                          <label>Release Notes</label>
                          <textarea
                            value={editVersionForm.notes}
                            onChange={(e) => setEditVersionForm({ ...editVersionForm, notes: e.target.value })}
                          />
                        </div>
                        <div className="form-group">
                          <div className="checkbox-group">
                            <input
                              type="checkbox"
                              id="updateFilePath"
                              checked={editVersionForm.useFilePath}
                              onChange={(e) => setEditVersionForm({ ...editVersionForm, useFilePath: e.target.checked })}
                            />
                            <label htmlFor="updateFilePath">Update file path?</label>
                          </div>
                        </div>
                        {editVersionForm.useFilePath && (
                          <div className="form-group">
                            <label>File Path:</label>
                            <input
                              type="text"
                              value={editVersionForm.filePath}
                              onChange={(e) => setEditVersionForm({ ...editVersionForm, filePath: e.target.value })}
                              placeholder="/mnt/files/Application v1.0.0.zip"
                            />
                            <p className="hint-text">Enter the absolute path to the file on the server.</p>
                          </div>
                        )}
                        
                        <div className="form-group">
                          <label>Version Type *</label>
                          <div style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'nowrap' }}>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="radio"
                                name="editVersionType"
                                value="installer"
                                checked={editVersionForm.versionType === 'installer'}
                                onChange={(e) => setEditVersionForm({ ...editVersionForm, versionType: e.target.value })}
                                style={{ marginRight: '8px' }}
                              />
                              Installer
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="radio"
                                name="editVersionType"
                                value="portable"
                                checked={editVersionForm.versionType === 'portable'}
                                onChange={(e) => setEditVersionForm({ ...editVersionForm, versionType: e.target.value })}
                                style={{ marginRight: '8px' }}
                              />
                              Portable
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              <input
                                type="radio"
                                name="editVersionType"
                                value="source"
                                checked={editVersionForm.versionType === 'source'}
                                onChange={(e) => setEditVersionForm({ ...editVersionForm, versionType: e.target.value, operatingSystem: '' })}
                                style={{ marginRight: '8px' }}
                              />
                              Source Code
                            </label>
                          </div>
                        </div>

                        {editVersionForm.versionType !== 'source' && (
                          <div className="form-group">
                            <label>Operating System *</label>
                            <select
                              value={editVersionForm.operatingSystem}
                              onChange={(e) => setEditVersionForm({ ...editVersionForm, operatingSystem: e.target.value })}
                              required
                            >
                              <option value="">Select platform...</option>
                              <option value="Windows">Windows</option>
                              <option value="macOS">macOS</option>
                              <option value="Linux">Linux</option>
                            </select>
                          </div>
                        )}

                        <div className="form-group">
                          <label>Release Date (optional)</label>
                          <input
                            type="date"
                            value={editVersionForm.releaseDate}
                            onChange={(e) => setEditVersionForm({ ...editVersionForm, releaseDate: e.target.value })}
                          />
                        </div>
                        
                        <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                          <button type="submit" className="btn btn-success" disabled={loading}>
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                          <button type="button" className="btn btn-secondary" onClick={() => setEditingVersion(null)}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="version-item">
                        <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <span className="drag-handle">☰</span>
                          <div className="version-info">
                            <h4>Version {version.version_number}</h4>
                            <p style={{ fontSize: '12px', color: 'var(--text-meta)', marginTop: '4px' }}>
                              {version.release_date 
                                ? `Released: ${new Date(version.release_date).toLocaleDateString()}`
                                : `Uploaded: ${new Date(version.uploaded_at).toLocaleDateString()}`
                              }
                              {version.operating_system && ` • ${version.operating_system}`}
                              {version.version_type && ` • ${version.version_type.charAt(0).toUpperCase() + version.version_type.slice(1)}`}
                            </p>
                            {version.notes && <p style={{ marginTop: '6px' }}>{version.notes}</p>}
                            <p style={{ fontSize: '12px', color: 'var(--text-meta)', marginTop: '4px' }}>
                              Path: {version.file_path}
                            </p>
                          </div>
                        </div>
                        <div className="version-actions">
                          <button
                            className="btn btn-primary"
                            onClick={() => handleEditVersion(version)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleDeleteVersion(version.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            </>
            )}
            
            <div className="modal-actions" style={{ marginTop: '24px' }}>
              <button className="btn btn-secondary" onClick={closeAppSettingsModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div 
          className="modal-overlay" 
          onMouseDown={(e) => setModalMouseDownTarget(e.target)}
          onClick={(e) => handleModalBackgroundClick(e, () => setEditingUser(null))}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Edit User</h2>
            <form onSubmit={handleUpdateUser}>
              <div className="form-group">
                <label>Username *</label>
                <input
                  type="text"
                  value={editUserForm.username}
                  onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Display Name (optional)</label>
                <input
                  type="text"
                  value={editUserForm.displayName}
                  onChange={(e) => setEditUserForm({ ...editUserForm, displayName: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={editUserForm.password}
                  onChange={(e) => setEditUserForm({ ...editUserForm, password: e.target.value })}
                />
              </div>
              <div className="form-group">
                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="editIsAdmin"
                    checked={editUserForm.isAdmin}
                    onChange={(e) => setEditUserForm({ ...editUserForm, isAdmin: e.target.checked })}
                  />
                  <label htmlFor="editIsAdmin">Administrator?</label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-success" disabled={loading}>
                  {loading ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal({ isOpen: false })}
      />
    </div>
  );
}

export default AdminPanel;
