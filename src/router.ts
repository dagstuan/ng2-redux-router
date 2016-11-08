import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import { Injectable, ApplicationRef } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd, NavigationCancel, DefaultUrlSerializer, NavigationExtras } from '@angular/router';
import { NgRedux } from 'ng2-redux';
import { Observable } from 'rxjs/Observable';
import { ISubscription } from 'rxjs/Subscription'
import { UPDATE_LOCATION, ReduxRouterState } from './actions';
import {
  RouterAction,
  DefaultRouterState
} from './reducer';

@Injectable()
export class NgReduxRouter {
  private initialized = false;
  private currentLocation: string;
  private initialLocation: string;

  private selectState: (state) => ReduxRouterState = (state) => state.router;
  private urlState: Observable<ReduxRouterState>;

  private urlStateSubscription: ISubscription;
  private reduxSubscription: ISubscription;

  constructor(
    private router: Router,
    private ngRedux: NgRedux<any>,
    private applicationRef: ApplicationRef,
    private location: Location
  ) {}

  /**
   * Destroys the bindings between ng2-redux and @angular/router.
   * This method unsubscribes from both ng2-redux and @angular router, in case
   * your app needs to tear down the bindings without destroying Angular or Redux
   * at the same time.
   */
  destroy() {
    if (this.urlStateSubscription) {
      this.urlStateSubscription.unsubscribe();
    }

    if (this.reduxSubscription) {
      this.reduxSubscription.unsubscribe();
    }

    this.initialized = false;
  }

  /**
   * Initialize the bindings between ng2-redux and @angular/router
   *
   * This should only be called once for the lifetime of your app, for
   * example in the constructor of your root component.
   *
   *
   * @param {(state: any) => ReduxRouterState} selectState Optional: If your
   * router state is in a custom location, supply this argument to tell the
   * bindings where to find the router location in the state.
   * @param {Observable<string>} urlState$ Optional: If you have a custom setup
   * when listening to router changes, or use a different router than @angular/router
   * you can supply this argument as an Observable of the current url state.
   */
  initialize(
    selectState: (state: any) => ReduxRouterState = (state) => state.router,
    urlState$: Observable<ReduxRouterState> = undefined
  ) {
    if (this.initialized) {
      throw new Error('ng2-redux-router already initialized! If you meant to re-initialize, call destroy first.');
    }

    this.selectState = selectState

    this.urlState = urlState$ || this.getDefaultUrlStateObservable();

    this.listenToRouterChanges();
    this.listenToReduxChanges();
    this.initialized = true;
  }

  private getDefaultUrlStateObservable() {
    return this.router.events
             .filter(event => event instanceof NavigationEnd)
             .map(event => ({
               location: this.location.path()
              }))
             .distinctUntilChanged()
  }

  private getLocationFromStore(useInitial: boolean = false) {
    return this.selectState(this.ngRedux.getState()).location ||
      (useInitial ? this.initialLocation : '');
  }

  private listenToRouterChanges() {
    const handleLocationChange = (state: ReduxRouterState) => {
      
      const location = state.location;
      const extras = state.extras;

      if(this.currentLocation === location || (state.extras && state.extras.skipLocationChange)) {
        // Dont dispatch changes if we haven't changed location.
        // If we've changed location but don't want a location change, update internal location
        this.currentLocation = location;
        return;
      }

      this.currentLocation = location;
      if (this.initialLocation === undefined) {
        this.initialLocation = location;

        // Fetch initial location from store and make sure
        // we dont dispath an event if the current url equals
        // the initial url.
        let locationFromStore = this.getLocationFromStore();
        if(locationFromStore === this.currentLocation) {
          return;
        }
      }

      this.ngRedux.dispatch(<RouterAction>{
        type: UPDATE_LOCATION,
        payload: {
          location:location,
          extras: extras
        }
      });
    }

    this.urlStateSubscription = this.urlState.subscribe(handleLocationChange);
  }

  private listenToReduxChanges() {
    const handleLocationChange = (state: ReduxRouterState) => {

      if (this.initialLocation === undefined) {
        // Wait for router to set initial location.
        return;
      }

      let locationInStore = this.getLocationFromStore(true);
      if (this.currentLocation === locationInStore) {
        // Dont change router location if its equal to the one in the store.
        return;
      }

      this.currentLocation = state.location;
      this.router.navigateByUrl(state.location, state.extras);
    }

    this.reduxSubscription = this.ngRedux
      .select(state => this.selectState(state))
      .distinctUntilChanged()
      .subscribe(handleLocationChange);
  }
}
