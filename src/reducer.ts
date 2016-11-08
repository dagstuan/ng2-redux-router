import { Action } from 'redux';

import { UPDATE_LOCATION, ReduxRouterState } from './actions';

export interface RouterAction extends Action {
  payload: ReduxRouterState | string
}

export const DefaultRouterState: ReduxRouterState = { location: '' };



export function routerReducer(state:ReduxRouterState = DefaultRouterState, action: RouterAction): ReduxRouterState {
  switch (action.type) {
    case UPDATE_LOCATION:
      if(typeof action.payload === 'string') {
        return {
          location: action.payload
        };
      } else {
        return action.payload || DefaultRouterState;
      }
    default:
      return state;
  }
}
