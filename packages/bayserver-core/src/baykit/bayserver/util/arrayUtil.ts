export class ArrayUtil {
    public static empty(a: any[]): boolean {
        return a.length == 0
    }

    public static remove<T>(obj: T, array: T[]): T[] {
        let idx = array.findIndex(value => value === obj)
        if(idx >= 0)
            return array.splice(idx, 1)
        else
            return []
    }

    public static removeAt<T>(idx: number, array: T[]) {
        array.splice(idx, 1)
    }

    public static valueIn<T>(obj: T, array: T[]) {
        return array.findIndex(value => value === obj) >= 0
    }
}