import {Reusable} from "./Reusable";
import {ObjectFactory} from "./objectFactory";
import {BayLog} from "../bayLog";
import {Sink} from "../sink";
import {ArrayUtil} from "./arrayUtil";
import {StrUtil} from "./strUtil";

export class ObjectStore<T extends Reusable> implements Reusable {

    public freeList: T[] = []
    //public activeList: T[] = []
    public factory: () => T;

    public constructor(factory: any=null) {
        this.factory = factory
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////
    reset() {
        this.freeList = []
    }

    //////////////////////////////////////////////////////
    // Other methods
    //////////////////////////////////////////////////////

    public rent(): T {
        var obj: T;

        if(this.freeList.length == 0) {
            obj = this.factory()
        }
        else {
            obj = this.freeList.pop();
        }
        if(obj == null)
            throw new Sink();
        //this.activeList.push(obj);
        return obj;
    }

    public Return(obj: T, reuse: boolean = true) {
        //if(this.freeList.includes(obj))
        //    throw new Sink("This object already returned: " + obj);
        //if(!this.activeList.includes(obj))
        //    throw new Sink("This object is not active: " + obj);
        //ArrayUtil.remove(obj, this.activeList)

        if(reuse) {
            this.freeList.push(obj);
            obj.reset();
        }
    }

    /**
     * print memory usage
     */
    public printUsage(indent: number) {
        BayLog.info("%sfree list: %d", StrUtil.indent(indent), this.freeList.length);
    }
}