import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export function useAuth() {
  const { user, token, isLoading, login, register, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return {
    user,
    token,
    isLoading,
    isAuthenticated: !!token && !!user,
    isAdmin: user?.role === 'admin',
    login,
    register,
    logout: handleLogout,
  };
}
