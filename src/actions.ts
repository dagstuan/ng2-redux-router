import { NavigationExtras } from '@angular/router';

export const UPDATE_LOCATION: string = "ng2-redux-router::UPDATE_LOCATION";

export interface ReduxRouterState {
  location: string,
  extras?: NavigationExtras
}
