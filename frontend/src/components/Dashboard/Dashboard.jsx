// src/components/Dashboard/Dashboard.jsx
import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { logout } from '../../store/authSlice'; // Adjust path if needed
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  // Get user information from the Redux store
  const { user } = useSelector((state) => state.auth);

  const handleLogout = () => {
    dispatch(logout());
    // Navigate to login page after logout
    navigate('/login');
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h1>Личный кабинет</h1>
      {user ? (
        <p>Добро пожаловать, {user.first_name || user.email}!</p>
      ) : (
        <p>Загрузка данных пользователя...</p>
      )}
      <p>Это ваша защищенная панель управления.</p>
      {/* Add links or content for the dashboard sections here later */}
      <ul>
        <li><a href="#bookings">Мои бронирования (ссылка пока не работает)</a></li>
        <li><a href="#profile">Профиль (ссылка пока не работает)</a></li>
        {/* ... other dashboard links */}
      </ul>

      <button
        onClick={handleLogout}
        style={{ marginTop: '2rem', padding: '0.5rem 1rem', cursor: 'pointer' }}
      >
        Выйти
      </button>
    </div>
  );
};

export default Dashboard;