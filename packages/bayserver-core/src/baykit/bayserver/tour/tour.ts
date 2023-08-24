import {Reusable} from "../util/Reusable";
import {InboundShip} from "../docker/base/inboundShip";
import {Counter} from "../util/counter";
import {Town} from "../docker/town";
import {City} from "../docker/city";
import {Club} from "../docker/club";
import {TourReq} from "./tourReq";
import {TourRes} from "./tourRes";
import {HttpException} from "../httpException";
import {Sink} from "../sink";
import {BayLog} from "../bayLog";
import {BayServer} from "../bayserver";
import {HttpStatus} from "../util/httpStatus";

export class Tour implements Reusable{

    static readonly STATE_UNINITIALIZED: number = 0;
    static readonly STATE_PREPARING: number = 1;
    static readonly STATE_RUNNING: number = 2;
    static readonly STATE_ABORTED: number = 3;
    static readonly STATE_ENDED: number = 4;
    static readonly STATE_ZOMBIE : number= 5;

    static readonly TOUR_ID_NOCHECK: number = -1;
    static readonly INVALID_TOUR_ID: number = 0;

    ship: InboundShip;
    shipId: number;
    readonly objectId: number; // object id
    static readonly oidCounter: Counter = new Counter();
    static readonly idCounter: Counter = new Counter();

    tourId: number; // tour id
    errorHandling: boolean;
    town: Town;
    city: City;
    club: Club;

    req: TourReq = new TourReq(this);
    res: TourRes = new TourRes(this);

    interval: number;
    isSecure: boolean;
    state: number = Tour.STATE_UNINITIALIZED;

    error: HttpException;

    constructor()  {
        this.objectId = Tour.oidCounter.next();
    }

    public init(key: number, sip: InboundShip) {
        if(this.isInitialized())
            throw new Sink(this.ship + " Tour already initialized: " + this);

        this.ship = sip;
        this.shipId = sip.id();
        this.tourId = Tour.idCounter.next();
        this.req.key = key;

        this.req.init(key);
        this.res.init();

        this.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_PREPARING);
        BayLog.debug(this + " initialized");
    }

    toString(): string {
        return this.ship + " tour#" + this.tourId + "/" + this.objectId + "[key=" + this.req.key + "]";
    }
    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////
    reset() {
        BayLog.trace("%s reset", this);
        this.req.reset();
        this.res.reset();
        this.city = null;
        this.town = null;
        this.club = null;
        this.errorHandling = false;

        this.tourId = Tour.INVALID_TOUR_ID;

        this.interval = 0;
        this.isSecure = false;
        //BayLog.trace("%s reset running false", this);
        this.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_UNINITIALIZED);
        this.error = null;

        this.ship = null;
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////
    id(): number {
        return this.tourId;
    }

    go() {
        let city = this.ship.portDocker.findCity(this.req.reqHost);
        if(city == null)
            city = BayServer.findCity(this.req.reqHost);

        this.changeState(Tour.TOUR_ID_NOCHECK, Tour.STATE_RUNNING);

        BayLog.debug("%s GO TOUR! ...( ^_^)/: city=%s url=%s", this, this.req.reqHost, this.req.uri);

        if (city == null) {
            throw new HttpException(HttpStatus.NOT_FOUND, this.req.uri);
        }
        else {
            try {
                city.enter(this);
            }
            catch(e) {
                if(e instanceof HttpException)
                    throw e;
                else if(e instanceof Sink)
                    throw e;
                else {
                    BayLog.error_e(e)
                    throw new HttpException(HttpStatus.INTERNAL_SERVER_ERROR, e.message);
                }
            }
        }
    }

    isValid(): boolean {
        return this.state == Tour.STATE_PREPARING || this.state == Tour.STATE_RUNNING;
    }

    isPreparing(): boolean {
        return this.state == Tour.STATE_PREPARING;
    }

    isRunning(): boolean {
        return this.state == Tour.STATE_RUNNING;
    }

    isAborted(): boolean {
        return this.state == Tour.STATE_ABORTED;
    }

    isZombie(): boolean {
        return this.state == Tour.STATE_ZOMBIE;
    }

    isEnded(): boolean {
        return this.state == Tour.STATE_ENDED;
    }

    isInitialized(): boolean {
        return this.state != Tour.STATE_UNINITIALIZED;
    }

    changeState(checkId: number, newState: number) {
        BayLog.trace("%s change state: %s", this, newState);
        this.checkTourId(checkId);
        this.state = newState;
    }

    checkTourId(checkId: number) {
        if(checkId == Tour.TOUR_ID_NOCHECK)
            return;

        if(!this.isInitialized()) {
            throw new Sink("%s Tour not initialized", this);
        }

        if(checkId != this.tourId) {
            throw new Sink("%s Invalid tour id : %d", this, this.tourId);
        }
    }
}