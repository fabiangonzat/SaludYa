import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from '../../services/auth.service';

export function roleGuard(...allowedRoles: UserRole[]): CanActivateFn {
  return async () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    await auth.waitForInitialization();

    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/login']);
    }

    const role = auth.userRole();
    if (role && allowedRoles.includes(role)) {
      return true;
    }

    // Redirigir al dashboard adecuado según el rol real
    if (role === 'doctor') return router.createUrlTree(['/doctor']);
    if (role === 'admin') return router.createUrlTree(['/admin']);
    return router.createUrlTree(['/inicio']);
  };
}
