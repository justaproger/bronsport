// src/components/Auth/GoogleLoginButton.jsx
import React from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useDispatch } from 'react-redux';
import apiClient from '../../services/api'; // Import your api client
import { login } from '../../store/authSlice'; // We can reuse the login fulfilled logic
import { useNavigate } from "react-router-dom";

const GoogleLoginButton = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate(); // Assuming you might want to navigate

  const handleGoogleLoginBackend = async (googleIdToken) => {
    try {
      // Send the Google ID token to your backend endpoint
      const response = await apiClient.post('/auth/google/', {
        access_token: googleIdToken, // dj-rest-auth expects the ID token as 'access_token'
      });

      console.log("Backend Google Login Response:", response.data);

      // Backend should return your API's access and refresh tokens
      const { access_token, refresh_token, user } = response.data; // Adjust keys based on dj-rest-auth response

      if (access_token && refresh_token && user) {
        // Store tokens
        localStorage.setItem('accessToken', access_token);
        localStorage.setItem('refreshToken', refresh_token);

        // Update Redux state manually or dispatch a specific action
        // Here we reuse parts of the login fulfilled logic idea
         dispatch({
            type: 'auth/login/fulfilled', // Manually dispatch fulfilled action type
            payload: { user: user, tokens: { access: access_token, refresh: refresh_token } }
        });

        // Navigate to dashboard or desired page
        // navigate('/dashboard'); // Already handled by useEffect in Login/Register probably

      } else {
          // Handle cases where backend didn't return expected tokens/user
          console.error("Backend did not return expected tokens/user data after Google login");
          alert("Login failed after Google authentication. Please try again.");
      }

    } catch (error) {
      console.error('Backend Google Login Error:', error.response?.data || error.message);
      alert(`Login failed: ${error.response?.data?.detail || error.message || 'Unknown error'}`);
      // Optional: Dispatch a failure action to update Redux state
      // dispatch({ type: 'auth/login/rejected', payload: error.response?.data || 'Google login backend failed' });
    }
  };


  const handleSuccess = (credentialResponse) => {
    console.log("Google Frontend Success:", credentialResponse);
    if (credentialResponse.credential) {
      // Send the ID token to the backend
      handleGoogleLoginBackend(credentialResponse.credential);
    } else {
        console.error("No credential received from Google.");
        alert("Google Login Failed (No credential). Please try again.");
    }
  };

  const handleError = () => {
    console.error('Google Login Failed on Frontend');
    alert('Google Login Failed. Please try again.');
  };

  return (
    <GoogleLogin
      onSuccess={handleSuccess}
      onError={handleError}
      // theme="outline" // Example customization
       size="large"
       width="300px" // Example customization
    />
  );
};

export default GoogleLoginButton;