import {Barge} from "../docker/barge";

export class Barges {

    /** Default barge docker */
    private anyBarge: Barge

    /** Barge dockers */
    barges: Barge[] = []

    add(b: Barge): void {
        if (b.getName() == "*")
            this.anyBarge = b
        else
            this.barges.push(b)
    }

    findBarge(path: string): Barge {
        // Check exact match
        for (const b of this.barges) {
            if (this.match(b, path))
                return b
        }

        return this.anyBarge
    }

    private match(b: Barge, path: string): boolean {
        return true
    }
}
