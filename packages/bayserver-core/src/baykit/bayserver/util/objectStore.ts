import {Reusable} from "./Reusable";
import {ObjectFactory} from "./objectFactory";
import {BayLog} from "../bayLog";
import {Sink} from "../sink";
import {ArrayUtil} from "./arrayUtil";
import {StrUtil} from "./strUtil";

export class ObjectStore<T extends Reusable> implements Reusable {

    public freeList: T[] = []
    public activeList: T[] = []
    public factory: () => T;

    public constructor(factory: any=null) {
        this.factory = factory
    }

    //////////////////////////////////////////////////////
    // Implements Reusable
    //////////////////////////////////////////////////////
    reset() {
        if (this.activeList.length > 0) {
            BayLog.error("BUG?: There are %d active objects: %s", this.activeList.length, this.activeList);
            // for security
            this.freeList = []
            this.activeList = []
        }
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
        this.activeList.push(obj);
        BayLog.trace("%s rent object : %s free=%s", this, obj, this.freeList);
        return obj;
    }

    public Return(obj: T, reuse: boolean = true) {
        BayLog.trace("%s return object : %s free=%s", this, obj, this.freeList);
        if(this.freeList.includes(obj))
            throw new Sink("This object already returned: " + obj);

        if(!this.activeList.includes(obj))
            throw new Sink("This object is not active: " + obj);

        if(ArrayUtil.remove(obj, this.activeList).length == 0)
            throw new Sink("Cannot remove object: " + obj)

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
        BayLog.info("%sactive list: %d", StrUtil.indent(indent), this.activeList.length);
        if(BayLog.isDebug()) {
            for(const obj of this.activeList) {
                BayLog.debug("%s%s", StrUtil.indent(indent+1), obj);
            }
        }
    }
}