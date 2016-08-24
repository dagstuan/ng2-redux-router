import 'rxjs/add/operator/filter';
import 'rxjs/add/operator/map';
import { Injectable, ApplicationRef } from '@angular/core';
import { Location } from '@angular/common';
import { Router, NavigationEnd, NavigationCancel, DefaultUrlSerializer } from '@angular/router';
import { NgRedux } from 'ng2-redux';
import { AnonymousSubscription } from 'rxjs/subscription';
import { Observable } from 'rxjs/Observable';
import { UPDATE_LOCATION } from './actions';
import {
  RouterAction,
  DefaultRouterState
} from './reducer';

@Injectable()
export class NgReduxRouter {
  private isTimeTravelling: boolean;
  private currentLocation: string;
  private initialLocation: string;

  private selectLocationFromState = (state) => state.router;
  private urlState : Observable<string> = null;

  private stateObserver: AnonymousSubscription = null;
  private urlStateObserver: AnonymousSubscription = null;

  constructor(
    private router: Router,
    private ngRedux: NgRedux<any>,
    private applicationRef: ApplicationRef,
    private location: Location
  ) {
  }

  destroy() {
    if (this.stateObserver) {
      /**
       * this .complete business is kind of odd.  In theory unsubscribe should
       * work.  In practice I needed to call a .complete :/
       *
       * Is it possible this is not an AnonymousSubscription?
       */
      if ((<any>this.stateObserver).complete) {
        (<any>this.stateObserver).complete();
      }
      this.stateObserver.unsubscribe();
      this.stateObserver = null;
    }
    if (this.urlStateObserver) {
      this.urlStateObserver.unsubscribe();
      this.urlStateObserver = null;
    }
  }

  initialize(
    selectLocationFromState: (state: any) => Router = (state) => state.router,
    routerState$: Observable<string> = undefined
  ) {
    this.selectLocationFromState = selectLocationFromState

    this.urlState = routerState$ || this.getDefaultUrlStateObservable();

    this.listenToRouterChanges();
    this.listenToReduxChanges();
  }

  destroy() {

  }

  getDefaultUrlStateObservable() {
    return this.router.events
             .filter(event => event instanceof NavigationEnd)
             .map(event => this.location.path())
             .distinctUntilChanged()
  }

  getState() {
    return this.ngRedux.getState();
  }

  getLocationFromStore(useInitial: boolean = false) {
    return this.selectLocationFromState(this.getState()) ||
      (useInitial ? this.initialLocation : '');
  }

  listenToRouterChanges() {
    const handleLocationChange = (location: string) => {
      if(this.isTimeTravelling) {
        // The promise of the router returns before the emit of changes...
        this.isTimeTravelling = false;
        return;
      }

      this.currentLocation = location;

      if (this.initialLocation === undefined) {
        this.initialLocation = location;

        let locationFromStore = this.getLocationFromStore();
        if(locationFromStore === this.currentLocation) {
          return;
        }
      }

      this.ngRedux.dispatch(<RouterAction>{
        type: UPDATE_LOCATION,
        payload: location
      });
    };

    if (!this.urlStateObserver) {
      this.urlStateObserver = this.urlState.subscribe(handleLocationChange);
    }
  }

  listenToReduxChanges() {
    const handleLocationChange = (location: string) => {
      if (this.initialLocation === undefined) {
        // Wait for router to set initial location.
        return;
      }

      let locationInStore = this.getLocationFromStore(true);
      if (this.currentLocation === locationInStore) {
        return;
      }

      this.isTimeTravelling = true;
      this.currentLocation = location
      this.router
        .navigateByUrl(location)
        .then(() => {
          // Apparently navigating by url doesn't trigger Angular's change detection,
          // Need to do this manually then via ApplicationRef.
          this.applicationRef.tick();
        });
    }

    if (!this.stateObserver) {
      this.stateObserver = this.ngRedux
        .select(state => this.selectLocationFromState(state))
        .distinctUntilChanged()
        .subscribe(handleLocationChange);
    }
  }
}
