import { Route } from '@angular/router';
import { AdminLayoutComponent } from './layout/admin-layout.component';

export const appRoutes: Route[] = [
  {
    path: '',
    component: AdminLayoutComponent,
    children: [
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'sdui-builder',
        loadComponent: () =>
          import('./pages/sdui-builder/sdui-builder.component').then(
            (m) => m.SduiBuilderComponent,
          ),
      },
    ],
  },
];
