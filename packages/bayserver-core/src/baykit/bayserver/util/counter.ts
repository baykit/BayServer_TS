export class Counter {
    private counter: number;

    constructor(initial: number = 1) {
        this.counter = initial;
    }

    public next(): number {
        return this.counter++;
    }
}