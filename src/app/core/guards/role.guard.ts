import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, UserRole } from '../../services/auth.service';

export function roleGuard(...allowedRoles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.isLoggedIn()) {
      return router.createUrlTree(['/login']);
    }

    const role = auth.userRole();
    if (role && allowedRoles.includes(role)) {
      return true;
    }

    // Redirigir al dashboard adecuado según el rol real
    return router.createUrlTree(['/inicio']);
  };
}
