import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar.js';

const Settings = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({ username: '', email: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/user/', {
          headers: {
            'Authorization': `Token ${localStorage.getItem('token')}`,
          },
        });

        const data = await response.json();
        if (response.ok) {
          setUserData(data);
        } else {
          setError(data.error || 'Failed to fetch user data');
        }
      } catch (err) {
        setError('Could not connect to server');
      } finally {
        setLoading(false);
      }
    };

    if (localStorage.getItem('token')) {
      fetchUserData();
    } else {
      navigate('/login');
    }
  }, [navigate]);

  const handleDeleteAccount = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/user/delete/', {
        method: 'DELETE',
        headers: {
          'Authorization': `Token ${localStorage.getItem('token')}`,
        },
      });

      if (response.ok) {
        localStorage.removeItem('token');
        navigate('/login');
      } else {
        setError('Failed to delete account');
      }
    } catch (err) {
      setError('Could not connect to server');
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <Navbar />
      <div className="settings-container">
        <h2>Settings</h2>

        {error && <p className="error">{error}</p>}

        <div className="settings-card">
          <h3>Account Details</h3>

          <div className="settings-field">
            <label>Username</label>
            <p>{userData.username}</p>
          </div>

          <div className="settings-field">
            <label>Email</label>
            <p>{userData.email}</p>
          </div>

          <div className="settings-field">
            <label>Password</label>
            <p>••••••••</p>
          </div>
        </div>

        <div className="settings-card danger-zone">
          <h3>Danger Zone</h3>
          <p>Once you delete your account, there is no going back. Please be certain.</p>

          {!showDeleteConfirm ? (
            <button onClick={() => setShowDeleteConfirm(true)}>Delete Account</button>
          ) : (
            <div className="confirm-box">
              <p>Are you sure? This cannot be undone.</p>
              <button onClick={handleDeleteAccount}>Yes, delete my account</button>
              <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;