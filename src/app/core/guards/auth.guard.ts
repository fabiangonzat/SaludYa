import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  await auth.waitForInitialization();
  return auth.isLoggedIn() ? true : inject(Router).createUrlTree(['/login']);
};
