import React from 'react';

/**
 * ProtectedRoute — renders children only if the signed-in user has an allowed role.
 * Props:
 *   user         — the user object from state (null if not logged in)
 *   allowedRoles — array of role strings that may access this route
 *   children     — content to render when access is granted
 *   onDeny       — optional callback when access is denied (e.g. redirect to login)
 */
export default function ProtectedRoute({ user, allowedRoles, children, onDeny }) {
  if (!user) {
    if (onDeny) onDeny();
    return <p className="feedback error">You must be signed in to view this page.</p>;
  }
  if (!allowedRoles.includes(user.role)) {
    return <p className="feedback error">Access denied. You do not have permission to view this page.</p>;
  }
  return children;
}

